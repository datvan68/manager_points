import { calendarDateDistance, calendarDateFrom, calendarDateRange, canonicalDate, parseVietnameseDate } from './dormitory-calendar-date';

describe('dormitory calendar date', () => {
  it('normalizes legacy Vietnam-local and canonical UTC instants to one date', () => {
    expect(calendarDateFrom(new Date('2004-03-11T17:00:00.000Z'))).toBe('2004-03-12');
    expect(calendarDateFrom(new Date('2004-03-12T00:00:00.000Z'))).toBe('2004-03-12');
    expect(calendarDateDistance(new Date('2004-03-11T17:00:00.000Z'), '2004-03-12')).toBe(0);
  });

  it('strictly validates literals and stores them at UTC midnight', () => {
    expect(parseVietnameseDate('12/03/2004')).toBe('2004-03-12');
    expect(parseVietnameseDate('31/02/2004')).toBeNull();
    expect(canonicalDate('2004-02-31')).toBeNull();
    expect(canonicalDate('12/03/2004')?.toISOString()).toBe('2004-03-12T00:00:00.000Z');
  });

  it('creates the Vietnam-local day boundary', () => {
    const range = calendarDateRange('2004-03-12')!;
    expect(range.start.toISOString()).toBe('2004-03-11T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2004-03-12T17:00:00.000Z');
  });
});
