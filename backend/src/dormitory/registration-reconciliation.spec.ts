import { buildReconciliationReport } from '../../scripts/report-dormitory-registration-reconciliation';

describe('dormitory registration reconciliation dry-run', () => {
  it('reports malformed, invalid, duplicate, divergent, and partial records without writes', () => {
    const report = buildReconciliationReport({
      publicRegistrations: [
        { _id: 'public-1', source: 'UNKNOWN', student_code: 'MISSING' },
        { _id: 'public-2', source: 'QR_SCAN', student_code: 'DUP', linked_student_id: 'student-1', linked_registration_id: 'formal-1', semester: 'HK1', academic_year: '2025-2026' },
        { _id: 'public-3', source: 'QR_SCAN', linked_student_id: 'student-1' },
      ],
      formalRegistrations: [{ _id: 'formal-1', student_id: 'student-2', semester: 'HK2', academic_year: '2024-2025' }],
      students: [{ _id: 'student-1', student_code: 'DUP' }, { _id: 'student-2', student_code: 'DUP' }],
    });

    expect(report.mode).toBe('dry-run');
    expect(report.malformedSources).toHaveLength(1);
    expect(report.duplicateCandidates).toEqual([expect.objectContaining({ code: 'DUP' })]);
    expect(report.divergentLinkedRecords[0].fields).toEqual(expect.arrayContaining(['student_id', 'semester', 'academic_year']));
    expect(report.partialLinks).toEqual([expect.objectContaining({ reason: 'ONE_SIDED_LINK' })]);
    expect(report.unsafeFindings.length).toBeGreaterThan(0);
  });
});
