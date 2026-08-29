# MARKLENCEMEDIA CRM — PRD

## Original problem statement
Internal, fully functional CRM for MARKLENCEMEDIA Advertising & Ad Agency. Real DB + CRUD (no static mock). Core relationship CLIENT → SERVICES/PROJECTS → INVOICES → PAYMENTS. Monthly services remain ONE service with one invoice per billing month. Branding: black #000000 / gold #E0B230 / white, Montserrat font, official logo. Modules: Dashboard, Clients, Pipeline (Kanban), Active Services, Completed Projects, Exited Clients, Invoices, Payments, Settings.

## User choices
- Auth: JWT email+password, single admin (mhdjunaidd62562@gmail.com)
- Invoice PDF: real downloadable PDF files (reportlab, logo + branding)
- Recurring: MANUAL "Generate Next Month Invoice" button per service
- Start with empty DB
- Currency: selectable INR/USD/EUR, standard formatting (default INR)

## Architecture
- Backend: FastAPI + Motor (MongoDB), all routes under /api. UUID string ids for CRM entities; users use ObjectId. httpOnly cookie JWT auth (access+refresh) + Bearer fallback, bcrypt, brute-force lockout, full password reset (Emergent email).
- Frontend: React (CRA/craco), react-router, dnd-kit (pipeline), sonner toasts, Tailwind + shadcn/ui, Montserrat, AuthContext + SettingsContext.
- PDF: reportlab, logo at /app/backend/assets/logo.png, served via /api/logo.

## Implemented (2026-06)
- Auth: login/logout/me/refresh/forgot/reset; admin seeded; test_credentials.md updated.
- Clients: CRUD, search (name/business/phone/email), status filters, computed per-client rollups.
- Client profile: dynamic summary cards (active services, completed projects, invoiced, received, outstanding, monthly recurring), services list, monthly billing history, activity timeline, Mark Exited (history preserved).
- Services: CRUD (edit updates in place, no dup, invoices/payments preserved); types PROJECT/MONTHLY/ONE-TIME; manual generate-next-month invoice (one invoice per month, never new service).
- Invoices: CRUD, auto total/balance, auto status (DRAFT/PENDING/PARTIALLY PAID/PAID/OVERDUE/CANCELLED), view dialog, mark-paid, real PDF download.
- Payments: multiple partial payments per invoice, history preserved, payments page + method filter.
- Pipeline: Kanban 6 stages, drag-and-drop persists, add/edit/delete lead, convert WON lead → client.
- Filtered views: Active Services, Completed Projects, Exited Clients (no duplicate collections).
- Dashboard: 9 DB-computed KPIs + 6 activity sections.
- Settings: agency name, currency, logo, user profile.
- Verified: 25/25 backend pytest, monthly billing statuses (PAID/PENDING/PARTIALLY PAID), partial→full transitions, PDF (%PDF), outstanding math. Frontend 100% of tested flows.

## Backlog / future (V2 — explicitly out of scope for V1)
HR, Payroll, Attendance, Expenses, Accounting, Inventory, Task mgmt, WhatsApp/Email automation, AI assistant, Client portal, Advanced analytics. Scheduled auto-recurring invoices (currently manual by design).

## Next tasks
- (Optional) Auto-recurring invoice scheduler if user later wants automation.
- (Optional) Split server.py into routers for maintainability.
