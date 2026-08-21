import {
  DORMITORY_ROSTER_APPLICATION_DESCRIPTOR,
  DORMITORY_RESIDENCE_INFO_DESCRIPTOR,
  DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR,
  resolveDormitoryContractPdfValues,
  resolveDormitoryResidenceInfoPdfValues,
  resolveDormitoryRosterPdfValues,
} from './pdf-template-adapter';

describe('dormitory-pdf-template contract', () => {
  describe('DORMITORY_ROSTER_APPLICATION_DESCRIPTOR (Mẫu đơn đăng ký KTX)', () => {
    it('exposes the one-page normalized KTX layout and metadata', () => {
      expect(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.templateTypeCode).toBe('DORMITORY_ROSTER_APPLICATION');
      expect(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.displayName).toBe('Mẫu đơn đăng ký KTX');
      expect(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.moduleCode).toBe('DORMITORY');
      expect(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.featureCode).toBe('DORMITORY_ROSTER');
      expect(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.sourcePermission).toBe('DORM_REG_READ');
      expect(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.fields.length).toBe(25);
    });

    it('generates synthetic fixtures across modes', () => {
      const viFixture = DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.syntheticFixture('vietnamese');
      expect(viFixture.values['student.fullName']).toBe('Nguyễn Thị Minh Khánh');
      expect(viFixture.values['applicant.citizenId']).toBe('012345678901');

      const shortFixture = DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.syntheticFixture('short');
      expect(shortFixture.values['student.fullName']).toBeDefined();

      const missingFixture = DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.syntheticFixture('missing');
      expect(missingFixture.values).toBeDefined();
    });

    it('resolves roster values correctly', () => {
      const roster = {
        full_name: 'Nguyễn Văn A',
        phone_number: '0987654321',
        applicant_profile: {
          ethnicity: 'Kinh',
          citizen_id_number: '123456789012',
          permanent_address: 'Hà Nội',
        },
      };
      const values = resolveDormitoryRosterPdfValues(roster, null);
      expect(values['student.fullName']).toBe('Nguyễn Văn A');
      expect(values['roster.phone']).toBe('0987654321');
      expect(values['applicant.citizenId']).toBe('123456789012');
    });
  });

  describe('DORMITORY_RESIDENCE_INFO_DESCRIPTOR (Mẫu đơn thông tin cư trú)', () => {
    it('exposes residence info descriptor metadata and field palette', () => {
      expect(DORMITORY_RESIDENCE_INFO_DESCRIPTOR.templateTypeCode).toBe('DORMITORY_RESIDENCE_INFO');
      expect(DORMITORY_RESIDENCE_INFO_DESCRIPTOR.displayName).toBe('Mẫu đơn thông tin cư trú');
      expect(DORMITORY_RESIDENCE_INFO_DESCRIPTOR.moduleCode).toBe('DORMITORY');
      expect(DORMITORY_RESIDENCE_INFO_DESCRIPTOR.featureCode).toBe('DORMITORY_ROSTER');
      expect(DORMITORY_RESIDENCE_INFO_DESCRIPTOR.sourcePermission).toBe('DORM_REG_READ');
      expect(DORMITORY_RESIDENCE_INFO_DESCRIPTOR.fields.length).toBe(19);

      const fieldKeys = DORMITORY_RESIDENCE_INFO_DESCRIPTOR.fields.map((f) => f.key);
      expect(fieldKeys).toContain('student.code');
      expect(fieldKeys).toContain('student.fullName');
      expect(fieldKeys).toContain('applicant.citizenId');
      expect(fieldKeys).toContain('applicant.permanentAddress');
      expect(fieldKeys).toContain('dormitory.semester');
      expect(fieldKeys).toContain('room.code');
      expect(fieldKeys).toContain('bed.code');
    });

    it('marks sensitive fields properly', () => {
      const sensitiveKeys = DORMITORY_RESIDENCE_INFO_DESCRIPTOR.fields
        .filter((f) => f.sensitive)
        .map((f) => f.key);
      expect(sensitiveKeys).toEqual([
        'student.fullName',
        'roster.phone',
        'applicant.citizenId',
        'applicant.permanentAddress',
      ]);
    });

    it('generates synthetic fixtures', () => {
      const viFixture = DORMITORY_RESIDENCE_INFO_DESCRIPTOR.syntheticFixture('vietnamese');
      expect(viFixture.values['student.fullName']).toBe('Nguyễn Thị Minh Khánh');
      expect(viFixture.values['room.code']).toBe('P101');
    });

    it('resolves residence info values', () => {
      const roster = {
        student_code: 'SV100',
        full_name: 'Phạm Thị D',
        date_of_birth: '2004-03-10',
        gender: 'Female',
        phone_number: '0977889900',
        semester: 'Học kỳ 1',
        academic_year: '2026-2027',
        applicant_profile: {
          citizen_id_number: '012345678999',
          permanent_address: 'Hà Nội',
        },
        room_id: { room_code: 'P102', room_name: 'Phòng 102' },
        bed_id: { bed_code: 'G04', position: 'Tầng 1 - Trái' },
      };
      const values = resolveDormitoryResidenceInfoPdfValues(roster);
      expect(values['student.code']).toBe('SV100');
      expect(values['student.fullName']).toBe('Phạm Thị D');
      expect(values['room.code']).toBe('P102');
      expect(values['bed.code']).toBe('G04');
      expect(values['dormitory.semester']).toBe('Học kỳ 1');
    });
  });

  describe('DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR (Mẫu đơn hợp đồng nội trú)', () => {
    it('reuses the ordered registration field palette while retaining contract identity', () => {
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.templateTypeCode).toBe('DORMITORY_RESIDENCE_CONTRACT');
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.displayName).toBe('Mẫu đơn hợp đồng nội trú');
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.moduleCode).toBe('DORMITORY');
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.featureCode).toBe('DORMITORY_CONTRACT');
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.sourcePermission).toBe('DORM_CONTRACT_READ');
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.fields).toEqual(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.fields);
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.fields.map((f) => f.key)).toEqual(
        DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.fields.map((f) => f.key),
      );
    });

    it('reuses registration formatters, sensitivity flags, and synthetic fixtures', () => {
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.fields.map((f) => ({ key: f.key, allowedFormatters: f.allowedFormatters, sensitive: f.sensitive })))
        .toEqual(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.fields.map((f) => ({ key: f.key, allowedFormatters: f.allowedFormatters, sensitive: f.sensitive })));
      for (const name of ['short', 'long', 'missing', 'vietnamese'] as const) {
        expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.syntheticFixture(name)).toEqual(
          DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.syntheticFixture(name),
        );
      }
    });

    it('resolves the registration palette from roster context and never emits removed contract keys', () => {
      const roster = {
        full_name: 'Lê Thị C',
        date_of_birth: '2004-08-20',
        gender: 'Female',
        phone_number: '0933445566',
        applicant_profile: {
          citizen_id_number: '012345678901',
          permanent_address: 'Đà Nẵng',
        },
      };
      const values = resolveDormitoryContractPdfValues(
        { roster_entry_id: roster },
        { student_code: 'SV888', full_name: 'Lê Thị C', date_bir: '2004-08-20', sex: 'Female' },
      );
      expect(values['student.fullName']).toBe('Lê Thị C');
      expect(values['roster.phone']).toBe('0933445566');
      expect(values['applicant.permanentAddress']).toBe('Đà Nẵng');
      expect(values).not.toHaveProperty('contract.code');
      expect(values).not.toHaveProperty('room.code');
      expect(values).not.toHaveProperty('bed.code');
    });
  });
});
