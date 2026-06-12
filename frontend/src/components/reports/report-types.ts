import { Student } from '@/api/student-api';
import { Class } from '@/api/class-api';
import { Department } from '@/api/department-api';
import { Semester } from '@/api/semester-api';
import { EvaluationPeriod } from '@/api/evaluation-period-api';
import { SummaryPoint } from '@/api/summaries-point-api';
import { EvaluationDetail } from '@/api/evaluation-detail-api';
import { AcademicRecord } from '@/api/academic-record-api';
import { DailyClassReport } from '@/api/daily-class-report-api';
import { StudentTask, StudentTaskProgress } from '@/api/task-api';
import { NotificationItem } from '@/api/notification-api';
import { LoginLog } from '@/api/system-api';
import { Category } from '@/api/category-api';
import { Criterion } from '@/api/criteria-api';

export interface ReportFilterState {
  semesterId: string;
  evaluationPeriodId: string;
  departmentId: string;
  classId: string;
  startDate: string;
  endDate: string;
  searchQuery: string;
  status: string;
}

export interface ReportsDataset {
  students: Student[];
  classes: Class[];
  departments: Department[];
  semesters: Semester[];
  evaluationPeriods: EvaluationPeriod[];
  summaries: SummaryPoint[];
  evaluationDetails: EvaluationDetail[];
  categories: Category[];
  criteria: Criterion[];
  academicRecords: AcademicRecord[];
  dailyReports: DailyClassReport[];
  tasks: StudentTask[];
  taskProgress: StudentTaskProgress[];
  notifications: NotificationItem[];
  loginLogs: LoginLog[];
}

export interface StudentReportRow {
  key: string;
  _id: string;
  student_code: string;
  full_name: string;
  email: string;
  class_name: string;
  department_name: string;
  class_year: string;
  class_type: string;
  headquarters: string;
  status: string;
  account_status: string;
  createdAt: string;
}

export interface ScoreReportRow {
  key: string;
  _id: string;
  student_code: string;
  full_name: string;
  class_name: string;
  department_name: string;
  semester_name: string;
  total_score: number;
  grading: string;
  status: string;
  updatedAt: string;
}

export interface ScoreDetailReportRow {
  key: string;
  student_code: string;
  full_name: string;
  class_name: string;
  category_name: string;
  criterion_name: string;
  current_count: number;
  system_score: number;
  sv_score: number;
  gv_score: number;
  final_score: number;
  status: string;
}

export interface AcademicRecordReportRow {
  key: string;
  _id: string;
  recorded_at: string;
  student_code: string;
  full_name: string;
  class_name: string;
  department_name: string;
  type: 'khen_thuong' | 'cong_diem' | 'ky_luat' | 'khac';
  record_title: string;
  description: string;
  points_effect: number;
  recorded_by: string;
  status: string;
}

export interface AttendanceReportRow {
  key: string;
  _id: string;
  report_date: string;
  class_name: string;
  department_name: string;
  teacher_name: string;
  total_present: number;
  total_absent: number;
  total: number;
  attendance_rate: number;
  class_note: string;
}

export interface TaskReportRow {
  key: string;
  _id: string;
  title: string;
  type: string;
  subject: string;
  deadline: string;
  priority: string;
  status: string;
  targetType: string;
  targetScope: string;
  completion_rate: number;
  completed_count: number;
  total_count: number;
}

export interface TaskProgressReportRow {
  key: string;
  _id: string;
  taskTitle: string;
  assigneeName: string;
  assigneeType: string;
  className: string;
  status: string;
  startedAt: string;
  completedAt: string;
  deadline: string;
}

export interface SystemReportRow {
  key: string;
  _id: string;
  login_time: string;
  user_name: string;
  email: string;
  role_name: string;
  ip_address: string;
  action: string;
  details: string;
}

export interface ChartDatum {
  name: string;
  value: number;
  [key: string]: any;
}

export interface HeatmapDatum {
  x: string; // date or class
  y: string; // class or weekday
  value: number; // rate or count
}

export interface ReportKpi {
  title: string;
  value: string | number;
  description: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  iconName: string;
}
