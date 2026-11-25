# BalMitr Risk Assessment Rules

> **Status: Proposed — needs expert review.**
>
> All risk levels and reasons are **rule-based** using WHO Z-score cut-offs and simple weight-trend checks. **No machine learning model is used** because no real Anganwadi clinical outcome dataset exists for training.

## Risk Levels
1. **High** — Any severe acute or chronic WHO deficit (`Z < -3`), obesity, or multiple moderate deficits combined with faltering weight:
   - `RISK_SEV_WFA`: Weight-for-age `Z < -3` (Severely underweight)
   - `RISK_SEV_HFA`: Height-for-age `Z < -3` (Severely stunted)
   - `RISK_SEV_WFH`: Weight-for-height `Z < -3` (Severely wasted)
   - `RISK_SEV_BMI`: BMI-for-age `Z < -3` (Severe thinness)
   - `RISK_OBESITY`: BMI-for-age `Z > +2` (Obesity) or Weight-for-height `Z > +3` (Obese)
   - `RISK_MULTI_MOD_DROP`: 2 or more moderate deficits (`-3 <= Z < -2`) plus a weight drop or no gain over 2 visits
2. **Moderate** — Any moderate WHO deficit (`-3 <= Z < -2`), overweight, weight faltering, or implausible measurement flag:
   - `RISK_MOD_WFA`: Weight-for-age `-3 <= Z < -2` (Underweight)
   - `RISK_MOD_HFA`: Height-for-age `-3 <= Z < -2` (Stunted)
   - `RISK_MOD_WFH`: Weight-for-height `-3 <= Z < -2` (Wasted)
   - `RISK_MOD_BMI_THIN`: BMI-for-age `-3 <= Z < -2` (Thinness)
   - `RISK_OVERWEIGHT`: Overweight or possible risk of overweight
   - `RISK_WEIGHT_DROP`: Weight dropped since the previous visit
   - `RISK_NO_GAIN`: No weight gain recorded across two consecutive visits
   - `RISK_FLAGGED`: Measurement outside WHO plausible Z-score flag limits (needs re-check)
3. **Low** — All applicable indicators are within normal WHO cut-offs and no faltering weight trend:
   - `RISK_NORMAL`: All applicable WHO indicators inside normal cut-offs
