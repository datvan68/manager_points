import { Student } from '@/api/student-api';
import { Class } from '@/api/class-api';
import { Department } from '@/api/department-api';
import { Semester } from '@/api/semester-api';
import { EvaluationPeriod } from '@/api/evaluation-period-api';
import { SummaryPoint } from '@/api/summaries-point-api';
import { DailyClassReport } from '@/api/daily-class-report-api';
import { AcademicRecord } from '@/api/academic-record-api';
import { StudentTask } from '@/api/task-api';
import { NotificationItem } from '@/api/notification-api';
import { Criterion } from '@/api/criteria-api';
import { Category } from '@/api/category-api';

export interface UserInfo {
  id: string;
  user_name?: string;
  username?: string;
  role?: string;
  roleName?: string;
  roleCode?: string;
  permissions?: string[];
  studentId?: string;
  classId?: string;
}

export interface StudentHighlightItem {
  studentId: string;
  classId?: string;
  studentName: string;
  studentCode?: string;
  className?: string;
  currentScore?: number | null;
  grading?: string | null;
  recordCount: number;
  impactScore: number;
  latestRecordTitle?: string;
  latestRecordAt?: string;
  dominantCriterionName?: string;
  groupedRecords?: Array<{ label: string; count: number }>;
  type: 'khen_thuong' | 'cong_diem' | 'ky_luat' | 'score' | 'progress';
  href?: string;
}

export interface StudentPersonalSpotlight {
  studentId: string;
  classId?: string;
  currentScore: number | null;
  grading: string | null;
  evaluationStatus: 'draft' | 'sv_submitted' | 'gv_reviewed' | 'locked' | null;
  positiveRecords: StudentHighlightItem[];
  warningRecords: StudentHighlightItem[];
  totalPositiveCount?: number;
  totalWarningCount?: number;
  nextAction?: {
    label: string;
    href: string;
  };
}

export interface DashboardMetrics {
  roleScope: 'admin' | 'teacher' | 'student' | 'system' | 'unknown';
  activeSemester: Semester | null;
  activePeriod: EvaluationPeriod | null;
  
  // KPI Metrics
  kpis: {
    totalStudents: number;
    totalClasses: number;
    totalDepartments: number;
    averageScore: number;
    pendingMyReviewCount: number; // for teachers (students awaiting review) or students (self awaiting submission)
    studentAttentionCount: number;
    urgentTasksCount: number;
    unreadNotificationsCount: number;
    
    // Student specific
    myCurrentScore: number | null;
    myGrading: string | null;
    myEvaluationStatus: 'draft' | 'sv_submitted' | 'gv_reviewed' | 'locked' | null;
    
    // Operator specific
    todayLoginSuccess: number;
    todayLoginFailure: number;
    pendingSystemRequests: number;
    lastBackupStatus: 'queued' | 'running' | 'success' | 'failed' | null;
    lastBackupTime: string | null;
  };

  // Detailed lists/distributions for charts/panels
  distributions: {
    studentStatus: Record<string, number>;
    evaluationStatus: Record<string, number>;
    classDistributionByDept: Record<string, number>;
    scoreDistribution: {
      xuatsac: number; // >= 90
      tot: number;     // 80-89
      kha: number;     // 65-79
      trungbinh: number; // 50-64
      yeu: number;     // < 50
    };
    attendanceRate: number; // present / (present + absent)
    attendanceTodaySubmitted: number;
    attendanceTodayPending: number;
  };

  // Recent lists
  recentNotifications: NotificationItem[];
  urgentTasks: StudentTask[];
  recentAcademicRecords: AcademicRecord[];
  recentDailyReports: DailyClassReport[];
  
  // Student highlights
  studentHighlights: {
    topScores: StudentHighlightItem[];
    topRewards: StudentHighlightItem[];
    topBonus: StudentHighlightItem[];
    topDiscipline: StudentHighlightItem[];
    topProgress?: StudentHighlightItem[];
    mySpotlight?: StudentPersonalSpotlight;
  };
}

export function getActiveSemester(semesters: Semester[]): Semester | null {
  if (!Array.isArray(semesters)) return null;
  return semesters.find(s => s.status === 'active') || semesters.find(s => s.status === 'upcoming') || null;
}

