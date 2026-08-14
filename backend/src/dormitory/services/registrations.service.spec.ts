jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
const mockPdfPage = { setContent: jest.fn().mockResolvedValue(undefined), evaluate: jest.fn().mockResolvedValue(undefined), pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-test')), close: jest.fn().mockResolvedValue(undefined), isClosed: jest.fn().mockReturnValue(false) };
const mockPdfBrowser = { newPage: jest.fn().mockResolvedValue(mockPdfPage), close: jest.fn().mockResolvedValue(undefined) };
const mockPuppeteerLaunch = jest.fn().mockResolvedValue(mockPdfBrowser);
jest.mock('puppeteer', () => ({ launch: mockPuppeteerLaunch }));
import { RegistrationsService } from './registrations.service';

function queryResult<T>(value: T) {
  const query: any = {
    populate: () => query,
    sort: () => query,
    skip: () => query,
    limit: () => query,
    lean: () => Promise.resolve(value),
    exec: () => Promise.resolve(value),
  };
  return query;
}

describe('RegistrationsService unclassified roster', () => {
  it('returns only blank-code public registrations without typed links', async () => {
    const publicModel: any = {
      find: jest.fn().mockReturnValue(queryResult([{ _id: 'a', public_registration_code: 'QR-1', student_code: '', full_name: 'A' }])),
      countDocuments: jest.fn().mockResolvedValue(1),
    };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);
    const result = await service.findUnclassified({ page: 1, limit: 20 });
    expect(publicModel.find).toHaveBeenCalledWith(expect.objectContaining({
      student_code: { $in: ['', null] },
      linked_student_id: { $exists: false },
      linked_registration_id: { $exists: false },
    }));
    expect(result.data[0]).toEqual(expect.objectContaining({ source: 'PUBLIC', classification_status: 'UNCLASSIFIED' }));
  });

  it('does not expose a public registration after auto-link references are persisted', async () => {
    const publicModel: any = { find: jest.fn().mockReturnValue(queryResult([{ _id: 'a', public_registration_code: 'QR-1', student_code: '', linked_student_id: 'student-1', linked_registration_id: 'registration-1' }])) };
    const registrationModel: any = { find: jest.fn().mockReturnValue(queryResult([])) };
    const service = new RegistrationsService(registrationModel, {} as any, {} as any, publicModel, {} as any);
    const result = await service.findAll({});
    expect(result.data).toHaveLength(0);
  });
});

describe('RegistrationsService room enrichment', () => {
  it('adds the active contract room name to formal rows and keeps public room references', async () => {
    const formal = { _id: 'registration-1', registration_code: 'DK-1', student_id: { student_code: '012', full_name: 'Nguyễn A' }, toObject: () => ({ _id: 'registration-1', registration_code: 'DK-1' }) };
    const registrationModel: any = { find: jest.fn().mockReturnValue(queryResult([formal])) };
    const contractModel: any = { find: jest.fn().mockReturnValue(queryResult([{ registration_id: 'registration-1', room_id: { room_name: 'A101' } }])) };
    const publicModel: any = { find: jest.fn().mockReturnValue(queryResult([{ _id: 'public-1', public_registration_code: 'QR-1', full_name: 'Trần B', room_id: { room_name: 'Phòng B', room_code: 'B202' }, source: 'QR_SCAN' }])) };
    const service = new RegistrationsService(registrationModel, {} as any, contractModel, publicModel, {} as any);

    const result = await service.findAll({});

    expect(contractModel.find).toHaveBeenCalledWith({ registration_id: { $in: ['registration-1'] }, status: 'Hiệu lực' });
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ registration_code: 'DK-1', assigned_room_name: 'A101' }),
      expect.objectContaining({ registration_code: 'QR-1', assigned_room_name: 'Phòng B' }),
    ]));
  });
});

