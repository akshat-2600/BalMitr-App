export interface Centre {
  id: number;
  name: string;
  code: string;
  district: string;
}

export interface Measurement {
  id: number;
  client_uuid: string;
  child: number;
  date: string;
  weight_kg: string | number;
  height_cm: string | number;
  measured_position: "lying" | "standing";
  adjusted_height_cm: string | number | null;
  age_months: number;
  weight_for_age_z: number | null;
  status: string;
  height_for_age_z: number | null;
  height_status: string;
  weight_for_height_z: number | null;
  wfh_status: string;
  bmi_for_age_z: number | null;
  bmi_status: string;
  is_flagged: boolean;
  flag_reasons: string[];
  created_at: string;
}

export interface RiskReason {
  rule_id: string;
  text: string;
}

export interface RiskAssessment {
  level: "Low" | "Moderate" | "High";
  reasons: RiskReason[];
  updated_at?: string;
  notice: string;
}

export interface ProgressSummary {
  status: "improved" | "same" | "worse" | "not_enough_data";
  deltas: Record<string, number>;
  summary: string;
}

export interface FollowUp {
  id: number;
  child: number;
  child_name: string;
  centre_name: string;
  due_date: string;
  reason: string;
  status: "pending" | "overdue" | "done";
  completed_at: string | null;
}

export interface HomeVisit {
  id: number;
  child: number;
  child_name: string;
  visit_date: string;
  notes: string;
}

export interface Referral {
  id: number;
  child: number;
  child_name: string;
  centre_name: string;
  facility: string;
  reason: string;
  status: "open" | "visited" | "closed";
  referred_date: string;
}

export interface Child {
  id: number;
  client_uuid: string;
  centre: number;
  centre_name: string;
  name: string;
  sex: "M" | "F";
  date_of_birth: string;
  guardian_name: string;
  age_months: number;
  age_display: string;
  latest: Measurement | null;
  status_chips: string[];
  risk?: RiskAssessment;
  progress?: ProgressSummary | null;
  created_at: string;
}
