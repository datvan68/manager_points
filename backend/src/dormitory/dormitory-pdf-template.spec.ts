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
    it('exposes contract descriptor metadata and field palette', () => {
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.templateTypeCode).toBe('DORMITORY_RESIDENCE_CONTRACT');
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.displayName).toBe('Mẫu đơn hợp đồng nội trú');
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.moduleCode).toBe('DORMITORY');
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.featureCode).toBe('DORMITORY_CONTRACT');
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.sourcePermission).toBe('DORM_CONTRACT_READ');
      expect(DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.fields.length).toBe(15);

      const fieldKeys = DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.fields.map((f) => f.key);
      expect(fieldKeys).toEqual([
        'contract.code',
        'contract.startDate',
        'contract.endDate',
        'contract.status',
        'student.code',
        'student.fullName',
        'student.dateOfBirth',
        'student.gender',
        'roster.phone',
        'applicant.citizenId',
        'applicant.permanentAddress',
        'room.code',
        'room.name',
        'bed.code',
        'bed.position',
      ]);
    });

    it('marks personal identity and contact fields as sensitive', () => {
      const sensitiveKeys = DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.fields
        .filter((f) => f.sensitive)
        .map((f) => f.key);
      expect(sensitiveKeys).toEqual([
        'student.fullName',
        'roster.phone',
        'applicant.citizenId',
        'applicant.permanentAddress',
      ]);
    });

    it('generates synthetic contract fixtures for all fixture modes', () => {
      const viFixture = DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.syntheticFixture('vietnamese');
      expect(viFixture.values['contract.code']).toBe('HD-2026-0001');
      expect(viFixture.values['student.fullName']).toBe('Nguyễn Thị Minh Khánh');
      expect(viFixture.values['room.code']).toBe('P101');
      expect(viFixture.values['bed.code']).toBe('G01');

      const longFixture = DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.syntheticFixture('long');
      expect(longFixture.values['contract.code']).toContain('wrap và shrink');

      const missingFixture = DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR.syntheticFixture('missing');
      expect(missingFixture.values['contract.code']).toBe('');
    });

    it('resolves contract PDF values from populated contract entity', () => {
      const contract = {
        contract_code: 'HD-12345678',
        start_date: new Date('2026-09-01'),
        end_date: new Date('2027-06-30'),
        status: 'Hiệu lực',
        student_id: {
          student_code: 'SV001',
          full_name: 'Trần Văn B',
          date_bir: new Date('2004-05-15'),
          sex: 'Male',
        },
        room_id: {
          room_code: 'P202',
          room_name: 'Phòng 202',
        },
        bed_id: {
          bed_code: 'G02',
          position: 'Tầng 1 - Phải',
        },
        roster_entry_id: {
          phone_number: '0901112233',
          applicant_profile: {
            citizen_id_number: '079204000111',
            permanent_address: 'Hà Nội',
          },
        },
      };

      const values = resolveDormitoryContractPdfValues(contract);
      expect(values['contract.code']).toBe('HD-12345678');
      expect(values['contract.status']).toBe('Hiệu lực');
      expect(values['student.code']).toBe('SV001');
      expect(values['student.fullName']).toBe('Trần Văn B');
      expect(values['student.gender']).toBe('Male');
      expect(values['room.code']).toBe('P202');
      expect(values['room.name']).toBe('Phòng 202');
      expect(values['bed.code']).toBe('G02');
      expect(values['bed.position']).toBe('Tầng 1 - Phải');
      expect(values['roster.phone']).toBe('0901112233');
      expect(values['applicant.citizenId']).toBe('079204000111');
      expect(values['applicant.permanentAddress']).toBe('Hà Nội');
    });

    it('resolves contract PDF values from separate context arguments', () => {
      const contract = { contract_code: 'HD-888', start_date: '2026-09-01', end_date: '2027-06-30', status: 'Hiệu lực' };
      const student = { student_code: 'SV888', full_name: 'Lê Thị C', date_bir: '2004-08-20', sex: 'Female' };
      const room = { room_code: 'P303', room_name: 'Phòng 303' };
      const bed = { bed_code: 'G03', position: 'Tầng 2 - Trái' };
      const roster = { phone_number: '0933445566', applicant_profile: { citizen_id_number: '012345678901', permanent_address: 'Đà Nẵng' } };

      const values = resolveDormitoryContractPdfValues(contract, student, room, bed, roster);
      expect(values['contract.code']).toBe('HD-888');
      expect(values['student.fullName']).toBe('Lê Thị C');
      expect(values['student.code']).toBe('SV888');
      expect(values['room.code']).toBe('P303');
      expect(values['bed.code']).toBe('G03');
      expect(values['roster.phone']).toBe('0933445566');
      expect(values['applicant.permanentAddress']).toBe('Đà Nẵng');
    });
  });
});
