export const departments = [
  { id: 'CNTT', name: 'Công nghệ thông tin - Kỹ thuật điện', code: 'CNTT', classCount: 12, active: true },
  { id: 'KTQT', name: 'Kinh tế quốc tế', code: 'KTQT', classCount: 8, active: false },
  { id: 'NNA', name: 'Ngôn ngữ Anh', code: 'NNA', classCount: 6, active: false },
  { id: 'CKCT', name: 'Cơ khí chế tạo', code: 'CKCT', classCount: 10, active: false },
  { id: 'KTR', name: 'Kiến trúc', code: 'KTR', classCount: 5, active: false },
];

export const classes = [
  {
    id: 'K45A',
    name: 'Lớp CNTT-K45A',
    year: '2021 - 2025',
    status: 'Đang học',
    statusColor: 'bg-green-100 text-green-700',
    students: 45,
    avatars: ['https://i.pravatar.cc/150?u=1', 'https://i.pravatar.cc/150?u=2', 'https://i.pravatar.cc/150?u=3'],
    extraStudents: 42
  },
  {
    id: 'K45B',
    name: 'Lớp CNTT-K45B',
    year: '2021 - 2025',
    status: 'Đang học',
    statusColor: 'bg-green-100 text-green-700',
    students: 41,
    avatars: ['https://i.pravatar.cc/150?u=4', 'https://i.pravatar.cc/150?u=5', 'https://i.pravatar.cc/150?u=6'],
    extraStudents: 39
  },
  {
    id: 'K44CLC',
    name: 'Lớp CNTT-K44CLC',
    year: '2020 - 2024',
    status: 'Sắp tốt nghiệp',
    statusColor: 'bg-yellow-100 text-yellow-700',
    students: 30,
    avatars: ['https://i.pravatar.cc/150?u=7', 'https://i.pravatar.cc/150?u=8'],
    extraStudents: 29
  },
  {
    id: 'K43',
    name: 'Lớp CNTT-K43',
    year: '2019 - 2023',
    status: 'Đã tốt nghiệp',
    statusColor: 'bg-gray-100 text-gray-600',
    students: 0,
    avatars: [],
    extraStudents: 0
  }
];

export const mockStudents = [
  { id: '20216001', name: 'Nguyễn Văn An', email: 'an.nv21@school.edu.vn', dob: '12/05/2003', gender: 'Nam', score: 85, status: 'Đang học', classId: 'K45A' },
  { id: '20216002', name: 'Trần Thị Bích', email: 'bich.tt21@school.edu.vn', dob: '24/08/2003', gender: 'Nữ', score: 92, status: 'Đang học', classId: 'K45A' },
  { id: '20216003', name: 'Lê Hoàng Cường', email: 'cuong.lh21@school.edu.vn', dob: '05/01/2003', gender: 'Nam', score: 70, status: 'Bảo lưu', classId: 'K45B' },
  { id: '20216004', name: 'Phạm Minh Đức', email: 'duc.pm21@school.edu.vn', dob: '19/11/2003', gender: 'Nam', score: 88, status: 'Đang học', classId: 'K45A' },
  { id: '20216005', name: 'Hoàng Thị Em', email: 'em.ht21@school.edu.vn', dob: '30/03/2003', gender: 'Nữ', score: 65, status: 'Thôi học', classId: 'K45B' },
  { id: '20216006', name: 'Vũ Minh Giang', email: 'giang.vm21@school.edu.vn', dob: '14/09/2003', gender: 'Nam', score: 90, status: 'Đang học', classId: 'K45A' },
  { id: '20216007', name: 'Nguyễn Thị Hoa', email: 'hoa.nt21@school.edu.vn', dob: '02/02/2003', gender: 'Nữ', score: 78, status: 'Đang học', classId: 'K45B' },
  { id: '20216008', name: 'Trần Đức Hùng', email: 'hung.td21@school.edu.vn', dob: '11/11/2003', gender: 'Nam', score: 82, status: 'Đang học', classId: 'K45A' },
  { id: '20216009', name: 'Phạm Thị Lan', email: 'lan.pt21@school.edu.vn', dob: '09/07/2003', gender: 'Nữ', score: 95, status: 'Đang học', classId: 'K45A' },
  { id: '20216010', name: 'Đỗ Minh Khôi', email: 'khoi.dm21@school.edu.vn', dob: '22/04/2003', gender: 'Nam', score: 68, status: 'Bảo lưu', classId: 'K45A' },
  { id: '20216011', name: 'Lê Thị Mai', email: 'mai.lt21@school.edu.vn', dob: '15/06/2003', gender: 'Nữ', score: 89, status: 'Đang học', classId: 'K45B' },
  { id: '20216012', name: 'Ngô Văn Nam', email: 'nam.nv21@school.edu.vn', dob: '01/12/2003', gender: 'Nam', score: 74, status: 'Đang học', classId: 'K45A' },
  { id: '20216013', name: 'Đinh Thị Ngọc', email: 'ngoc.dt21@school.edu.vn', dob: '18/03/2003', gender: 'Nữ', score: 91, status: 'Đang học', classId: 'K45B' },
  { id: '20216014', name: 'Bùi Văn Phong', email: 'phong.bv21@school.edu.vn', dob: '20/10/2003', gender: 'Nam', score: 60, status: 'Thôi học', classId: 'K43' },
  { id: '20216015', name: 'Hồ Thị Quyên', email: 'quyen.ht21@school.edu.vn', dob: '05/09/2003', gender: 'Nữ', score: 85, status: 'Đang học', classId: 'K45A' },
  { id: '20216016', name: 'Dương Văn Sơn', email: 'son.dv21@school.edu.vn', dob: '08/08/2003', gender: 'Nam', score: 77, status: 'Đang học', classId: 'K45B' },
];

