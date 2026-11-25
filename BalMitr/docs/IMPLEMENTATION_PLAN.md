# BalMitr Implementation Plan (Weeks 1–10)

Web client + Django REST backend + rule-based WHO growth/nutrition engine for Anganwadi workers and supervisors (ages 0–144 completed months).

## Phase 1 — Weeks 1–3: Setup, Docs, Official WHO Tables, App Shell
- Layout: `backend/`, `ml/`, `frontend/`, `docs/`, `docker-compose.yml`, `README.md`.
- Docs: scope & glossary, ER diagram, API list, wireframe notes, GitHub rules, implementation plan.
- Official WHO LMS tables downloaded from `who.int` into `ml/who_tables/` + `SOURCES.md`:
  - 0–60 months: `wfa`, `lhfa` (length 0–23m / height 24–60m), `wfl` (45–110 cm), `wfh` (65–120 cm).
  - 61–144 months (WHO 2007 5–19y): `hfa` (61–228m), `bmi` (61–228m), `wfa` (61–120m).
- Backend: Django + DRF + JWT + drf-spectacular Swagger (`/api/docs/`), SQLite default + MySQL 8 env toggle, `docker-compose.yml`, base models (`Centre`, `Profile`, `Child`, `Measurement`).
- Frontend: React + TypeScript + Vite + React Router + `@fontsource` serif/sans + `lucide-react`, split-screen Login page + App shell (sidebar / mobile bottom bar, top bar).

## Phase 2 — Weeks 4–5: Login, Roles, Child Registration, Measurements
- `MAX_AGE_MONTHS = 144` enforced in `ml/` and serializers; age formatting (`"8 months"`, `"2y 6m"`, `"9y 3m"`).
- Role permissions (Worker: own centre only; Supervisor: all centres + create centres).
- Measurement API: `weight_kg`, `height_cm`, `measured_position` (`lying`/`standing`, default by age `< 24m` vs `>= 24m`), WHO 0.7 cm adjustment when position differs, range checks, no future dates, no duplicate date, unified `{"error": {"code", "message", "details"}}` error format.
- Frontend: Home dashboard, Children register list + Register Child form, Child Profile + Record Measurement form.

## Phase 3 — Week 6: Growth Status, WHO Charts & Trend Rules
- Save all applicable indicators per measurement (`wfa`, `hfa`, `wfh`, `bmi`), standard WHO cut-offs (`-3/-2/+1/+2/+3`), WHO flag limits for implausible Z-scores.
- Growth history + chart reference curve endpoints (`-3`, `-2`, `0`, `+2`, `+3` SD curves from WHO LMS tables).
- Plain-word trend rules (weight drop, no gain over 2 visits, crossed cut-off).
- Frontend: Recharts growth charts per age-applicable indicator + trend banner on Child Profile.

## Phase 4 — Week 7: Food Suggestions
- ~20 common Indian foods JSON/fixture + `import_foods` management command (`energy`, `protein`, `iron`, `vitamin_a` tags, `min_age_months`, choking/honey safety flags).
- Rule-based food matcher in `ml/food_rules.py` (no honey `< 12m`, no whole nuts `< 36m`, pureed/mashed `< 9m`, etc.).
- Frontend: Food suggestions tab/section on Child Profile labeled `"demo list: needs review by a nutrition expert"`.

## Phase 5 — Week 8: Risk Level & Alerts
- Rule-based risk engine in `ml/risk_rules.py` (Low / Moderate / High with rule IDs & plain-word reasons), documented in `docs/risk_rules.md` (`"proposed: needs expert review"`).
- `RiskAssessment` table + `/api/alerts/` endpoint sorted High first.
- Frontend: Risk card on Child Profile + Alerts page.

## Phase 6 — Week 9: Follow-ups, Home Visits, Referrals & Progress
- Models & APIs for `FollowUp`, `HomeVisit`, `Referral` + `flag_overdue` management command.
- Progress calculation comparing latest Z-scores vs baseline at first follow-up/referral (`improved` / `same` / `worse`).
- Frontend: Visits page (Due today / Overdue / Done) + profile follow-up/visit/referral logging.

## Phase 7 — Week 10: Offline Storage, PWA & Sync + Summary/Backend/Account
- Frontend: IndexedDB queue with client UUIDs, PWA service worker caching app shell, `Synced` / `Waiting to sync` / `Failed` badges, manual Sync button + automatic online sync.
- Backend: idempotent `POST /api/sync/`, server recalculates all WHO statuses, trends, and risk; `Summary` API/page (read-only counts per centre) and `Backend` API/page (health, version, DB counts, Swagger link, sync queue) and `Account` page.
- Full test suites + offline-to-online browser verification with screenshots.
