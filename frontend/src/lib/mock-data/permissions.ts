export const MOCK_USERS = [
  { id: '#U-2023001', name: 'Nguyễn Văn A', email: 'vana@email.com', phone: '0901234567', roles: ['Admin', 'Giảng viên'], status: 'Active' },
  { id: '#U-2023002', name: 'Nguyễn Văn A', email: 'vana@email.com', phone: '0901234567', roles: ['Admin', 'Giảng viên'], status: 'Active' },
  { id: '#U-2023003', name: 'Nguyễn Văn A', email: 'vana@email.com', phone: '0901234567', roles: ['Admin', 'Giảng viên'], status: 'Active' },
  { id: '#U-2023004', name: 'Nguyễn Văn A', email: 'vana@email.com', phone: '0901234567', roles: ['Admin', 'Giảng viên'], status: 'Active' },
  { id: '#U-2023005', name: 'Nguyễn Văn A', email: 'vana@email.com', phone: '0901234567', roles: ['Admin', 'Giảng viên'], status: 'Active' },
];

export const MOCK_ROLES = [
  { id: 'r1', name: 'Quản trị viên (Admin)', desc: 'Toàn quyền truy cập hệ thống', type: 'Hệ thống', status: 'Hoạt động', ref: 'ID: #R001' },
  { id: 'r2', name: 'Giảng viên chính', desc: 'Quản lý lớp học và điểm số', type: 'Tùy chỉnh', status: 'Hoạt động', ref: 'Hết hạn: 31/12/2024' },
  { id: 'r3', name: 'Trợ giảng (TA)', desc: 'Hỗ trợ chấm điểm và quản lý sinh viên', type: 'Tùy chỉnh', status: 'Tạm dừng', ref: 'ID: #R003' },
  { id: 'r4', name: 'Sinh viên', desc: 'Xem khóa học và làm bài tập', type: 'Hệ thống', status: 'Hoạt động', ref: 'ID: #R004' },
  { id: 'r5', name: 'Kế toán học vụ', desc: 'Quản lý thu chi', type: 'Tùy chỉnh', status: 'Ngừng kích hoạt', ref: 'Hết hạn: 01/01/2024' },
];

export const MOCK_GROUPS = [
  { id: 'acad', name: 'Quản lý Đào tạo (Academic)', desc: 'Quyền liên quan đến khóa học, lớp học và nội dung đào tạo.', tag: 'G_ACAD', status: 'Active', count: 4 },
  { id: 'user', name: 'Quản lý Người dùng (Users)', desc: 'Phân quyền quản lý tài khoản sinh viên, giảng viên.', tag: 'G_USER', status: 'Active', count: 3 },
  { id: 'fin', name: 'Tài chính & Kế toán (Finance)', desc: 'Quản lý học phí, lương thưởng.', tag: 'G_FIN', status: 'Active', count: 8 },
  { id: 'sys', name: 'Hệ thống (System)', desc: 'Cấu hình chung toàn hệ thống', tag: 'G_SYS', status: 'Active', count: 12 },
  { id: 'adm', name: 'Tuyển sinh (Admission)', desc: 'Quản lý hồ sơ và tư vấn tuyển sinh', tag: 'G_ADM', status: 'Inactive', count: 0 },
];

export const MOCK_PERMISSIONS: Record<string, any[]> = {
  'acad': [
    { code: 'view_course', name: 'Xem danh sách khóa học', desc: 'Cho phép xem tất cả các khóa học trong hệ thống' },
    { code: 'create_course', name: 'Tạo mới khóa học', desc: 'Cho phép tạo mới và cấu hình khóa học' },
    { code: 'edit_content', name: 'Chỉnh sửa nội dung', desc: 'Cập nhật bài giảng, video và tài liệu' },
    { code: 'delete_course', name: 'Xóa khóa học', desc: 'Xóa khóa học khỏi hệ thống (Cần phê duyệt)' },
  ],
  'user': [
    { code: 'view_users', name: 'Xem danh sách người dùng', desc: 'Truy cập danh bạ toàn bộ người dùng' },
    { code: 'reset_pwd', name: 'Reset mật khẩu', desc: 'Gửi email đặt lại mật khẩu cho user' },
  ],
  'fin': [
    { code: 'view_revenue', name: 'Xem báo cáo doanh thu', desc: 'Quyền nhạy cảm, chỉ dành cho cấp cao' },
  ]
};
