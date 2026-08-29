"""
MARKLENCEMEDIA CRM — Backend regression tests.

Covers: auth (login/me/logout/forgot), settings, clients CRUD,
services (project + monthly + edit), monthly next-invoice generation,
invoices (create, get, PDF, mark-paid), payments (partial→full status),
leads CRUD + convert, dashboard KPIs.

Uses Bearer token from login response cookie (secure cookies won't be
resent over http/https via requests without explicit management).
"""
import os
import re
import uuid
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://agency-crm-pro-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "mhdjunaidd62562@gmail.com"
ADMIN_PASSWORD = "Marklence@2026"


# ---------------------------------------------------------------- fixtures
@pytest.fixture(scope="session")
def auth_headers():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    # Extract access_token cookie
    token = s.cookies.get("access_token")
    assert token, f"no access_token cookie set. cookies={s.cookies.get_dict()}"
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def client(auth_headers):
    s = requests.Session()
    s.headers.update(auth_headers)
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------------------------------------------------------- auth
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong-xyz"})
        assert r.status_code in (401, 429)

    def test_login_success_and_me(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert "id" in data

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_forgot_password_generic_response(self):
        r1 = requests.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL})
        r2 = requests.post(f"{API}/auth/forgot-password", json={"email": "unknown-xyz@example.com"})
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json() == r2.json(), "forgot-password must return identical response for registered/unregistered"


# ---------------------------------------------------------------- settings
class TestSettings:
    def test_get_and_update_currency(self, client):
        r = client.get(f"{API}/settings")
        assert r.status_code == 200
        orig = r.json()
        assert orig.get("currency") in ("INR", "USD", "EUR")

        r = client.put(f"{API}/settings", json={"currency": "USD"})
        assert r.status_code == 200
        assert r.json()["currency"] == "USD"

        r = client.get(f"{API}/settings")
        assert r.json()["currency"] == "USD"

        # restore
        client.put(f"{API}/settings", json={"currency": orig.get("currency", "INR")})


# ---------------------------------------------------------------- clients + full flow
@pytest.fixture(scope="session")
def test_client_id(client):
    payload = {
        "client_name": f"TEST_Client_{uuid.uuid4().hex[:6]}",
        "business_name": "TEST Biz",
        "phone": "9990001111",
        "email": "test_c@example.com",
        "status": "ACTIVE",
    }
    r = client.post(f"{API}/clients", json=payload)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    yield cid


