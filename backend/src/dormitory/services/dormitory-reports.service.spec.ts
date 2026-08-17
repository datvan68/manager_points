import { DormitoryReportsService } from './dormitory-reports.service';

function queryResult<T>(value: T) {
  return {
    lean: () => ({ exec: async () => value }),
    exec: async () => value,
  };
}

function modelFor<T>(value: T) {
  return {
    find: jest.fn(() => queryResult(value)),
  };
}

describe('DormitoryReportsService dashboard contract', () => {
  const buildings = [
    { _id: 'building-a', building_code: 'A', name: 'Tòa A' },
    { _id: 'building-b', building_code: 'B', name: 'Tòa B' },
  ];
  const rooms = [
    { _id: 'room-empty', room_code: 'A100', room_name: 'Phòng A100', building_id: 'building-a', room_type: 'Thường', bed_count: 2, status: 'Trống' },
    { _id: 'room-partial', room_code: 'A101', room_name: 'Phòng A101', building_id: 'building-a', room_type: 'Thường', bed_count: 4, status: 'Trống' },
    { _id: 'room-full', room_code: 'A102', room_name: 'Phòng A102', building_id: 'building-a', room_type: 'Máy lạnh', bed_count: 2, status: 'Đầy' },
    { _id: 'room-maintenance', room_code: 'B201', room_name: 'Phòng B201', building_id: 'building-b', room_type: 'Máy lạnh', bed_count: 3, status: 'Bảo trì' },
    { _id: 'room-locked', room_code: 'B202', room_name: 'Phòng B202', building_id: 'building-b', room_type: 'Thường', bed_count: 2, status: 'Khóa' },
    { _id: 'room-unconfigured', room_code: 'B203', room_name: 'Phòng B203', building_id: 'building-b', room_type: 'Diện tích cũ', bed_count: 0, status: 'Trống' },
  ];
  const beds = [
    { _id: 'bed-empty-1', room_id: 'room-empty', status: 'Trống' },
    { _id: 'bed-empty-2', room_id: 'room-empty', status: 'Trống' },
    { _id: 'bed-partial-1', room_id: 'room-partial', status: 'Đang sử dụng' },
    { _id: 'bed-partial-2', room_id: 'room-partial', status: 'Trống' },
    { _id: 'bed-partial-3', room_id: 'room-partial', status: 'Trống' },
    { _id: 'bed-partial-4', room_id: 'room-partial', status: 'Trống' },
    { _id: 'bed-full-1', room_id: 'room-full', status: 'Đang sử dụng' },
    { _id: 'bed-full-2', room_id: 'room-full', status: 'Đang sử dụng' },
    { _id: 'bed-maintenance-1', room_id: 'room-maintenance', status: 'Trống' },
    { _id: 'bed-maintenance-2', room_id: 'room-maintenance', status: 'Trống' },
    { _id: 'bed-maintenance-3', room_id: 'room-maintenance', status: 'Trống' },
    { _id: 'bed-locked-1', room_id: 'room-locked', status: 'Đang sử dụng' },
    { _id: 'bed-locked-2', room_id: 'room-locked', status: 'Trống' },
  ];
  const contracts = [
    { _id: 'contract-a101', room_id: 'room-partial', status: 'Hiệu lực' },
    { _id: 'contract-a102', room_id: 'room-full', status: 'Hết hạn' },
    { _id: 'contract-orphan', room_id: 'room-missing', status: 'Hiệu lực' },
  ];

  function createService() {
    return new DormitoryReportsService(
      modelFor(buildings) as any,
      modelFor(rooms) as any,
      modelFor(beds) as any,
      modelFor(contracts) as any,
      modelFor([
        { _id: 'invoice-1', contract_id: 'contract-a101', student_id: 'student-1', status: 'Chưa thanh toán', total_amount: 100 },
        { _id: 'invoice-2', contract_id: 'contract-a101', student_id: 'student-1', status: 'Quá hạn', total_amount: 150 },
        { _id: 'invoice-3', contract_id: 'contract-a101', student_id: 'student-2', status: 'Chưa thanh toán', total_amount: 200 },
        { _id: 'invoice-paid', contract_id: 'contract-a102', student_id: 'student-3', status: 'Đã thanh toán', total_amount: 999 },
        { _id: 'invoice-orphan-room', contract_id: 'contract-orphan', student_id: 'student-4', status: 'Quá hạn', total_amount: 500 },
        { _id: 'invoice-orphan-contract', contract_id: 'contract-missing', student_id: 'student-5', status: 'Chưa thanh toán', total_amount: 250 },
      ]) as any,
      {} as any,
      { countDocuments: jest.fn().mockResolvedValue(0) } as any,
      modelFor([
        { _id: 'formal-pending', status: 'Chờ duyệt', preference: { room_type: 'Thường' }, createdAt: new Date() },
        { _id: 'formal-assigned', status: 'Đã duyệt', room_id: 'room-partial', preference: { room_type: 'Máy lạnh' }, createdAt: new Date() },
        { _id: 'formal-unassigned', status: 'Đã duyệt', preference: { room_type: 'Máy lạnh' }, createdAt: new Date() },
      ]) as any,
      modelFor([
        { _id: 'public-pending', source: 'QR_SCAN', status: 'Chờ xác nhận', room_type: 'Thường', createdAt: new Date() },
        { _id: 'admin-temporary', source: 'ADMIN_ENTRY', status: 'Đã xác nhận', room_type: 'Máy lạnh', createdAt: new Date() },
        { _id: 'public-linked', source: 'QR_SCAN', status: 'Đã xác nhận', linked_registration_id: 'formal-assigned', room_type: 'Thường', createdAt: new Date() },
      ]) as any,
    );
  }

  it('classifies canonical types and derives every room state from administrative status and beds', async () => {
    const report = await createService().getDashboardStats();

    expect(report.room_summary).toEqual(expect.objectContaining({
      total_rooms: 6,
      by_type: { thuong: 3, may_lanh: 2, unknown: 1 },
      by_state: { trong: 1, con_cho: 1, day: 1, bao_tri: 1, khoa: 1, chua_cau_hinh: 1 },
    }));
    expect(report.room_rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ room_code: 'A100', state: 'Trống', total_beds: 2, occupied_beds: 0, free_beds: 2 }),
      expect.objectContaining({ room_code: 'A101', state: 'Còn chỗ', total_beds: 4, occupied_beds: 1, free_beds: 3 }),
      expect.objectContaining({ room_code: 'A102', room_type: 'Máy lạnh', state: 'Đầy' }),
      expect.objectContaining({ room_code: 'B201', state: 'Bảo trì' }),
      expect.objectContaining({ room_code: 'B202', state: 'Khóa' }),
      expect.objectContaining({ room_code: 'B203', state: 'Chưa cấu hình', room_type: 'Chưa xác định' }),
    ]));
    expect(report.rooms.air_conditioned).toBe(2);
  });

  it('separates invoice statuses, deduplicates debtors, and exposes unresolved references', async () => {
    const report = await createService().getDashboardStats();

    expect(report.invoice_summary).toEqual(expect.objectContaining({
      outstanding_invoice_count: 5,
      unpaid_count: 3,
      overdue_count: 2,
      total_outstanding_amount: 1200,
      anomaly_count: 2,
    }));
    expect(report.invoice_summary.rows).toEqual([
      expect.objectContaining({
        room_code: 'A101',
        debtor_count: 2,
        unpaid_count: 2,
        overdue_count: 1,
        total_outstanding_amount: 450,
      }),
    ]);
  });

  it('combines formal and unlinked public/admin registration workload without double counting linked public records', async () => {
    const report = await createService().getDashboardStats();

    expect(report.registration_summary).toEqual({
      total: 5,
      pending_confirmation: 1,
      pending_approval: 1,
      approved_unassigned: 2,
      requested_room_type: { thuong: 2, may_lanh: 3, unknown: 0 },
    });
    expect(report.pending_registrations).toBe(1);
  });
});