export const mockRecords = [
  { id: 1, type: 'reward', label: 'Khen thưởng', date: '15/10/2024', title: 'Đi học đầy đủ, đúng giờ', count: '01', session: 'Sáng', points: '+10' },
  { id: 2, type: 'violation', label: 'Vi phạm', date: '12/10/2024', title: 'Vi phạm nội quy lớp học', count: '01', session: 'Chiều', points: '-10' },
  { id: 3, type: 'reward', label: 'Khen thưởng', date: '05/10/2024', title: 'Tham gia hiến máu tình nguyện ...', count: '01', session: 'Sáng', points: '+10' },
  { id: 4, type: 'reward', label: 'Khen thưởng', date: '05/10/2024', title: 'Tham gia hiến máu tình nguyện ...', count: '01', session: 'Sáng', points: '+10' },
  { id: 5, type: 'reward', label: 'Khen thưởng', date: '05/10/2024', title: 'Tham gia hiến máu tình nguyện ...', count: '01', session: 'Sáng', points: '+10' },
];

export const mockCategories = [
  { id: 1, title: 'Ý thức tham gia học tập', maxPoints: 20, description: 'Đánh giá tinh thần chuyên cần, thái độ trong giờ học, ý thức thực hiện quy chế thi và kiểm tra, tham gia các hoạt động học thuật.', items: [
    { label: 'Đi học đầy đủ, đúng giờ', points: '+10đ' },
    { label: 'Tích cực phát biểu', points: '+5đ' },
    { label: 'Tham gia các hoạt động ngoại khóa', points: '+5đ' },
  ]},
  { id: 2, title: 'Ý thức chấp hành nội quy, quy chế', maxPoints: 25, description: 'Đánh giá việc thực hiện các quy định của Nhà trường, pháp luật Nhà nước và các quy định về an ninh trật tự, an toàn giao thông.', items: [
    { label: 'Chấp hành nội quy nhà trường', points: '+10đ' },
    { label: 'Không vi phạm pháp luật', points: '+10đ' },
    { label: 'Chấp hành an toàn giao thông', points: '+5đ' },
    { label: 'Chấp hành an toàn giao thông', points: '+5đ' },
    { label: 'Chấp hành an toàn giao thông', points: '+5đ' },
  ]},
  { id: 3, title: 'Ý thức tham gia hoạt động chính trị, xã hội', maxPoints: 20, description: 'Tham gia các hoạt động tình nguyện, chiến dịch mùa hè xanh, các hoạt động văn hóa, văn nghệ, thể thao cấp Khoa và Trường.', items: [
    { label: 'Tham gia hoạt động tình nguyện', points: '+10đ' },
    { label: 'Tham gia văn nghệ, thể thao', points: '+5đ' },
    { label: 'Tham gia chiến dịch mùa hè xanh', points: '+5đ' },
  ]},
  { id: 4, title: 'Phẩm chất công dân và quan hệ cộng đồng', maxPoints: 15, description: 'Ý thức giúp đỡ bạn bè, xây dựng nếp sống văn minh, bảo vệ môi trường và tham gia các hoạt động hỗ trợ cộng đồng.', items: [
    { label: 'Giúp đỡ bạn bè trong học tập', points: '+5đ' },
    { label: 'Bảo vệ môi trường', points: '+5đ' },
    { label: 'Tham gia hoạt động cộng đồng', points: '+5đ' },
  ]},
  { id: 5, title: 'Phẩm chất công dân và quan hệ cộng đồng', maxPoints: 15, description: 'Ý thức giúp đỡ bạn bè, xây dựng nếp sống văn minh, bảo vệ môi trường và tham gia các hoạt động hỗ trợ cộng đồng.', items: [
    { label: 'Giúp đỡ bạn bè trong học tập', points: '+5đ' },
    { label: 'Bảo vệ môi trường', points: '+5đ' },
    { label: 'Tham gia hoạt động cộng đồng', points: '+5đ' },
  ]},
];
