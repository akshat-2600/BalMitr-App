export interface TrendFinding {
  code: string;
  severity: "warning" | "ok";
  message: string;
}

export interface SdPoint {
  x: number;
  sd3neg: number;
  sd2neg: number;
  median: number;
  sd2: number;
  sd3: number;
}

export interface ChartSpec {
  label: string;
  x_label?: string;
  applicable: boolean;
  reason?: string;
  curves?: SdPoint[];
}

export interface GrowthHistoryResponse {
  child: import("./types").Child;
  measurements: import("./types").Measurement[];
  trends: TrendFinding[];
  charts: {
    age_group: string;
    wfa: ChartSpec;
    hfa: ChartSpec;
    wfh: ChartSpec;
    bmi: ChartSpec;
  };
}

export interface FoodItemSuggestion {
  id: number;
  name: string;
  local_name: string;
  min_age_months: number;
  texture: string;
  tag_energy: boolean;
  tag_protein: boolean;
  tag_iron: boolean;
  tag_vitamin_a: boolean;
  serving_note: string;
}

export interface FoodSuggestionsResponse {
  notice: string;
  age_months: number;
  needs: string[];
  safety_notes: string[];
  suggestions: FoodItemSuggestion[];
}
