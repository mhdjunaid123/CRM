from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging
import uuid
import hashlib
import secrets
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
import httpx
from html import escape
from urllib.parse import urlparse

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from bson import ObjectId

# ---------------------------------------------------------------------------
# App / DB setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
LOGO_PATH = ROOT_DIR / "assets" / "logo.png"

EMAIL_BASE_URL = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip().rstrip("/") or "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "MARKLENCEMEDIA"


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "email": email, "ver": token_version,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "ver": token_version,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Session expired")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Brute force + password reset email
# ---------------------------------------------------------------------------
async def is_locked_out(identifier: str) -> bool:
    doc = await db.login_attempts.find_one({"identifier": identifier})
    if not doc:
        return False
    if doc.get("count", 0) >= 5:
        last = doc.get("last_attempt")
        if last:
            last_dt = datetime.fromisoformat(last)
            if datetime.now(timezone.utc) - last_dt < timedelta(minutes=15):
                return True
    return False


async def record_failed_attempt(identifier: str, email: str):
    await db.login_attempts.update_one(
        {"identifier": identifier},
        {"$inc": {"count": 1}, "$set": {"email": email, "last_attempt": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def clear_attempts(identifier: str):
    await db.login_attempts.delete_many({"identifier": identifier})


async def send_password_reset_email(to_email: str, token: str) -> bool:
    base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    link = f"{base}/reset-password?token={token}"
    if not EMAIL_KEY or EMAIL_KEY.startswith("{") or not base.startswith("https://"):
        if urlparse(base).hostname in ("localhost", "127.0.0.1", "::1"):
            logger.warning("Email not configured; password reset link: %s", link)
        else:
            logger.error("Password reset email not configured (EMERGENT_EMAIL_KEY / FRONTEND_URL)")
        return False
    brand = escape(EMAIL_FROM_NAME)
    html = (
        f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif">'
        f'<p>We received a request to reset your {brand} password.</p>'
        f'<p><a href="{escape(link)}">Reset your password</a></p>'
        f'<p>This link expires in 1 hour and can be used once. If you did not request it, ignore this email.</p>'
        f'<p style="font-size:12px;color:#888">Sent by {brand}. We never ask for your password by email.</p>'
        f'</td></tr></table>'
    )
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                headers={"X-Email-Key": EMAIL_KEY},
                                json={"to": [to_email], "subject": f"Reset your {EMAIL_FROM_NAME} password",
                                      "html": html, "from_name": EMAIL_FROM_NAME})
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Password reset email failed: {e}")
        return False


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


async def next_invoice_number() -> str:
    doc = await db.counters.find_one_and_update(
        {"_id": "invoice"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    seq = doc["seq"] if doc and "seq" in doc else 1
    return f"INV-{seq:03d}"


def add_months(year: int, month: int, delta: int):
    idx = (year * 12 + (month - 1)) + delta
    return idx // 12, (idx % 12) + 1


MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December"]


def billing_month_label(bm: Optional[str]) -> Optional[str]:
    if not bm:
        return None
    try:
        y, m = bm.split("-")
        return f"{MONTH_NAMES[int(m) - 1]} {y}"
    except Exception:
        return bm


def compute_invoice_status(total: float, paid: float, due_date: Optional[str], manual: Optional[str]) -> str:
    if manual in ("CANCELLED", "DRAFT"):
        return manual
    balance = round(total - paid, 2)
    if total > 0 and balance <= 0:
        return "PAID"
    if due_date:
        try:
            due = datetime.fromisoformat(due_date)
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > due and balance > 0:
                return "OVERDUE"
        except Exception:
            pass
    if paid > 0:
        return "PARTIALLY PAID"
    return "PENDING"


async def log_activity(client_id: str, text: str, when: Optional[str] = None):
    await db.activities.insert_one({
        "id": new_id(), "client_id": client_id, "text": text,
        "date": when or now_iso(), "created_at": now_iso(),
    })


def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def enrich_invoice(inv: dict) -> dict:
    inv = clean(inv)
    total = float(inv.get("total_amount", 0) or 0)
    paid = float(inv.get("amount_paid", 0) or 0)
    inv["balance"] = round(total - paid, 2)
    inv["status"] = compute_invoice_status(total, paid, inv.get("due_date"), inv.get("status"))
    inv["billing_month_label"] = billing_month_label(inv.get("billing_month"))
    return inv


async def recompute_invoice(invoice_id: str):
    inv = await db.invoices.find_one({"id": invoice_id})
    if not inv:
        return
    agg = await db.payments.aggregate([
        {"$match": {"invoice_id": invoice_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    paid = float(agg[0]["total"]) if agg else 0.0
    total = float(inv.get("total_amount", 0) or 0)
    manual = inv.get("status")
    status = compute_invoice_status(total, paid, inv.get("due_date"), manual)
    await db.invoices.update_one({"id": invoice_id},
                                 {"$set": {"amount_paid": paid, "balance": round(total - paid, 2), "status": status}})


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = "User"


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str


class ClientIn(BaseModel):
    client_name: str
    business_name: Optional[str] = ""
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""
    email: Optional[str] = ""
    business_category: Optional[str] = ""
    location: Optional[str] = ""
    website: Optional[str] = ""
    lead_source: Optional[str] = ""
    status: str = "ACTIVE"
    start_date: Optional[str] = None
    exit_date: Optional[str] = None
    exit_reason: Optional[str] = ""
    notes: Optional[str] = ""


class ExitIn(BaseModel):
    exit_date: Optional[str] = None
    exit_reason: Optional[str] = ""
    notes: Optional[str] = ""


class ServiceIn(BaseModel):
    client_id: str
    service_name: str
    service_type: str = "PROJECT"
    billing_type: str = "ONE-TIME"
    price: float = 0
    start_date: Optional[str] = None
    expected_completion_date: Optional[str] = None
    actual_completion_date: Optional[str] = None
    status: str = "ACTIVE"
    recurring_enabled: bool = False
    invoice_day: Optional[int] = 1
    notes: Optional[str] = ""


class ServiceUpdate(BaseModel):
    service_name: Optional[str] = None
    service_type: Optional[str] = None
    billing_type: Optional[str] = None
    price: Optional[float] = None
    start_date: Optional[str] = None
    expected_completion_date: Optional[str] = None
    actual_completion_date: Optional[str] = None
    status: Optional[str] = None
    recurring_enabled: Optional[bool] = None
    invoice_day: Optional[int] = None
    notes: Optional[str] = None


class InvoiceIn(BaseModel):
    client_id: str
    service_id: str
    billing_month: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    description: Optional[str] = ""
    subtotal: float = 0
    discount: float = 0
    tax: float = 0
    status: str = "PENDING"
    notes: Optional[str] = ""


class InvoiceUpdate(BaseModel):
    billing_month: Optional[str] = None
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    description: Optional[str] = None
    subtotal: Optional[float] = None
    discount: Optional[float] = None
    tax: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PaymentIn(BaseModel):
    invoice_id: str
    amount: float
    payment_date: Optional[str] = None
    payment_method: str = "UPI"
    notes: Optional[str] = ""


class LeadIn(BaseModel):
    business_name: str
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    potential_service: Optional[str] = ""
    expected_value: float = 0
    lead_source: Optional[str] = ""
    stage: str = "NEW LEAD"
    notes: Optional[str] = ""


class LeadUpdate(BaseModel):
    business_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    potential_service: Optional[str] = None
    expected_value: Optional[float] = None
    lead_source: Optional[str] = None
    stage: Optional[str] = None
    notes: Optional[str] = None


class SettingsIn(BaseModel):
    agency_name: Optional[str] = None
    currency: Optional[str] = None
    user_name: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {"email": email, "password_hash": hash_password(body.password), "name": body.name or "User",
           "role": "user", "token_version": 0, "created_at": now_iso()}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    set_auth_cookies(response, create_access_token(uid, email, 0), create_refresh_token(uid, 0))
    return {"id": uid, "email": email, "name": doc["name"], "role": doc["role"]}


@api_router.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    if await is_locked_out(identifier):
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await record_failed_attempt(identifier, email)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await clear_attempts(identifier)
    uid = str(user["_id"])
    ver = user.get("token_version", 0)
    set_auth_cookies(response, create_access_token(uid, email, ver), create_refresh_token(uid, ver))
    return {"id": uid, "email": email, "name": user.get("name", "User"), "role": user.get("role", "user")}


@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["_id"], "email": user["email"], "name": user.get("name", "User"), "role": user.get("role", "user")}


@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Session expired")
        uid = str(user["_id"])
        access = create_access_token(uid, user["email"], user.get("token_version", 0))
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=900, path="/")
        return {"message": "refreshed"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn, background_tasks: BackgroundTasks):
    email = body.email.lower()
    generic = {"message": "If that email is registered, a reset link has been sent."}
    await db.password_reset_requests.insert_one({"email": email, "created_at": now_iso()})
    window = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    count = await db.password_reset_requests.count_documents({"email": email, "created_at": {"$gt": window}})
    if count > 5:
        return generic
    total = await db.password_reset_requests.count_documents({"created_at": {"$gt": (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()}})
    if total > 10:
        return generic
    user = await db.users.find_one({"email": email})
    if not user:
        return generic
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "user_id": str(user["_id"]), "email": email,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1), "used": False,
    })
    background_tasks.add_task(send_password_reset_email, user["email"], token)
    return generic


@api_router.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    h = hashlib.sha256(body.token.encode()).hexdigest()
    doc = await db.password_reset_tokens.find_one_and_update(
        {"token_hash": h, "used": False, "expires_at": {"$gt": datetime.now(timezone.utc)}},
        {"$set": {"used": True}})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    email = doc["email"]
    await db.users.update_one({"_id": ObjectId(doc["user_id"])},
                              {"$set": {"password_hash": hash_password(body.password)}, "$inc": {"token_version": 1}})
    await db.password_reset_tokens.delete_many({"user_id": doc["user_id"], "used": False})
    await db.login_attempts.delete_many({"email": email})
    return {"message": "Password reset successful"}


# ---------------------------------------------------------------------------
# Settings + logo
# ---------------------------------------------------------------------------
async def get_settings_doc():
    s = await db.settings.find_one({"id": "app"})
    if not s:
        s = {"id": "app", "agency_name": "MARKLENCEMEDIA Advertising & Ad Agency", "currency": "INR"}
        await db.settings.insert_one(dict(s))
    return clean(s)


@api_router.get("/settings")
async def read_settings(user: dict = Depends(get_current_user)):
    return await get_settings_doc()


@api_router.put("/settings")
async def update_settings(body: SettingsIn, user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.settings.update_one({"id": "app"}, {"$set": updates}, upsert=True)
    return await get_settings_doc()


@api_router.get("/logo")
async def get_logo():
    if LOGO_PATH.exists():
        return FileResponse(str(LOGO_PATH), media_type="image/png")
    raise HTTPException(status_code=404, detail="Logo not found")


# ---------------------------------------------------------------------------
# Client summary helper
# ---------------------------------------------------------------------------
async def client_summary(client_id: str) -> dict:
    services = await db.services.find({"client_id": client_id}).to_list(1000)
    invoices = await db.invoices.find({"client_id": client_id}).to_list(2000)
    payments = await db.payments.find({"client_id": client_id}).to_list(5000)
    active_services = sum(1 for s in services if s.get("status") in ("ACTIVE", "IN PROGRESS"))
    completed_projects = sum(1 for s in services if s.get("service_type") == "PROJECT" and s.get("status") == "COMPLETED")
    total_invoiced = sum(float(i.get("total_amount", 0) or 0) for i in invoices if i.get("status") not in ("CANCELLED", "DRAFT"))
    total_received = sum(float(p.get("amount", 0) or 0) for p in payments)
    monthly_recurring = sum(float(s.get("price", 0) or 0) for s in services
                            if s.get("billing_type") == "MONTHLY" and s.get("status") == "ACTIVE")
    return {
        "active_services": active_services,
        "completed_projects": completed_projects,
        "total_invoiced": round(total_invoiced, 2),
        "total_received": round(total_received, 2),
        "total_outstanding": round(total_invoiced - total_received, 2),
        "monthly_recurring_value": round(monthly_recurring, 2),
        "num_services": len(services),
    }


# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------
@api_router.post("/clients")
async def create_client(body: ClientIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    if not doc.get("start_date"):
        doc["start_date"] = now_iso()
    await db.clients.insert_one(dict(doc))
    await log_activity(doc["id"], f"Client onboarded — {doc['client_name']}", doc["start_date"])
    return clean(doc)


@api_router.get("/clients")
async def list_clients(user: dict = Depends(get_current_user), search: str = "", status: str = ""):
    q = {}
    if status and status != "ALL":
        q["status"] = status
    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$or"] = [{"client_name": rx}, {"business_name": rx}, {"phone": rx}, {"email": rx}]
    clients = await db.clients.find(q).sort("created_at", -1).to_list(1000)
    out = []
    for c in clients:
        c = clean(c)
        summ = await client_summary(c["id"])
        c["num_services"] = summ["num_services"]
        c["total_invoiced"] = summ["total_invoiced"]
        c["total_outstanding"] = summ["total_outstanding"]
        out.append(c)
    return out


@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, user: dict = Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id})
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    c = clean(c)
    c["summary"] = await client_summary(client_id)
    return c


@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, body: ClientIn, user: dict = Depends(get_current_user)):
    existing = await db.clients.find_one({"id": client_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")
    updates = body.model_dump()
    await db.clients.update_one({"id": client_id}, {"$set": updates})
    c = await db.clients.find_one({"id": client_id})
    return clean(c)


@api_router.post("/clients/{client_id}/exit")
async def exit_client(client_id: str, body: ExitIn, user: dict = Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id})
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    updates = {"status": "EXITED", "exit_date": body.exit_date or now_iso(),
               "exit_reason": body.exit_reason or "", "exit_notes": body.notes or ""}
    await db.clients.update_one({"id": client_id}, {"$set": updates})
    await log_activity(client_id, f"Client marked as EXITED — {body.exit_reason or 'No reason'}", updates["exit_date"])
    c = await db.clients.find_one({"id": client_id})
    return clean(c)


@api_router.get("/clients/{client_id}/services")
async def client_services(client_id: str, user: dict = Depends(get_current_user)):
    services = await db.services.find({"client_id": client_id}).sort("created_at", -1).to_list(1000)
    out = []
    for s in services:
        s = clean(s)
        invs = await db.invoices.find({"service_id": s["id"]}).to_list(1000)
        s["invoice_count"] = len(invs)
        out.append(s)
    return out


@api_router.get("/clients/{client_id}/invoices")
async def client_invoices(client_id: str, user: dict = Depends(get_current_user)):
    invs = await db.invoices.find({"client_id": client_id}).sort("invoice_date", -1).to_list(2000)
    return [await enrich_invoice(i) for i in invs]


@api_router.get("/clients/{client_id}/payments")
async def client_payments(client_id: str, user: dict = Depends(get_current_user)):
    pays = await db.payments.find({"client_id": client_id}).sort("payment_date", -1).to_list(5000)
    return [clean(p) for p in pays]


@api_router.get("/clients/{client_id}/activities")
async def client_activities(client_id: str, user: dict = Depends(get_current_user)):
    acts = await db.activities.find({"client_id": client_id}).sort("date", -1).to_list(2000)
    return [clean(a) for a in acts]


# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------
@api_router.post("/services")
async def create_service(body: ServiceIn, user: dict = Depends(get_current_user)):
    c = await db.clients.find_one({"id": body.client_id})
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    if not doc.get("start_date"):
        doc["start_date"] = now_iso()
    await db.services.insert_one(dict(doc))
    await log_activity(body.client_id, f"{doc['service_name']} started", doc["start_date"])
    if doc.get("status") == "COMPLETED" and doc.get("actual_completion_date"):
        await log_activity(body.client_id, f"{doc['service_name']} completed", doc["actual_completion_date"])
    return clean(doc)


@api_router.get("/services")
async def list_services(user: dict = Depends(get_current_user), status: str = "", service_type: str = "",
                        billing_type: str = "", client_id: str = ""):
    q = {}
    if status and status != "ALL":
        if status == "ACTIVE_VIEW":
            q["status"] = {"$in": ["ACTIVE", "IN PROGRESS"]}
        else:
            q["status"] = status
    if service_type and service_type != "ALL":
        q["service_type"] = service_type
    if billing_type and billing_type != "ALL":
        q["billing_type"] = billing_type
    if client_id:
        q["client_id"] = client_id
    services = await db.services.find(q).sort("created_at", -1).to_list(2000)
    out = []
    clients_cache = {}
    for s in services:
        s = clean(s)
        cid = s["client_id"]
        if cid not in clients_cache:
            cl = await db.clients.find_one({"id": cid})
            clients_cache[cid] = clean(cl) if cl else {}
        cl = clients_cache[cid]
        s["client_name"] = cl.get("client_name", "")
        s["business_name"] = cl.get("business_name", "")
        invs = await db.invoices.find({"service_id": s["id"]}).sort("billing_month", -1).to_list(1000)
        invs = [await enrich_invoice(i) for i in invs]
        s["invoices"] = invs
        # current bill = most recent invoice
        s["current_invoice"] = invs[0] if invs else None
        out.append(s)
    return out


@api_router.get("/services/{service_id}")
async def get_service(service_id: str, user: dict = Depends(get_current_user)):
    s = await db.services.find_one({"id": service_id})
    if not s:
        raise HTTPException(status_code=404, detail="Service not found")
    s = clean(s)
    invs = await db.invoices.find({"service_id": service_id}).sort("billing_month", 1).to_list(1000)
    s["invoices"] = [await enrich_invoice(i) for i in invs]
    return s


@api_router.put("/services/{service_id}")
async def update_service(service_id: str, body: ServiceUpdate, user: dict = Depends(get_current_user)):
    existing = await db.services.find_one({"id": service_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Service not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.services.update_one({"id": service_id}, {"$set": updates})
    s = await db.services.find_one({"id": service_id})
    if updates.get("status") == "COMPLETED" and existing.get("status") != "COMPLETED":
        await log_activity(s["client_id"], f"{s['service_name']} completed",
                           s.get("actual_completion_date") or now_iso())
    return clean(s)


@api_router.get("/services/{service_id}/invoices")
async def service_invoices(service_id: str, user: dict = Depends(get_current_user)):
    invs = await db.invoices.find({"service_id": service_id}).sort("billing_month", 1).to_list(1000)
    return [await enrich_invoice(i) for i in invs]


@api_router.post("/services/{service_id}/generate-next-invoice")
async def generate_next_invoice(service_id: str, user: dict = Depends(get_current_user)):
    s = await db.services.find_one({"id": service_id})
    if not s:
        raise HTTPException(status_code=404, detail="Service not found")
    if s.get("billing_type") != "MONTHLY":
        raise HTTPException(status_code=400, detail="Only monthly services support recurring invoices")
    existing = await db.invoices.find({"service_id": service_id}).sort("billing_month", -1).to_list(1)
    if existing and existing[0].get("billing_month"):
        y, m = existing[0]["billing_month"].split("-")
        ny, nm = add_months(int(y), int(m), 1)
    else:
        start = s.get("start_date") or now_iso()
        try:
            sd = datetime.fromisoformat(start)
        except Exception:
            sd = datetime.now(timezone.utc)
        ny, nm = sd.year, sd.month
    bm = f"{ny}-{nm:02d}"
    if await db.invoices.find_one({"service_id": service_id, "billing_month": bm}):
        raise HTTPException(status_code=400, detail=f"Invoice for {billing_month_label(bm)} already exists")
    day = s.get("invoice_day") or 1
    inv_date = datetime(ny, nm, min(max(day, 1), 28), tzinfo=timezone.utc)
    price = float(s.get("price", 0) or 0)
    inv = {
        "id": new_id(), "invoice_number": await next_invoice_number(),
        "client_id": s["client_id"], "service_id": service_id,
        "billing_month": bm, "invoice_date": inv_date.isoformat(),
        "due_date": (inv_date + timedelta(days=7)).isoformat(),
        "description": f"{s['service_name']} — {billing_month_label(bm)}",
        "subtotal": price, "discount": 0, "tax": 0, "total_amount": price,
        "amount_paid": 0, "balance": price, "status": "PENDING", "notes": "",
        "created_at": now_iso(),
    }
    await db.invoices.insert_one(dict(inv))
    await log_activity(s["client_id"], f"{billing_month_label(bm)} invoice created ({inv['invoice_number']}) for {s['service_name']}", inv_date.isoformat())
    return await enrich_invoice(inv)


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------
@api_router.post("/invoices")
async def create_invoice(body: InvoiceIn, user: dict = Depends(get_current_user)):
    s = await db.services.find_one({"id": body.service_id})
    if not s:
        raise HTTPException(status_code=404, detail="Service not found")
    subtotal = float(body.subtotal or 0)
    discount = float(body.discount or 0)
    tax = float(body.tax or 0)
    total = round(subtotal - discount + tax, 2)
    inv = body.model_dump()
    inv["id"] = new_id()
    inv["invoice_number"] = await next_invoice_number()
    inv["invoice_date"] = body.invoice_date or now_iso()
    inv["due_date"] = body.due_date or (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    inv["total_amount"] = total
    inv["amount_paid"] = 0
    inv["balance"] = total
    inv["created_at"] = now_iso()
    await db.invoices.insert_one(dict(inv))
    label = billing_month_label(inv.get("billing_month"))
    txt = f"Invoice {inv['invoice_number']} created" + (f" ({label})" if label else "") + f" for {s['service_name']}"
    await log_activity(body.client_id, txt, inv["invoice_date"])
    return await enrich_invoice(inv)


@api_router.get("/invoices")
async def list_invoices(user: dict = Depends(get_current_user), search: str = "", status: str = "",
                        client_id: str = ""):
    q = {}
    # NOTE: do not pre-filter on status in the DB — OVERDUE (and others) are computed
    # at read time via enrich_invoice, so we filter on the computed status below.
    if client_id:
        q["client_id"] = client_id
    if search:
        q["invoice_number"] = {"$regex": search, "$options": "i"}
    invs = await db.invoices.find(q).sort("invoice_date", -1).to_list(3000)
    out = []
    cache = {}
    for i in invs:
        e = await enrich_invoice(i)
        cid = e["client_id"]
        if cid not in cache:
            cl = await db.clients.find_one({"id": cid})
            cache[cid] = clean(cl) if cl else {}
        e["client_name"] = cache[cid].get("client_name", "")
        e["business_name"] = cache[cid].get("business_name", "")
        sv = await db.services.find_one({"id": e["service_id"]})
        e["service_name"] = clean(sv).get("service_name", "") if sv else ""
        out.append(e)
    # apply computed status filter too (overdue is computed)
    if status and status != "ALL":
        out = [i for i in out if i["status"] == status]
    return out


@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    i = await db.invoices.find_one({"id": invoice_id})
    if not i:
        raise HTTPException(status_code=404, detail="Invoice not found")
    e = await enrich_invoice(i)
    cl = await db.clients.find_one({"id": e["client_id"]})
    sv = await db.services.find_one({"id": e["service_id"]})
    e["client"] = clean(cl) if cl else {}
    e["service"] = clean(sv) if sv else {}
    e["payments"] = [clean(p) for p in await db.payments.find({"invoice_id": invoice_id}).sort("payment_date", -1).to_list(1000)]
    return e


@api_router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, body: InvoiceUpdate, user: dict = Depends(get_current_user)):
    existing = await db.invoices.find_one({"id": invoice_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    merged = {**existing, **updates}
    subtotal = float(merged.get("subtotal", 0) or 0)
    discount = float(merged.get("discount", 0) or 0)
    tax = float(merged.get("tax", 0) or 0)
    updates["total_amount"] = round(subtotal - discount + tax, 2)
    await db.invoices.update_one({"id": invoice_id}, {"$set": updates})
    await recompute_invoice(invoice_id)
    i = await db.invoices.find_one({"id": invoice_id})
    return await enrich_invoice(i)


@api_router.post("/invoices/{invoice_id}/mark-paid")
async def mark_paid(invoice_id: str, user: dict = Depends(get_current_user)):
    i = await db.invoices.find_one({"id": invoice_id})
    if not i:
        raise HTTPException(status_code=404, detail="Invoice not found")
    total = float(i.get("total_amount", 0) or 0)
    paid = float(i.get("amount_paid", 0) or 0)
    remaining = round(total - paid, 2)
    if remaining > 0:
        pay = {"id": new_id(), "invoice_id": invoice_id, "client_id": i["client_id"],
               "amount": remaining, "payment_date": now_iso(), "payment_method": "OTHER",
               "notes": "Marked as paid", "created_at": now_iso()}
        await db.payments.insert_one(dict(pay))
        await log_activity(i["client_id"], f"Payment received for {i['invoice_number']}", pay["payment_date"])
    await recompute_invoice(invoice_id)
    i = await db.invoices.find_one({"id": invoice_id})
    return await enrich_invoice(i)


@api_router.get("/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: str, user: dict = Depends(get_current_user)):
    i = await db.invoices.find_one({"id": invoice_id})
    if not i:
        raise HTTPException(status_code=404, detail="Invoice not found")
    e = await enrich_invoice(i)
    cl = clean(await db.clients.find_one({"id": e["client_id"]}) or {})
    sv = clean(await db.services.find_one({"id": e["service_id"]}) or {})
    settings = await get_settings_doc()
    pdf_bytes = build_invoice_pdf(e, cl, sv, settings)
    return StreamingResponse(iter([pdf_bytes]), media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{e["invoice_number"]}.pdf"'})


# ---------------------------------------------------------------------------
# PDF generation
# ---------------------------------------------------------------------------
def fmt_money(amount, currency="INR"):
    symbols = {"INR": "\u20b9", "USD": "$", "EUR": "\u20ac"}
    sym = symbols.get(currency, "\u20b9")
    try:
        return f"{sym}{float(amount):,.2f}"
    except Exception:
        return f"{sym}0.00"


def fmt_date_pdf(iso):
    if not iso:
        return "-"
    try:
        return datetime.fromisoformat(iso).strftime("%d %b %Y")
    except Exception:
        return iso


def build_invoice_pdf(inv, cl, sv, settings):
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.pdfgen import canvas as pdfcanvas
    from reportlab.lib.utils import ImageReader

    currency = settings.get("currency", "INR")
    GOLD = colors.HexColor("#E0B230")
    BLACK = colors.HexColor("#000000")
    WHITE = colors.white
    GRAY = colors.HexColor("#71717A")
    LIGHT = colors.HexColor("#F4F4F5")

    buf = BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    W, H = A4

    # Header black band
    c.setFillColor(BLACK)
    c.rect(0, H - 45 * mm, W, 45 * mm, fill=1, stroke=0)
    if LOGO_PATH.exists():
        try:
            c.drawImage(ImageReader(str(LOGO_PATH)), 15 * mm, H - 40 * mm, width=30 * mm, height=30 * mm,
                        preserveAspectRatio=True, mask='auto')
        except Exception:
            pass
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(50 * mm, H - 20 * mm, "MARKLENCEMEDIA")
    c.setFillColor(GOLD)
    c.setFont("Helvetica", 10)
    c.drawString(50 * mm, H - 26 * mm, "ADVERTISING & AD AGENCY")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 22)
    c.drawRightString(W - 15 * mm, H - 20 * mm, "INVOICE")
    c.setFont("Helvetica", 10)
    c.setFillColor(GOLD)
    c.drawRightString(W - 15 * mm, H - 27 * mm, inv.get("invoice_number", ""))

    y = H - 58 * mm
    # Bill To
    c.setFillColor(BLACK)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(15 * mm, y, "BILL TO")
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#333333"))
    c.drawString(15 * mm, y - 6 * mm, cl.get("client_name", ""))
    c.drawString(15 * mm, y - 11 * mm, cl.get("business_name", ""))
    if cl.get("phone"):
        c.drawString(15 * mm, y - 16 * mm, f"Phone: {cl.get('phone')}")
    if cl.get("email"):
        c.drawString(15 * mm, y - 21 * mm, f"Email: {cl.get('email')}")

    # Invoice meta right
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(BLACK)
    c.drawRightString(W - 40 * mm, y, "Invoice Date:")
    c.drawRightString(W - 40 * mm, y - 6 * mm, "Due Date:")
    if inv.get("billing_month_label"):
        c.drawRightString(W - 40 * mm, y - 12 * mm, "Billing Month:")
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#333333"))
    c.drawRightString(W - 15 * mm, y, fmt_date_pdf(inv.get("invoice_date")))
    c.drawRightString(W - 15 * mm, y - 6 * mm, fmt_date_pdf(inv.get("due_date")))
    if inv.get("billing_month_label"):
        c.drawRightString(W - 15 * mm, y - 12 * mm, inv.get("billing_month_label"))

    # Table header
    ty = y - 34 * mm
    c.setFillColor(BLACK)
    c.rect(15 * mm, ty, W - 30 * mm, 9 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * mm, ty + 2.7 * mm, "DESCRIPTION")
    c.drawRightString(W - 18 * mm, ty + 2.7 * mm, "AMOUNT")

    # Row
    ry = ty - 12 * mm
    c.setFillColor(colors.HexColor("#333333"))
    c.setFont("Helvetica", 10)
    desc = inv.get("description") or sv.get("service_name", "Service")
    c.drawString(18 * mm, ry + 3 * mm, desc[:70])
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(W - 18 * mm, ry + 3 * mm, fmt_money(inv.get("subtotal", 0), currency))
    c.setStrokeColor(LIGHT)
    c.line(15 * mm, ry, W - 15 * mm, ry)

    # Totals
    def total_row(label, value, offset, bold=False, color=None):
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 10)
        c.setFillColor(color or colors.HexColor("#333333"))
        c.drawRightString(W - 55 * mm, offset, label)
        c.drawRightString(W - 15 * mm, offset, value)

    oy = ry - 10 * mm
    total_row("Subtotal", fmt_money(inv.get("subtotal", 0), currency), oy)
    total_row("Discount", "- " + fmt_money(inv.get("discount", 0), currency), oy - 6 * mm)
    total_row("Tax", fmt_money(inv.get("tax", 0), currency), oy - 12 * mm)
    c.setStrokeColor(colors.HexColor("#cccccc"))
    c.line(W - 80 * mm, oy - 16 * mm, W - 15 * mm, oy - 16 * mm)
    total_row("TOTAL", fmt_money(inv.get("total_amount", 0), currency), oy - 22 * mm, bold=True, color=BLACK)
    total_row("Amount Paid", fmt_money(inv.get("amount_paid", 0), currency), oy - 28 * mm)
    total_row("Balance Due", fmt_money(inv.get("balance", 0), currency), oy - 34 * mm, bold=True,
              color=colors.HexColor("#EF4444") if inv.get("balance", 0) > 0 else colors.HexColor("#22C55E"))

    # Status badge
    status = inv.get("status", "PENDING")
    status_colors = {"PAID": "#22C55E", "PENDING": "#E0B230", "PARTIALLY PAID": "#F97316",
                     "OVERDUE": "#EF4444", "CANCELLED": "#EF4444", "DRAFT": "#71717A"}
    c.setFillColor(colors.HexColor(status_colors.get(status, "#E0B230")))
    c.roundRect(15 * mm, oy - 24 * mm, 45 * mm, 10 * mm, 2 * mm, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(37.5 * mm, oy - 20.5 * mm, status)

    # Footer
    c.setFillColor(BLACK)
    c.rect(0, 0, W, 18 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(W / 2, 10 * mm, "MARKLENCEMEDIA Advertising & Ad Agency")
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 8)
    c.drawCentredString(W / 2, 5 * mm, "Thank you for your business")

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------
@api_router.post("/payments")
async def create_payment(body: PaymentIn, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": body.invoice_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    pay = body.model_dump()
    pay["id"] = new_id()
    pay["client_id"] = inv["client_id"]
    pay["payment_date"] = body.payment_date or now_iso()
    pay["created_at"] = now_iso()
    await db.payments.insert_one(dict(pay))
    await recompute_invoice(body.invoice_id)
    settings = await get_settings_doc()
    await log_activity(inv["client_id"],
                       f"{fmt_money(pay['amount'], settings.get('currency', 'INR'))} payment received for {inv['invoice_number']}",
                       pay["payment_date"])
    return clean(pay)


@api_router.get("/payments")
async def list_payments(user: dict = Depends(get_current_user), client_id: str = "", payment_method: str = ""):
    q = {}
    if client_id:
        q["client_id"] = client_id
    if payment_method and payment_method != "ALL":
        q["payment_method"] = payment_method
    pays = await db.payments.find(q).sort("payment_date", -1).to_list(5000)
    out = []
    ccache, icache, scache = {}, {}, {}
    for p in pays:
        p = clean(p)
        cid = p.get("client_id")
        if cid not in ccache:
            cl = await db.clients.find_one({"id": cid})
            ccache[cid] = clean(cl) if cl else {}
        p["client_name"] = ccache[cid].get("client_name", "")
        iid = p.get("invoice_id")
        if iid not in icache:
            iv = await db.invoices.find_one({"id": iid})
            icache[iid] = clean(iv) if iv else {}
        p["invoice_number"] = icache[iid].get("invoice_number", "")
        sid = icache[iid].get("service_id")
        if sid and sid not in scache:
            sv = await db.services.find_one({"id": sid})
            scache[sid] = clean(sv) if sv else {}
        p["service_name"] = scache.get(sid, {}).get("service_name", "") if sid else ""
        out.append(p)
    return out


# ---------------------------------------------------------------------------
# Pipeline / Leads
# ---------------------------------------------------------------------------
@api_router.post("/leads")
async def create_lead(body: LeadIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.leads.insert_one(dict(doc))
    return clean(doc)


@api_router.get("/leads")
async def list_leads(user: dict = Depends(get_current_user)):
    leads = await db.leads.find({}).sort("created_at", -1).to_list(2000)
    return [clean(l) for l in leads]


@api_router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadUpdate, user: dict = Depends(get_current_user)):
    existing = await db.leads.find_one({"id": lead_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Lead not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.leads.update_one({"id": lead_id}, {"$set": updates})
    l = await db.leads.find_one({"id": lead_id})
    return clean(l)


@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user: dict = Depends(get_current_user)):
    await db.leads.delete_one({"id": lead_id})
    return {"message": "deleted"}


@api_router.post("/leads/{lead_id}/convert")
async def convert_lead(lead_id: str, user: dict = Depends(get_current_user)):
    l = await db.leads.find_one({"id": lead_id})
    if not l:
        raise HTTPException(status_code=404, detail="Lead not found")
    if l.get("converted_client_id"):
        raise HTTPException(status_code=400, detail="Lead already converted")
    doc = {
        "id": new_id(), "client_name": l.get("contact_person") or l.get("business_name"),
        "business_name": l.get("business_name", ""), "contact_person": l.get("contact_person", ""),
        "phone": l.get("phone", ""), "whatsapp": l.get("phone", ""), "email": l.get("email", ""),
        "business_category": "", "location": "", "website": "",
        "lead_source": l.get("lead_source", ""), "status": "ACTIVE",
        "start_date": now_iso(), "notes": l.get("notes", ""), "created_at": now_iso(),
    }
    await db.clients.insert_one(dict(doc))
    await db.leads.update_one({"id": lead_id}, {"$set": {"stage": "WON", "converted_client_id": doc["id"]}})
    await log_activity(doc["id"], f"Client onboarded from pipeline — {doc['client_name']}", doc["start_date"])
    return clean(doc)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    clients = [clean(c) for c in await db.clients.find({}).to_list(5000)]
    services = [clean(s) for s in await db.services.find({}).to_list(5000)]
    invoices = [await enrich_invoice(i) for i in await db.invoices.find({}).to_list(10000)]
    payments = [clean(p) for p in await db.payments.find({}).to_list(20000)]
    leads = [clean(l) for l in await db.leads.find({}).to_list(5000)]

    cmap = {c["id"]: c for c in clients}
    smap = {s["id"]: s for s in services}

    total_invoiced = sum(float(i.get("total_amount", 0) or 0) for i in invoices if i.get("status") not in ("CANCELLED", "DRAFT"))
    total_received = sum(float(p.get("amount", 0) or 0) for p in payments)

    def with_names(inv):
        inv = dict(inv)
        inv["client_name"] = cmap.get(inv.get("client_id"), {}).get("client_name", "")
        inv["service_name"] = smap.get(inv.get("service_id"), {}).get("service_name", "")
        return inv

    def svc_with_names(s):
        s = dict(s)
        cl = cmap.get(s.get("client_id"), {})
        s["client_name"] = cl.get("client_name", "")
        s["business_name"] = cl.get("business_name", "")
        return s

    pending = [with_names(i) for i in invoices if i.get("status") in ("PENDING", "PARTIALLY PAID")]
    overdue = [with_names(i) for i in invoices if i.get("status") == "OVERDUE"]
    recent_payments = sorted(payments, key=lambda p: p.get("payment_date", ""), reverse=True)[:8]
    for p in recent_payments:
        p["client_name"] = cmap.get(p.get("client_id"), {}).get("client_name", "")
        iv = next((i for i in invoices if i["id"] == p.get("invoice_id")), None)
        p["invoice_number"] = iv.get("invoice_number", "") if iv else ""

    return {
        "stats": {
            "total_clients": len(clients),
            "active_clients": sum(1 for c in clients if c.get("status") == "ACTIVE"),
            "pipeline": sum(1 for l in leads if l.get("stage") not in ("WON", "LOST")),
            "exited_clients": sum(1 for c in clients if c.get("status") == "EXITED"),
            "active_services": sum(1 for s in services if s.get("status") in ("ACTIVE", "IN PROGRESS")),
            "completed_projects": sum(1 for s in services if s.get("service_type") == "PROJECT" and s.get("status") == "COMPLETED"),
            "total_invoiced": round(total_invoiced, 2),
            "total_received": round(total_received, 2),
            "total_outstanding": round(total_invoiced - total_received, 2),
        },
        "recent_clients": sorted(clients, key=lambda c: c.get("created_at", ""), reverse=True)[:6],
        "active_services": [svc_with_names(s) for s in services if s.get("status") in ("ACTIVE", "IN PROGRESS")][:6],
        "pending_invoices": sorted(pending, key=lambda i: i.get("due_date", ""))[:6],
        "overdue_invoices": sorted(overdue, key=lambda i: i.get("due_date", ""))[:6],
        "recent_payments": recent_payments,
        "recent_completed_projects": [svc_with_names(s) for s in services
                                      if s.get("service_type") == "PROJECT" and s.get("status") == "COMPLETED"][:6],
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password),
                                   "name": "Admin", "role": "admin", "token_version": 0, "created_at": now_iso()})
        logger.info("Seeded admin user")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.login_attempts.create_index("email")
    await db.login_attempts.create_index("identifier")
    await db.password_reset_requests.create_index("email")
    await db.password_reset_requests.create_index("created_at", expireAfterSeconds=1800)
    await db.clients.create_index("id", unique=True)
    await db.services.create_index("id", unique=True)
    await db.invoices.create_index("id", unique=True)
    await db.payments.create_index("id", unique=True)
    await db.leads.create_index("id", unique=True)
    await seed_admin()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
