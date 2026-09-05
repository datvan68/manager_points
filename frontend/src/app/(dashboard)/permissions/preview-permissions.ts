export interface PreviewSubject {
  type: 'role' | 'user' | 'default';
  role: any;
  user?: any;
}

export function resolvePreviewSubject({
  users,
  roles,
  selectedPreviewUser,
  selectedPreviewRole
}: {
  users: any[];
  roles: any[];
  selectedPreviewUser: string;
  selectedPreviewRole: string;
}): PreviewSubject {
  let previewUserObj: any = null;
  let previewRoleObj: any = null;
  let type: 'role' | 'user' | 'default' = 'default';

  if (selectedPreviewUser && selectedPreviewUser !== 'none') {
    previewUserObj = users.find((u: any) => (u._id || u.id) === selectedPreviewUser);
    previewRoleObj = previewUserObj?.role;
    type = 'user';
  } else if (selectedPreviewRole && selectedPreviewRole !== 'none') {
    previewRoleObj = roles.find((r: any) => (r._id || r.id) === selectedPreviewRole);
    type = 'role';
  } else if (roles.length > 0) {
    previewRoleObj = roles.find((r: any) => r.role_code === 'ADMIN') || roles[0];
    type = 'default';
  }

  return {
    type,
    role: previewRoleObj,
    user: previewUserObj
  };
}

export function getPreviewPermissions(subject: PreviewSubject): string[] {
  const permsSet = new Set<string>();

  // 1. Lấy direct permissions của user
  if (subject.user && Array.isArray(subject.user.permissions)) {
    subject.user.permissions.forEach((p: any) => {
      const code = typeof p === 'string' ? p : p.code || p._id || p.id;
      if (code) permsSet.add(code);
    });
  }

  // 2. Merge every assigned role while preserving server order and codes.
  const assignedRoles = subject.user?.roles?.length ? subject.user.roles : [subject.role];
  assignedRoles.filter(Boolean).forEach((role: any) => {
    (role.permissions || []).forEach((p: any) => {
      const code = typeof p === 'string' ? p : p.code || p._id || p.id;
      if (code) permsSet.add(code);
    });
  });

  return Array.from(permsSet);
}

export function buildSystemPreviewAccess(permissions: string[], role: any) {
  const roleCode = role?.role_code || '';
  const roleName = role?.name || '';
  const isPreviewAdmin = roleCode === 'ADMIN' || permissions.includes('ADMIN_FULL') || roleName.toLowerCase() === 'admin';
  
  const hasPreviewPermission = (code: string) => isPreviewAdmin || permissions.includes(code);

  return {
    isPreviewAdmin,
    showStudents: isPreviewAdmin || roleCode === 'TEACHER' || roleCode === 'STUDENT' || hasPreviewPermission('STUDENT_PAGE') || hasPreviewPermission('STUDENT_READ'),
    showGrading: isPreviewAdmin || roleCode === 'TEACHER' || roleCode === 'SUPERVISOR' || hasPreviewPermission('GRADING_PAGE'),
    showSystem: [
      'SYSTEM_ADMIN', 'LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'SYSTEM_REQUEST_MANAGE',
      'DATABASE_BACKUP_READ', 'DATABASE_BACKUP_CREATE', 'DATABASE_BACKUP_DOWNLOAD', 'DATABASE_BACKUP_DELETE', 'DATABASE_BACKUP_RESTORE', 'SYSTEM_PERFORMANCE_READ'
    ].some(code => permissions.includes(code)),
    showPermissions: hasPreviewPermission('admin') || hasPreviewPermission('ADMIN_FULL'),
    showReports: isPreviewAdmin || hasPreviewPermission('REPORTS_PAGE') || hasPreviewPermission('REPORTS_READ'),
    
    previewCanReadLogs: hasPreviewPermission("LOGIN_LOG_READ"),
    previewCanReadRequests: hasPreviewPermission("SYSTEM_REQUEST_READ"),
    previewCanManageRequests: hasPreviewPermission("SYSTEM_REQUEST_MANAGE"),
    previewCanReadBackups: hasPreviewPermission("DATABASE_BACKUP_READ"),
    previewCanCreateBackup: hasPreviewPermission("DATABASE_BACKUP_CREATE"),
    previewCanDownloadBackup: hasPreviewPermission("DATABASE_BACKUP_DOWNLOAD"),
    previewCanDeleteBackup: hasPreviewPermission("DATABASE_BACKUP_DELETE"),
  };
}