describe('RegistrationsService create snapshots', () => {
  it('persists profile snapshots and the selected registration options', async () => {
    const registrationModel: any = jest.fn().mockImplementation((payload: any) => ({
      ...payload,
      save: jest.fn().mockResolvedValue({ ...payload, _id: 'registration-1' }),
    }));
    registrationModel.findOne = jest.fn().mockResolvedValue(null);
    const invoiceModel: any = { countDocuments: jest.fn().mockResolvedValue(0) };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue(null) };
    const publicModel: any = {};
    const service = new RegistrationsService(registrationModel, invoiceModel, contractModel, publicModel, {} as any);

    await service.create({
      student_id: '507f1f77bcf86cd799439011',
      semester: 'HK2',
      academic_year: '2025-2026',
      date_of_birth: '2003-01-15',
      gender: 'Female',
      phone_number: '0912345678',
      priority_group: 'Khó khăn',
      preference: { room_type: 'Máy lạnh' },
    }, { _id: 'user-1' });

    expect(registrationModel.findOne).toHaveBeenCalledWith({
      student_id: '507f1f77bcf86cd799439011',
      status: { $in: ['Chờ duyệt', 'Đã duyệt'] },
    });
    expect(registrationModel).toHaveBeenCalledWith(expect.objectContaining({
      student_id: '507f1f77bcf86cd799439011',
      date_of_birth: '2003-01-15',
      gender: 'Female',
      phone_number: '0912345678',
      priority_group: 'Khó khăn',
      preference: { room_type: 'Máy lạnh' },
      status: 'Đã duyệt',
    }));
  });
});

describe('RegistrationsService temporary entry', () => {
  it('derives the active semester and persists an unclassified admin entry', async () => {
    const publicModel: any = jest.fn().mockImplementation((payload: any) => ({ ...payload, save: jest.fn().mockResolvedValue({ ...payload, _id: 'temporary-1' }) }));
    publicModel.findOne = jest.fn().mockResolvedValue(null);
    const semesters = { findAll: jest.fn().mockResolvedValue([{ semester_name: 'HK2 - 2025 - 2026', status: 'active' }]) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, semesters as any);

    await service.createTemporary({ full_name: 'Nguyễn Tạm', date_of_birth: '2004-02-03', gender: 'Female', phone_number: '0912345678', room_type: 'Máy lạnh' });

    expect(publicModel).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Nguyễn Tạm', student_code: '', semester: 'HK2', academic_year: '2025-2026',
      room_type: 'Máy lạnh', source: 'ADMIN_ENTRY', status: 'Chờ xác nhận',
    }));
  });

  it('rejects a duplicate pending phone', async () => {
    const publicModel: any = jest.fn();
    publicModel.findOne = jest.fn().mockResolvedValue({ public_registration_code: 'PUB-OLD' });
    const semesters = { findAll: jest.fn().mockResolvedValue([{ semester_name: 'HK1 - 2025 - 2026', status: 'active' }]) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, semesters as any);
    await expect(service.createTemporary({ full_name: 'Nguyễn Tạm', date_of_birth: '2004-02-03', gender: 'Other', phone_number: '0912345678' })).rejects.toThrow('đã có đơn đăng ký tạm');
  });
});

