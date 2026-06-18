export type GradingStatus =
  | "draft"
  | "sv_submitted"
  | "gv_reviewed"
  | "locked"
  | "no_summary";

export interface StudentData {
  id: string;
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