export interface PreviewPermissionItem {
  code: string;
  name: string;
  desc: string;
  isRoute: boolean;
  status: 'route_enforced' | 'scope_defined' | 'proposed' | 'missing' | 'unmapped';
  allowedStatus: 'allowed' | 'admin_override' | 'denied';
}

const ADMIN_RBAC_PERMISSIONS = [
  'admin',
  'view_users',
  'reset_pwd',
  'ADMIN_FULL',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_DELETE',
  'ROLE_CREATE',
  'ROLE_UPDATE',
  'ROLE_DELETE',
  'PERMISSION_CREATE',
  'PERMISSION_UPDATE',
  'PERMISSION_DELETE',
  'PERMISSION_GROUP_CREATE',
  'PERMISSION_GROUP_UPDATE',
  'PERMISSION_GROUP_DELETE',
  'ROUTE_PERMISSION_CREATE',
  'ROUTE_PERMISSION_UPDATE',
  'ROUTE_PERMISSION_DELETE'
];

export function getPagePreviewScope({
  routePath,
  pagePermissionScopes,
  routePermissions,
  allPermissions,
  previewPermissions,
  isPreviewAdmin
}: {
  routePath: string;
  pagePermissionScopes: any[];
  routePermissions: any[];
  allPermissions: any[];
  previewPermissions: string[];
  isPreviewAdmin: boolean;
}): PreviewPermissionItem[] {
  const scope = pagePermissionScopes.find(s => s.route_path === routePath);
  
  if (!scope) {
    return getFallbackScope(routePath, previewPermissions, isPreviewAdmin);
  }

  const result: PreviewPermissionItem[] = [];

  const accessCodes = scope.access_permissions || [];
  const actionCodes = scope.action_permissions || [];

  const allCodes = Array.from(new Set([...accessCodes, ...actionCodes]));

  const mappedCodes = new Set<string>();
  routePermissions.forEach(rp => {
    if (Array.isArray(rp.permissions)) {
      rp.permissions.forEach((p: any) => {
        const c = typeof p === 'string' ? p : p.code || p._id || p.id;
        if (c) mappedCodes.add(c);
      });
    }
  });

  allCodes.forEach(code => {
    const isRoute = accessCodes.includes(code);
    const registryPerm = allPermissions.find(p => p.code === code);
    
    const name = registryPerm?.name || code;
    const desc = registryPerm?.description || registryPerm?.desc || (isRoute ? 'Quyền truy cập trang con' : 'Quyền thực hiện thao tác nghiệp vụ');

    let status: 'route_enforced' | 'scope_defined' | 'proposed' | 'missing' | 'unmapped';
    
    if (!registryPerm) {
      status = 'missing';
    } else if (!mappedCodes.has(code)) {
      status = 'unmapped';
    } else if (accessCodes.includes(code)) {
      status = 'route_enforced';
    } else {
      status = 'scope_defined';
    }

    let allowedStatus: 'allowed' | 'admin_override' | 'denied' = 'denied';
    if (previewPermissions.includes(code)) {
      allowedStatus = 'allowed';
    } else if (isPreviewAdmin) {
      allowedStatus = 'admin_override';
    }

    result.push({
      code,
      name,
      desc,
      isRoute,
      status,
      allowedStatus
    });
  });

  return result;
}

