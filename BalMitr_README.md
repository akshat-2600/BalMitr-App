# BalMitr — Anganwadi Child Nutrition & Growth Register (Weeks 1–10)

A college project built for Anganwadi workers and supervisors to register children (0–144 completed months / birth to 12 years), record weight and height (including offline via IndexedDB + PWA), and read rule-based WHO growth statuses, charts, trends, food suggestions, risk levels, follow-ups, visits, and referrals.

> **Important:**
> - **Rule-based only (NOT Machine Learning):** Growth statuses, trends, food suggestions, and risk levels are calculated using official WHO LMS tables and explicit written rules. No ML model is used because no real clinical dataset is available, and no accuracy figures or "AI %" are claimed anywhere in the app.
> - **Demo data is FAKE:** All seeded children, centres, measurements, and demo accounts (`worker1`, `worker2`, `supervisor1`) are fictional test data.

---

## Tech Stack
- **Backend:** Python 3.12, Django, Django REST Framework, SimpleJWT, drf-spectacular (Swagger at `/api/docs/`). SQLite by default; MySQL 8 selectable via environment variables or `docker-compose.yml`.
- **Rules & WHO Engine (`ml/`):** Pure Python rule-based WHO LMS calculator using official WHO CSV tables (`ml/who_tables/`), trend rules, Indian food safety rules, risk rules, and progress comparison.
- **Frontend:** React 18, TypeScript, Vite, React Router, Recharts, `lucide-react`, locally bundled `@fontsource` fonts, IndexedDB offline queue, and PWA service worker (`public/sw.js`).

---

## Project Structure
```text
BalMitr/
├── backend/                # Django + DRF REST API, JWT auth, Swagger (/api/docs/)
│   ├── balmitr/            # Project settings (SQLite default, MySQL 8 via env) & URLs
│   └── core/               # Models, serializers, views, error handler, management commands
├── ml/                     # Rule-based WHO & nutrition engine (no ML model)
│   ├── who_tables/         # Official WHO LMS CSV tables (0-60m & 5-19y) + SOURCES.md
│   ├── growth.py           # WHO LMS Z-scores, 0-144m age rules, 0.7 cm position adjustment
│   ├── trends.py           # Trend detection & WHO SD reference curves
│   ├── food_rules.py       # Age-safe Indian food matcher + foods.json
│   ├── risk_rules.py       # Rule-based Low/Moderate/High risk scorer
│   ├── followups.py        # Baseline vs latest Z-score progress calculation
│   └── test_growth.py      # Unit tests verified against official WHO tables
├── frontend/               # React + TypeScript + Vite web app
│   ├── public/             # PWA manifest & service worker (sw.js)
│   └── src/                # Pages, components, IndexedDB offline queue, SyncContext
├── docs/                   # Scope, glossary, ER diagram, API list, wireframes, risk rules
├── docker-compose.yml      # Backend + MySQL 8 setup
└── requirements.txt
```

## Features Built (Weeks 1–10)
| Week | Scope |
|------|-------|
| 1–3 | Repo layout, docs, official WHO LMS CSV tables (`0–144` months), Django + Swagger, Docker Compose, React shell & split Login screen |
| 4–5 | JWT login with roles (Worker: own centre; Supervisor: all), `MAX_AGE_MONTHS = 144`, measurement range/date checks, `0.7 cm` lying/standing adjustment, unified error JSON |
| 6 | All-indicator Z-scores & statuses, Recharts WHO `-3/-2/0/+2/+3` SD curves, plain-word trend findings |
| 7 | 20 common Indian foods (`import_foods`), age/choking/honey safety rules (`Demo list: needs review by a nutrition expert`) |
| 8 | Rule-based `Low` / `Moderate` / `High` risk (`Proposed: needs expert review`), rule IDs, Alerts page sorted High first |
| 9 | Follow-ups, home visits, referrals, `flag_overdue` command, Z-score progress (`improved` / `same` / `worse`) |
| 10 | IndexedDB offline queue with UUIDs, PWA app shell caching, `Synced` / `Waiting to sync` / `Failed` badges, idempotent `POST /api/sync/`, Summary, Backend & Account pages |

---

## Quick Start on Windows (PowerShell)

> **Note:** If PowerShell blocks script activation (`Activate.ps1` or `npm.ps1`), run this once in your PowerShell window:
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

### 1. Start the Backend (Django + SQLite)
```powershell
cd BalMitr
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

cd backend
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

### 2. Start the Frontend (React + Vite) in a second PowerShell window
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd BalMitr\frontend
npm install
npm run dev
```

Open in your browser:
- **BalMitr Web App:** http://127.0.0.1:5173/
- **Swagger API Docs:** http://127.0.0.1:8000/api/docs/
- **Django Admin:** http://127.0.0.1:8000/admin/

