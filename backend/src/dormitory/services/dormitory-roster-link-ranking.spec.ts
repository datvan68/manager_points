import { birthDateSimilarity, nameSimilarity, normalizeLinkName, rankLinkCandidates } from './dormitory-roster-link-ranking';

describe('dormitory roster link ranking', () => {
  it('normalizes Vietnamese names and combines edit/token similarity', () => {
    expect(normalizeLinkName(' Nguyễn Văn-A ')).toBe('nguyenvana');
    expect(nameSimilarity('Nguyễn Văn A', 'Nguyen Van A')).toBe(1);
    expect(nameSimilarity('Nguyễn Văn A', 'Nguyễn Văn B')).toBeGreaterThan(0.7);
  });

  it('uses calendar-date boundaries without timezone drift', () => {
    expect(birthDateSimilarity('2004-01-02', '2004-01-02').score).toBe(1);
    expect(birthDateSimilarity('2004-01-02', '2004-01-03').score).toBe(0.8);
    expect(birthDateSimilarity('2004-01-02', '2004-02-02').score).toBeCloseTo(0.2);
    expect(birthDateSimilarity('invalid', '2004-01-02').score).toBe(0);
  });

  it('sorts recommendations and tie-breaks deterministically with reason codes', () => {
    const ranked = rankLinkCandidates({ full_name: 'Nguyễn Văn A', date_of_birth: '2004-01-02' }, [
      { _id: '2', student_code: 'SV002', full_name: 'Nguyen Van A', date_bir: '2004-01-03' },
      { _id: '1', student_code: 'SV001', full_name: 'Nguyen Van A', date_bir: '2004-01-02' },
      { _id: '3', student_code: 'SV003', full_name: 'Trần B', date_bir: '1990-01-01' },
    ]);
    expect(ranked.map((item) => item._id)).toEqual(['1', '2', '3']);
    expect(ranked[0]).toMatchObject({ match_score: 100, recommended: true, match_reasons: ['NAME_EXACT', 'DOB_EXACT'] });
    expect(Number.isNaN(ranked[2].match_score)).toBe(false);
  });
});