function getFallbackScope(routePath: string, previewPermissions: string[], isPreviewAdmin: boolean): PreviewPermissionItem[] {
  const fallbacks: Record<string, Array<{ code: string; name: string; desc: string; isRoute: boolean; proposed?: boolean }>> = {
    '/permissions': [
      { code: 'admin', name: 'Quyền vào trang', desc: 'Đăng nhập vào bảng điều khiển và xem danh sách người dùng', isRoute: true },
      { code: 'view_users', name: 'Xem người dùng', desc: 'Quyền xem chi tiết danh sách tài khoản người dùng', isRoute: false },
      { code: 'reset_pwd', name: 'Reset Mật khẩu', desc: 'Reset mật khẩu của một tài khoản khác', isRoute: false },
      { code: 'ADMIN_FULL', name: 'Toàn quyền Admin', desc: 'Toàn quyền thêm, sửa, xóa cấu hình phân quyền', isRoute: false },
      { code: 'USER_CREATE', name: 'Tạo tài khoản mới', desc: 'Tạo tài khoản người dùng trực tiếp', isRoute: false },
      { code: 'USER_UPDATE', name: 'Cập nhật người dùng', desc: 'Chỉnh sửa thông tin người dùng', isRoute: false },
      { code: 'USER_DELETE', name: 'Xóa người dùng', desc: 'Xóa người dùng', isRoute: false },
      { code: 'ROLE_CREATE', name: 'Thêm vai trò', desc: 'Tạo mới vai trò', isRoute: false },
      { code: 'ROLE_UPDATE', name: 'Cập nhật vai trò', desc: 'Chỉnh sửa vai trò', isRoute: false },
      { code: 'ROLE_DELETE', name: 'Xóa vai trò', desc: 'Quyền xóa vai trò cấu hình', isRoute: false },
      { code: 'PERMISSION_CREATE', name: 'Thêm quyền', desc: 'Thêm mới mã quyền', isRoute: false },
      { code: 'PERMISSION_UPDATE', name: 'Cập nhật quyền', desc: 'Cập nhật thông tin quyền', isRoute: false },
      { code: 'PERMISSION_DELETE', name: 'Xóa quyền', desc: 'Xóa mã quyền', isRoute: false },
      { code: 'PERMISSION_GROUP_CREATE', name: 'Thêm nhóm quyền', desc: 'Thêm nhóm quyền', isRoute: false },
      { code: 'PERMISSION_GROUP_UPDATE', name: 'Cập nhật nhóm quyền', desc: 'Cập nhật nhóm quyền', isRoute: false },
      { code: 'PERMISSION_GROUP_DELETE', name: 'Xóa nhóm quyền', desc: 'Xóa nhóm quyền', isRoute: false },
      { code: 'ROUTE_PERMISSION_CREATE', name: 'Thêm Route Permission', desc: 'Thêm mapping route permission', isRoute: false },
      { code: 'ROUTE_PERMISSION_UPDATE', name: 'Cập nhật Route Permission', desc: 'Cập nhật mapping route permission', isRoute: false },
      { code: 'ROUTE_PERMISSION_DELETE', name: 'Xóa Route Permission', desc: 'Xóa mapping route permission', isRoute: false }
    ],
    '/students': [
      { code: 'STUDENT_READ', name: 'Xem thông tin học sinh', desc: 'Xem danh sách và hồ sơ chi tiết học sinh', isRoute: false },
      { code: 'STUDENT_CREATE', name: 'Thêm học sinh mới', desc: 'Thêm học sinh thủ công vào hệ thống', isRoute: false },
      { code: 'STUDENT_UPDATE', name: 'Cập nhật học sinh', desc: 'Sửa đổi thông tin cá nhân và lớp học', isRoute: false },
      { code: 'STUDENT_DELETE', name: 'Xóa học sinh', desc: 'Xóa học sinh hoặc chuyển trạng thái thôi học', isRoute: false },
      { code: 'STUDENT_IMPORT', name: 'Nhập tệp Excel', desc: 'Import danh sách học sinh từ file mẫu', isRoute: false },
      { code: 'STUDENT_EXPORT', name: 'Xuất tệp Excel', desc: 'Export danh sách học sinh ra file Excel', isRoute: false },
      { code: 'CLASS_CREATE', name: 'Tạo lớp học', desc: 'Thêm lớp học mới', isRoute: false },
      { code: 'DEPT_CREATE', name: 'Tạo khoa', desc: 'Tạo khoa quản lý chuyên môn', isRoute: false }
    ],
    '/grading': [
      { code: 'CONFIG_RECORD', name: 'Cấu hình tiêu chí', desc: 'Thay đổi thang điểm và khung tiêu chuẩn đánh giá', isRoute: false },
    ],
    '/students/record': [
      { code: 'READ_STUDENT_RECORD', name: 'Xem ghi nhận sinh viên', desc: 'Xem lịch sử ghi nhận rèn luyện của sinh viên', isRoute: true },
      { code: 'CREATE_STUDENT_RECORD', name: 'Thêm ghi nhận sinh viên', desc: 'Tạo ghi nhận rèn luyện', isRoute: false },
      { code: 'UPDATE_STUDENT_RECORD', name: 'Cập nhật ghi nhận sinh viên', desc: 'Sửa ghi nhận rèn luyện', isRoute: false },
      { code: 'DELETE_STUDENT_RECORD', name: 'Xóa ghi nhận sinh viên', desc: 'Xóa ghi nhận rèn luyện', isRoute: false },
      { code: 'READ_CLASS_RECORD', name: 'Xem ghi nhận lớp', desc: 'Xem tổng hợp ghi nhận của lớp', isRoute: false },
      { code: 'READ_ALL_CLASS_RECORD', name: 'Xem toàn bộ ghi nhận lớp', desc: 'Xem ghi nhận lớp do người khác tạo', isRoute: false },
      { code: 'CREATE_CLASS_RECORD', name: 'Thêm ghi nhận lớp', desc: 'Tạo ghi nhận rèn luyện cho lớp', isRoute: false },
      { code: 'UPDATE_CLASS_RECORD', name: 'Cập nhật ghi nhận lớp', desc: 'Sửa ghi nhận rèn luyện của lớp', isRoute: false },
      { code: 'DELETE_CLASS_RECORD', name: 'Xóa ghi nhận lớp', desc: 'Xóa ghi nhận rèn luyện của lớp', isRoute: false },
    ],
    '/students/tasks': [
      { code: 'READ_STUDENT_TASK', name: 'Xem nhiệm vụ HSSV', desc: 'Xem nhiệm vụ và tiến độ', isRoute: true },
      { code: 'CREATE_STUDENT_TASK', name: 'Tạo nhiệm vụ HSSV', desc: 'Tạo và phân công nhiệm vụ', isRoute: false },
      { code: 'UPDATE_STUDENT_TASK', name: 'Cập nhật nhiệm vụ HSSV', desc: 'Cập nhật nhiệm vụ', isRoute: false },
      { code: 'DELETE_STUDENT_TASK', name: 'Xóa nhiệm vụ HSSV', desc: 'Xóa nhiệm vụ', isRoute: false },
    ],
    '/activities': [
      { code: 'ACTIVITY_PAGE', name: 'Truy cập hoạt động', desc: 'Mở module hoạt động', isRoute: true },
      { code: 'ACTIVITY_READ', name: 'Xem hoạt động', desc: 'Xem danh sách và chi tiết hoạt động', isRoute: false },
      { code: 'ACTIVITY_CREATE', name: 'Tạo hoạt động', desc: 'Tạo hoạt động mới', isRoute: false },
      { code: 'ACTIVITY_UPDATE', name: 'Cập nhật hoạt động', desc: 'Cập nhật hoạt động', isRoute: false },
      { code: 'ACTIVITY_DELETE', name: 'Xóa hoạt động', desc: 'Vô hiệu hóa hoạt động', isRoute: false },
      { code: 'ACTIVITY_MEMBER_MANAGE', name: 'Quản lý thành viên', desc: 'Quản lý thành viên hoạt động', isRoute: false },
      { code: 'ACTIVITY_REPORT_READ', name: 'Xem báo cáo hoạt động', desc: 'Xem báo cáo hoạt động', isRoute: false },
      { code: 'ACTIVITY_EXPORT', name: 'Xuất hoạt động', desc: 'Xuất dữ liệu hoạt động', isRoute: false },
    ],
    '/activities/schedule': [
      { code: 'ACTIVITY_SCHEDULE_READ', name: 'Xem lịch hoạt động', desc: 'Xem lịch sinh hoạt', isRoute: true },
      { code: 'ACTIVITY_SCHEDULE_MANAGE', name: 'Quản lý lịch hoạt động', desc: 'Tạo, sửa, xóa lịch', isRoute: false },
      { code: 'ACTIVITY_SCHEDULE_REGISTER', name: 'Đăng ký buổi sinh hoạt', desc: 'Đăng ký buổi sinh hoạt', isRoute: false },
    ],
    '/activities/attendance': [
      { code: 'ACTIVITY_ATTENDANCE_READ', name: 'Xem điểm danh', desc: 'Xem dữ liệu điểm danh', isRoute: true },
      { code: 'ACTIVITY_ATTENDANCE_CREATE', name: 'Ghi nhận điểm danh', desc: 'Ghi nhận điểm danh', isRoute: false },
      { code: 'ACTIVITY_ATTENDANCE_UPDATE', name: 'Cập nhật điểm danh', desc: 'Cập nhật điểm danh', isRoute: false },
      { code: 'ACTIVITY_ATTENDANCE_APPROVE', name: 'Duyệt điểm danh', desc: 'Duyệt điểm danh', isRoute: false },
      { code: 'ACTIVITY_ATTENDANCE_DELETE', name: 'Xóa điểm danh', desc: 'Xóa điểm danh', isRoute: false },
      { code: 'ATTENDANCE_SESSION_CREATE', name: 'Mở phiên điểm danh', desc: 'Mở phiên điểm danh', isRoute: false },
      { code: 'ATTENDANCE_SESSION_READ', name: 'Xem phiên điểm danh', desc: 'Xem phiên điểm danh', isRoute: false },
      { code: 'ATTENDANCE_SESSION_CLOSE', name: 'Đóng phiên điểm danh', desc: 'Đóng phiên điểm danh', isRoute: false },
    ],
    '/activities/:activityId': [
      { code: 'ACTIVITY_READ', name: 'Xem chi tiết hoạt động', desc: 'Xem trang chi tiết hoạt động', isRoute: true },
      { code: 'ACTIVITY_UPDATE', name: 'Cập nhật hoạt động', desc: 'Cập nhật hoạt động', isRoute: false },
      { code: 'ACTIVITY_MEMBER_MANAGE', name: 'Quản lý thành viên', desc: 'Quản lý thành viên', isRoute: false },
      { code: 'ACTIVITY_SCHEDULE_READ', name: 'Xem lịch hoạt động', desc: 'Xem timeline hoạt động', isRoute: false },
      { code: 'ACTIVITY_ATTENDANCE_READ', name: 'Xem điểm danh', desc: 'Xem điểm danh hoạt động', isRoute: false },
      { code: 'ACTIVITY_CONFIG_READ', name: 'Xem cấu hình hoạt động', desc: 'Xem cấu hình hoạt động', isRoute: false },
      { code: 'ACTIVITY_CONFIG_MANAGE', name: 'Quản lý cấu hình hoạt động', desc: 'Quản lý cấu hình hoạt động', isRoute: false },
    ],
    '/reports': [
      { code: 'REPORTS_READ', name: 'Xem báo cáo thống kê', desc: 'Truy cập vào các biểu đồ và báo cáo dữ liệu học sinh, điểm số', isRoute: false }
    ]
  };

  const list = fallbacks[routePath] || [];
  return list.map(item => {
    let allowedStatus: 'allowed' | 'admin_override' | 'denied' = 'denied';
    if (previewPermissions.includes(item.code)) {
      allowedStatus = 'allowed';
    } else if (isPreviewAdmin) {
      allowedStatus = 'admin_override';
    }

    return {
      code: item.code,
      name: item.name + ' (Fallback)',
      desc: item.desc,
      isRoute: item.isRoute,
      status: item.proposed ? 'proposed' : (item.isRoute ? 'route_enforced' : 'scope_defined'),
      allowedStatus
    };
  });
}

