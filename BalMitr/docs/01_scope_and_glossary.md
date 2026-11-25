# Scope and Glossary (Weeks 1–10)

## Scope
BalMitr is a nutrition and growth register for Anganwadi workers and supervisors covering children from birth up to 12 years (`MAX_AGE_MONTHS = 144`).

- **Included (Weeks 1–10):**
  - JWT login with roles (Worker: own centre only; Supervisor: all centres)
  - Anganwadi centre list & management (Supervisor)
  - Child registration (0–144 completed months) and child profile
  - Weight & height recording with lying/standing WHO 0.7 cm adjustment and validation
  - Rule-based WHO LMS growth status (0–60m Child Growth Standards + 61–144m 2007 Reference)
  - Growth history charts with WHO SD reference curves (`-3`, `-2`, `0`, `+2`, `+3`) and trend rules
  - Age-safe Indian food suggestions from a curated table (`demo list: needs review by a nutrition expert`)
  - Rule-based risk level (`Low` / `Moderate` / `High`) with rule IDs & Alerts list
  - Follow-ups, home visits, referrals, overdue flagging command, and Z-score progress calculation
  - Offline IndexedDB storage with client UUIDs, PWA shell caching, sync badges, and idempotent `POST /api/sync/`
  - Read-only Summary and Backend status pages
- **Explicitly rule-based (not ML):** Growth status, trends, food suggestions, and risk levels use written WHO and domain rules. No invented accuracy percentages or "AI" labels.

## Glossary
| Term | Meaning |
|------|---------|
| Anganwadi | Village/ward child-care and nutrition centre under ICDS |
| AWW | Anganwadi Worker — registers children and records measurements in their own centre |
| Supervisor | Reviews multiple centres, creates centres, and views cross-centre summaries |
| WHO Z-score | Standard deviations above/below the WHO reference median using the LMS method |
| Weight-for-age (WFA) | Weight compared with same-age peers (0–120 months) |
| Length/Height-for-age (HFA) | Length (<24m) or height (24–144m) compared with same-age peers -> stunting check |
| Weight-for-length/height (WFH) | Weight compared with length/height (0–60m only) -> wasting/overweight check |
| BMI-for-age (BFA) | Body mass index compared with same-age peers (61–144m) -> thinness/overweight/obesity |
| LMS | Lambda (skewness), Mu (median), Sigma (coefficient of variation) parameters from WHO tables |
| JWT | JSON Web Token sent as `Authorization: Bearer <token>` |
