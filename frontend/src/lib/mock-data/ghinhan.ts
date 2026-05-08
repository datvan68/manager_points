export interface RecordItem {
  id: string;
  studentId: string;
  fullName: string;
  className: string;
  recordType: 'Khen thưởng' | 'Kỷ luật';
  recordNumber: string;
  date: string;
  points: string;
}

export const DUMMY_RECORDS: RecordItem[] = [
  { id: '1', studentId: '20230001', fullName: 'Nguyen Van A', className: 'ECO-23B', recordType: 'Khen thưởng', recordNumber: '#1', date: '15/10/2023', points: '+5' },
  { id: '2', studentId: '20230002', fullName: 'Tran Thi B', className: 'ECO-23B', recordType: 'Kỷ luật', recordNumber: '#1', date: '12/10/2023', points: '-2' },
  { id: '3', studentId: '20230001', fullName: 'Nguyen Van A', className: 'ECO-23B', recordType: 'Khen thưởng', recordNumber: '#1', date: '15/10/2023', points: '+5' },
  { id: '4', studentId: '20230002', fullName: 'Tran Thi B', className: 'ECO-23B', recordType: 'Kỷ luật', recordNumber: '#1', date: '12/10/2023', points: '-2' },
  { id: '5', studentId: '20230001', fullName: 'Nguyen Van A', className: 'ECO-23B', recordType: 'Khen thưởng', recordNumber: '#1', date: '15/10/2023', points: '+5' },
  // Duplicate more to test pagination
  ...Array.from({ length: 20 }).map((_, i) => ({
    id: `ext-${i}`, studentId: `202301${i.toString().padStart(2, '0')}`, fullName: `Student ${i}`, className: 'ECO-23B', recordType: i % 3 === 0 ? 'Kỷ luật' : 'Khen thưởng' as 'Khen thưởng' | 'Kỷ luật', recordNumber: `#${i+2}`, date: '15/10/2023', points: i % 3 === 0 ? '-2' : '+5'
  }))
];

export const MOCK_HISTORY = [
  { date: '12/10/2023', title: 'Vi phạm quy định giờ giấc', type: 'Kỷ luật', criteria: 'Vi phạm giờ giấc', category: 'Kỷ luật chuyên cần', shift: 'Buổi Sáng', logDate: '12/10/2023', description: 'Sinh viên đi muộn 20 phút không có lý do chính đáng. Đã nhắc nhở lần đầu.' },
  { date: '05/09/2023', title: 'Tham gia hoạt động thiện nguyện', type: 'Khen thưởng' },
  { date: '20/08/2023', title: 'Đạt giải khuyến khích NCKH', type: 'Khen thưởng' },
  { date: '15/06/2023', title: 'Vi phạm nội quy ký túc xá', type: 'Kỷ luật' },
];
