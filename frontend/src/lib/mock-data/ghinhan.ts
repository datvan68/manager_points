export interface RecordItem {
  id: string;
  studentId: string;
  fullName: string;
  className: string;
  recordType: 'Khen thưởng' | 'Kỷ luật';
  recordNumber: string;
  date: string;
  points: string;
  criteria?: string;
}

export const DUMMY_RECORDS: RecordItem[] = [
  { id: '1', studentId: '20230001', fullName: 'Nguyen Van A', className: 'ECO-23B', recordType: 'Khen thưởng', recordNumber: '#1', date: '15/10/2023', points: '+5', criteria: 'Tham gia hiến máu tình nguyện' },
  { id: '2', studentId: '20230002', fullName: 'Tran Thi B', className: 'ECO-23B', recordType: 'Kỷ luật', recordNumber: '#1', date: '12/10/2023', points: '-2', criteria: 'Đi học muộn không có lý do' },
  { id: '3', studentId: '20230001', fullName: 'Nguyen Van A', className: 'ECO-23B', recordType: 'Khen thưởng', recordNumber: '#1', date: '15/10/2023', points: '+5', criteria: 'Đạt thành tích xuất sắc trong kỳ thi NCKH' },
  { id: '4', studentId: '20230002', fullName: 'Tran Thi B', className: 'ECO-23B', recordType: 'Kỷ luật', recordNumber: '#1', date: '12/10/2023', points: '-2', criteria: 'Không mặc đồng phục quy định' },
  { id: '5', studentId: '20230001', fullName: 'Nguyen Van A', className: 'ECO-23B', recordType: 'Khen thưởng', recordNumber: '#1', date: '15/10/2023', points: '+5', criteria: 'Đóng góp tích cực chiến dịch Mùa hè xanh' },
  // Duplicate more to test pagination
  ...Array.from({ length: 20 }).map((_, i) => ({
    id: `ext-${i}`,
    studentId: `202301${i.toString().padStart(2, '0')}`,
    fullName: `Student ${i}`,
    className: 'ECO-23B',
    recordType: (i % 3 === 0 ? 'Kỷ luật' : 'Khen thưởng') as 'Khen thưởng' | 'Kỷ luật',
    recordNumber: `#${i+2}`,
    date: '15/10/2023',
    points: i % 3 === 0 ? '-2' : '+5',
    criteria: i % 3 === 0 ? 'Vắng mặt không phép buổi sinh hoạt' : 'Hỗ trợ công tác tổ chức sự kiện khoa'
  }))
];

export const MOCK_HISTORY = [
  { date: '12/10/2023', title: 'Vi phạm quy định giờ giấc', type: 'Kỷ luật', criteria: 'Vi phạm giờ giấc', category: 'Kỷ luật chuyên cần', shift: 'Buổi Sáng', logDate: '12/10/2023', description: 'Sinh viên đi muộn 20 phút không có lý do chính đáng. Đã nhắc nhở lần đầu.' },
  { date: '05/09/2023', title: 'Tham gia hoạt động thiện nguyện', type: 'Khen thưởng' },
  { date: '20/08/2023', title: 'Đạt giải khuyến khích NCKH', type: 'Khen thưởng' },
  { date: '15/06/2023', title: 'Vi phạm nội quy ký túc xá', type: 'Kỷ luật' },
];

export interface MockClassReport {
  _id: string;
  class_id: { _id: string; class_name: string } | string;
  user_id: string;
  report_date: string;
  total_present: number;
  total_absent: number;
  teacher_name: string;
  class_note: string;
  createdAt?: string;
  updatedAt?: string;
}

