jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { DormitoryRosterService } from './dormitory-roster.service';
import { dormitoryOverviewEventEmitter } from '../dormitory-overview-event-emitter';

function query<T>(value: T) {
  const result: any = { exec: jest.fn().mockResolvedValue(value), lean: jest.fn(() => result), populate: jest.fn(() => result), sort: jest.fn(() => result), skip: jest.fn(() => result), limit: jest.fn(() => result) };
  return result;
}

describe('DormitoryRosterService', () => {
  const semester = { _id: 'semester-1', semester_name: 'HK1 - 2026 - 2027', status: 'active' } as any;
  const student = { _id: '507f1f77bcf86cd799439012', student_code: 'SV001', full_name: 'Nguyễn Văn A', date_bir: new Date('2004-01-02'), sex: 'Male', status: 'Studying' } as any;

  function setup() {
    const saved = jest.fn().mockImplementation(async function (this: any) { return { ...this, _id: this._id || 'roster-1', toObject() { return { ...this }; } }; });
    const rosterModel: any = jest.fn().mockImplementation((value: any) => ({ ...value, save: saved, toObject() { return { ...this }; } }));
    rosterModel.find = jest.fn(() => query([]));
    rosterModel.findOne = jest.fn(() => query(null));
    rosterModel.findById = jest.fn(() => query(null));
    rosterModel.findByIdAndDelete = jest.fn(() => query({ _id: 'roster-1' }));
    rosterModel.deleteMany = jest.fn(() => query({ deletedCount: 0 }));
    rosterModel.countDocuments = jest.fn(() => query(0));
    const studentModel: any = { findById: jest.fn(() => query(student)), find: jest.fn(() => query([])) };
    const semesterModel: any = { find: jest.fn(() => query([semester])) };
    const contractModel: any = { findOne: jest.fn(() => query(null)), find: jest.fn(() => query([])) };
    const invoiceModel: any = { countDocuments: jest.fn(() => query(0)) };
    const roomAssignmentService: any = { assignFirstAvailableBed: jest.fn().mockResolvedValue({}), deleteRosterEntry: jest.fn().mockResolvedValue(undefined) };
    return { service: new DormitoryRosterService(rosterModel, studentModel, semesterModel, contractModel, invoiceModel, undefined, roomAssignmentService), saved, rosterModel, studentModel, roomAssignmentService };
  }

  it('links by stable student_id and ignores client identity values', async () => {
    const { service, saved } = setup();
    const result = await service.create({ student_id: '507f1f77bcf86cd799439012', full_name: 'Giả mạo', date_of_birth: '2000-01-01', gender: 'Female', phone_number: '0912345678', room_type: 'Thường' } as any);
    expect(saved).toHaveBeenCalled();
    expect(result.student_id).toBe('507f1f77bcf86cd799439012');
    expect(result.full_name).toBe('Nguyễn Văn A');
    expect(result.identity_state).toBe('LINKED');
  });

  it('rejects a second linked entry in the same semester', async () => {
    const { service, rosterModel } = setup();
    rosterModel.findOne.mockReturnValue(query({ _id: 'existing' }));
    await expect(service.create({ student_id: '507f1f77bcf86cd799439012', phone_number: '0912345678', room_type: 'Thường' } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates manual identity and creates an immediately visible unlinked entry', async () => {
    const { service } = setup();
    const result = await service.createPublic({ full_name: 'Nguyễn B', date_of_birth: '2003-02-03', gender: 'Other', phone_number: '0912345678', room_type: 'Máy lạnh' } as any);
    expect(result.identity_state).toBe('UNLINKED');
    expect(result.roster_entry_code).toBeDefined();
    expect(result).not.toHaveProperty('status');
  });

  it('imports valid rows, reports in-file duplicates and row errors, and emits one invalidation', async () => {
    const { service, saved, rosterModel } = setup();
    const events: unknown[] = [];
    const listener = (event: unknown) => events.push(event);
    dormitoryOverviewEventEmitter.on('dormitory_overview_event', listener);

    const result = await service.importRows({ rows: [
      { full_name: 'Nguyễn Văn A', date_of_birth: '02/01/2004', gender: 'Nam', phone_number: '0912345678' },
      { full_name: '  nguyễn   văn a ', date_of_birth: '2004-01-02', gender: 'Female', phone_number: '0912345679' },
      { full_name: 'B', date_of_birth: 'not-a-date', gender: 'unknown', phone_number: 'bad' },
    ] } as any);

    dormitoryOverviewEventEmitter.off('dormitory_overview_event', listener);
    expect(result).toMatchObject({ requested: 3, created: 1, duplicated: 1, failed: 1 });
    expect(result.results.map((item) => item.status)).toEqual(['created', 'duplicated', 'failed']);
    expect(result.results[1].reason).toContain('tệp');
    expect(saved).toHaveBeenCalledTimes(1);
    expect(rosterModel).toHaveBeenCalledWith(expect.objectContaining({ room_type: 'Thường', identity_state: 'UNLINKED', semester_id: semester._id }));
    expect(events).toHaveLength(1);
  });

  it('reports an existing normalized identity as duplicated without creating it', async () => {
    const { service, rosterModel, saved } = setup();
    rosterModel.find.mockReturnValue(query([{ full_name_normalized: 'nguyễn văn a', date_of_birth: new Date('2004-01-02') }]));

    const result = await service.importRows({ rows: [{ full_name: 'Nguyễn Văn A', date_of_birth: '02/01/2004', gender: 'Nam', phone_number: '0912345678' }] } as any);
    expect(result).toMatchObject({ created: 0, duplicated: 1, failed: 0 });
    expect(saved).not.toHaveBeenCalled();
  });

  it('links an imported roster entry to exactly one student with the same normalized name and date of birth', async () => {
    const { service, rosterModel, studentModel } = setup();
    studentModel.find.mockReturnValue(query([student]));

    const result = await service.importRows({ rows: [{ full_name: '  nguyễn   văn a ', date_of_birth: '02/01/2004', gender: 'Female', phone_number: '0912345678' }] } as any);

    expect(result).toMatchObject({ created: 1, failed: 0 });
    expect(rosterModel).toHaveBeenCalledWith(expect.objectContaining({
      student_id: student._id,
      student_code: student.student_code,
      identity_state: 'LINKED',
    }));
  });

  it('marks an imported roster entry as conflicted when multiple students share its name and date of birth', async () => {
    const { service, rosterModel, studentModel } = setup();
    studentModel.find.mockReturnValue(query([student, { ...student, _id: '507f1f77bcf86cd799439013' }]));

    const result = await service.importRows({ rows: [{ full_name: 'Nguyễn Văn A', date_of_birth: '02/01/2004', gender: 'Male', phone_number: '0912345678' }] } as any);

    expect(result.results[0]).toMatchObject({ status: 'created', reason: expect.stringContaining('nhiều sinh viên') });
    expect(rosterModel).toHaveBeenCalledWith(expect.objectContaining({ student_id: undefined, identity_state: 'CONFLICT' }));
  });

  it('returns paginated link candidates with only current-class display data', async () => {
    const rosterModel: any = { find: jest.fn(() => query([])) };
    const studentModel: any = {
      find: jest.fn(() => query([{ _id: '507f1f77bcf86cd799439012', student_code: 'SV001', full_name: 'Nguyễn Văn A', status: 'Studying', class_id: { _id: 'class-1', class_name: 'CNTT K20' } }])),
    };
    const service = new DormitoryRosterService(rosterModel, studentModel, {} as any, {} as any, {} as any);

    await expect(service.findLinkCandidates({ search: 'CNTT', page: 1, limit: 20 })).resolves.toEqual({
      data: [{ _id: '507f1f77bcf86cd799439012', student_code: 'SV001', full_name: 'Nguyễn Văn A', status: 'Studying', class_id: { _id: 'class-1', class_name: 'CNTT K20' } }],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    });
    expect(studentModel.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'Studying', class_id: { $exists: true, $ne: null } }));
  });

  it('ranks contextual candidates, excludes same-semester links, and validates the source first', async () => {
    const source = { _id: '507f1f77bcf86cd799439011', semester_id: 'semester-1', full_name: 'Nguyễn Văn A', date_of_birth: new Date('2004-01-02') };
    const linkedQuery: any = query([{ student_id: 'student-linked' }]);
    linkedQuery.select = jest.fn(() => linkedQuery);
    const rosterModel: any = { findById: jest.fn(() => query(source)), find: jest.fn(() => linkedQuery) };
    const studentModel: any = {
      aggregate: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([{ _id: 'student-linked', student_code: 'SV000', full_name: 'Nguyễn Văn A', date_bir: '2004-01-02', status: 'Studying', class_id: { _id: 'class-1', class_name: 'CNTT' } }, { _id: 'student-1', student_code: 'SV001', full_name: 'Nguyen Van A', date_bir: '2004-01-03', status: 'Studying', class_id: { _id: 'class-1', class_name: 'CNTT' } }]) })),
    };
    const service = new DormitoryRosterService(rosterModel, studentModel, {} as any, {} as any, {} as any);

    await expect(service.findLinkCandidates({ roster_entry_id: source._id, page: 1, limit: 20 })).resolves.toMatchObject({ data: [{ _id: 'student-1', recommended: true, match_score: 94, date_bir: '2004-01-03' }], meta: { total: 1 } });
    expect(rosterModel.findById).toHaveBeenCalledWith(source._id);
  });

  it('rejects an invalid contextual source id before reading candidates', async () => {
    const studentModel: any = { aggregate: jest.fn() };
    const service = new DormitoryRosterService({} as any, studentModel, {} as any, {} as any, {} as any);
    await expect(service.findLinkCandidates({ roster_entry_id: 'bad-id' })).rejects.toBeInstanceOf(BadRequestException);
    expect(studentModel.aggregate).not.toHaveBeenCalled();
  });

  it('rejects a stale manual link instead of overwriting the roster entry', async () => {
    const entry: any = { _id: 'entry-1', semester_id: 'semester-1', full_name: 'Nguyễn A', date_of_birth: new Date('2004-01-02'), gender: 'Male', phone_number: '0912345678', room_type: 'Thường', identity_state: 'UNLINKED' };
    const rosterModel: any = { findById: jest.fn(() => query(entry)), findOne: jest.fn(() => query(null)) };
    const studentModel: any = { findById: jest.fn(() => query(student)) };
    const rosterIdentityService: any = { assertCurrentStudent: jest.fn().mockResolvedValue(student), linkIfUnchanged: jest.fn().mockResolvedValue(false) };
    const service = new DormitoryRosterService(rosterModel, studentModel, {} as any, {} as any, {} as any, undefined, undefined, rosterIdentityService);

    await expect(service.update('entry-1', { student_id: student._id } as any)).rejects.toBeInstanceOf(ConflictException);
    expect(rosterIdentityService.linkIfUnchanged).toHaveBeenCalledWith('entry-1', student._id, expect.any(Object));
    expect(entry.identity_state).toBe('UNLINKED');
  });

  it('assigns a first available bed from the optional imported room code', async () => {
    const { service, roomAssignmentService } = setup();

    const result = await service.importRows({ rows: [{ full_name: 'Nguyễn Văn A', date_of_birth: '02/01/2004', gender: 'Nam', phone_number: '0912345678', room_code: 'P101' }] } as any);

    expect(result).toMatchObject({ created: 1, failed: 0 });
    expect(roomAssignmentService.assignFirstAvailableBed).toHaveBeenCalledWith('roster-1', 'P101', {});
  });

  it('keeps a newly created roster entry unassigned when the imported room is full', async () => {
    const { service, rosterModel } = setup();
    const roomAssignmentService = (service as any).roomAssignmentService;
    roomAssignmentService.assignFirstAvailableBed.mockRejectedValue(new BadRequestException('Phòng P101 không còn giường trống'));

    const result = await service.importRows({ rows: [{ full_name: 'Nguyễn Văn A', date_of_birth: '02/01/2004', gender: 'Nam', phone_number: '0912345678', room_code: 'P101' }] } as any);

    expect(result).toMatchObject({ created: 1, failed: 0 });
    expect(result.results[0].reason).toContain('Chưa xếp phòng/giường');
    expect(rosterModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('imports every student and leaves only the overflow student unassigned when a room fills up', async () => {
    const { service, saved } = setup();
    const roomAssignmentService = (service as any).roomAssignmentService;
    roomAssignmentService.assignFirstAvailableBed
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new BadRequestException('Phòng P101 không còn giường trống'));
    const rows = Array.from({ length: 5 }, (_, index) => ({ full_name: `Nguyễn Văn ${index}`, date_of_birth: '02/01/2004', gender: 'Nam', phone_number: `09123456${index}8`, room_code: 'P101' }));

    const result = await service.importRows({ rows } as any);

    expect(result).toMatchObject({ created: 5, failed: 0 });
    expect(roomAssignmentService.assignFirstAvailableBed).toHaveBeenCalledTimes(5);
    expect(result.results[4].reason).toContain('Chưa xếp phòng/giường');
    expect(saved).toHaveBeenCalledTimes(5);
  });

  it('deletes an entry through bed release even when a contract references it', async () => {
    const { service, rosterModel, roomAssignmentService } = setup();
    const contractModel = (service as any).contractModel;
    contractModel.findOne.mockReturnValue(query({ _id: 'contract-1' }));

    await expect(service.remove('507f1f77bcf86cd799439011')).resolves.toEqual({ success: true, id: '507f1f77bcf86cd799439011' });
    expect(contractModel.findOne).not.toHaveBeenCalled();
    expect(roomAssignmentService.deleteRosterEntry).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(rosterModel.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('bulk removes every existing entry and retains categorized invalid and missing outcomes', async () => {
    const { service, rosterModel, roomAssignmentService } = setup();
    const deletableId = '507f1f77bcf86cd799439011';
    const referencedId = '507f1f77bcf86cd799439013';
    const missingId = '507f1f77bcf86cd799439014';
    rosterModel.find.mockReturnValue(query([{ _id: deletableId }, { _id: referencedId }]));
    const contractModel = (service as any).contractModel;
    const events: unknown[] = [];
    const listener = (event: unknown) => events.push(event);
    dormitoryOverviewEventEmitter.on('dormitory_overview_event', listener);

    const result = await service.bulkRemove([deletableId, referencedId, missingId, 'bad-id']);

    dormitoryOverviewEventEmitter.off('dormitory_overview_event', listener);
    expect(result).toEqual({
      requested: 4,
      deleted: [deletableId, referencedId],
      blocked: [],
      not_found: [missingId],
      invalid: ['bad-id'],
    });
    expect(contractModel.find).not.toHaveBeenCalled();
    expect(roomAssignmentService.deleteRosterEntry).toHaveBeenCalledWith(deletableId);
    expect(roomAssignmentService.deleteRosterEntry).toHaveBeenCalledWith(referencedId);
    expect(events).toHaveLength(1);
  });

  it('maps linked student and applicant data into a one-page A4 PDF without placeholders', async () => {
    const { service, rosterModel } = setup();
    const linkedStudent = { ...student, class_id: { class_name: 'CNTT K20', dept_id: { name: 'Công nghệ thông tin' } } };
    const entry: any = {
      _id: 'roster-1', roster_entry_code: 'DK-TEST', student_id: linkedStudent, full_name: 'Client override',
      date_of_birth: new Date('2000-01-01'), gender: 'Female', phone_number: '0912345678', identity_state: 'LINKED',
      applicant_profile: { ethnicity: 'Kinh', religion: 'Không', citizen_id_number: '012345678901', citizen_id_issue_date: new Date('2022-03-04'), citizen_id_issue_place: 'Cục CSQLHC', permanent_address: 'Hà Nội' },
    };
    rosterModel.findById.mockReturnValue(query(entry));

    const result = await service.generateApplicationPdf('roster-1');
    const document = await PDFDocument.load(result.buffer);
    expect(result.filename).toBe('don-xin-vao-ktx-DK-TEST.pdf');
    expect(document.getPageCount()).toBe(1);
    expect(document.getPage(0).getWidth()).toBeCloseTo(595.32, 1);
    expect(document.getPage(0).getHeight()).toBeCloseTo(842.04, 1);
    const html = (service as any).applicationPdfOverlayHtml((service as any).applicationPdfValues((service as any).toResponse(entry), linkedStudent));
    expect(html).toContain('Nguyễn Văn A');
    expect(html).toContain('CNTT K20');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
    expect(html).toContain('font-family:"Times New Roman"');
    expect(html).toContain('left:323.5pt');
    expect(html).toContain('left:241pt');
    expect(html).toContain('left:354.5pt');
    expect(html).toContain('left:362.5pt');
    expect(html).toContain('left:480.7pt');
    expect((service as any).formatPdfDate('2024-04-14T00:00:00.000Z')).toBe('14/04/2024');
  }, 30000);

  it('keeps long values inside their measured field width with deterministic font fitting', () => {
    const { service } = setup();
    const html = (service as any).applicationPdfOverlayHtml({
      name: 'Nguyễn Văn Tấn Đạt',
      permanentAddress: 'Số 123 đường Nguyễn Trãi, phường Thanh Xuân Trung, quận Thanh Xuân, Hà Nội',
      citizenIssueDate: '14/04/2024',
      citizenIssuePlace: 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
    });
    expect(html).toContain('left:203pt');
    expect(html).toContain('left:480.7pt');
    expect(html).toMatch(/font-size:\d+\.\d{2}pt/);
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });

  it('rejects bulk PDF request if ids is empty, >100, contains invalid mongo ID, or contains duplicate IDs', async () => {
    const { service } = setup();
    await expect(service.generateBulkApplicationPdf([])).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.generateBulkApplicationPdf(
        Array.from({ length: 101 }, (_, i) => `507f1f77bcf86cd7994390${i < 10 ? '0' + i : i}`),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.generateBulkApplicationPdf(['invalid-mongo-id'])).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.generateBulkApplicationPdf(['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439011']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects bulk PDF request without partial document if any entry is missing', async () => {
    const { service, rosterModel } = setup();
    const entry1: any = {
      _id: '507f1f77bcf86cd799439011',
      roster_entry_code: 'DK-01',
      full_name: 'Nguyễn Văn A',
      identity_state: 'UNLINKED',
    };
    rosterModel.find.mockReturnValue(query([entry1]));

    await expect(
      service.generateBulkApplicationPdf(['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012']),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('merges multiple application PDFs in input order and returns a stable bulk filename', async () => {
    const { service, rosterModel } = setup();
    const student1 = { ...student, _id: '507f1f77bcf86cd799439011', full_name: 'Sinh viên 1' };
    const student2 = { ...student, _id: '507f1f77bcf86cd799439012', full_name: 'Sinh viên 2' };

    const entry1: any = {
      _id: '507f1f77bcf86cd799439011',
      roster_entry_code: 'DK-01',
      student_id: student1,
      full_name: 'Sinh viên 1',
      date_of_birth: new Date('2004-01-01'),
      gender: 'Male',
      phone_number: '0912345671',
      identity_state: 'LINKED',
      applicant_profile: {},
    };
    const entry2: any = {
      _id: '507f1f77bcf86cd799439012',
      roster_entry_code: 'DK-02',
      student_id: student2,
      full_name: 'Sinh viên 2',
      date_of_birth: new Date('2004-02-02'),
      gender: 'Female',
      phone_number: '0912345672',
      identity_state: 'LINKED',
      applicant_profile: {},
    };

    rosterModel.find.mockReturnValue(query([entry1, entry2]));

    // Request in reverse order [entry2, entry1]
    const result = await service.generateBulkApplicationPdf(['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439011']);
    expect(result.filename).toBe('don-xin-vao-ktx-danh-sach.pdf');

    const mergedDoc = await PDFDocument.load(result.buffer);
    expect(mergedDoc.getPageCount()).toBe(2);
    expect(mergedDoc.getPage(0).getWidth()).toBeCloseTo(595.32, 1);
    expect(mergedDoc.getPage(1).getWidth()).toBeCloseTo(595.32, 1);
  }, 30000);
});
