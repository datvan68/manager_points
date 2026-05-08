export interface OCRStudent {
  id: string;
  fullName: string;
  studentId: string;
  className: string;
  status: 'SUCCESS' | 'ERROR' | 'SCANNING';
  errorMessage?: string;
  note?: string;
}

export const MOCK_OCR_STUDENTS: OCRStudent[] = [
  { id: 's1', fullName: 'Nguyễn Văn A', studentId: '2012345', className: 'D20_TH01', status: 'SUCCESS' },
  { id: 's2', fullName: 'Trần Thị B', studentId: '2012346', status: 'ERROR', className: '', errorMessage: 'Ảnh quá mờ, vui lòng thử lại' },
  { id: 's3', fullName: 'Lê Văn C', studentId: '2012347', className: 'D21_QT02', status: 'SUCCESS' },
  { id: 's4', fullName: 'Phạm Minh D', studentId: '2012348', className: 'D20_TH02', status: 'SUCCESS' },
  { id: 's5', fullName: 'Hoàng Quốc E', studentId: '2012349', className: 'D20_TH01', status: 'SUCCESS' },
  { id: 's6', fullName: 'Đinh Tuấn F', studentId: '2012350', status: 'ERROR', className: '', errorMessage: 'Không tìm thấy mã vạch' },
  { id: 's7', fullName: 'Vũ Hải G', studentId: '2012351', className: 'D21_HT01', status: 'SUCCESS' },
  { id: 's8', fullName: 'Bùi Ngọc H', studentId: '2012352', className: 'D20_TM01', status: 'SUCCESS' },
  { id: 's9', fullName: 'Đỗ Tiến I', studentId: '2012353', className: 'D20_TH01', status: 'SUCCESS' },
  { id: 's10', fullName: 'Ngô Thanh K', studentId: '2012354', className: 'D20_TH02', status: 'SUCCESS' },
  { id: 's11', fullName: 'Lý Tú L', studentId: '2012355', className: 'D21_QT01', status: 'SUCCESS' },
  { id: 's12', fullName: 'Đang nhận diện...', studentId: '', className: '', status: 'SCANNING' }
];

export const MOCK_RECORD_CATEGORIES = [
  { value: 'discipline', label: 'Kỷ luật' },
  { value: 'reward', label: 'Khen thưởng' }
];

export const MOCK_LOCATIONS = [
  { value: 'hq', label: 'Trụ sở chính' },
  { value: 'branch1', label: 'Cơ sở 1' }
];

export const MOCK_VIOLATION_TYPES = [
  { value: 'class_rules', label: 'Vi phạm Nội quy lớp học' },
  { value: 'exam_rules', label: 'Vi phạm Quy chế thi' },
  { value: 'behavior', label: 'Vi phạm Đạo đức & Tác phong' }
];

export interface Criterion {
  id: string;
  label: string;
  points: number;
}

export const MOCK_CRITERIA: Criterion[] = [
  { id: 'c1', label: 'Đi muộn sau 15 phút', points: -5 },
  { id: 'c2', label: 'Không mặc đồng phục đúng quy định', points: -10 },
  { id: 'c3', label: 'Sử dụng điện thoại trong giờ', points: -5 }
];