export function getActiveEvaluationPeriod(periods: EvaluationPeriod[], activeSemesterId: string | null): EvaluationPeriod | null {
  if (!Array.isArray(periods)) return null;
  if (!activeSemesterId) {
    return periods.find(p => p.status !== 'closed') || null;
  }
  return periods.find(p => {
    const semId = typeof p.semester_id === 'object' ? p.semester_id?._id : p.semester_id;
    return semId === activeSemesterId && p.status !== 'closed';
  }) || null;
}

export function calculateAverageScore(summaries: SummaryPoint[]): number {
  if (!Array.isArray(summaries) || summaries.length === 0) return 0;
  const validScores = summaries
    .map(s => Number(s.total_score))
    .filter(score => !isNaN(score) && score >= 0);
  if (validScores.length === 0) return 0;
  const sum = validScores.reduce((acc, curr) => acc + curr, 0);
  return Math.round((sum / validScores.length) * 10) / 10;
}

export function calculateAttendanceRate(reports: DailyClassReport[]): number {
  if (!Array.isArray(reports) || reports.length === 0) return 100;
  let totalPresent = 0;
  let totalAbsent = 0;
  reports.forEach(r => {
    totalPresent += Number(r.total_present) || 0;
    totalAbsent += Number(r.total_absent) || 0;
  });
  const total = totalPresent + totalAbsent;
  if (total === 0) return 100;
  return Math.round((totalPresent / total) * 1000) / 10;
}

export interface BuildDashboardOverviewConfig {
  user: UserInfo | null;
  students: Student[];
  classes: Class[];
  departments: Department[];
  semesters: Semester[];
  periods: EvaluationPeriod[];
  summaries: SummaryPoint[];
  dailyReports?: DailyClassReport[];
  academicRecords: AcademicRecord[];
  criteria?: Criterion[];
  categories?: Category[];
  tasks: StudentTask[];
  notifications: NotificationItem[];
  unreadCount: number;
  systemData?: {
    loginSummary?: any;
    systemRequests?: any[];
    backups?: any[];
  };
  selectedSemesterId?: string | null;
}

