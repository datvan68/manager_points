import { 
  ReportsDataset, 
  StudentReportRow, 
  ScoreReportRow, 
  ScoreDetailReportRow,
  AcademicRecordReportRow, 
  AttendanceReportRow, 
  TaskReportRow, 
  TaskProgressReportRow,
  SystemReportRow,
  ReportFilterState,
  ReportKpi,
  ChartDatum
} from './report-types';
import { format } from 'date-fns';

// Helper to safely extract ID from an entity which could be string or object
export function getEntityId(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id;
  if (typeof value === 'object' && value.id) return value.id;
  return String(value);
}

// Safely format date strings
export function safeFormatDate(dateStr?: string, pattern: string = 'dd/MM/yyyy'): string {
  if (!dateStr) return 'Chưa xác định';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // Try to parse manually if it's in format dd/MM/yyyy
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const parsedDate = new Date(y, m, d);
        if (!isNaN(parsedDate.getTime())) {
          return format(parsedDate, pattern);
        }
      }
      return dateStr;
    }
    return format(date, pattern);
  } catch {
    return dateStr;
  }
}

// Convert Vietnamese status keys to display string
export function translateStatus(status?: string): string {
  if (!status) return 'Chưa xác định';
  const mapping: Record<string, string> = {
    'Studying': 'Đang học',
    'Reserved': 'Bảo lưu',
    'Dropped': 'Thôi học',
    'Graduated': 'Tốt nghiệp',
    'Suspended': 'Đình chỉ',
    'active': 'Hoạt động',
    'inactive': 'Không hoạt động',
    'locked': 'Đã khóa',
    'draft': 'Nháp',
    'sv_submitted': 'SV đã nộp',
    'gv_reviewed': 'GV đã duyệt',
    'pending': 'Chờ duyệt',
    'sv_phase': 'SV tự đánh giá',
    'gv_phase': 'GV duyệt',
    'admin_phase': 'Admin chốt',
    'closed': 'Đã đóng',
    'not_started': 'Chưa bắt đầu',
    'in_progress': 'Đang thực hiện',
    'completed': 'Hoàn thành',
    'high': 'Cao',
    'medium': 'Trung bình',
    'low': 'Thấp',
    'project': 'Dự án',
    'assignment': 'Bài tập',
    'activity': 'Hoạt động',
    'khen_thuong': 'Khen thưởng',
    'cong_diem': 'Cộng điểm',
    'ky_luat': 'Kỷ luật',
    'warning': 'Cảnh báo',
    'success': 'Thành công',
    'info': 'Thông tin',
    'system': 'Hệ thống',
    'login_success': 'Đăng nhập thành công',
    'login_failure': 'Đăng nhập thất bại',
    'logout': 'Đăng xuất',
    'password_reset': 'Đặt lại mật khẩu',
    'password_change': 'Đổi mật khẩu',
    'admin_reset_password': 'Admin đặt lại MK'
  };
  return mapping[status] || status;
}

