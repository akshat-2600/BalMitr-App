# API List (Weeks 1–10)

All endpoints except login/refresh and `/api/health/` require `Authorization: Bearer <access_token>`.
Interactive Swagger docs: `http://127.0.0.1:8000/api/docs/`

## Error Format
Every API error returns:
```json
{
  "error": {
    "code": "validation_error",
    "message": "Human readable message",
    "details": {}
  }
}
```
Codes: `validation_error` (400), `not_logged_in` (401), `not_allowed` (403), `not_found` (404).

## Endpoints
| Method | URL | Who | Purpose |
|--------|-----|-----|---------|
| POST | `/api/auth/login/` | anyone | Returns `access`, `refresh`, `username`, `full_name`, `role`, `centre_id`, `centre_name` |
| POST | `/api/auth/refresh/` | anyone | Refreshes access token |
| GET | `/api/me/` | logged in | Current user profile |
| GET/POST | `/api/centres/` | logged in / supervisor | List centres; supervisor creates centre |
| GET/POST | `/api/children/` | logged in | List/register children (0–144 months; worker: own centre) |
| GET/PATCH | `/api/children/{id}/` | logged in | Child profile with latest measurement, risk, trends |
| GET | `/api/children/{id}/growth-history/` | logged in | Measurements + WHO SD curves + trend messages |
| GET | `/api/children/{id}/food-suggestions/` | logged in | Age-safe rule-based food suggestions |
| GET/POST | `/api/measurements/` | logged in | List/record measurements (`lying`/`standing`, 0.7 cm WHO adj.) |
| GET | `/api/growth/assess/` | logged in | Stateless WHO calculator preview |
| GET | `/api/alerts/` | logged in | Children needing attention sorted High risk first |
| GET/POST/PATCH | `/api/follow-ups/` | logged in | Follow-up tasks (due today / overdue / done) + progress |
| GET/POST | `/api/visits/` | logged in | Home visit logs |
| GET/POST/PATCH | `/api/referrals/` | logged in | Facility referrals + progress |
| POST | `/api/sync/` | logged in | Idempotent batch sync of offline children & measurements |
| GET | `/api/summary/` | logged in | Read-only status & risk counts per centre |
| GET | `/api/health/` | anyone | API health, version, DB engine & record counts |
