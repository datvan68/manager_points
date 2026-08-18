import { DormitoryRosterIdentityService } from './dormitory-roster-identity.service';

function query<T>(value: T) { const q: any = { exec: jest.fn().mockResolvedValue(value), limit: jest.fn(() => q) }; return q; }

describe('DormitoryRosterIdentityService', () => {
  it('links only one exact normalized-name and DOB candidate', async () => {
    const entry: any = { _id: 'entry-1', semester_id: 'semester-1', full_name_normalized: 'nguyen van a', date_of_birth: new Date('2004-01-02'), identity_state: 'UNLINKED', save: jest.fn().mockResolvedValue(undefined) };
    const rosterModel: any = { findById: jest.fn(() => query({ _id: 'student-1', full_name: 'Nguyễn Văn A', date_bir: new Date('2004-01-02') })), find: jest.fn()
      .mockReturnValueOnce(query([entry]))
      .mockReturnValueOnce(query([])), findOne: jest.fn(() => query(null)) };
    const studentModel: any = { findById: jest.fn(() => query({ _id: 'student-1', full_name: 'Nguyễn Văn A', date_bir: new Date('2004-01-02'), student_code: 'SV001' })) };
    const service = new DormitoryRosterIdentityService(rosterModel, studentModel);
    await expect(service.reconcileStudent('student-1')).resolves.toEqual({ linked: 1, conflicts: 0, skipped: 0 });
    expect(entry.student_id).toBe('student-1');
    expect(entry.identity_state).toBe('LINKED');
  });

  it('normalizes names but does not accept a DOB mismatch', () => {
    const service = new DormitoryRosterIdentityService({} as any, {} as any);
    expect(service.normalizeName(' Nguyễn   Văn A ')).toBe('nguyễn văn a');
    expect(service.sameDate('2004-01-02', '2004-01-03')).toBe(false);
  });
});