### Demo Logins (FAKE)
| Name | Username | Role | Centre | Password |
|------|----------|------|--------|----------|
| Meera Kole | `worker1` | Anganwadi Worker | Lotus Lane Anganwadi | `demo1234` |
| Ravi Das | `worker2` | Anganwadi Worker | Banyan Chowk Anganwadi | `demo1234` |
| Anjali Sen | `supervisor1` | Supervisor | All centres | `demo1234` |

---

## Optional: MySQL 8 via Docker Compose or Environment Variables
To run the backend with MySQL 8 in Docker:
```powershell
docker compose up --build
```
Or point the local Django server to an existing MySQL 8 instance:
```powershell
$env:DB_ENGINE = "mysql"
$env:MYSQL_DATABASE = "balmitr"
$env:MYSQL_USER = "balmitr"
$env:MYSQL_PASSWORD = "your_password"
$env:MYSQL_HOST = "127.0.0.1"
$env:MYSQL_PORT = "3306"
python manage.py migrate
```

### Flag Overdue Follow-ups Command
```powershell
cd backend
python manage.py flag_overdue
```

---

## Run All Tests
Run every test suite from the project root (`BalMitr/`):

```powershell
# 1. WHO calculator, trend, food safety, risk, and progress unit tests (10 tests)
.\venv\Scripts\python.exe -m unittest ml.test_growth -v

# 2. Django API, permissions, age limit (144 vs 145 months), sync idempotency & overdue tests (11 tests)
cd backend
..\venv\Scripts\python.exe manage.py test

# 3. Frontend Vitest tests (age formatting + IndexedDB offline queue & badges) and production build
cd ..\frontend
npm test
npm run build
```

---

## Official WHO Tables & Verification Checks
Official LMS tables downloaded directly from `who.int` (`cdn.who.int`) are stored in `ml/who_tables/` with exact URLs and download date in [ml/who_tables/SOURCES.md](ml/who_tables/SOURCES.md).

- **0–60 months (WHO Child Growth Standards):**
  - Weight-for-age (`wfa_0_5_boys.csv`, `wfa_0_5_girls.csv`)
  - Length/height-for-age (`lhfa_0_2_*`, `lhfa_2_5_*`, with WHO's `0.7 cm` adjustment when measuring position differs from age standard)
  - Weight-for-length/height (`wfl_0_2_*`, `wfh_2_5_*`)
- **61–144 months (WHO 2007 Growth Reference 5–19 years):**
  - Height-for-age (`hfa_5_19_*`)
  - BMI-for-age (`bmi_5_19_*`)
  - Weight-for-age up to 120 months (`wfa_5_10_*`; marked *"Not applicable for this age"* above 120m; Weight-for-height marked *"Not applicable for this age"* above 60m)

**Verified WHO Cases in `ml/test_growth.py`:**
- **0–60 months (6 cases across boys & girls):**
  1. 0m boy median (`3.3464 kg`, `49.9 cm`) -> `Z ≈ 0.0`, `Normal`
  2. 8m boy (`6.8 kg`, `70.6 cm`) -> WFA `Underweight` (`< -2 SD`)
  3. 14m girl (`7.1 kg`, `76.0 cm`) -> WFA `Underweight`
  4. 30m boy (`12.8 kg`, `83.0 cm`) -> HFA `Stunted`, BMI `"Not applicable for this age"`
  5. 42m boy (`10.5 kg`, `96.0 cm`) -> WFA `Severely underweight` (`< -3 SD`)
  6. 24m girl (`8.6 kg`, `85.7 cm`) -> WFH `Severely wasted` (`< -3 SD`)
- **61–144 months (5 cases across boys & girls):**
  1. 61m boy (`18.56 kg`, `110.3 cm`) -> HFA `Z ≈ 0.0`, BMI `Z ≈ 0.0`, WFH `"Not applicable for this age"`
  2. 84m girl (`22.4 kg`, `120.8 cm`) -> HFA, BMI, and WFA all `Normal`
  3. 108m boy (`18.0 kg`, `118.0 cm`) -> HFA `Stunted`, BMI `Thinness`
  4. 114m girl (`37.4 kg`, `135.0 cm`) -> BMI `Overweight` (`+1 < Z <= +2`)
  5. 132m boy (`51.1 kg`, `143.0 cm`) -> WFA & WFH `"Not applicable for this age"`, BMI `Obesity` (`Z > +2`)
- **WHO plausibility flags** verified (`is_flagged = True` when outside WHO Z-score bounds), plus **0.7 cm** lying/standing adjustments and **144 accepted / 145 rejected** month boundary.