class TestClients:
    def test_create_and_get(self, client, test_client_id):
        r = client.get(f"{API}/clients/{test_client_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == test_client_id
        assert "summary" in data
        assert data["summary"]["active_services"] == 0

    def test_list_and_search(self, client, test_client_id):
        r = client.get(f"{API}/clients", params={"search": "TEST_Client"})
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert test_client_id in ids

    def test_status_filter(self, client):
        r = client.get(f"{API}/clients", params={"status": "ACTIVE"})
        assert r.status_code == 200
        assert all(c["status"] == "ACTIVE" for c in r.json())


# ---------------------------------------------------------------- one-time project
class TestProjectFlow:
    service_id = None
    invoice_id = None

    def test_add_project_service(self, client, test_client_id):
        r = client.post(f"{API}/services", json={
            "client_id": test_client_id,
            "service_name": "TEST_Ecommerce Website",
            "service_type": "PROJECT",
            "billing_type": "ONE-TIME",
            "price": 16000,
            "status": "COMPLETED",
            "actual_completion_date": datetime.now(timezone.utc).isoformat(),
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "COMPLETED"
        TestProjectFlow.service_id = d["id"]

    def test_create_invoice_for_project(self, client, test_client_id):
        assert TestProjectFlow.service_id
        r = client.post(f"{API}/invoices", json={
            "client_id": test_client_id,
            "service_id": TestProjectFlow.service_id,
            "subtotal": 16000,
            "description": "TEST project invoice",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "PENDING"
        assert d["total_amount"] == 16000
        assert d["balance"] == 16000
        assert re.match(r"INV-\d+", d["invoice_number"])
        TestProjectFlow.invoice_id = d["id"]

    def test_full_payment_marks_paid(self, client):
        assert TestProjectFlow.invoice_id
        r = client.post(f"{API}/payments", json={
            "invoice_id": TestProjectFlow.invoice_id,
            "amount": 16000,
            "payment_method": "UPI",
        })
        assert r.status_code == 200
        r = client.get(f"{API}/invoices/{TestProjectFlow.invoice_id}")
        d = r.json()
        assert d["status"] == "PAID"
        assert d["balance"] == 0

    def test_pdf_download(self, client):
        r = client.get(f"{API}/invoices/{TestProjectFlow.invoice_id}/pdf")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 5000


# ---------------------------------------------------------------- monthly service + recurring
class TestMonthlyFlow:
    service_id = None
    invoice_ids = []

    def test_add_monthly_service(self, client, test_client_id):
        r = client.post(f"{API}/services", json={
            "client_id": test_client_id,
            "service_name": "TEST_Facebook Ads",
            "service_type": "SERVICE",
            "billing_type": "MONTHLY",
            "price": 6000,
            "status": "ACTIVE",
            "start_date": "2027-01-01T00:00:00+00:00",
        })
        assert r.status_code == 200, r.text
        TestMonthlyFlow.service_id = r.json()["id"]

    def test_generate_next_three_months(self, client):
        sid = TestMonthlyFlow.service_id
        months = []
        for _ in range(3):
            r = client.post(f"{API}/services/{sid}/generate-next-invoice")
            assert r.status_code == 200, r.text
            d = r.json()
            TestMonthlyFlow.invoice_ids.append(d["id"])
            months.append(d["billing_month"])
        # consecutive & unique
        assert len(set(months)) == 3
        # each invoice number is unique
        r = client.get(f"{API}/services/{sid}/invoices")
        invs = r.json()
        assert len(invs) == 3
        assert len(set(i["invoice_number"] for i in invs)) == 3

    def test_service_edit_does_not_duplicate(self, client):
        sid = TestMonthlyFlow.service_id
        r = client.put(f"{API}/services/{sid}", json={"price": 6500})
        assert r.status_code == 200
        r = client.get(f"{API}/services", params={"billing_type": "MONTHLY"})
        matching = [s for s in r.json() if s["id"] == sid]
        assert len(matching) == 1
        assert matching[0]["price"] == 6500
        # invoices still 3
        r = client.get(f"{API}/services/{sid}/invoices")
        assert len(r.json()) == 3

    def test_partial_then_full_payment(self, client):
        inv_id = TestMonthlyFlow.invoice_ids[0]
        # partial
        r = client.post(f"{API}/payments", json={"invoice_id": inv_id, "amount": 2000, "payment_method": "UPI"})
        assert r.status_code == 200
        r = client.get(f"{API}/invoices/{inv_id}")
        d = r.json()
        assert d["status"] == "PARTIALLY PAID"
        assert d["balance"] == 4000
        # remaining
        r = client.post(f"{API}/payments", json={"invoice_id": inv_id, "amount": 4000, "payment_method": "CASH"})
        assert r.status_code == 200
        r = client.get(f"{API}/invoices/{inv_id}")
        d = r.json()
        assert d["status"] == "PAID"
        assert d["balance"] == 0
        # payment history preserved: 2 payments
        assert len(d["payments"]) == 2

    def test_mark_paid_endpoint(self, client):
        inv_id = TestMonthlyFlow.invoice_ids[1]
        r = client.post(f"{API}/invoices/{inv_id}/mark-paid")
        assert r.status_code == 200
        assert r.json()["status"] == "PAID"


# ---------------------------------------------------------------- invoices list
class TestInvoicesList:
    def test_list_search_filter(self, client):
        r = client.get(f"{API}/invoices")
        assert r.status_code == 200
        all_inv = r.json()
        assert len(all_inv) >= 4
        r = client.get(f"{API}/invoices", params={"status": "PAID"})
        assert all(i["status"] == "PAID" for i in r.json())
        # search by invoice number
        first = all_inv[0]["invoice_number"]
        r = client.get(f"{API}/invoices", params={"search": first})
        assert any(i["invoice_number"] == first for i in r.json())


# ---------------------------------------------------------------- payments
class TestPayments:
    def test_list_payments(self, client):
        r = client.get(f"{API}/payments")
        assert r.status_code == 200
        pays = r.json()
        assert len(pays) >= 3
        assert all("client_name" in p and "invoice_number" in p for p in pays)

    def test_filter_by_method(self, client):
        r = client.get(f"{API}/payments", params={"payment_method": "UPI"})
        assert r.status_code == 200
        assert all(p["payment_method"] == "UPI" for p in r.json())


# ---------------------------------------------------------------- leads + convert
class TestLeads:
    lead_id = None

    def test_create_lead(self, client):
        r = client.post(f"{API}/leads", json={
            "business_name": "TEST_Lead_Biz",
            "contact_person": "TEST Lead Guy",
            "phone": "9998887777",
            "email": "lead@test.com",
            "potential_service": "SEO",
            "expected_value": 25000,
            "stage": "NEW LEAD",
        })
        assert r.status_code == 200
        TestLeads.lead_id = r.json()["id"]

    def test_move_stage(self, client):
        r = client.put(f"{API}/leads/{TestLeads.lead_id}", json={"stage": "PROPOSAL"})
        assert r.status_code == 200
        assert r.json()["stage"] == "PROPOSAL"

    def test_convert_to_client(self, client):
        r = client.post(f"{API}/leads/{TestLeads.lead_id}/convert")
        assert r.status_code == 200
        new_client = r.json()
        assert new_client["status"] == "ACTIVE"
        assert new_client["business_name"] == "TEST_Lead_Biz"
        # lead now WON
        r = client.get(f"{API}/leads")
        lead = next(l for l in r.json() if l["id"] == TestLeads.lead_id)
        assert lead["stage"] == "WON"
        assert lead.get("converted_client_id") == new_client["id"]


# ---------------------------------------------------------------- exit client
class TestExit:
    def test_mark_exited(self, client, test_client_id):
        r = client.post(f"{API}/clients/{test_client_id}/exit", json={
            "exit_reason": "TEST reason", "notes": "done"
        })
        assert r.status_code == 200
        assert r.json()["status"] == "EXITED"
        # history intact
        r = client.get(f"{API}/clients/{test_client_id}/invoices")
        assert len(r.json()) >= 4
        r = client.get(f"{API}/clients/{test_client_id}/payments")
        assert len(r.json()) >= 3


# ---------------------------------------------------------------- dashboard
class TestDashboard:
    def test_dashboard_kpis(self, client):
        r = client.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        stats = d["stats"]
        for k in ("total_clients", "active_clients", "pipeline", "exited_clients",
                  "active_services", "completed_projects", "total_invoiced",
                  "total_received", "total_outstanding"):
            assert k in stats
        assert stats["total_clients"] >= 1
        assert stats["exited_clients"] >= 1
        assert stats["completed_projects"] >= 1
        assert stats["total_received"] > 0
        for k in ("recent_clients", "active_services", "pending_invoices",
                  "overdue_invoices", "recent_payments", "recent_completed_projects"):
            assert isinstance(d[k], list)
