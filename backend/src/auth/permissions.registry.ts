export interface PermissionSeed {
  code: string;
  name: string;
  module: string;
  description?: string;
}

export type PermissionPolicyKind =
  | 'page/module access'
  | 'read'
  | 'action'
  | 'scope modifier'
  | 'self-service'
  | 'backend-only';

export interface PermissionPolicy {
  code: string;
  kind: PermissionPolicyKind;
  requires: string[];
  owners: string[];
  routePath?: string;
  proposed?: boolean;
}

export const UNGROUPED_PERMISSION_GROUP = {
  code: 'G_UNGROUPED',
  name: 'Chưa phân nhóm',
  description:
    'Các quyền được khai báo trong hệ thống nhưng chưa được phân nhóm nghiệp vụ.',
  status: 'Active',
};

export const SYSTEM_PERMISSIONS_GROUP = {
  code: 'G_SYSTEM',
  name: 'Trang Phân Quyền',
  description: 'Quản trị hệ thống và phân quyền truy cập.',
  status: 'Active',
};

export const STUDENT_MANAGER_GROUP = {
  code: 'G_STUDENT',
  name: 'Quản lý Học Sinh Sinh Viên',
  description: 'Quản lý thông tin học sinh, sinh viên, lớp học và khoa.',
  status: 'Active',
};

export const GRADING_MANAGER_GROUP = {
  code: 'G_GRADING',
  name: 'Quản lý Điểm Rèn Luyện',
  description:
    'Quản lý ghi nhận rèn luyện cá nhân, ghi nhận lớp và cấu hình điểm rèn luyện.',
  status: 'Active',
};

export const TASK_MANAGER_GROUP = {
  code: 'G_TASK',
  name: 'Quản lý Nhiệm Vụ',
  description: 'Quản lý phân công và theo dõi tiến độ nhiệm vụ rèn luyện.',
  status: 'Active',
};

export const SYSTEM_OPERATIONS_GROUP = {
  code: 'G_SYSTEM_OPERATIONS',
  name: 'Quản trị vận hành hệ thống',
  description:
    'Các quyền quản trị vận hành hệ thống, xem log đăng nhập, quản lý yêu cầu và sao lưu cơ sở dữ liệu.',
  status: 'Active',
};

export const REPORT_MANAGER_GROUP = {
  code: 'G_REPORT',
  name: 'Báo cáo Thống kê',
  description: 'Nhóm quyền truy cập và thao tác với các báo cáo, thống kê.',
  status: 'Active',
};

export const ACTIVITY_MANAGER_GROUP = {
  code: 'G_ACTIVITY',
  name: 'Quản lý Hoạt động',
  description:
    'Quản lý câu lạc bộ, lịch sinh hoạt, điểm danh và cấu hình điểm rèn luyện.',
  status: 'Active',
};

export const DORMITORY_MANAGER_GROUP = {
  code: 'G_DORMITORY',
  name: 'Quản lý Ký túc xá',
  description:
    'Quản lý tòa nhà, phòng, giường, đăng ký, hợp đồng, phí, vi phạm và bảo trì KTX.',
  status: 'Active',
};

export const PROPOSED_PERMISSION_GROUP = {
  code: 'G_PROPOSED',
  name: 'Đề xuất bổ sung',
  description:
    'Nhóm các quyền được đề xuất để bổ sung cho chức năng tương lai (chưa có guard thực tế).',
  status: 'Active',
};

export const ADMIN_RBAC_GROUP = {
  code: 'G_ADMIN_RBAC',
  name: 'Admin RBAC Console',
  description:
    'Admin-only permissions for user, role, permission, permission-group, and route-permission management.',
  status: 'Active',
};

