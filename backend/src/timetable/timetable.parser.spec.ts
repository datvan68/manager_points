import { parseTimetable, parseTimetableOptions } from './timetable.parser';

describe('timetable parser', () => {
  it('does not offer the source placeholder as a real semester', () => {
    const options = parseTimetableOptions('<select id="year"><option value="2026">2026</option></select><select id="semester"><option value="-1">--Chọn--</option><option value="1">1</option></select><select id="week"><option value="0">1</option></select>');
    expect(options.semesters).toEqual([{ value: '1', label: '1' }]);
    expect(options.weeks).toEqual([{ value: '0', label: '1' }]);
  });
  it('preserves opaque option values and parses multi-period lessons', () => {
    const options = parseTimetableOptions(`<select id="year"><option value="2025|a">2025-2026</option></select><select id="semester"><option value="2">Học kỳ 2</option></select><select id="week"><option value="54">55</option></select>`);
    expect(options.years).toEqual([{ label: '2025-2026', value: '2025|a' }]);
    const result = parseTimetable(`<table><tr><th>Lớp</th><th>Buổi</th><th>Tiết</th><th>Thứ 2</th><th>Thứ 3</th><th>Thứ 4</th></tr><tr><td>Lớp A</td><td>Tối</td><td rowspan="2">13</td><td rowspan="2">Toán<br/>Phòng: A101<br/>GV: Cô A<br/>06:00-09:15 (4h)</td><td>&nbsp;</td><td>&nbsp;</td></tr></table>`, { year: '2025|a', semester: '2', week: '54' });
    expect(result.lessons).toEqual(expect.arrayContaining([expect.objectContaining({ subject: 'Toán', startPeriod: 13, endPeriod: 14, teacher: 'Cô A', sourceTime: '06:00-09:15 (4h)' })]));
    expect(result.isEmpty).toBe(false);
  });

  it('distinguishes a valid header-only empty schedule from changed markup', () => {
    const result = parseTimetable('<table><tr><th>Lớp</th><th>Buổi</th><th>Tiết</th><th>Thứ 2</th><th>Thứ 3</th></tr></table>', { year: '2025', semester: '2', week: '50' });
    expect(result).toMatchObject({ isEmpty: true, lessons: [] });
  });
});
