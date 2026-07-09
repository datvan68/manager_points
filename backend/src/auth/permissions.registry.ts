export interface PermissionSeed {
  code: string;
  name: string;
  module: string;
  description?: string;
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

export const CLUB_MANAGER_GROUP = {
  code: 'G_CLUB',
  name: 'Quản lý Câu lạc bộ',
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
    description: 'Cho phép xóa lớp quản lý (chỉ khi lớp không còn sinh viên).',
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
    code: 'CLUB_PAGE',
    name: 'Truy cập trang quản lý CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép truy cập menu và giao diện quản lý câu lạc bộ.',
  },
  {
    code: 'CLUB_READ',
    name: 'Xem CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách và chi tiết câu lạc bộ.',
  },
  {
    code: 'CLUB_CREATE',
    name: 'Tạo CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép tạo câu lạc bộ mới.',
  },
  {
    code: 'CLUB_UPDATE',
    name: 'Cập nhật CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép chỉnh sửa thông tin câu lạc bộ.',
  },
  {
    code: 'CLUB_DELETE',
    name: 'Xóa CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép vô hiệu hóa (soft delete) câu lạc bộ.',
  },
  {
    code: 'CLUB_MEMBER_MANAGE',
    name: 'Quản lý thành viên CLB',
    module: CLUB_MANAGER_GROUP.name,
    description:
      'Cho phép thêm, xóa, duyệt thành viên và phân vai trò trong CLB.',
  },
  {
    code: 'CLUB_SCHEDULE_READ',
    name: 'Xem lịch sinh hoạt CLB',
    module: CLUB_MANAGER_GROUP.name,
    description:
      'Cho phép xem lịch sinh hoạt và danh sách đăng ký buổi sinh hoạt CLB.',
  },
  {
    code: 'CLUB_SCHEDULE_MANAGE',
    name: 'Quản lý lịch sinh hoạt CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép tạo, sửa, xóa lịch sinh hoạt câu lạc bộ.',
  },
  {
    code: 'CLUB_SCHEDULE_REGISTER',
    name: 'Đăng ký buổi sinh hoạt CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép sinh viên đăng ký hoặc hủy tham gia buổi sinh hoạt.',
  },
  {
    code: 'CLUB_ATTENDANCE_READ',
    name: 'Xem điểm danh CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách và thống kê điểm danh câu lạc bộ.',
  },
  {
    code: 'CLUB_ATTENDANCE_CREATE',
    name: 'Ghi nhận điểm danh CLB',
    module: CLUB_MANAGER_GROUP.name,
    description:
      'Cho phép ghi nhận điểm danh sinh viên tại buổi sinh hoạt CLB.',
  },
  {
    code: 'CLUB_ATTENDANCE_UPDATE',
    name: 'Cập nhật điểm danh CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép chỉnh sửa bản ghi điểm danh đã tồn tại.',
  },
  {
    code: 'CLUB_ATTENDANCE_APPROVE',
    name: 'Duyệt điểm danh CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép duyệt hoặc từ chối điểm danh sinh viên tại CLB.',
  },
  {
    code: 'CLUB_ATTENDANCE_DELETE',
    name: 'Xóa điểm danh CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép xóa bản ghi điểm danh CLB.',
  },
  {
    code: 'CLUB_CONFIG_READ',
    name: 'Xem cấu hình điểm CLB',
    module: CLUB_MANAGER_GROUP.name,
    description:
      'Cho phép xem cấu hình mapping điểm danh CLB sang điểm rèn luyện.',
  },
  {
    code: 'CLUB_CONFIG_MANAGE',
    name: 'Quản lý cấu hình điểm CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép tạo, sửa, xóa cấu hình điểm danh → điểm rèn luyện.',
  },
  {
    code: 'CLUB_REPORT_READ',
    name: 'Xem báo cáo CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép xem báo cáo thống kê hoạt động câu lạc bộ.',
  },
  {
    code: 'CLUB_EXPORT',
    name: 'Xuất dữ liệu CLB',
    module: CLUB_MANAGER_GROUP.name,
    description: 'Cho phép xuất dữ liệu CLB ra file Excel/PDF.',
  },

  // ── Attendance Sessions (Universal) ──
  {
    code: 'ATTENDANCE_SESSION_CREATE',
    name: 'Mở phiên điểm danh',
    module: CLUB_MANAGER_GROUP.name,
    description:
      'Cho phép mở phiên điểm danh mới (QR Code hoặc Proximity).',
  },
  {
    code: 'ATTENDANCE_SESSION_READ',
    name: 'Xem phiên điểm danh',
    module: CLUB_MANAGER_GROUP.name,
    description:
      'Cho phép xem danh sách và chi tiết các phiên điểm danh.',
  },
  {
    code: 'ATTENDANCE_SESSION_CLOSE',
    name: 'Đóng phiên điểm danh',
    module: CLUB_MANAGER_GROUP.name,
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
    name: 'Xem đăng ký KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép xem danh sách đơn đăng ký ở KTX.',
  },
  {
    code: 'DORM_REG_CREATE',
    name: 'Tạo đăng ký KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép tạo đơn đăng ký ở KTX.',
  },
  {
    code: 'DORM_REG_APPROVE',
    name: 'Duyệt đăng ký KTX',
    module: DORMITORY_MANAGER_GROUP.name,
    description: 'Cho phép duyệt hoặc từ chối đơn đăng ký ở KTX, phân phòng.',
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