export const DECLARED_PERMISSION_SEEDS: PermissionSeed[] = [
  // 1. Nhóm Trang Phân Quyền
  {
    code: 'admin',
    name: 'Truy cập trang quản trị phân quyền',
    module: ADMIN_RBAC_GROUP.name,
    description:
      'Quyền truy cập trang quản lý phân quyền (RBAC), quản lý người dùng, vai trò và route mappings.',
  },
  {
    code: 'view_users',
    name: 'Xem danh sách người dùng',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Cho phép xem danh sách người dùng trong hệ thống.',
  },
  {
    code: 'reset_pwd',
    name: 'Reset mật khẩu',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Cho phép đổi/mới mật khẩu cho người dùng.',
  },
  {
    code: 'ADMIN_FULL',
    name: 'Toàn quyền Admin',
    module: ADMIN_RBAC_GROUP.name,
    description:
      '⚠️ QUYỀN HẠN TỐI CAO: Toàn quyền quản trị và bypass tất cả các cơ chế bảo mật hệ thống.',
  },

  // 2. Nhóm Quản lý Học Sinh Sinh Viên
  {
    code: 'STUDENT_PAGE',
    name: 'Truy cập trang quản lý sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
    description:
      'Cho phép truy cập menu và giao diện quản lý thông tin sinh viên, lớp học, khoa.',
  },
  {
    code: 'STUDENT_READ',
    name: 'Xem sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
    description:
      'Cho phép xem thông tin chi tiết và hồ sơ cá nhân của sinh viên trong hệ thống.',
  },
  {
    code: 'STUDENT_CREATE',
    name: 'Thêm sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
    description: 'Cho phép đăng ký, tạo mới hồ sơ sinh viên thủ công.',
  },
  {
    code: 'STUDENT_UPDATE',
    name: 'Cập nhật sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
    description: 'Cho phép chỉnh sửa thông tin hồ sơ sinh viên đã tồn tại.',
  },
  {
    code: 'STUDENT_DELETE',
    name: 'Xóa sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
    description: 'Cho phép xóa hồ sơ sinh viên ra khỏi hệ thống quản lý.',
  },
  {
    code: 'STUDENT_IMPORT',
    name: 'Import danh sách sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
    description: 'Cho phép import hàng loạt hồ sơ sinh viên từ file excel.',
  },
  {
    code: 'STUDENT_EXPORT',
    name: 'Xuất danh sách sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
    description: 'Cho phép xuất dữ liệu sinh viên ra file Excel/PDF.',
  },
  {
    code: 'STUDENT_ACCOUNT_ACTIVATE',
    name: 'Kích hoạt tài khoản sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
    description:
      'Cho phép kích hoạt hoặc tạm khóa tài khoản đăng nhập của sinh viên.',
  },
  {
    code: 'STUDENT_ACCOUNT_RESET_PASSWORD',
    name: 'Reset mật khẩu sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
    description:
      'Cho phép đặt lại mật khẩu của sinh viên về ngày sinh mặc định.',
  },
  {
    code: 'STUDENT_TRANSFER',
    name: 'Chuyển lớp sinh viên',
    module: STUDENT_MANAGER_GROUP.name,
    description:
      'Cho phép thực hiện chuyển lớp sinh viên từ lớp này sang lớp khác.',
  },
  {
    code: 'DEPT_CREATE',
    name: 'Thêm khoa',
    module: STUDENT_MANAGER_GROUP.name,
    description: 'Cho phép tạo mới khoa đào tạo trong trường.',
  },
  {
    code: 'DEPT_UPDATE',
    name: 'Cập nhật khoa',
    module: STUDENT_MANAGER_GROUP.name,
    description: 'Cho phép cập nhật thông tin khoa đào tạo.',
  },
  {
    code: 'DEPT_DELETE',
    name: 'Xóa khoa',
    module: STUDENT_MANAGER_GROUP.name,
    description:
      'Cho phép xóa khoa đào tạo (chỉ khi không còn lớp học thuộc khoa).',
  },
  {
    code: 'CLASS_CREATE',
    name: 'Thêm lớp',
    module: STUDENT_MANAGER_GROUP.name,
    description: 'Cho phép tạo mới lớp quản lý.',
  },
  {
    code: 'CLASS_UPDATE',
    name: 'Cập nhật lớp',
    module: STUDENT_MANAGER_GROUP.name,
    description: 'Cho phép thay đổi thông tin lớp, giảng viên chủ nhiệm.',
  },
  {
    code: 'CLASS_DELETE',
    name: 'Xóa lớp',
    module: STUDENT_MANAGER_GROUP.name,
    description: 'Cho phép xóa vĩnh viễn lớp và toàn bộ dữ liệu phụ thuộc theo cascade.',
  },

  // 3. Nhóm Quản lý Điểm Rèn Luyện
  {
    code: 'GRADING_PAGE',
    name: 'Truy cập trang rèn luyện',
    module: GRADING_MANAGER_GROUP.name,
    description:
      'Cho phép truy cập menu và giao diện quản lý rèn luyện sinh viên.',
  },
  {
    code: 'GRADING_SEMESTER_MANAGE',
    name: 'Quản lý học kỳ rèn luyện',
    module: GRADING_MANAGER_GROUP.name,
    description: 'Cho phép khởi tạo, đóng học kỳ đánh giá rèn luyện.',
  },
  {
    code: 'READ_STUDENT_RECORD',
    name: 'Xem ghi nhận sinh viên',
    module: GRADING_MANAGER_GROUP.name,
    description:
      'Cho phép xem lịch sử ghi nhận điểm rèn luyện cá nhân của sinh viên.',
  },
  {
    code: 'CREATE_STUDENT_RECORD',
    name: 'Thêm ghi nhận sinh viên',
    module: GRADING_MANAGER_GROUP.name,
    description: 'Cho phép thêm mới ghi nhận rèn luyện cho sinh viên.',
  },
  {
    code: 'UPDATE_STUDENT_RECORD',
    name: 'Cập nhật ghi nhận sinh viên',
    module: GRADING_MANAGER_GROUP.name,
    description: 'Cho phép sửa thông tin ghi nhận rèn luyện sinh viên.',
  },
  {
    code: 'DELETE_STUDENT_RECORD',
    name: 'Xóa ghi nhận sinh viên',
    module: GRADING_MANAGER_GROUP.name,
    description: 'Cho phép xóa ghi nhận rèn luyện sinh viên.',
  },
  {
    code: 'READ_CLASS_RECORD',
    name: 'Xem ghi nhận lớp',
    module: GRADING_MANAGER_GROUP.name,
    description: 'Cho phép xem tổng hợp ghi nhận rèn luyện của cả lớp học.',
  },
  {
    code: 'READ_ALL_CLASS_RECORD',
    name: 'Xem toàn bộ ghi nhận lớp',
    module: GRADING_MANAGER_GROUP.name,
    description: 'Cho phép xem ghi nhận lớp do người dùng khác tạo.',
  },
  {
    code: 'CREATE_CLASS_RECORD',
    name: 'Thêm ghi nhận lớp',
    module: GRADING_MANAGER_GROUP.name,
    description: 'Cho phép thêm ghi nhận rèn luyện tập thể cho cả lớp.',
  },
  {
    code: 'UPDATE_CLASS_RECORD',
    name: 'Cập nhật ghi nhận lớp',
    module: GRADING_MANAGER_GROUP.name,
    description: 'Cho phép chỉnh sửa ghi nhận rèn luyện tập thể.',
  },
  {
    code: 'DELETE_CLASS_RECORD',
    name: 'Xóa ghi nhận lớp',
    module: GRADING_MANAGER_GROUP.name,
    description: 'Cho phép xóa ghi nhận rèn luyện tập thể.',
  },
  {
    code: 'CONFIG_RECORD',
    name: 'Cấu hình ghi nhận',
    module: GRADING_MANAGER_GROUP.name,
    description: 'Cho phép cấu hình các tiêu chí, điểm cộng/trừ rèn luyện.',
  },

  // 4. Nhóm Quản lý Nhiệm Vụ
  {
    code: 'READ_STUDENT_TASK',
    name: 'Xem nhiệm vụ học tập',
    module: TASK_MANAGER_GROUP.name,
    description:
      'Cho phép xem danh sách nhiệm vụ rèn luyện, học tập được giao.',
  },
  {
    code: 'CREATE_STUDENT_TASK',
    name: 'Tạo nhiệm vụ học tập',
    module: TASK_MANAGER_GROUP.name,
    description:
      'Cho phép tạo mới và phân công nhiệm vụ rèn luyện cho sinh viên/lớp.',
  },
  {
    code: 'UPDATE_STUDENT_TASK',
    name: 'Cập nhật nhiệm vụ học tập',
    module: TASK_MANAGER_GROUP.name,
    description: 'Cho phép chỉnh sửa nội dung, hạn chót, trạng thái nhiệm vụ.',
  },
  {
    code: 'DELETE_STUDENT_TASK',
    name: 'Xóa nhiệm vụ học tập',
    module: TASK_MANAGER_GROUP.name,
    description: 'Cho phép xóa nhiệm vụ học tập đã giao.',
  },

  // 5. Nhóm Quản trị vận hành hệ thống
  {
    code: 'SYSTEM_ADMIN',
    name: 'Truy cập trang quản trị hệ thống',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description:
      'Cho phép truy cập menu và giao diện tổng quan Quản trị vận hành hệ thống.',
  },
  {
    code: 'LOGIN_LOG_READ',
    name: 'Xem lịch sử đăng nhập',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description:
      'Cho phép xem nhật ký hoạt động đăng nhập và thay đổi bảo mật hệ thống.',
  },
  {
    code: 'SYSTEM_REQUEST_READ',
    name: 'Xem request hệ thống',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description:
      'Cho phép xem các yêu cầu thay đổi dữ liệu/hỗ trợ kỹ thuật hệ thống.',
  },
  {
    code: 'SYSTEM_REQUEST_MANAGE',
    name: 'Quản lý request hệ thống',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description:
      'Cho phép phê duyệt, từ chối, phân công và xóa các yêu cầu vận hành hệ thống.',
  },
  {
    code: 'DATABASE_BACKUP_READ',
    name: 'Xem danh sách backup',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description:
      'Cho phép xem danh sách và trạng thái các bản sao lưu cơ sở dữ liệu hệ thống.',
  },
  {
    code: 'DATABASE_BACKUP_CREATE',
    name: 'Tạo backup database',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description:
      'Cho phép kích hoạt tiến trình tạo bản sao lưu cơ sở dữ liệu tức thời.',
  },
  {
    code: 'DATABASE_BACKUP_DOWNLOAD',
    name: 'Tải backup database',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description:
      '⚠️ QUYỀN HẠN NGUY HIỂM: Cho phép tải xuống tệp sao lưu chứa toàn bộ cơ sở dữ liệu của hệ thống về máy cá nhân.',
  },
  {
    code: 'DATABASE_BACKUP_DELETE',
    name: 'Xóa backup database',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description:
      '⚠️ QUYỀN HẠN NHẠY CẢM: Cho phép xóa vĩnh viễn tệp sao lưu dữ liệu trên server, không thể khôi phục.',
  },
  {
    code: 'DATABASE_BACKUP_RESTORE',
    name: 'Khôi phục backup database',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description:
      '⚠️ QUYỀN HẠN CỰC KỲ NGUY HIỂM: Cho phép import, xem trước và thực hiện khôi phục ghi đè dữ liệu từ bản sao lưu.',
  },
  {
    code: 'SYSTEM_PERFORMANCE_READ',
    name: 'Xem hiệu năng hệ thống',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description: 'Cho phép xem thống kê hiệu năng trang và API.',
  },
  {
    code: 'SYSTEM_MAIL_CONFIG_MANAGE',
    name: 'Cấu hình MAIL SMTP',
    module: SYSTEM_OPERATIONS_GROUP.name,
    description:
      'Cho phép xem, sửa và kiểm tra kết nối cấu hình MAIL SMTP của hệ thống.',
  },

  // Nhóm Báo cáo
  {
    code: 'REPORTS_PAGE',
    name: 'Truy cập trang báo cáo',
    module: REPORT_MANAGER_GROUP.name,
    description: 'Cho phép truy cập vào giao diện trang thống kê báo cáo.',
  },
  {
    code: 'REPORTS_READ',
    name: 'Xem báo cáo',
    module: REPORT_MANAGER_GROUP.name,
    description: 'Cho phép xem dữ liệu các báo cáo và biểu đồ thống kê.',
  },

  // 7. Nhóm Quản lý Câu lạc bộ
  {
    code: 'ACTIVITY_PAGE',
    name: 'Truy cập trang quản lý Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép truy cập menu và giao diện quản lý câu lạc bộ.',
  },
  {
    code: 'ACTIVITY_READ',
    name: 'Xem Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách và chi tiết câu lạc bộ.',
  },
  {
    code: 'ACTIVITY_CREATE',
    name: 'Tạo Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép tạo câu lạc bộ mới.',
  },
  {
    code: 'ACTIVITY_UPDATE',
    name: 'Cập nhật Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép chỉnh sửa thông tin câu lạc bộ.',
  },
  {
    code: 'ACTIVITY_DELETE',
    name: 'Xóa Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép vô hiệu hóa (soft delete) câu lạc bộ.',
  },
  {
    code: 'ACTIVITY_MEMBER_MANAGE',
    name: 'Quản lý thành viên Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description:
      'Cho phép thêm, xóa, duyệt thành viên và phân vai trò trong Hoạt động.',
  },
  {
    code: 'ACTIVITY_SCHEDULE_READ',
    name: 'Xem lịch sinh hoạt Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description:
      'Cho phép xem lịch sinh hoạt và danh sách đăng ký buổi sinh hoạt Hoạt động.',
  },
  {
    code: 'ACTIVITY_SCHEDULE_MANAGE',
    name: 'Quản lý lịch sinh hoạt Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép tạo, sửa, xóa lịch sinh hoạt câu lạc bộ.',
  },
  {
    code: 'ACTIVITY_SCHEDULE_REGISTER',
    name: 'Đăng ký buổi sinh hoạt Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép sinh viên đăng ký hoặc hủy tham gia buổi sinh hoạt.',
  },
  {
    code: 'ACTIVITY_ATTENDANCE_READ',
    name: 'Xem điểm danh Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách và thống kê điểm danh câu lạc bộ.',
  },
  {
    code: 'ACTIVITY_ATTENDANCE_CREATE',
    name: 'Ghi nhận điểm danh Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description:
      'Cho phép ghi nhận điểm danh sinh viên tại buổi sinh hoạt Hoạt động.',
  },
  {
    code: 'ACTIVITY_ATTENDANCE_UPDATE',
    name: 'Cập nhật điểm danh Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép chỉnh sửa bản ghi điểm danh đã tồn tại.',
  },
  {
    code: 'ACTIVITY_ATTENDANCE_APPROVE',
    name: 'Duyệt điểm danh Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép duyệt hoặc từ chối điểm danh sinh viên tại Hoạt động.',
  },
  {
    code: 'ACTIVITY_ATTENDANCE_DELETE',
    name: 'Xóa điểm danh Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép xóa bản ghi điểm danh Hoạt động.',
  },
  {
    code: 'ACTIVITY_CONFIG_READ',
    name: 'Xem cấu hình điểm Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description:
      'Cho phép xem cấu hình mapping điểm danh Hoạt động sang điểm rèn luyện.',
  },
  {
    code: 'ACTIVITY_CONFIG_MANAGE',
    name: 'Quản lý cấu hình điểm Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép tạo, sửa, xóa cấu hình điểm danh → điểm rèn luyện.',
  },
  {
    code: 'ACTIVITY_REPORT_READ',
    name: 'Xem báo cáo Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép xem báo cáo thống kê hoạt động câu lạc bộ.',
  },
  {
    code: 'ACTIVITY_EXPORT',
    name: 'Xuất dữ liệu Hoạt động',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép xuất dữ liệu Hoạt động ra file Excel/PDF.',
  },

  // ── Attendance Sessions (Universal) ──
  {
    code: 'ATTENDANCE_SESSION_CREATE',
    name: 'Mở phiên điểm danh',
    module: ACTIVITY_MANAGER_GROUP.name,
    description:
      'Cho phép mở phiên điểm danh mới (QR Code hoặc Proximity).',
  },
  {
    code: 'ATTENDANCE_SESSION_READ',
    name: 'Xem phiên điểm danh',
    module: ACTIVITY_MANAGER_GROUP.name,
    description:
      'Cho phép xem danh sách và chi tiết các phiên điểm danh.',
  },
  {
    code: 'ATTENDANCE_SESSION_CLOSE',
    name: 'Đóng phiên điểm danh',
    module: ACTIVITY_MANAGER_GROUP.name,
    description: 'Cho phép đóng phiên điểm danh đang hoạt động.',
  },

  // 8. Nhóm Quản lý Ký túc xá (KTX)
  {
    code: 'DORM_PAGE',
    name: 'Truy cập trang quản lý KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép truy cập menu và giao diện quản lý Ký túc xá.',
  },
  {
    code: 'DORM_BUILDING_READ',
    name: 'Xem tòa nhà KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách và chi tiết tòa nhà KTX.',
  },
  {
    code: 'DORM_BUILDING_CREATE',
    name: 'Thêm tòa nhà KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép tạo mới tòa nhà KTX.',
  },
  {
    code: 'DORM_BUILDING_UPDATE',
    name: 'Cập nhật tòa nhà KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép chỉnh sửa thông tin tòa nhà KTX.',
  },
  {
    code: 'DORM_BUILDING_DELETE',
    name: 'Xóa tòa nhà KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xóa tòa nhà KTX.',
  },
  {
    code: 'DORM_ROOM_READ',
    name: 'Xem phòng KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách và chi tiết phòng KTX.',
  },
  {
    code: 'DORM_ROOM_CREATE',
    name: 'Thêm phòng KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép tạo mới phòng KTX.',
  },
  {
    code: 'DORM_ROOM_UPDATE',
    name: 'Cập nhật phòng KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép chỉnh sửa thông tin phòng KTX.',
  },
  {
    code: 'DORM_ROOM_DELETE',
    name: 'Xóa phòng KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xóa phòng KTX.',
  },
  {
    code: 'DORM_BED_CREATE',
    name: 'Thêm giường KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép tạo mới giường trong phòng KTX.',
  },
  {
    code: 'DORM_BED_UPDATE',
    name: 'Cập nhật giường KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép cập nhật trạng thái giường KTX.',
  },
  {
    code: 'DORM_BED_DELETE',
    name: 'Xóa giường KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xóa giường KTX.',
  },
  {
    code: 'DORM_REG_READ',
    name: 'Xem Danh sách KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xem Danh sách KTX.',
  },
  {
    code: 'DORM_REG_CREATE',
    name: 'Tạo mục Danh sách KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép tạo mục Danh sách KTX.',
  },
  {
    code: 'PDF_TEMPLATE_READ',
    name: 'Xem PDF Template Designer',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xem catalog, source và synthetic preview của PDF template.',
  },
  {
    code: 'PDF_TEMPLATE_MANAGE',
    name: 'Quản lý PDF Template Designer',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép thay PDF nền, chỉnh layout và lưu template hiện hành.',
  },
  {
    code: 'PDF_TEMPLATE_DELETE',
    name: 'Xóa PDF Template Designer',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xóa PDF và layout đã lưu của một collection.',
  },
  {
    code: 'DORM_REG_UPDATE',
    name: 'Cập nhật Danh sách KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép chỉnh sửa thông tin Danh sách KTX.',
  },
  {
    code: 'DORM_REG_DELETE',
    name: 'Xóa mục Danh sách KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xóa mục Danh sách KTX.',
  },
  {
    code: 'DORM_CONTRACT_READ',
    name: 'Xem hợp đồng KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách và chi tiết hợp đồng KTX.',
  },
  {
    code: 'DORM_CONTRACT_CREATE',
    name: 'Lập hợp đồng KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép lập hợp đồng ở KTX cho sinh viên.',
  },
  {
    code: 'DORM_CONTRACT_UPDATE',
    name: 'Cập nhật hợp đồng KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép hủy, gia hạn, chuyển phòng hợp đồng KTX.',
  },
  {
    code: 'DORM_INVOICE_READ',
    name: 'Xem hóa đơn KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách và chi tiết hóa đơn phí KTX.',
  },
  {
    code: 'DORM_INVOICE_CREATE',
    name: 'Lập hóa đơn KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép lập hóa đơn phí KTX (đơn lẻ và hàng loạt).',
  },
  {
    code: 'DORM_INVOICE_CONFIRM',
    name: 'Xác nhận thanh toán KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xác nhận thanh toán hóa đơn phí KTX.',
  },
  {
    code: 'DORM_INVOICE_DELETE',
    name: 'Xóa hóa đơn KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xóa hóa đơn phí KTX.',
  },
  {
    code: 'DORM_VIOLATION_READ',
    name: 'Xem vi phạm KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách và chi tiết vi phạm nội quy KTX.',
  },
  {
    code: 'DORM_VIOLATION_CREATE',
    name: 'Ghi nhận vi phạm KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép ghi nhận vi phạm nội quy KTX.',
  },
  {
    code: 'DORM_VIOLATION_HANDLE',
    name: 'Xử lý vi phạm KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xử lý vi phạm KTX (cảnh cáo, phạt, buộc rời).',
  },
  {
    code: 'DORM_MAINT_READ',
    name: 'Xem yêu cầu bảo trì KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách yêu cầu bảo trì KTX.',
  },
  {
    code: 'DORM_MAINT_CREATE',
    name: 'Tạo yêu cầu bảo trì KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép tạo yêu cầu sửa chữa thiết bị KTX.',
  },
  {
    code: 'DORM_MAINT_ASSIGN',
    name: 'Phân công bảo trì KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép phân công kỹ thuật viên và cập nhật tiến độ bảo trì.',
  },
  {
    code: 'DORM_MAINT_COMPLETE',
    name: 'Hoàn tất bảo trì KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép đánh dấu hoàn tất yêu cầu bảo trì KTX.',
  },
  {
    code: 'DORM_REPORT_READ',
    name: 'Xem báo cáo KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xem báo cáo thống kê KTX (lấp đầy, công nợ, vi phạm, bảo trì).',
  },
  {
    code: 'DORM_QR_CHECKIN',
    name: 'Check-in/out QR KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép quét QR để check-in/check-out phòng KTX.',
  },

  // Nhóm Đề xuất bổ sung (Các quyền CRUD cho trang /permissions chưa có guard)
  {
    code: 'USER_CREATE',
    name: 'Thêm người dùng',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Thêm mới người dùng',
  },
  {
    code: 'USER_UPDATE',
    name: 'Cập nhật người dùng',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Chỉnh sửa thông tin người dùng',
  },
  {
    code: 'USER_DELETE',
    name: 'Xóa người dùng',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Xóa người dùng',
  },
  {
    code: 'ROLE_CREATE',
    name: 'Thêm vai trò',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Tạo mới vai trò',
  },
  {
    code: 'ROLE_UPDATE',
    name: 'Cập nhật vai trò',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Chỉnh sửa vai trò',
  },
  {
    code: 'ROLE_DELETE',
    name: 'Xóa vai trò',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Xóa vai trò',
  },
  {
    code: 'PERMISSION_CREATE',
    name: 'Thêm quyền',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Thêm mới mã quyền',
  },
  {
    code: 'PERMISSION_UPDATE',
    name: 'Cập nhật quyền',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Cập nhật thông tin quyền',
  },
  {
    code: 'PERMISSION_DELETE',
    name: 'Xóa quyền',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Xóa mã quyền',
  },
  {
    code: 'PERMISSION_GROUP_CREATE',
    name: 'Thêm nhóm quyền',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Thêm nhóm quyền',
  },
  {
    code: 'PERMISSION_GROUP_UPDATE',
    name: 'Cập nhật nhóm quyền',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Cập nhật nhóm quyền',
  },
  {
    code: 'PERMISSION_GROUP_DELETE',
    name: 'Xóa nhóm quyền',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Xóa nhóm quyền',
  },
  {
    code: 'ROUTE_PERMISSION_CREATE',
    name: 'Thêm Route Permission',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Thêm mapping route permission',
  },
  {
    code: 'ROUTE_PERMISSION_UPDATE',
    name: 'Cập nhật Route Permission',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Cập nhật mapping route permission',
  },
  {
    code: 'ROUTE_PERMISSION_DELETE',
    name: 'Xóa Route Permission',
    module: ADMIN_RBAC_GROUP.name,
    description: 'Đề xuất: Xóa mapping route permission',
  },
];

