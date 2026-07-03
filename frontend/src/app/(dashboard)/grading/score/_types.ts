export type GradingStatus =
  | "draft"
  | "sv_submitted"
  | "gv_reviewed"
  | "locked"
  | "no_summary";

// === NEW: Role-Aware Count Types ===

export interface CountsByRole {
  student?: number;
  teacher?: number;
  supervisor?: number;
  admin?: number;
  system?: number;
  import?: number;
}

export type RecordedByRole = 'student' | 'teacher' | 'supervisor' | 'admin' | 'system' | 'import';

export type ResolutionSource = 'teacher_review' | 'supervisor_approval' | 'admin_override' | 'automatic_rule';

/** Extended evaluation detail with role-aware fields from backend */
export interface EvaluationDetailExtended {
  criterion_id: string | { _id: string };
  current_count: number;
  selected_option_id?: string | null;
  selected_option_label?: string | null;
  selected_option_score?: number | null;
  system_score?: number | null;
  sv_score?: number | null;
  sv_submitted_at?: string | null;
  gv_score?: number | null;
  gv_reviewed_at?: string | null;
  gv_reviewed_by?: string | null;
  final_score?: number | null;
  locked_at?: string | null;
  locked_by?: string | null;
  status?: string;
  description?: string;
  // Role-aware fields
  counts_by_role?: CountsByRole | null;
  resolved_count?: number | null;
  resolved_by_role?: string | null;
  resolved_at?: string | null;
  resolution_source?: ResolutionSource | null;
  source_record_count?: number;
  last_source_record_id?: string | null;
  last_record_at?: string | null;
  has_conflict?: boolean;
}

export interface StudentData {
  id: string; // MongoDB ObjectId
  studentCode?: string;
  name: string;
  email: string;
  dob: string;
  gender: string;
  score: number;
  status: string;
  gradingStatus: GradingStatus;
  classId: string;
  className?: string;
  avatarUrl?: string;
  colorTheme?: { bg: string; text: string };
}
