import { DormitoryRosterIdentityService } from './dormitory-roster-identity.service';

function query<T>(value: T) { const q: any = { exec: jest.fn().mockResolvedValue(value), limit: jest.fn(() => q) }; return q; }

describe('DormitoryRosterIdentityService', () => {
  it('links only one exact normalized-name and DOB candidate', async () => {
    const entry: any = { _id: 'entry-1', semester_id: 'semester-1', full_name_normalized: 'nguyen van a', date_of_birth: new Date('2004-01-02'), identity_state: 'UNLINKED', save: jest.fn().mockResolvedValue(undefined) };
    const rosterModel: any = { findById: jest.fn(() => query({ _id: 'student-1', full_name: 'Nguyễn Văn A', date_bir: new Date('2004-01-02') })), find: jest.fn()
      .mockReturnValueOnce(query([entry]))
      .mockReturnValueOnce(query([])), findOne: jest.fn(() => query(null)) };
    const studentModel: any = { findById: jest.fn(() => query({ _id: 'student-1', full_name: 'Nguyễn Văn A', date_bir: new Date('2004-01-02'), student_code: 'SV001', status: 'Studying', class_id: { _id: 'class-1' } })) };
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

  it('matches only studying students with a class reference and preserves exact ambiguity', async () => {
    const entry: any = { _id: 'entry-1', semester_id: 'semester-1', full_name: 'Nguyễn Văn A', date_of_birth: new Date('2004-01-02') };
    const studying = { _id: 'student-1', full_name: 'Nguyễn Văn A', date_bir: new Date('2004-01-02'), status: 'Studying', class_id: { _id: 'class-1' } };
    const dropped = { ...studying, _id: 'student-2', status: 'Dropped' };
    const noClass = { ...studying, _id: 'student-3', class_id: null };
    const rosterModel: any = { find: jest.fn(() => query([])) };
    const studentModel: any = { find: jest.fn(() => query([studying, dropped, noClass])) };
    const service = new DormitoryRosterIdentityService(rosterModel, studentModel);

    await expect(service.resolveBatch([entry])).resolves.toEqual([{ student: studying, state: 'LINKED' }]);
    expect(studentModel.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'Studying', class_id: { $exists: true, $ne: null } }));
  });

  it('returns conflict for multiple current-class candidates and rejects non-current manual links', async () => {
    const candidate = { _id: 'student-1', full_name: 'Nguyễn Văn A', date_bir: new Date('2004-01-02'), status: 'Studying', class_id: { _id: 'class-1' } };
    const rosterModel: any = { find: jest.fn(() => query([])) };
    const studentModel: any = {
      find: jest.fn(() => query([candidate, { ...candidate, _id: 'student-2' }])),
      findById: jest.fn(() => query({ ...candidate, class_id: null })),
    };
    const service = new DormitoryRosterIdentityService(rosterModel, studentModel);
    await expect(service.resolveBatch([{ full_name: candidate.full_name, date_of_birth: candidate.date_bir, semester_id: 'semester-1' }])).resolves.toEqual([{ state: 'CONFLICT', reason: expect.stringContaining('nhiều sinh viên') }]);
    await expect(service.assertCurrentStudent('507f1f77bcf86cd799439011')).rejects.toThrow('lớp hiện tại');
  });

  it('uses a stable _id cursor and conditional linking for reconciliation', async () => {
    const entry: any = { _id: '507f1f77bcf86cd799439011', semester_id: 'semester-1', full_name: 'Nguyễn Văn A', date_of_birth: new Date('2004-01-02'), identity_state: 'UNLINKED' };
    const student: any = { _id: '507f1f77bcf86cd799439012', full_name: 'Nguyễn Văn A', date_bir: new Date('2004-01-02'), student_code: 'SV001', status: 'Studying', class_id: { _id: 'class-1' } };
    const rosterModel: any = { find: jest.fn().mockReturnValueOnce(query([entry])).mockReturnValueOnce(query([])), updateOne: jest.fn(() => query({ matchedCount: 1 })) };
    const studentModel: any = { find: jest.fn(() => query([student])) };
    const service = new DormitoryRosterIdentityService(rosterModel, studentModel);
    const result = await service.reconcileUnlinked(undefined, 1);
    expect(result).toMatchObject({ scanned: 1, linked: 1, has_more: true, next_cursor: entry._id });
    expect(rosterModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ identity_state: { $in: ['UNLINKED', 'CONFLICT'] } }), expect.objectContaining({ $set: expect.objectContaining({ student_id: student._id, identity_state: 'LINKED' }) }));
  });
});