const ADMIN_PAGE_CODES = new Set([
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
  'ROUTE_PERMISSION_DELETE',
]);

const POLICY_OVERRIDES: Record<
  string,
  Partial<Pick<PermissionPolicy, 'kind' | 'requires' | 'owners' | 'routePath' | 'proposed'>>
> = {
  admin: { kind: 'page/module access', owners: ['/permissions'], routePath: '/permissions' },
  ADMIN_FULL: { kind: 'scope modifier', owners: ['/permissions'], routePath: '/permissions' },
  view_users: { kind: 'read', requires: ['admin'], owners: ['/permissions'], routePath: '/permissions' },
  reset_pwd: { kind: 'action', requires: ['admin', 'view_users'], owners: ['/permissions'], routePath: '/permissions' },
  STUDENT_PAGE: { kind: 'page/module access', owners: ['/students'], routePath: '/students' },
  STUDENT_READ: { kind: 'read', requires: ['STUDENT_PAGE'], owners: ['/students'], routePath: '/students' },
  GRADING_PAGE: { kind: 'page/module access', owners: ['/students/record'], routePath: '/students/record' },
  READ_STUDENT_RECORD: { kind: 'read', requires: ['GRADING_PAGE'], owners: ['/students/record', 'GET /academic-records'], routePath: '/students/record' },
  CREATE_STUDENT_RECORD: { kind: 'action', requires: ['READ_STUDENT_RECORD'], owners: ['POST /academic-records'], routePath: '/students/record' },
  UPDATE_STUDENT_RECORD: { kind: 'action', requires: ['READ_STUDENT_RECORD'], owners: ['PATCH /academic-records/:id'], routePath: '/students/record' },
  DELETE_STUDENT_RECORD: { kind: 'action', requires: ['READ_STUDENT_RECORD'], owners: ['DELETE /academic-records/:id'], routePath: '/students/record' },
  READ_CLASS_RECORD: { kind: 'read', requires: ['GRADING_PAGE'], owners: ['/students/record', 'GET /daily-class-reports'], routePath: '/students/record' },
  READ_ALL_CLASS_RECORD: { kind: 'scope modifier', requires: ['READ_CLASS_RECORD'], owners: ['GET /daily-class-reports'], routePath: '/students/record' },
  CREATE_CLASS_RECORD: { kind: 'action', requires: ['READ_CLASS_RECORD'], owners: ['POST /daily-class-reports'], routePath: '/students/record' },
  UPDATE_CLASS_RECORD: { kind: 'action', requires: ['READ_CLASS_RECORD'], owners: ['PATCH /daily-class-reports/:id'], routePath: '/students/record' },
  DELETE_CLASS_RECORD: { kind: 'action', requires: ['READ_CLASS_RECORD'], owners: ['DELETE /daily-class-reports/:id'], routePath: '/students/record' },
  READ_STUDENT_TASK: { kind: 'read', requires: ['STUDENT_PAGE'], owners: ['/students/tasks', 'GET /student-tasks'], routePath: '/students/tasks' },
  SYSTEM_ADMIN: { kind: 'page/module access', owners: ['/system'], routePath: '/system' },
  LOGIN_LOG_READ: { kind: 'read', requires: ['SYSTEM_ADMIN'], owners: ['GET /system/login-logs', 'GET /system/login-logs/summary'], routePath: '/system' },
  SYSTEM_REQUEST_READ: { kind: 'read', requires: ['SYSTEM_ADMIN'], owners: ['GET /system/requests'], routePath: '/system' },
  SYSTEM_REQUEST_MANAGE: { kind: 'action', requires: ['SYSTEM_ADMIN', 'SYSTEM_REQUEST_READ'], owners: ['POST/PATCH/DELETE /system/requests'], routePath: '/system' },
  DATABASE_BACKUP_READ: { kind: 'read', requires: ['SYSTEM_ADMIN'], owners: ['GET /system/backups', 'GET /system/backups/:id'], routePath: '/system' },
  DATABASE_BACKUP_CREATE: { kind: 'action', requires: ['SYSTEM_ADMIN', 'DATABASE_BACKUP_READ'], owners: ['POST /system/backups'], routePath: '/system' },
  DATABASE_BACKUP_DOWNLOAD: { kind: 'action', requires: ['SYSTEM_ADMIN', 'DATABASE_BACKUP_READ'], owners: ['GET /system/backups/:id/download'], routePath: '/system' },
  DATABASE_BACKUP_DELETE: { kind: 'action', requires: ['SYSTEM_ADMIN', 'DATABASE_BACKUP_READ'], owners: ['DELETE /system/backups/:id'], routePath: '/system' },
  DATABASE_BACKUP_RESTORE: { kind: 'action', requires: ['SYSTEM_ADMIN', 'DATABASE_BACKUP_READ'], owners: ['POST /system/backups/import/*'], routePath: '/system' },
  SYSTEM_PERFORMANCE_READ: { kind: 'read', requires: ['SYSTEM_ADMIN'], owners: ['GET /system/performance/summary', 'GET /system/performance/metrics'], routePath: '/system' },
  SYSTEM_MAIL_CONFIG_MANAGE: { kind: 'action', requires: ['SYSTEM_ADMIN'], owners: ['GET/PATCH/POST /system/settings/mail'], routePath: '/system' },
  ACTIVITY_PAGE: { kind: 'page/module access', owners: ['/activities'], routePath: '/activities' },
  ACTIVITY_READ: { kind: 'read', requires: ['ACTIVITY_PAGE'], owners: ['/activities', 'GET /activities'], routePath: '/activities' },
  ACTIVITY_CREATE: { kind: 'action', requires: ['ACTIVITY_PAGE', 'ACTIVITY_READ'], owners: ['POST /activities'], routePath: '/activities' },
  ACTIVITY_UPDATE: { kind: 'action', requires: ['ACTIVITY_PAGE', 'ACTIVITY_READ'], owners: ['PATCH /activities/:id', 'POST /activities/media/upload'], routePath: '/activities' },
  ACTIVITY_DELETE: { kind: 'action', requires: ['ACTIVITY_PAGE', 'ACTIVITY_READ'], owners: ['DELETE /activities/:id'], routePath: '/activities' },
  ACTIVITY_MEMBER_MANAGE: { kind: 'action', requires: ['ACTIVITY_PAGE', 'ACTIVITY_READ'], owners: ['POST/PATCH/DELETE /activities/:id/members'], routePath: '/activities/:activityId' },
  ACTIVITY_SCHEDULE_READ: { kind: 'read', requires: ['ACTIVITY_PAGE', 'ACTIVITY_READ'], owners: ['/activities/schedule', 'GET /activity-schedules'], routePath: '/activities/schedule' },
  ACTIVITY_SCHEDULE_MANAGE: { kind: 'action', requires: ['ACTIVITY_SCHEDULE_READ'], owners: ['POST/PATCH/DELETE /activity-schedules'], routePath: '/activities/schedule' },
  ACTIVITY_SCHEDULE_REGISTER: { kind: 'self-service', requires: ['ACTIVITY_SCHEDULE_READ'], owners: ['/activities/schedule', 'POST /activities/:id/join', 'GET /activity-attendance/my'], routePath: '/activities/schedule' },
  ACTIVITY_ATTENDANCE_READ: { kind: 'read', requires: ['ACTIVITY_PAGE', 'ACTIVITY_READ'], owners: ['/activities/attendance', 'GET /activity-attendance'], routePath: '/activities/attendance' },
  ACTIVITY_ATTENDANCE_CREATE: { kind: 'action', requires: ['ACTIVITY_ATTENDANCE_READ'], owners: ['POST /activity-attendance', 'POST /activity-completion-rules'], routePath: '/activities/:activityId' },
  ACTIVITY_ATTENDANCE_UPDATE: { kind: 'action', requires: ['ACTIVITY_ATTENDANCE_READ'], owners: ['PATCH /activity-attendance/:id', 'PATCH /activity-completion-rules/:id'], routePath: '/activities/:activityId' },
  ACTIVITY_ATTENDANCE_APPROVE: { kind: 'action', requires: ['ACTIVITY_ATTENDANCE_READ'], owners: ['POST /activity-attendance/:id/approve'], routePath: '/activities/:activityId' },
  ACTIVITY_ATTENDANCE_DELETE: { kind: 'action', requires: ['ACTIVITY_ATTENDANCE_READ'], owners: ['DELETE /activity-attendance/:id'], routePath: '/activities/:activityId' },
  ACTIVITY_CONFIG_READ: { kind: 'read', requires: ['ACTIVITY_PAGE'], owners: ['GET /activity-attendance-config'], routePath: '/activities/:activityId' },
  ACTIVITY_CONFIG_MANAGE: { kind: 'action', requires: ['ACTIVITY_CONFIG_READ'], owners: ['POST/PATCH/DELETE /activity-attendance-config'], routePath: '/activities/:activityId' },
  ACTIVITY_REPORT_READ: { kind: 'read', requires: ['ACTIVITY_PAGE', 'ACTIVITY_READ'], owners: ['GET /activities/:id/stats'], routePath: '/activities/:activityId' },
  ACTIVITY_EXPORT: { kind: 'action', requires: ['ACTIVITY_ATTENDANCE_READ'], owners: ['frontend/src/app/(dashboard)/activities/attendance/page.tsx:exportSelected'], routePath: '/activities/attendance' },
  ATTENDANCE_SESSION_CREATE: { kind: 'action', requires: ['ACTIVITY_PAGE', 'ATTENDANCE_SESSION_READ'], owners: ['POST /attendance-sessions'], routePath: '/activities/:activityId' },
  ATTENDANCE_SESSION_READ: { kind: 'read', requires: ['ACTIVITY_PAGE'], owners: ['/activities/:activityId', 'GET /attendance-sessions'], routePath: '/activities/:activityId' },
  ATTENDANCE_SESSION_CLOSE: { kind: 'action', requires: ['ATTENDANCE_SESSION_READ'], owners: ['POST /attendance-sessions/:id/close'], routePath: '/activities/:activityId' },
  DORM_PAGE: { kind: 'page/module access', owners: ['/dormitory'], routePath: '/dormitory' },
  DORM_REG_READ: { kind: 'read', requires: ['DORM_PAGE'], owners: ['/dormitory/roster', 'GET /dormitory/roster'], routePath: '/dormitory/roster' },
  DORM_REG_CREATE: { kind: 'action', requires: ['DORM_REG_READ'], owners: ['POST /dormitory/roster'], routePath: '/dormitory/roster' },
  DORM_REG_UPDATE: { kind: 'action', requires: ['DORM_REG_READ'], owners: ['PATCH /dormitory/roster'], routePath: '/dormitory/roster' },
  DORM_REG_DELETE: { kind: 'action', requires: ['DORM_REG_READ'], owners: ['DELETE /dormitory/roster'], routePath: '/dormitory/roster' },
};