describe('RegistrationsService registration actions', () => {
  it('updates only formal registration-owned fields', async () => {
    const formal = {
      phone_number: '0912345678',
      save: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011' }),
    };
    const registrationModel: any = { findById: jest.fn().mockResolvedValue(formal) };
    const service = new RegistrationsService(registrationModel, {} as any, {} as any, {} as any, {} as any);

    await service.update('507f1f77bcf86cd799439011', 'FORMAL', {
      phone_number: '0987654321',
      preference: { room_type: 'Máy lạnh' },
    });

    expect(formal.phone_number).toBe('0987654321');
    expect(formal.preference).toEqual({ room_type: 'Máy lạnh' });
    expect(formal.save).toHaveBeenCalled();
    await expect(service.update('507f1f77bcf86cd799439011', 'FORMAL', { full_name: 'Không được sửa' } as any)).rejects.toThrow('Không thể cập nhật trường');
  });

  it('updates temporary public entries only when the source matches', async () => {
    const temporary = {
      source: 'ADMIN_ENTRY',
      full_name: 'Tên cũ',
      save: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011' }),
    };
    const publicModel: any = { findById: jest.fn().mockResolvedValue(temporary) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);

    await service.update('507f1f77bcf86cd799439011', 'ADMIN_TEMPORARY', { full_name: 'Tên mới' });
    expect(temporary.full_name).toBe('Tên mới');
    await expect(service.update('507f1f77bcf86cd799439011', 'PUBLIC', { full_name: 'Sai nguồn' })).rejects.toThrow('Nguồn đăng ký QR không hợp lệ');
  });

  it('normalizes a legacy nested preference when updating a temporary entry', async () => {
    const temporary = { source: 'ADMIN_ENTRY', save: jest.fn().mockResolvedValue({}) };
    const publicModel: any = { findById: jest.fn().mockResolvedValue(temporary) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);

    await service.update('507f1f77bcf86cd799439011', 'ADMIN_TEMPORARY', { preference: { room_type: 'Máy lạnh', notes: 'Gần lớp' } } as any);
    expect(temporary.room_type).toBe('Máy lạnh');
    expect(temporary.notes).toBe('Gần lớp');
    expect(temporary.preference).toBeUndefined();
  });

  it('blocks deletion of referenced records and deletes unlinked public records', async () => {
    const formal = { _id: '507f1f77bcf86cd799439011' };
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue(formal),
      findByIdAndDelete: jest.fn().mockResolvedValue(formal),
    };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue({ _id: 'contract-1' }) };
    const service = new RegistrationsService(registrationModel, {} as any, contractModel, {} as any, {} as any);
    await expect(service.remove('507f1f77bcf86cd799439011', 'FORMAL')).rejects.toThrow('đã liên kết với hợp đồng');

    const publicRegistration = { source: 'QR_SCAN', linked_student_id: undefined, linked_registration_id: undefined };
    const publicModel: any = {
      findById: jest.fn().mockResolvedValue(publicRegistration),
      findByIdAndDelete: jest.fn().mockResolvedValue(publicRegistration),
    };
    const publicService = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);
    await expect(publicService.remove('507f1f77bcf86cd799439011', 'PUBLIC')).resolves.toEqual({ success: true, id: '507f1f77bcf86cd799439011', source: 'PUBLIC' });
    expect(publicModel.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });
});

