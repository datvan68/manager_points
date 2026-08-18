jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { ConflictException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { DormitoryRosterService } from './dormitory-roster.service';

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
    rosterModel.countDocuments = jest.fn(() => query(0));
    const studentModel: any = { findById: jest.fn(() => query(student)), find: jest.fn(() => query([])) };
    const semesterModel: any = { find: jest.fn(() => query([semester])) };
    const contractModel: any = { findOne: jest.fn(() => query(null)), find: jest.fn(() => query([])) };
    const invoiceModel: any = { countDocuments: jest.fn(() => query(0)) };
    return { service: new DormitoryRosterService(rosterModel, studentModel, semesterModel, contractModel, invoiceModel), saved, rosterModel, studentModel };
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

  it('refuses deletion while a contract references the roster entry', async () => {
    const { service, rosterModel } = setup();
    const contractModel = (service as any).contractModel;
    contractModel.findOne.mockReturnValue(query({ _id: 'contract-1' }));

    await expect(service.remove('507f1f77bcf86cd799439011')).rejects.toBeInstanceOf(ConflictException);
    expect(rosterModel.findByIdAndDelete).not.toHaveBeenCalled();
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
});