function inferredPolicy(seed: PermissionSeed): PermissionPolicy {
  const code = seed.code;
  const override = POLICY_OVERRIDES[code] || {};
  const proposed = override.proposed ?? false;
  let kind: PermissionPolicyKind = override.kind || 'backend-only';
  let routePath = override.routePath;
  let owners = override.owners || [];
  let requires = override.requires || [];

  if (ADMIN_PAGE_CODES.has(code) && !override.kind) {
    kind = code === 'ADMIN_FULL' ? 'scope modifier' : code === 'admin' ? 'page/module access' : code === 'view_users' ? 'read' : 'action';
    requires = code === 'admin' || code === 'ADMIN_FULL' ? [] : ['admin'];
    owners = ['/permissions'];
    routePath = '/permissions';
  }

  if (code.startsWith('STUDENT_') || code.startsWith('CLASS_') || code.startsWith('DEPT_')) {
    routePath = routePath || '/students';
    owners = owners.length ? owners : [routePath];
    if (code.endsWith('_READ') || code === 'STUDENT_EXPORT') kind = 'read';
    else if (code !== 'STUDENT_PAGE') kind = 'action';
    if (code !== 'STUDENT_PAGE' && !requires.length) requires = ['STUDENT_PAGE'];
  }
  if (code.includes('TASK')) {
    routePath = '/students/tasks';
    owners = ['/students/tasks', `API permission ${code}`];
    kind = code === 'READ_STUDENT_TASK' ? 'read' : 'action';
    if (!requires.length) requires = ['READ_STUDENT_TASK'];
  }
  if (code.startsWith('SYSTEM_') || code.startsWith('LOGIN_') || code.startsWith('DATABASE_')) {
    routePath = '/system';
    owners = ['/system', `API permission ${code}`];
    if (!override.kind) kind = code === 'SYSTEM_ADMIN' ? 'page/module access' : 'read';
    if (override.owners?.length) owners = override.owners;
    if (override.routePath) routePath = override.routePath;
    if (code !== 'SYSTEM_ADMIN' && !requires.length) requires = ['SYSTEM_ADMIN'];
  }
  if (code.startsWith('REPORTS_')) {
    routePath = '/reports';
    owners = ['/reports'];
    kind = code === 'REPORTS_PAGE' ? 'page/module access' : 'read';
    if (code === 'REPORTS_READ') requires = ['REPORTS_PAGE'];
  }
  if (code.startsWith('ACTIVITY_') || code.startsWith('ATTENDANCE_SESSION_')) {
    routePath = routePath || '/activities';
    owners = owners.length ? owners : ['/activities', `API permission ${code}`];
    if (code === 'ACTIVITY_PAGE') kind = 'page/module access';
    else if (code.endsWith('_READ')) kind = 'read';
    else if (code === 'ACTIVITY_SCHEDULE_REGISTER') kind = 'self-service';
    else kind = 'action';
    if (!requires.length && code !== 'ACTIVITY_PAGE') requires = ['ACTIVITY_PAGE'];
  }
  if (code.startsWith('DORM_') || code.startsWith('PDF_TEMPLATE_')) {
    routePath = routePath || '/dormitory';
    owners = owners.length ? owners : ['/dormitory', `backend/src/dormitory/controllers (${code})`];
    if (code.endsWith('_READ') || code === 'DORM_PAGE') kind = code === 'DORM_PAGE' ? 'page/module access' : 'read';
    else kind = 'backend-only';
    if (!requires.length && code !== 'DORM_PAGE') requires = ['DORM_PAGE'];
  }

  if (!owners.length) owners = [`API permission ${code}`];
  return { code, kind, requires, owners, routePath, proposed };
}

