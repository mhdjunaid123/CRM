# Auth Testing Notes — MARKLENCEMEDIA CRM

Auth uses httpOnly cookies (access_token + refresh_token), samesite=none, secure=true.
Because cookies are `secure`, test over the HTTPS preview URL, OR extract the `access_token`
cookie after login and send it as `Authorization: Bearer <token>` for localhost http tests.

## Admin account
- Email: mhdjunaidd62562@gmail.com
- Password: Marklence@2026

## Endpoints
- POST /api/auth/login  -> sets cookies, returns user
- GET  /api/auth/me
- POST /api/auth/logout
- POST /api/auth/refresh
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

## Password reset local test
Set FRONTEND_URL="http://localhost:3000" in backend/.env, restart backend; the reset link is
written to the backend log. Restore the https origin afterward.