export function buildDashboardOverview(config: BuildDashboardOverviewConfig): DashboardMetrics {
  const {
    user,
    students,
    classes,
    departments,
    semesters,
    periods,
    summaries,
    dailyReports = [],
    academicRecords,
    criteria = [],
    categories = [],
    tasks,
    notifications,
    unreadCount,
    systemData,
    selectedSemesterId
  } = config;

  const role = (user?.roleCode || user?.roleName || user?.role || '').toUpperCase();
  const isSysAdmin = role === 'ADMIN' || (user?.permissions || []).includes('ADMIN_FULL');
  
  let roleScope: 'admin' | 'teacher' | 'student' | 'system' | 'unknown' = 'unknown';
  if (isSysAdmin) {
    roleScope = 'admin';
  } else if (role.includes('TEACHER') || role.includes('ADVISOR') || role.includes('GIANG VIEN') || role.includes('CO VAN')) {
    roleScope = 'teacher';
  } else if (role.includes('STUDENT') || role.includes('SINH VIEN') || role.includes('HOC SINH')) {
    roleScope = 'student';
  } else if ((user?.permissions || []).some(p => ['LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'DATABASE_BACKUP_READ'].includes(p))) {
    roleScope = 'system';
  }

  // Determine active semester and period for filtering
  const activeSem = getActiveSemester(semesters);
  const targetSemesterId = selectedSemesterId || (activeSem ? activeSem._id : null);
  const activePeriod = getActiveEvaluationPeriod(periods, targetSemesterId);

  // Helper variables for filtering teacher data
  const teacherClasses = roleScope === 'teacher'
    ? classes.filter(c => {
        const advisorId = typeof c.advisor_id === 'object' ? c.advisor_id?._id : c.advisor_id;
        const userId = typeof c.user_id === 'object' ? c.user_id?._id : c.user_id;
        return advisorId === user?.id || userId === user?.id;
      })
    : [];
  const teacherClassIds = teacherClasses.map(c => c._id);

  // Filter students based on role scope
  let filteredStudents = students;
  if (roleScope === 'student') {
    filteredStudents = students.filter(s => s._id === user?.studentId || (s.user_id && (typeof s.user_id === 'object' ? s.user_id?._id === user?.id : s.user_id === user?.id)));
  } else if (roleScope === 'teacher') {
    filteredStudents = students.filter(s => {
      const classId = typeof s.class_id === 'object' ? s.class_id?._id : s.class_id;
      return classId && teacherClassIds.includes(classId);
    });
  }

  // Filter classes
  let filteredClasses = classes;
  if (roleScope === 'student') {
    filteredClasses = classes.filter(c => c._id === user?.classId);
  } else if (roleScope === 'teacher') {
    filteredClasses = teacherClasses;
  }

  // Filter summaries (scores) - MUST match the target/selected semester
  let filteredSummaries = summaries;
  if (targetSemesterId) {
    filteredSummaries = summaries.filter(s => {
      const semId = typeof s.semester_id === 'object' ? s.semester_id?._id : s.semester_id;
      return semId === targetSemesterId;
    });
  }
  if (roleScope === 'student') {
    filteredSummaries = filteredSummaries.filter(s => {
      const studentId = typeof s.student_id === 'object' ? s.student_id?._id : s.student_id;
      return studentId === user?.studentId;
    });
  } else if (roleScope === 'teacher') {
    filteredSummaries = filteredSummaries.filter(s => {
      const studentId = typeof s.student_id === 'object' ? s.student_id?._id : s.student_id;
      return studentId && filteredStudents.some(fs => fs._id === studentId);
    });
  }

  // Calculate scores
  const avgScore = calculateAverageScore(filteredSummaries);

  // Filter academic records - Match selected semester
  let filteredRecords = academicRecords;
  if (targetSemesterId) {
    filteredRecords = academicRecords.filter(r => {
      const semId = typeof r.semester_id === 'object' ? r.semester_id?._id : r.semester_id;
      return semId === targetSemesterId;
    });
  }
  if (roleScope === 'student') {
    filteredRecords = filteredRecords.filter(r => {
      const studentId = typeof r.student_id === 'object' ? r.student_id?._id : r.student_id;
      return studentId === user?.studentId;
    });
  } else if (roleScope === 'teacher') {
    filteredRecords = filteredRecords.filter(r => {
      const studentId = typeof r.student_id === 'object' ? r.student_id?._id : r.student_id;
      return studentId && filteredStudents.some(fs => fs._id === studentId);
    });
  }

  // Filter tasks
  const urgentTasks = tasks
    .filter(t => t.status !== 'completed' && (t.priority === 'high' || new Date(t.deadline).getTime() - Date.now() < 3 * 24 * 3600 * 1000))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  // Filter notifications
  const recentNotifs = (notifications || []).slice(0, 5);

  // Filter daily reports - Disabled / Removed
  const filteredDailyReports: any[] = [];
  const attendanceRate = 100;

  // Distributions
  const studentStatus: Record<string, number> = {};
  filteredStudents.forEach(s => {
    studentStatus[s.status] = (studentStatus[s.status] || 0) + 1;
  });

  const evaluationStatus: Record<string, number> = {
    draft: 0,
    sv_submitted: 0,
    gv_reviewed: 0,
    locked: 0,
  };
  filteredSummaries.forEach(s => {
    if (evaluationStatus[s.status] !== undefined) {
      evaluationStatus[s.status]++;
    }
  });

  const classDistributionByDept: Record<string, number> = {};
  filteredClasses.forEach(c => {
    let deptName = 'Chưa phân khoa';
    if (c.dept_id) {
      if (typeof c.dept_id === 'object') {
        deptName = c.dept_id.name;
      } else {
        const dept = departments.find(d => d._id === c.dept_id);
        if (dept) deptName = dept.name;
      }
    }
    classDistributionByDept[deptName] = (classDistributionByDept[deptName] || 0) + 1;
  });

  // Calculate score distributions
  const scoreDistribution = {
    xuatsac: 0,
    tot: 0,
    kha: 0,
    trungbinh: 0,
    yeu: 0,
  };
  filteredSummaries.forEach(s => {
    const score = Number(s.total_score);
    if (!isNaN(score)) {
      if (score >= 90) scoreDistribution.xuatsac++;
      else if (score >= 80) scoreDistribution.tot++;
      else if (score >= 65) scoreDistribution.kha++;
      else if (score >= 50) scoreDistribution.trungbinh++;
      else scoreDistribution.yeu++;
    }
  });

  // Action count (pending reviews, etc.)
  let pendingMyReviewCount = 0;
  if (roleScope === 'teacher') {
    pendingMyReviewCount = summaries.filter(s => {
      const semId = typeof s.semester_id === 'object' ? s.semester_id?._id : s.semester_id;
      if (targetSemesterId && semId !== targetSemesterId) return false;
      const studentId = typeof s.student_id === 'object' ? s.student_id?._id : s.student_id;
      const belongsToMyClass = studentId && filteredStudents.some(fs => fs._id === studentId);
      return belongsToMyClass && s.status === 'sv_submitted';
    }).length;
  } else if (roleScope === 'student') {
    const mySummary = filteredSummaries.find(s => {
      const semId = typeof s.semester_id === 'object' ? s.semester_id?._id : s.semester_id;
      return semId === targetSemesterId;
    });
    if (mySummary && mySummary.status === 'draft') {
      pendingMyReviewCount = 1;
    }
  } else if (roleScope === 'admin') {
    pendingMyReviewCount = summaries.filter(s => {
      const semId = typeof s.semester_id === 'object' ? s.semester_id?._id : s.semester_id;
      if (targetSemesterId && semId !== targetSemesterId) return false;
      return s.status === 'gv_reviewed' || s.status === 'sv_submitted';
    }).length;
  }

  // Student specific points
  let myCurrentScore: number | null = null;
  let myGrading: string | null = null;
  let myEvaluationStatus: 'draft' | 'sv_submitted' | 'gv_reviewed' | 'locked' | null = null;
  if (roleScope === 'student') {
    const mySummary = filteredSummaries.find(s => {
      const semId = typeof s.semester_id === 'object' ? s.semester_id?._id : s.semester_id;
      return semId === targetSemesterId;
    });
    if (mySummary) {
      myCurrentScore = mySummary.total_score;
      myGrading = mySummary.grading;
      myEvaluationStatus = mySummary.status;
    }
  }

  // Attendance submission indicators today - Disabled / Removed
  const attendanceTodaySubmitted = 0;
  const attendanceTodayPending = 0;

  // System Operator KPIs
  const todayLoginSuccess = systemData?.loginSummary?.today?.login_success || 0;
  const todayLoginFailure = systemData?.loginSummary?.today?.login_failure || 0;
  const pendingSystemRequests = systemData?.systemRequests?.filter(r => r.status === 'pending').length || 0;
  
  const latestBackup = systemData?.backups?.[0];
  const lastBackupStatus = latestBackup ? latestBackup.status : null;
  const lastBackupTime = latestBackup ? latestBackup.createdAt : null;

  // Compute student highlights maps
  const studentsMap = new Map(filteredStudents.map(s => [s._id, s]));
  const classesMap = new Map(classes.map(c => [c._id, c]));
  const criteriaMap = new Map(criteria.map(crit => [crit._id, crit]));
  const summariesMap = new Map<string, SummaryPoint>();
  filteredSummaries.forEach(s => {
    const studentId = typeof s.student_id === 'object' ? s.student_id?._id : s.student_id;
    if (studentId) {
      summariesMap.set(studentId, s);
    }
  });

  const studentAggregates = new Map<string, {
    studentId: string;
    khenThuongCount: number;
    congDiemPoints: number;
    kyLuatCount: number;
    records: any[];
    totalPointsEffect: number;
  }>();

  const getRecordQuantity = (record: AcademicRecord) => {
    const quantity = Number(record.quantity);
    return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  };

  filteredRecords.forEach(r => {
    if (r.status !== 'active' || r.is_deleted) return;
    
    // Check semester filter
    if (targetSemesterId) {
      const recordSemId = typeof r.semester_id === 'object' ? r.semester_id?._id : r.semester_id;
      if (recordSemId !== targetSemesterId) return;
    }

    const studentId = typeof r.student_id === 'object' ? r.student_id?._id : r.student_id;
    if (!studentId || !studentsMap.has(studentId)) return;
    
    // Resolve criterion
    let crit: any = null;
    if (r.criterion_id) {
      crit = typeof r.criterion_id === 'object' ? r.criterion_id : criteriaMap.get(r.criterion_id);
    } else if (r.criteria_id) {
      crit = typeof r.criteria_id === 'object' ? r.criteria_id : criteriaMap.get(r.criteria_id);
    }
    
    const critType = crit?.criterion_type;
    const pointsEffect = Number(r.points_effect) !== undefined && !isNaN(Number(r.points_effect)) 
      ? Number(r.points_effect) 
      : (crit?.score_per_unit || 0);

    if (!studentAggregates.has(studentId)) {
      studentAggregates.set(studentId, {
        studentId,
        khenThuongCount: 0,
        congDiemPoints: 0,
        kyLuatCount: 0,
        records: [],
        totalPointsEffect: 0,
      });
    }
    
    const agg = studentAggregates.get(studentId)!;
    const quantity = getRecordQuantity(r);
    agg.records.push({ record: r, crit, pointsEffect, quantity });
    agg.totalPointsEffect += pointsEffect;

    if (critType === 'khen_thuong') {
      agg.khenThuongCount += quantity;
    } else if (critType === 'cong_diem') {
      agg.congDiemPoints += pointsEffect;
    }
    
    if (critType === 'ky_luat') {
      agg.kyLuatCount += quantity;
    }
  });

  const getLatestRecordInfo = (records: any[]) => {
    if (records.length === 0) return {};
    const sorted = [...records].sort((a, b) => {
      const timeA = new Date(a.record.recorded_at || a.record.createdAt || 0).getTime();
      const timeB = new Date(b.record.recorded_at || b.record.createdAt || 0).getTime();
      return timeB - timeA;
    });
    return {
      latestRecordTitle: sorted[0].record.record_title || sorted[0].crit?.criterion_name || 'Ghi nhận mới',
      latestRecordAt: sorted[0].record.recorded_at || sorted[0].record.createdAt,
      dominantCriterionName: sorted[0].crit?.criterion_name
    };
  };

  const getGroupedRecords = (records: any[]) => {
    const groups = new Map<string, number>();
    records.forEach(({ record, crit, quantity }: any) => {
      const label = crit?.criterion_name || record.record_title || 'Ghi nhận';
      groups.set(label, (groups.get(label) || 0) + (quantity || 1));
    });
    return Array.from(groups, ([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'vi'));
  };

  // Top Khen Thuong
  const topRewards: StudentHighlightItem[] = Array.from(studentAggregates.values())
    .filter(agg => agg.khenThuongCount > 0)
    .map(agg => {
      const s = studentsMap.get(agg.studentId)!;
      const summary = summariesMap.get(s._id);
      const score = summary ? Number(summary.total_score) : null;
      const grading = summary ? summary.grading : null;
      
      const rewardRecords = agg.records.filter(r => r.crit?.criterion_type === 'khen_thuong');
      const latest = getLatestRecordInfo(rewardRecords);
      const groupedRecords = getGroupedRecords(rewardRecords);
      const rewardImpactScore = rewardRecords.reduce((sum, r) => sum + r.pointsEffect, 0);
      
      const classId = typeof s.class_id === 'object' ? s.class_id?._id : s.class_id;
      const cls = classId ? classesMap.get(classId) : null;
      const className = cls?.class_name || '';

      return {
        studentId: s._id,
        classId,
        studentName: s.full_name || '',
        studentCode: s.student_code || '',
        className,
        currentScore: score,
        grading,
        recordCount: agg.khenThuongCount,
        impactScore: rewardImpactScore,
        ...latest,
        groupedRecords,
        type: 'khen_thuong' as const,
        href: classId ? `/students/${classId}/${s._id}` : `/students`
      };
    })
    .sort((a, b) => {
      if (b.recordCount !== a.recordCount) return b.recordCount - a.recordCount;
      if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
      const timeA = a.latestRecordAt ? new Date(a.latestRecordAt).getTime() : 0;
      const timeB = b.latestRecordAt ? new Date(b.latestRecordAt).getTime() : 0;
      return timeB - timeA;
    });

  // Top Diem Cong
  const topBonus: StudentHighlightItem[] = Array.from(studentAggregates.values())
    .filter(agg => agg.congDiemPoints > 0)
    .map(agg => {
      const s = studentsMap.get(agg.studentId)!;
      const summary = summariesMap.get(s._id);
      const score = summary ? Number(summary.total_score) : null;
      const grading = summary ? summary.grading : null;
      
      const bonusRecords = agg.records.filter(r => r.crit?.criterion_type === 'cong_diem');
      const latest = getLatestRecordInfo(bonusRecords);
      const groupedRecords = getGroupedRecords(bonusRecords);
      const bonusImpactScore = bonusRecords.reduce((sum, r) => sum + r.pointsEffect, 0);
      
      const classId = typeof s.class_id === 'object' ? s.class_id?._id : s.class_id;
      const cls = classId ? classesMap.get(classId) : null;
      const className = cls?.class_name || '';

      return {
        studentId: s._id,
        classId,
        studentName: s.full_name || '',
        studentCode: s.student_code || '',
        className,
        currentScore: score,
        grading,
        recordCount: bonusRecords.reduce((sum, r) => sum + r.quantity, 0),
        impactScore: bonusImpactScore,
        ...latest,
        groupedRecords,
        type: 'cong_diem' as const,
        href: classId ? `/students/${classId}/${s._id}` : `/students`
      };
    })
    .sort((a, b) => {
      if (b.recordCount !== a.recordCount) return b.recordCount - a.recordCount;
      if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
      const timeA = a.latestRecordAt ? new Date(a.latestRecordAt).getTime() : 0;
      const timeB = b.latestRecordAt ? new Date(b.latestRecordAt).getTime() : 0;
      return timeB - timeA;
    });

  // Top Ky Luat
  const topDiscipline: StudentHighlightItem[] = Array.from(studentAggregates.values())
    .filter(agg => agg.kyLuatCount > 0)
    .map(agg => {
      const s = studentsMap.get(agg.studentId)!;
      const summary = summariesMap.get(s._id);
      const score = summary ? Number(summary.total_score) : null;
      const grading = summary ? summary.grading : null;
      
      const disciplineRecords = agg.records.filter(r => r.crit?.criterion_type === 'ky_luat');
      const latest = getLatestRecordInfo(disciplineRecords);
      const groupedRecords = getGroupedRecords(disciplineRecords);
      const disciplineImpactScore = disciplineRecords.reduce((sum, r) => sum + r.pointsEffect, 0);
      
      const classId = typeof s.class_id === 'object' ? s.class_id?._id : s.class_id;
      const cls = classId ? classesMap.get(classId) : null;
      const className = cls?.class_name || '';

      return {
        studentId: s._id,
        classId,
        studentName: s.full_name || '',
        studentCode: s.student_code || '',
        className,
        currentScore: score,
        grading,
        recordCount: agg.kyLuatCount,
        impactScore: disciplineImpactScore,
        ...latest,
        groupedRecords,
        type: 'ky_luat' as const,
        href: classId ? `/students/${classId}/${s._id}` : `/students`
      };
    })
    .sort((a, b) => {
      if (b.recordCount !== a.recordCount) return b.recordCount - a.recordCount;
      if (a.impactScore !== b.impactScore) return a.impactScore - b.impactScore;
      const timeA = a.latestRecordAt ? new Date(a.latestRecordAt).getTime() : 0;
      const timeB = b.latestRecordAt ? new Date(b.latestRecordAt).getTime() : 0;
      return timeB - timeA;
    });

  // Top Scores
  const topScores: StudentHighlightItem[] = filteredStudents
    .map(s => {
      const summary = summariesMap.get(s._id);
      const score = summary ? Number(summary.total_score) : null;
      const grading = summary ? summary.grading : null;
      const agg = studentAggregates.get(s._id);
      const latest = getLatestRecordInfo(agg?.records || []);
      
      const classId = typeof s.class_id === 'object' ? s.class_id?._id : s.class_id;
      const cls = classId ? classesMap.get(classId) : null;
      const className = cls?.class_name || '';

      return {
        studentId: s._id,
        classId,
        studentName: s.full_name || '',
        studentCode: s.student_code || '',
        className,
        currentScore: score,
        grading,
        recordCount: agg?.records.reduce((sum, r) => sum + r.quantity, 0) || 0,
        impactScore: agg?.totalPointsEffect || 0,
        ...latest,
        type: 'score' as const,
        href: classId ? `/students/${classId}/${s._id}` : `/students`
      };
    })
    .filter(item => item.currentScore !== null)
    .sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));

  // Spotlight for student
  let mySpotlight: StudentPersonalSpotlight | undefined = undefined;
  if (roleScope === 'student' && user?.studentId) {
    const s = studentsMap.get(user.studentId);
    if (s) {
      const summary = summariesMap.get(s._id);
      const score = summary ? Number(summary.total_score) : null;
      const grading = summary ? summary.grading : null;
      const evaluationStatus = summary ? summary.status as any : null;
      
      const agg = studentAggregates.get(s._id);
      const records = agg?.records || [];
      
      const classId = typeof s.class_id === 'object' ? s.class_id?._id : s.class_id;
      const cls = classId ? classesMap.get(classId) : null;
      const className = cls?.class_name || '';

      const mappedRecords = records.map(r => {
        const latest = getLatestRecordInfo([r]);
        return {
          studentId: s._id,
          classId,
          studentName: s.full_name || '',
          studentCode: s.student_code || '',
          className,
          currentScore: score,
          grading,
          recordCount: r.quantity,
          impactScore: r.pointsEffect,
          ...latest,
          type: r.crit?.criterion_type === 'ky_luat' ? ('ky_luat' as const) : ('cong_diem' as const),
          href: classId ? `/students/${classId}/${s._id}` : `/students`
        };
      });

      const positiveRecords = mappedRecords.filter(r => r.type !== 'ky_luat');
      const warningRecords = mappedRecords.filter(r => r.type === 'ky_luat');

      let nextActionLabel = 'Tự đánh giá điểm rèn luyện';
      let nextActionHref = '/grading/score';
      if (evaluationStatus === 'sv_submitted') {
        nextActionLabel = 'Xem hồ sơ đã nộp';
      } else if (evaluationStatus === 'gv_reviewed') {
        nextActionLabel = 'Hồ sơ đã được duyệt';
      } else if (evaluationStatus === 'locked') {
        nextActionLabel = 'Xem kết quả chính thức';
      }

      mySpotlight = {
        studentId: s._id,
        classId,
        currentScore: score,
        grading,
        evaluationStatus,
        positiveRecords,
        warningRecords,
        nextAction: {
          label: nextActionLabel,
          href: nextActionHref
        }
      };
    }
  }

  return {
    roleScope,
    activeSemester: activeSem,
    activePeriod,
    kpis: {
      totalStudents: filteredStudents.length,
      totalClasses: filteredClasses.length,
      totalDepartments: departments.length,
      averageScore: avgScore,
      pendingMyReviewCount,
      studentAttentionCount: topDiscipline.filter(item => item.recordCount > 3).length,
      urgentTasksCount: urgentTasks.length,
      unreadNotificationsCount: unreadCount,
      
      myCurrentScore,
      myGrading,
      myEvaluationStatus,
      
      todayLoginSuccess,
      todayLoginFailure,
      pendingSystemRequests,
      lastBackupStatus,
      lastBackupTime,
    },
    distributions: {
      studentStatus,
      evaluationStatus,
      classDistributionByDept,
      scoreDistribution,
      attendanceRate,
      attendanceTodaySubmitted,
      attendanceTodayPending,
    },
    recentNotifications: recentNotifs,
    urgentTasks: urgentTasks.slice(0, 5),
    recentAcademicRecords: filteredRecords.slice(0, 5),
    recentDailyReports: filteredDailyReports.slice(0, 5),
    studentHighlights: {
      topScores,
      topRewards,
      topBonus,
      topDiscipline,
      mySpotlight
    }
  };
}
