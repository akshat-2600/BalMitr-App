# Official WHO LMS Tables — Sources

All tables in `ml/who_tables/` were downloaded directly from official World Health Organization (`who.int` / `cdn.who.int`) pages on **2026-11-25** and converted from `.xlsx` to `.csv` preserving exact `L`, `M`, and `S` values.

## 1. WHO Child Growth Standards (0–60 completed months)

- **Weight-for-age (0–5 years):** https://www.who.int/tools/child-growth-standards/standards/weight-for-age
  - `wfa_0_5_boys.csv` <- https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-age/wfa_boys_0-to-5-years_zscores.xlsx?sfvrsn=97a05331_9
  - `wfa_0_5_girls.csv` <- https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-age/wfa_girls_0-to-5-years_zscores.xlsx?sfvrsn=4c03b8db_7

- **Length/height-for-age (0–5 years):** https://www.who.int/tools/child-growth-standards/standards/length-height-for-age
  - `lhfa_0_2_boys.csv` (0–24 months recumbent length) <- https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/length-height-for-age/lhfa_boys_0-to-2-years_zscores.xlsx?sfvrsn=30e044c_9
  - `lhfa_0_2_girls.csv` (0–24 months recumbent length) <- https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/length-height-for-age/lhfa_girls_0-to-2-years_zscores.xlsx?sfvrsn=e9e66a95_11
  - `lhfa_2_5_boys.csv` (24–60 months standing height) <- https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/length-height-for-age/lhfa_boys_2-to-5-years_zscores.xlsx?sfvrsn=17e5ad91_9
  - `lhfa_2_5_girls.csv` (24–60 months standing height) <- https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/length-height-for-age/lhfa_girls_2-to-5-years_zscores.xlsx?sfvrsn=2ec187b9_11

- **Weight-for-length/height (0–5 years):** https://www.who.int/tools/child-growth-standards/standards/weight-for-length-height
  - `wfl_0_2_boys.csv` (45.0–110.0 cm recumbent length) <- https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-length-height/wfl_boys_0-to-2-years_zscores.xlsx?sfvrsn=e27a9da3_7
  - `wfl_0_2_girls.csv` (45.0–110.0 cm recumbent length) <- https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-length-height/wfl_girls_0-to-2-years_zscores.xlsx?sfvrsn=288bc4e4_7
  - `wfh_2_5_boys.csv` (65.0–120.0 cm standing height) <- https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-length-height/wfh_boys_2-to-5-years_zscores.xlsx?sfvrsn=202c0545_7
  - `wfh_2_5_girls.csv` (65.0–120.0 cm standing height) <- https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/weight-for-length-height/wfh_girls_2-to-5-years_zscores.xlsx?sfvrsn=4d66af6a_7

## 2. WHO 2007 Growth Reference (5–19 years; BalMitr uses 61–144 months)

- **Height-for-age (5–19 years, 61–228 months):** https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/height-for-age
  - `hfa_5_19_boys.csv` <- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/height-for-age-(5-19-years)/hfa-boys-z-who-2007-exp.xlsx?sfvrsn=7fa263d_2
  - `hfa_5_19_girls.csv` <- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/height-for-age-(5-19-years)/hfa-girls-z-who-2007-exp.xlsx?sfvrsn=79d310ee_2

- **BMI-for-age (5–19 years, 61–228 months):** https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age
  - `bmi_5_19_boys.csv` <- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/bmi-for-age-(5-19-years)/bmi-boys-z-who-2007-exp.xlsx?sfvrsn=a84bca93_2
  - `bmi_5_19_girls.csv` <- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/bmi-for-age-(5-19-years)/bmi-girls-z-who-2007-exp.xlsx?sfvrsn=79222875_2

- **Weight-for-age (5–10 years, 61–120 months):** https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/weight-for-age-5to10-years
  - `wfa_5_10_boys.csv` <- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/weight-for-age-(5-10-years)/hfa-boys-z-who-2007-exp_0ff9c43c-8cc0-4c23-9fc6-81290675e08b.xlsx?sfvrsn=b3ca0d6f_4
  - `wfa_5_10_girls.csv` <- https://cdn.who.int/media/docs/default-source/child-growth/growth-reference-5-19-years/weight-for-age-(5-10-years)/hfa-girls-z-who-2007-exp_7ea58763-36a2-436d-bef0-7fcfbadd2820.xlsx?sfvrsn=6ede55a4_4