export const PERMISSION_POLICIES: PermissionPolicy[] = DECLARED_PERMISSION_SEEDS.map(inferredPolicy);
export const PERMISSION_POLICY_BY_CODE = new Map(PERMISSION_POLICIES.map((policy) => [policy.code, policy]));
export const DECLARED_PERMISSION_CODES = DECLARED_PERMISSION_SEEDS.map((seed) => seed.code);

export function getPermissionPolicy(code: string): PermissionPolicy | undefined {
  return PERMISSION_POLICY_BY_CODE.get(code);
}

export function validatePermissionPolicyCatalog(): string[] {
  const errors: string[] = [];
  const declared = new Set<string>();
  for (const seed of DECLARED_PERMISSION_SEEDS) {
    if (declared.has(seed.code)) errors.push(`duplicate declared permission: ${seed.code}`);
    declared.add(seed.code);
  }
  if (PERMISSION_POLICIES.length !== DECLARED_PERMISSION_SEEDS.length) errors.push('policy count does not match declared seed count');
  for (const policy of PERMISSION_POLICIES) {
    if (!declared.has(policy.code)) errors.push(`unknown policy code: ${policy.code}`);
    if (!policy.owners.length) errors.push(`ownerless permission: ${policy.code}`);
    for (const dependency of policy.requires) {
      if (!declared.has(dependency)) errors.push(`unknown dependency ${dependency} for ${policy.code}`);
    }
  }
  return errors;
}