export const MOCK_CLASS_REPORTS: MockClassReport[] = [
  {
    _id: 'class-rep-1',
    class_id: { _id: 'c1', class_name: 'ECO-23B' },
    user_id: 'u1',
    report_date: '02/06/2026',
    total_present: 38,
    total_absent: 2,
    teacher_name: 'Thầy Nguyễn Văn A',
    class_note: 'Lớp học nghiêm túc, vắng 2 bạn có lý do xin phép nghỉ ốm.'
  },
  {
    _id: 'class-rep-2',
    class_id: { _id: 'c2', class_name: 'CS-101-A' },
    user_id: 'u2',
    report_date: '02/06/2026',
    total_present: 35,
    total_absent: 0,
    teacher_name: 'Cô Trần Thị B',
    class_note: 'Giờ học sôi nổi, các nhóm hoàn thành bài tập đầy đủ và đúng hạn.'
  },
  {
    _id: 'class-rep-3',
    class_id: { _id: 'c3', class_name: 'IT-22A' },
    user_id: 'u3',
    report_date: '01/06/2026',
    total_present: 42,
    total_absent: 3,
    teacher_name: 'Thầy Phạm Minh C',
    class_note: 'Lớp đi học khá đầy đủ, có 3 bạn vắng không phép đã lập danh sách nhắc nhở.'
  },
  {
    _id: 'class-rep-4',
    class_id: { _id: 'c4', class_name: 'ME-24C' },
    user_id: 'u4',
    report_date: '01/06/2026',
    total_present: 28,
    total_absent: 2,
    teacher_name: 'Cô Lê Thị D',
    class_note: 'Lớp thực hành tập trung tốt, các thiết bị cơ khí vận hành an toàn.'
  },
  {
    _id: 'class-rep-5',
    class_id: { _id: 'c5', class_name: 'BA-21B' },
    user_id: 'u5',
    report_date: '31/05/2026',
    total_present: 50,
    total_absent: 0,
    teacher_name: 'Thầy Hoàng Văn E',
    class_note: 'Học tập tích cực, nhiều cá nhân hăng hái phát biểu xây dựng bài.'
  },
  {
    _id: 'class-rep-6',
    class_id: { _id: 'c6', class_name: 'SE-23D' },
    user_id: 'u6',
    report_date: '31/05/2026',
    total_present: 29,
    total_absent: 3,
    teacher_name: 'Cô Ngô Thị F',
    class_note: 'Lớp học nghiêm túc. Có 3 bạn vắng mặt trong đó 1 bạn xin phép muộn.'
  },
  {
    _id: 'class-rep-7',
    class_id: { _id: 'c7', class_name: 'EE-22F' },
    user_id: 'u7',
    report_date: '30/05/2026',
    total_present: 36,
    total_absent: 4,
    teacher_name: 'Thầy Đặng Văn G',
    class_note: 'Lớp học tương tác tốt. Một vài bạn đi học muộn từ 5 đến 10 phút.'
  },
  {
    _id: 'class-rep-8',
    class_id: { _id: 'c8', class_name: 'GD-23A' },
    user_id: 'u8',
    report_date: '30/05/2026',
    total_present: 24,
    total_absent: 1,
    teacher_name: 'Cô Bùi Thị H',
    class_note: 'Lớp giữ vệ sinh phòng học tốt, bài tập thực hành đạt yêu cầu thẩm mỹ cao.'
  },
  {
    _id: 'class-rep-9',
    class_id: { _id: 'c9', class_name: 'HT-24B' },
    user_id: 'u9',
    report_date: '29/05/2026',
    total_present: 39,
    total_absent: 3,
    teacher_name: 'Thầy Vũ Văn I',
    class_note: 'Lớp làm bài kiểm tra 15 phút nghiêm túc, không phát hiện trường hợp gian lận.'
  },
  {
    _id: 'class-rep-10',
    class_id: { _id: 'c10', class_name: 'LH-23C' },
    user_id: 'u10',
    report_date: '29/05/2026',
    total_present: 31,
    total_absent: 4,
    teacher_name: 'Cô Đỗ Thị K',
    class_note: 'Máy chiếu gặp sự cố nhỏ đầu giờ nhưng đã được phòng kỹ thuật hỗ trợ khắc phục nhanh.'
  }
];

