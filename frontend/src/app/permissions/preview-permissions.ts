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

  // 2. Lấy permissions từ role (subject.role đã được gán là role của user trong resolvePreviewSubject)
  if (subject.role && Array.isArray(subject.role.permissions)) {
    subject.role.permissions.forEach((p: any) => {
      const code = typeof p === 'string' ? p : p.code || p._id || p.id;
      if (code) permsSet.add(code);
    });
  }

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
    showSystem: isPreviewAdmin || [
      'SYSTEM_ADMIN', 'LOGIN_LOG_READ', 'SYSTEM_REQUEST_READ', 'SYSTEM_REQUEST_MANAGE',
      'DATABASE_BACKUP_READ', 'DATABASE_BACKUP_CREATE', 'DATABASE_BACKUP_DOWNLOAD', 'DATABASE_BACKUP_DELETE'
    ].some(code => hasPreviewPermission(code)),
    showPermissions: isPreviewAdmin || hasPreviewPermission('admin'),
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

const PROPOSED_PERMISSIONS = [
  'USER_CREATE', 'USER_UPDATE', 'USER_DELETE',
  'ROLE_CREATE', 'ROLE_UPDATE', 'ROLE_DELETE',
  'PERMISSION_CREATE', 'PERMISSION_UPDATE', 'PERMISSION_DELETE',
  'PERMISSION_GROUP_CREATE', 'PERMISSION_GROUP_UPDATE', 'PERMISSION_GROUP_DELETE',
  'ROUTE_PERMISSION_CREATE', 'ROUTE_PERMISSION_UPDATE', 'ROUTE_PERMISSION_DELETE'
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
    const isProposedCode = PROPOSED_PERMISSIONS.includes(code);
    
    if (!registryPerm) {
      status = 'missing';
    } else if (!mappedCodes.has(code)) {
      status = 'unmapped';
    } else if (isProposedCode) {
      status = 'proposed';
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
      { code: 'USER_CREATE', name: 'Tạo tài khoản mới', desc: 'Tạo tài khoản người dùng trực tiếp (Đề xuất)', isRoute: false, proposed: true },
      { code: 'ROLE_DELETE', name: 'Xóa vai trò', desc: 'Quyền xóa vai trò cấu hình (Đề xuất)', isRoute: false, proposed: true },
      { code: 'PERMISSION_UPDATE', name: 'Cập nhật danh sách quyền', desc: 'Chỉnh sửa định nghĩa quyền hệ thống (Đề xuất)', isRoute: false, proposed: true }
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
      { code: 'READ_STUDENT_RECORD', name: 'Xem kết quả rèn luyện học sinh', desc: 'Xem lịch sử ghi nhận điểm rèn luyện của học sinh', isRoute: false },
      { code: 'CREATE_STUDENT_RECORD', name: 'Đánh giá điểm rèn luyện', desc: 'Ghi nhận điểm cộng/trừ rèn luyện', isRoute: false },
      { code: 'CONFIG_RECORD', name: 'Cấu hình tiêu chí', desc: 'Thay đổi thang điểm và khung tiêu chuẩn đánh giá', isRoute: false },
      { code: 'CREATE_STUDENT_TASK', name: 'Giao nhiệm vụ rèn luyện', desc: 'Giao bài tập/hoạt động nâng cao rèn luyện', isRoute: false }
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

