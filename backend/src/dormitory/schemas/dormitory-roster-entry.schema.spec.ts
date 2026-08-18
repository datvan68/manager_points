import { DormitoryRosterEntrySchema } from './dormitory-roster-entry.schema';

describe('DormitoryRosterEntry schema', () => {
  it('uses the canonical collection and integrity indexes', () => {
    expect(DormitoryRosterEntrySchema.get('collection')).toBe('dormitory_roster_entries');
    const indexes = DormitoryRosterEntrySchema.indexes();
    const namedIndexes = indexes.map(([key, options]) => ({ key, options }));
    expect(namedIndexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ options: expect.objectContaining({ name: 'roster_student_semester_unique', unique: true }) }),
      expect.objectContaining({ options: expect.objectContaining({ name: 'roster_identity_lookup' }) }),
      expect.objectContaining({ options: expect.objectContaining({ name: 'roster_student_code_lookup' }) }),
    ]));
    const membership = indexes.find(([, options]) => options.name === 'roster_student_semester_unique');
    expect(membership?.[1].partialFilterExpression).toEqual({ student_id: { $exists: true, $ne: null } });
  });
});