// Helper to filter and map data based on filter state
export function processReportsData(
  dataset: ReportsDataset,
  filters: ReportFilterState
) {
  const { students, classes, departments, semesters, summaries, evaluationDetails, categories, criteria, academicRecords, dailyReports, tasks, taskProgress, notifications, loginLogs } = dataset;

  // Helper maps for faster lookup
  const deptMap = new Map(departments.map(d => [d._id, d.name]));
  const classMap = new Map(classes.map(c => [c._id, c]));
  const semesterMap = new Map(semesters.map(s => [s._id, s]));
  const categoryMap = new Map(categories.map(c => [c._id, c.category_name]));
  const criterionMap = new Map(criteria.map(cr => [cr._id, cr]));

  const getStudentClassAndDept = (classIdStr: string) => {
    const cls = classMap.get(classIdStr);
    if (!cls) return { className: 'Chưa xác định', deptName: 'Chưa xác định', classYear: 'Chưa xác định', classType: 'Chưa xác định', headquarters: 'Chưa xác định' };
    const deptIdStr = getEntityId(cls.dept_id);
    const deptName = deptMap.get(deptIdStr) || 'Chưa xác định';
    return {
      className: cls.class_name || 'Chưa xác định',
      deptName,
      classYear: cls.class_year || 'Chưa xác định',
      classType: cls.class_type || 'Chưa xác định',
      headquarters: cls.headquarters || 'Chưa xác định'
    };
  };

  // 1. FILTER STUDENTS
  const filteredStudents = students.filter(student => {
    const classIdStr = getEntityId(student.class_id);
    const cls = classMap.get(classIdStr);
    const deptIdStr = cls ? getEntityId(cls.dept_id) : '';

    if (filters.departmentId && deptIdStr !== filters.departmentId) return false;
    if (filters.classId && classIdStr !== filters.classId) return false;
    if (filters.status && student.status !== filters.status) return false;
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchName = student.full_name?.toLowerCase().includes(query);
      const matchCode = student.student_code?.toLowerCase().includes(query);
      const matchEmail = student.email?.toLowerCase().includes(query);
      if (!matchName && !matchCode && !matchEmail) return false;
    }
    return true;
  });

  const studentRows: StudentReportRow[] = filteredStudents.map(s => {
    const classIdStr = getEntityId(s.class_id);
    const details = getStudentClassAndDept(classIdStr);
    return {
      key: s._id,
      _id: s._id,
      student_code: s.student_code,
      full_name: s.full_name,
      email: s.email || 'Chưa cung cấp',
      class_name: details.className,
      department_name: details.deptName,
      class_year: details.classYear,
      class_type: details.classType,
      headquarters: details.headquarters,
      status: translateStatus(s.status),
      account_status: translateStatus(s.account_status || 'active'),
      createdAt: safeFormatDate(s.createdAt)
    };
  });

  // 2. FILTER SCORE SUMMARIES
  const filteredSummaries = summaries.filter(sum => {
    const studentIdStr = getEntityId(sum.student_id);
    const student = students.find(s => s._id === studentIdStr);
    if (!student) return false; // Exclude summaries without valid student

    const classIdStr = getEntityId(student.class_id);
    const cls = classMap.get(classIdStr);
    const deptIdStr = cls ? getEntityId(cls.dept_id) : '';
    const semesterIdStr = getEntityId(sum.semester_id);

    if (filters.semesterId && semesterIdStr !== filters.semesterId) return false;
    if (filters.departmentId && deptIdStr !== filters.departmentId) return false;
    if (filters.classId && classIdStr !== filters.classId) return false;
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchName = student.full_name?.toLowerCase().includes(query);
      const matchCode = student.student_code?.toLowerCase().includes(query);
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  const scoreRows: ScoreReportRow[] = filteredSummaries.map(sum => {
    const studentIdStr = getEntityId(sum.student_id);
    const student = students.find(s => s._id === studentIdStr)!;
    const classIdStr = getEntityId(student.class_id);
    const details = getStudentClassAndDept(classIdStr);
    const semIdStr = getEntityId(sum.semester_id);
    const sem = semesterMap.get(semIdStr);

    return {
      key: sum._id,
      _id: sum._id,
      student_code: student.student_code,
      full_name: student.full_name,
      class_name: details.className,
      department_name: details.deptName,
      semester_name: sem ? sem.semester_name : 'Chưa xác định',
      total_score: sum.total_score,
      grading: sum.grading || 'Chưa xếp loại',
      status: translateStatus(sum.status),
      updatedAt: safeFormatDate(sum.updatedAt, 'dd/MM/yyyy HH:mm')
    };
  });

  // 3. FILTER SCORE DETAILS (Evaluation Details)
  const filteredDetails = evaluationDetails.filter(detail => {
    const summaryIdStr = getEntityId(detail.summary_id);
    const sum = summaries.find(s => s._id === summaryIdStr);
    if (!sum) return false;

    const studentIdStr = getEntityId(sum.student_id);
    const student = students.find(s => s._id === studentIdStr);
    if (!student) return false;

    const classIdStr = getEntityId(student.class_id);
    const cls = classMap.get(classIdStr);
    const deptIdStr = cls ? getEntityId(cls.dept_id) : '';
    const semesterIdStr = getEntityId(sum.semester_id);

    if (filters.semesterId && semesterIdStr !== filters.semesterId) return false;
    if (filters.departmentId && deptIdStr !== filters.departmentId) return false;
    if (filters.classId && classIdStr !== filters.classId) return false;

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchName = student.full_name?.toLowerCase().includes(query);
      const matchCode = student.student_code?.toLowerCase().includes(query);
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  const scoreDetailRows: ScoreDetailReportRow[] = filteredDetails.map(detail => {
    const summaryIdStr = getEntityId(detail.summary_id);
    const sum = summaries.find(s => s._id === summaryIdStr)!;
    const studentIdStr = getEntityId(sum.student_id);
    const student = students.find(s => s._id === studentIdStr)!;
    const classIdStr = getEntityId(student.class_id);
    const details = getStudentClassAndDept(classIdStr);

    const critIdStr = getEntityId(detail.criterion_id);
    const crit = criterionMap.get(critIdStr);
    const critName = crit ? crit.criterion_name : 'Tiêu chí khác';
    
    const catIdStr = crit ? getEntityId(crit.category_id) : '';
    const catName = categoryMap.get(catIdStr) || 'Nhóm khác';

    return {
      key: detail._id,
      student_code: student.student_code,
      full_name: student.full_name,
      class_name: details.className,
      category_name: catName,
      criterion_name: critName,
      current_count: detail.current_count || 0,
      system_score: detail.system_score || 0,
      sv_score: detail.sv_score || 0,
      gv_score: detail.gv_score || 0,
      final_score: detail.final_score || 0,
      status: translateStatus(detail.status || 'draft')
    };
  });

  // 4. FILTER ACADEMIC RECORDS (Khen thuong / Ky luat)
  const filteredRecords = academicRecords.filter(rec => {
    if (rec.is_deleted) return false;
    const studentIdStr = getEntityId(rec.student_id);
    const student = students.find(s => s._id === studentIdStr);
    if (!student) return false;

    const classIdStr = getEntityId(student.class_id);
    const cls = classMap.get(classIdStr);
    const deptIdStr = cls ? getEntityId(cls.dept_id) : '';
    const semesterIdStr = getEntityId(rec.semester_id);

    if (filters.semesterId && semesterIdStr !== filters.semesterId) return false;
    if (filters.departmentId && deptIdStr !== filters.departmentId) return false;
    if (filters.classId && classIdStr !== filters.classId) return false;

    // Date range filter
    const recDateStr = rec.recorded_at || rec.date_record;
    if (recDateStr && (filters.startDate || filters.endDate)) {
      try {
        const recDate = new Date(recDateStr);
        if (filters.startDate) {
          const start = new Date(filters.startDate);
          start.setHours(0, 0, 0, 0);
          if (recDate < start) return false;
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (recDate > end) return false;
        }
      } catch {
        // Skip invalid date filter
      }
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchName = student.full_name?.toLowerCase().includes(query);
      const matchCode = student.student_code?.toLowerCase().includes(query);
      const matchTitle = rec.record_title?.toLowerCase().includes(query);
      if (!matchName && !matchCode && !matchTitle) return false;
    }
    return true;
  });

  const recordRows: AcademicRecordReportRow[] = filteredRecords.map(rec => {
    const studentIdStr = getEntityId(rec.student_id);
    const student = students.find(s => s._id === studentIdStr)!;
    const classIdStr = getEntityId(student.class_id);
    const details = getStudentClassAndDept(classIdStr);

    // Determine type (khen_thuong, ky_luat, cong_diem)
    let type: 'khen_thuong' | 'cong_diem' | 'ky_luat' | 'khac' = 'khac';
    const effect = rec.points_effect || 0;
    const titleLower = (rec.record_title || '').toLowerCase();
    
    if (titleLower.includes('kỷ luật') || titleLower.includes('vi phạm') || titleLower.includes('cảnh cáo') || effect < 0) {
      type = 'ky_luat';
    } else if (titleLower.includes('khen thưởng') || titleLower.includes('giải thưởng') || titleLower.includes('xuất sắc')) {
      type = 'khen_thuong';
    } else if (effect > 0) {
      type = 'cong_diem';
    }

    let recordedByStr = 'Hệ thống';
    if (rec.recorded_by) {
      recordedByStr = typeof rec.recorded_by === 'object' ? (rec.recorded_by.full_name || rec.recorded_by.user_name || 'Quản trị viên') : String(rec.recorded_by);
    }

    return {
      key: rec._id,
      _id: rec._id,
      recorded_at: safeFormatDate(rec.recorded_at || rec.date_record),
      student_code: student.student_code,
      full_name: student.full_name,
      class_name: details.className,
      department_name: details.deptName,
      type,
      record_title: rec.record_title || 'Ghi nhận rèn luyện',
      description: rec.description || 'Không có mô tả',
      points_effect: effect,
      recorded_by: recordedByStr,
      status: translateStatus(rec.status || 'active')
    };
  });

  // 5. FILTER ATTENDANCE REPORTS (Daily Class Reports)
  const filteredAttendance = dailyReports.filter(rep => {
    const classIdStr = getEntityId(rep.class_id);
    const cls = classMap.get(classIdStr);
    if (!cls) return false;
    const deptIdStr = getEntityId(cls.dept_id);

    if (filters.departmentId && deptIdStr !== filters.departmentId) return false;
    if (filters.classId && classIdStr !== filters.classId) return false;

    // Date range filter
    if (rep.report_date && (filters.startDate || filters.endDate)) {
      try {
        const repDate = new Date(rep.report_date);
        if (filters.startDate) {
          const start = new Date(filters.startDate);
          start.setHours(0, 0, 0, 0);
          if (repDate < start) return false;
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (repDate > end) return false;
        }
      } catch {
        // Skip
      }
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchClass = cls.class_name?.toLowerCase().includes(query);
      const matchTeacher = rep.teacher_name?.toLowerCase().includes(query);
      if (!matchClass && !matchTeacher) return false;
    }
    return true;
  });

  const attendanceRows: AttendanceReportRow[] = filteredAttendance.map(rep => {
    const classIdStr = getEntityId(rep.class_id);
    const details = getStudentClassAndDept(classIdStr);
    const total = (rep.total_present || 0) + (rep.total_absent || 0);
    const rate = total > 0 ? (rep.total_present || 0) / total : 1;

    return {
      key: rep._id,
      _id: rep._id,
      report_date: safeFormatDate(rep.report_date),
      class_name: details.className,
      department_name: details.deptName,
      teacher_name: rep.teacher_name || 'Chưa ghi nhận',
      total_present: rep.total_present || 0,
      total_absent: rep.total_absent || 0,
      total,
      attendance_rate: rate,
      class_note: rep.class_note || (rep as any).class_notes || 'Không có ghi chú'
    };
  });

  // 6. FILTER TASKS AND PROGRESS
  const filteredTasks = tasks.filter(task => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchTitle = task.title?.toLowerCase().includes(query);
      const matchSubj = task.subject?.toLowerCase().includes(query);
      if (!matchTitle && !matchSubj) return false;
    }
    return true;
  });

  const taskRows: TaskReportRow[] = filteredTasks.map(task => {
    // Calculate completion rate based on taskProgress
    const taskIdStr = task._id || task.id;
    const progressList = taskProgress.filter(p => p.taskId === taskIdStr);
    
    // If progress API didn't return anything or empty, fallback to 0
    const total = progressList.length;
    const completed = progressList.filter(p => p.status === 'completed').length;
    const rate = total > 0 ? completed / total : 0;

    return {
      key: taskIdStr,
      _id: taskIdStr,
      title: task.title,
      type: translateStatus(task.type),
      subject: task.subject,
      deadline: safeFormatDate(task.deadline),
      priority: translateStatus(task.priority),
      status: translateStatus(task.status),
      targetType: translateStatus(task.targetType),
      targetScope: translateStatus(task.targetScope),
      completion_rate: rate,
      completed_count: completed,
      total_count: total
    };
  });

  // 6b. FILTER TASK PROGRESS
  const filteredTaskProgress = taskProgress.filter(prog => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchName = prog.assigneeName?.toLowerCase().includes(query);
      const matchTask = prog.taskTitle?.toLowerCase().includes(query);
      if (!matchName && !matchTask) return false;
    }
    return true;
  });

  const taskProgressRows: TaskProgressReportRow[] = filteredTaskProgress.map(prog => {
    return {
      key: prog.id,
      _id: prog.id,
      taskTitle: prog.taskTitle || 'Nhiệm vụ không rõ',
      assigneeName: prog.assigneeName || 'Người nhận không rõ',
      assigneeType: translateStatus(prog.assigneeType),
      className: prog.className || 'Không có lớp',
      status: translateStatus(prog.status),
      startedAt: safeFormatDate(prog.startedAt),
      completedAt: safeFormatDate(prog.completedAt),
      deadline: safeFormatDate(prog.deadline)
    };
  });

  // 6c. FILTER NOTIFICATIONS
  const filteredNotifications = notifications.filter(notif => {
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchTitle = notif.title?.toLowerCase().includes(query);
      const matchDesc = notif.description?.toLowerCase().includes(query);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  const notificationRows = filteredNotifications.map(notif => {
    return {
      key: notif.id || notif._id,
      _id: notif.id || notif._id,
      title: notif.title,
      type: translateStatus(notif.type),
      description: notif.description,
      isRead: notif.isRead ? 'Đã đọc' : 'Chưa đọc',
      createdAt: safeFormatDate(notif.createdAt, 'dd/MM/yyyy HH:mm'),
      source: notif.source || 'Hệ thống'
    };
  });

  // 7. FILTER LOGS SYSTEM
  const filteredLogs = loginLogs.filter(log => {
    if (log.createdAt && (filters.startDate || filters.endDate)) {
      try {
        const logDate = new Date(log.createdAt);
        if (filters.startDate) {
          const start = new Date(filters.startDate);
          start.setHours(0, 0, 0, 0);
          if (logDate < start) return false;
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          if (logDate > end) return false;
        }
      } catch {
        // Skip
      }
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const uName = log.user_id?.user_name?.toLowerCase() || '';
      const email = log.user_id?.email?.toLowerCase() || '';
      const ip = log.ip_address?.toLowerCase() || '';
      const act = log.action?.toLowerCase() || '';
      if (!uName.includes(query) && !email.includes(query) && !ip.includes(query) && !act.includes(query)) return false;
    }
    return true;
  });

  const systemRows: SystemReportRow[] = filteredLogs.map(log => {
    return {
      key: log._id,
      _id: log._id,
      login_time: safeFormatDate(log.login_time || log.createdAt, 'dd/MM/yyyy HH:mm'),
      user_name: log.user_id?.user_name || 'Người dùng ẩn',
      email: log.user_id?.email || 'N/A',
      role_name: log.user_id?.role?.name || 'User',
      ip_address: log.ip_address || 'N/A',
      action: translateStatus(log.action),
      details: log.details || 'Không có chi tiết'
    };
  });

  // KPI CALCULATION
  const kpis: ReportKpi[] = [
    {
      title: 'Tổng sinh viên',
      value: filteredStudents.length,
      description: 'Sinh viên trong phạm vi bộ lọc',
      iconName: 'users'
    },
    {
      title: 'Điểm RL trung bình',
      value: scoreRows.length > 0 
        ? (scoreRows.reduce((acc, curr) => acc + curr.total_score, 0) / scoreRows.length).toFixed(1)
        : '0.0',
      description: 'Trung bình điểm rèn luyện',
      iconName: 'award'
    },
    {
      title: 'Tỉ lệ chuyên cần',
      value: attendanceRows.length > 0
        ? `${(attendanceRows.reduce((acc, curr) => acc + curr.attendance_rate, 0) / attendanceRows.length * 100).toFixed(1)}%`
        : '100%',
      description: 'Hiện diện lớp trung bình',
      iconName: 'calendar'
    },
    {
      title: 'Kỷ luật phát sinh',
      value: recordRows.filter(r => r.type === 'ky_luat').length,
      description: 'Số vụ kỷ luật/vi phạm',
      trend: {
        value: recordRows.filter(r => r.type === 'khen_thuong').length > 0 
          ? `Khen thưởng: ${recordRows.filter(r => r.type === 'khen_thuong').length}`
          : 'Khen thưởng: 0',
        isPositive: true
      },
      iconName: 'shield-alert'
    },
    {
      title: 'Tiến độ nhiệm vụ',
      value: taskRows.length > 0
        ? `${(taskRows.reduce((acc, curr) => acc + curr.completion_rate, 0) / taskRows.length * 100).toFixed(0)}%`
        : '0%',
      description: 'Tỉ lệ hoàn thành nhiệm vụ',
      iconName: 'check-square'
    }
  ];

  // CHARTS DATA
  // 1. Score Distribution
  const gradingCounts = { 'Xuất sắc': 0, 'Tốt': 0, 'Khá': 0, 'Trung bình': 0, 'Yếu': 0, 'Kém': 0 };
  scoreRows.forEach(row => {
    const gr = row.grading;
    if (gr.includes('Xuất sắc')) gradingCounts['Xuất sắc']++;
    else if (gr.includes('Tốt')) gradingCounts['Tốt']++;
    else if (gr.includes('Khá')) gradingCounts['Khá']++;
    else if (gr.includes('Trung bình')) gradingCounts['Trung bình']++;
    else if (gr.includes('Yếu')) gradingCounts['Yếu']++;
    else gradingCounts['Kém']++;
  });
  
  const scoreDistribution: ChartDatum[] = Object.entries(gradingCounts).map(([name, value]) => ({ name, value }));

  // 2. Evaluation Funnel: draft -> sv_submitted -> gv_reviewed -> locked
  const funnelCounts = { draft: 0, sv_submitted: 0, gv_reviewed: 0, locked: 0 };
  filteredSummaries.forEach(sum => {
    if (sum.status === 'draft') funnelCounts.draft++;
    else if (sum.status === 'sv_submitted') funnelCounts.sv_submitted++;
    else if (sum.status === 'gv_reviewed') funnelCounts.gv_reviewed++;
    else if (sum.status === 'locked') funnelCounts.locked++;
  });
  const evaluationFunnel: ChartDatum[] = [
    { name: 'Nháp', value: funnelCounts.draft },
    { name: 'SV đã nộp', value: funnelCounts.sv_submitted },
    { name: 'GV đã duyệt', value: funnelCounts.gv_reviewed },
    { name: 'Đã khóa', value: funnelCounts.locked }
  ];

  // 3. Record Type Distribution
  const recCounts = { khen_thuong: 0, cong_diem: 0, ky_luat: 0, khac: 0 };
  recordRows.forEach(row => {
    recCounts[row.type]++;
  });
  const recordTypeDistribution: ChartDatum[] = [
    { name: 'Khen thưởng', value: recCounts.khen_thuong },
    { name: 'Cộng điểm', value: recCounts.cong_diem },
    { name: 'Kỷ luật', value: recCounts.ky_luat },
    { name: 'Khác', value: recCounts.khac }
  ];

  // 4. Attendance Trend (by class ranking for top vắng nhiều)
  const classAbsentData: Record<string, { absent: number, total: number }> = {};
  attendanceRows.forEach(row => {
    if (!classAbsentData[row.class_name]) {
      classAbsentData[row.class_name] = { absent: 0, total: 0 };
    }
    classAbsentData[row.class_name].absent += row.total_absent;
    classAbsentData[row.class_name].total += row.total;
  });

  const attendanceTrend: ChartDatum[] = Object.entries(classAbsentData)
    .map(([name, data]) => ({
      name,
      value: data.total > 0 ? parseFloat(((1 - (data.absent / data.total)) * 100).toFixed(1)) : 100,
      absentCount: data.absent
    }))
    .sort((a, b) => a.value - b.value) // Sort classes with lowest attendance rate first
    .slice(0, 5); // Take top 5 lowest attendance classes

  return {
    kpis,
    tables: {
      students: studentRows,
      scores: scoreRows,
      scoreDetails: scoreDetailRows,
      records: recordRows,
      attendance: attendanceRows,
      tasks: taskRows,
      taskProgress: taskProgressRows,
      notifications: notificationRows,
      system: systemRows
    },
    charts: {
      scoreDistribution,
      evaluationFunnel,
      recordTypeDistribution,
      attendanceTrend
    }
  };
}