describe('RegistrationsService application PDF source matrix', () => {
  beforeEach(() => {
    mockPuppeteerLaunch.mockReset().mockResolvedValue(mockPdfBrowser);
    mockPdfBrowser.newPage.mockReset().mockResolvedValue(mockPdfPage);
    mockPdfBrowser.close.mockReset().mockResolvedValue(undefined);
    mockPdfPage.setContent.mockClear();
    mockPdfPage.evaluate.mockReset().mockResolvedValue(undefined);
    mockPdfPage.pdf.mockClear();
    mockPdfPage.close.mockReset().mockResolvedValue(undefined);
    mockPdfPage.isClosed.mockReset().mockReturnValue(false);
  });

  it.each([
    ['FORMAL', 'DK-FORMAL', { student_id: { full_name: 'Nguyễn Formal', student_code: 'SV01', sex: 'Male', class_id: { class_name: 'CTK1', dept_id: { name: 'Công nghệ' } } }, date_of_birth: '2003-01-02', gender: 'Male', phone_number: '0901', priority_group: 'Không', registration_code: 'DK-FORMAL' }],
    ['PUBLIC', 'QR-PUBLIC', { full_name: 'Nguyễn Public', student_code: 'SV02', date_of_birth: '2004-02-03', gender: 'Female', phone_number: '0902', source: 'QR_SCAN', public_registration_code: 'QR-PUBLIC' }],
    ['ADMIN_TEMPORARY', 'PUB-TEMP', { full_name: 'Nguyễn Temporary', date_of_birth: '2005-03-04', gender: 'Other', phone_number: '0903', source: 'ADMIN_ENTRY', public_registration_code: 'PUB-TEMP' }],
  ])('loads the %s collection and generates one PDF', async (source, code, record) => {
    const formalModel: any = { findById: jest.fn().mockReturnValue(queryResult(record)) };
    const publicModel: any = { findOne: jest.fn().mockReturnValue(queryResult(record)) };
    const service = new RegistrationsService(formalModel, {} as any, {} as any, publicModel, {} as any);

    const result = await service.generateApplicationPdf('507f1f77bcf86cd799439011', source);

    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.filename).toContain(code);
    if (source === 'FORMAL') expect(formalModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    else expect(publicModel.findOne).toHaveBeenCalledWith({
      _id: '507f1f77bcf86cd799439011',
      source: source === 'ADMIN_TEMPORARY' ? 'ADMIN_ENTRY' : { $ne: 'ADMIN_ENTRY' },
    });
  });

  it('rejects public/admin source mismatches without probing the other collection', async () => {
    const publicModel: any = { findOne: jest.fn().mockReturnValue(queryResult(null)) };
    const formalModel: any = { findById: jest.fn() };
    const service = new RegistrationsService(formalModel, {} as any, {} as any, publicModel, {} as any);

    await expect(service.generateApplicationPdf('507f1f77bcf86cd799439011', 'PUBLIC')).rejects.toThrow('Không tìm thấy đơn đăng ký');
    expect(formalModel.findById).not.toHaveBeenCalled();
    await expect(service.generateApplicationPdf('507f1f77bcf86cd799439011', 'UNSUPPORTED')).rejects.toThrow('Nguồn đăng ký không hợp lệ');
    expect(publicModel.findOne).toHaveBeenCalledTimes(1);
  });

  it('renders incomplete and unsafe values as blanks or escaped text', async () => {
    const publicModel: any = { findOne: jest.fn().mockReturnValue(queryResult({ public_registration_code: 'QR-EMPTY', full_name: '<script>alert(1)</script>', source: 'QR_SCAN', date_of_birth: 'not-a-date', gender: 'Unknown', applicant_profile: { citizen_id_number: null, father: { full_name: '<b>unsafe</b>' } } })) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);

    await service.generateApplicationPdf('507f1f77bcf86cd799439011', 'PUBLIC');

    const html = mockPdfPage.setContent.mock.calls.at(-1)[0];
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;unsafe&lt;/b&gt;');
    expect(html).not.toContain('&amp;lt;b&amp;gt;unsafe&amp;lt;/b&amp;gt;');
    expect(html).not.toMatch(/undefined|null|Invalid Date|Unknown/);
  });

  it('matches the DOCX wording and layout contract with fixed blank slots', async () => {
    const publicModel: any = {
      findOne: jest.fn().mockReturnValue(queryResult({
        public_registration_code: 'QR-CONTRACT',
        full_name: 'Nguyễn Đủ Dữ Liệu',
        date_of_birth: '2004-02-03',
        gender: 'Female',
        phone_number: '0902',
        source: 'QR_SCAN',
        applicant_profile: {
          ethnicity: 'Kinh',
          religion: 'Không',
          citizen_id_number: '012345678901',
          citizen_id_issue_date: '2020-01-02',
          citizen_id_issue_place: 'TP. Hồ Chí Minh',
          permanent_address: 'Thành phố Hồ Chí Minh',
          father: { full_name: 'Nguyễn Cha', age: '50', permanent_address: 'Đồng Nai', contact_address: 'TP. Hồ Chí Minh', occupation: 'Kỹ sư', phone_number: '0903' },
          mother: { full_name: 'Trần Mẹ', age: '48', permanent_address: 'Long An', contact_address: 'TP. Hồ Chí Minh', occupation: 'Giáo viên', phone_number: '0904' },
          priority_certificate_details: 'Giấy chứng nhận hộ nghèo',
        },
      })),
    };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);

    await service.generateApplicationPdf('507f1f77bcf86cd799439011', 'PUBLIC');

    const html = mockPdfPage.setContent.mock.calls.at(-1)[0] as string;
    const expectedFlow = [
      'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM',
      'Độc lập - Tự do - Hạnh phúc',
      'ĐƠN XIN VÀO KÝ TÚC XÁ',
      'Kính gửi: Phòng Học sinh sinh viên.',
      'Họ và tên HSSV:',
      'Ngày, tháng, năm sinh:',
      'Nam(nữ):',
      'Lớp:',
      'Khoa',
      'Dân tộc:',
      'Tôn giáo:',
      'Điện thoại',
      'CCCD:',
      'Ngày cấp:',
      'Nơi cấp:',
      'Hộ khẩu thường trú:',
      'Họ tên Cha:',
      'Họ tên Mẹ:',
      'Các giấy chứng nhận ưu tiên (nếu có):',
      'Nay tôi làm đơn này kính đề nghị Phòng Học sinh sinh viên xem xét cho tôi được vào ở Ký túc xá. Nếu được giải quyết, tôi cam kết thực hiện Nội quy Ký túc xá của Nhà trường./.',
      'PHHS ký và ghi rõ họ tên',
      '(Dành cho HSSV dưới 18 tuổi)',
      'NGƯỜI LÀM ĐƠN',
      '(Ký tên, ghi rõ họ, tên)',
    ];
    let previous = -1;
    for (const text of expectedFlow) {
      const current = html.indexOf(text);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(html).toContain('@page { size: A4 portrait; margin: 20mm 20mm 20mm 30mm; }');
    expect(html).toContain('font-family: "Times New Roman", Times, serif; font-size: 15pt;');
    expect(html).toContain('font-size: 17pt; font-weight: 700;');
    expect(html).toContain('.detail-row { height: 1.75em; line-height: 1.75; white-space: nowrap; }');
    expect(html).toContain('.field { display: inline-block; padding: 0; border: 0; vertical-align: baseline; overflow: visible; white-space: nowrap; }');
    expect(html).not.toContain('border-bottom: 1px dotted #000;');
    expect(html).not.toContain('min-height: 1.25em');
    expect(html).not.toContain('overflow: hidden');
    expect(html).toContain('grid-template-columns: 39mm minmax(0, 1fr);');
    expect(html).toContain('height: 41.8mm;');
    expect(html).toContain('class="photo-frame"');
    expect(html).toContain('.signature-space { height: 0; }');
    expect(html).toContain('table-layout: fixed;');
    expect((html.match(/class="signature-cell\b/g) || []).length).toBe(2);
    expect(html).not.toContain('BỘ GIÁO DỤC VÀ ĐÀO TẠO');
    expect(html).not.toContain('TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN');
    expect(html).not.toContain('Mã số sinh viên');
    expect(html).not.toContain('Ban Quản lý Ký túc xá');
    expect(html).not.toContain('..., ngày');
    expect(html).not.toContain('Diện ưu tiên:');
    expect(html).toContain('Nguyễn Đủ Dữ Liệu');
    expect(html).toContain('Giấy chứng nhận hộ nghèo');
    expect(mockPdfPage.evaluate).toHaveBeenCalledTimes(1);
    expect(mockPdfPage.evaluate.mock.invocationCallOrder[0]).toBeLessThan(mockPdfPage.pdf.mock.invocationCallOrder[0]);
  });

  it('keeps both signature columns and all fixed-width blank fields for an adult blank form', async () => {
    const publicModel: any = { findOne: jest.fn().mockReturnValue(queryResult({ public_registration_code: 'QR-BLANK', source: 'QR_SCAN', date_of_birth: '1980-01-01', gender: 'Unknown', applicant_profile: { father: null, mother: null } })) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);

    await service.generateApplicationPdf('507f1f77bcf86cd799439011', 'PUBLIC');

    const html = mockPdfPage.setContent.mock.calls.at(-1)[0] as string;
    expect((html.match(/class="signature-cell\b/g) || []).length).toBe(2);
    expect((html.match(/class="field /g) || []).length).toBe(25);
    expect(html).not.toMatch(/>undefined<|>null<|Invalid Date|>Unknown</);
    expect(html).toContain('field field-name"></span>');
    expect(html).toContain('field field-parent-name"></span>');
    expect(html).toContain('class="photo-frame" aria-label="Khung ảnh"></div>');
    expect(html).toContain('parent-signature');
    expect(html).toContain('applicant-signature');
    expect(html).not.toContain('border-bottom: 1px dotted #000;');
    expect(html).not.toContain('>----------</span>');
  });

  it('retries a target closure with a fresh browser and page', async () => {
    const firstPage = { ...mockPdfPage, setContent: jest.fn().mockResolvedValue(undefined), pdf: jest.fn().mockRejectedValue(Object.assign(new Error('Protocol error (Page.printToPDF): Target closed'), { name: 'TargetCloseError' })), close: jest.fn().mockResolvedValue(undefined), isClosed: jest.fn().mockReturnValue(false) };
    const secondPage = { ...mockPdfPage, setContent: jest.fn().mockResolvedValue(undefined), pdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-retry')), close: jest.fn().mockResolvedValue(undefined), isClosed: jest.fn().mockReturnValue(false) };
    const firstBrowser = { newPage: jest.fn().mockResolvedValue(firstPage), close: jest.fn().mockResolvedValue(undefined) };
    const secondBrowser = { newPage: jest.fn().mockResolvedValue(secondPage), close: jest.fn().mockResolvedValue(undefined) };
    mockPuppeteerLaunch.mockResolvedValueOnce(firstBrowser).mockResolvedValueOnce(secondBrowser);
    const publicModel: any = { findOne: jest.fn().mockReturnValue(queryResult({ public_registration_code: 'QR-RETRY', source: 'QR_SCAN' })) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);

    const result = await service.generateApplicationPdf('507f1f77bcf86cd799439011', 'PUBLIC');

    expect(result.buffer).toEqual(Buffer.from('%PDF-retry'));
    expect(mockPuppeteerLaunch).toHaveBeenCalledTimes(2);
    expect(firstPage.close).toHaveBeenCalledTimes(1);
    expect(secondPage.close).toHaveBeenCalledTimes(1);
    expect(firstBrowser.close).toHaveBeenCalledTimes(1);
    expect(secondBrowser.close).toHaveBeenCalledTimes(1);
  });

  it('retries a target closure during setContent and sanitizes persistent closure', async () => {
    const targetError = Object.assign(new Error('Target closed'), { name: 'TargetCloseError' });
    const firstPage = { ...mockPdfPage, setContent: jest.fn().mockRejectedValue(targetError), pdf: jest.fn(), close: jest.fn().mockResolvedValue(undefined), isClosed: jest.fn().mockReturnValue(false) };
    const secondPage = { ...mockPdfPage, setContent: jest.fn().mockRejectedValue(targetError), pdf: jest.fn(), close: jest.fn().mockResolvedValue(undefined), isClosed: jest.fn().mockReturnValue(false) };
    const firstBrowser = { newPage: jest.fn().mockResolvedValue(firstPage), close: jest.fn().mockResolvedValue(undefined) };
    const secondBrowser = { newPage: jest.fn().mockResolvedValue(secondPage), close: jest.fn().mockResolvedValue(undefined) };
    mockPuppeteerLaunch.mockResolvedValueOnce(firstBrowser).mockResolvedValueOnce(secondBrowser);
    const publicModel: any = { findOne: jest.fn().mockReturnValue(queryResult({ public_registration_code: 'QR-CLOSED', source: 'QR_SCAN' })) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);

    await expect(service.generateApplicationPdf('507f1f77bcf86cd799439011', 'PUBLIC')).rejects.toMatchObject({ status: 503, message: 'Không thể tạo PDF đơn đăng ký lúc này' });
    expect(mockPuppeteerLaunch).toHaveBeenCalledTimes(2);
    expect(firstPage.pdf).not.toHaveBeenCalled();
    expect(secondPage.pdf).not.toHaveBeenCalled();
    expect(firstPage.close).toHaveBeenCalledTimes(1);
    expect(secondPage.close).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-target render errors and cleanup errors do not replace them', async () => {
    const renderError = new Error('template render failed');
    mockPdfPage.pdf.mockRejectedValue(renderError);
    mockPdfPage.close.mockRejectedValue(new Error('page close failed'));
    mockPdfBrowser.close.mockRejectedValue(new Error('browser close failed'));
    const publicModel: any = { findOne: jest.fn().mockReturnValue(queryResult({ public_registration_code: 'QR-ERROR', source: 'QR_SCAN' })) };
    const service = new RegistrationsService({} as any, {} as any, {} as any, publicModel, {} as any);

    await expect(service.generateApplicationPdf('507f1f77bcf86cd799439011', 'PUBLIC')).rejects.toBe(renderError);
    expect(mockPuppeteerLaunch).toHaveBeenCalledTimes(1);
    expect(mockPdfPage.close).toHaveBeenCalledTimes(1);
    expect(mockPdfBrowser.close).toHaveBeenCalledTimes(1);
  });
});
