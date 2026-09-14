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
    expect(result.lessons).toEqual(expect.arrayContaining([expect.objectContaining({ subject: 'Toán', startPeriod: 13, endPeriod: 14, teacher: 'Cô A', room: 'A101', durationLabel: '(4h)', sourceTime: '06:00-09:15 (4h)' })]));
    expect(result.isEmpty).toBe(false);
  });

  it('preserves source-style room, teacher, duration and safe meeting links across HTML lines', () => {
    const result = parseTimetable('<table><tr><th>Lớp</th><th>Buổi</th><th>Tiết</th><th>Thứ 2</th><th>Thứ 3</th></tr><tr><td>A</td><td>Sáng</td><td>1</td><td><span>CD-TTCAD-CAM</span><br><span>B0.7 (TH-QTMMT)</span><br><strong>ThS. Nguyễn Nhơn Hải (5h)</strong></td><td>CD-DACNCTM<br><a href="https://meet.google.com/xji-euts-xwt">https://meet.google.com/xji-euts-xwt</a><br><span>ThS. Lê Quang Trung</span><br>01:00-05:25 (3t)</td></tr></table>', { year: '2026', semester: '1', week: '1' });
    expect(result.lessons).toEqual(expect.arrayContaining([
      expect.objectContaining({ subject: 'CD-TTCAD-CAM', teacher: 'ThS. Nguyễn Nhơn Hải', room: 'B0.7 (TH-QTMMT)', durationLabel: '(5h)' }),
      expect.objectContaining({ subject: 'CD-DACNCTM', teacher: 'ThS. Lê Quang Trung', onlineUrl: 'https://meet.google.com/xji-euts-xwt', sourceTime: '01:00-05:25 (3t)' }),
    ]));
  });

  it('rejects unsafe links and keeps absent optional fields absent', () => {
    const result = parseTimetable('<table><tr><th>Lớp</th><th>Buổi</th><th>Tiết</th><th>Thứ 2</th></tr><tr><td>A</td><td>Sáng</td><td>1</td><td>Môn<br><a href="javascript:alert(1)">Họp</a></td></tr></table>', { year: 'y', semester: 's', week: 'w' });
    expect(result.lessons[0]).not.toHaveProperty('onlineUrl');
    expect(result.lessons[0]).not.toHaveProperty('teacher');
    expect(result.lessons[0]).not.toHaveProperty('room');
    expect(result.lessons[0]).not.toHaveProperty('durationLabel');
  });

  it('reads a valid result date range and assigns the calendar date to each lesson day', () => {
    const result = parseTimetable('<h2>Từ ngày 14/09/2026 đến ngày 20/09/2026</h2><table><tr><th>Lớp</th><th>Buổi</th><th>Tiết</th><th>Thứ 2</th><th>Thứ 3</th></tr><tr><td>Lớp A</td><td>Sáng</td><td>1</td><td>Toán</td><td>Văn</td></tr></table>', { year: '2026', semester: '1', week: 'w' });
    expect(result).toMatchObject({ startDate: '2026-09-14', endDate: '2026-09-20' });
    expect(result.lessons.map((lesson) => lesson.date)).toEqual(['2026-09-14', '2026-09-15']);
  });

  it.each([
    '<h2>Từ ngày 15/09/2026 đến ngày 21/09/2026</h2>',
    '<h2>Từ ngày 14/09/2026 đến ngày 19/09/2026</h2>',
    '<h2>Từ ngày 31/09/2026 đến ngày 07/10/2026</h2>',
    '<h2>Từ ngày 14/09/2026 đến ngày 20/09/2026</h2><h2>Từ ngày 21/09/2026 đến ngày 27/09/2026</h2>',
    '',
  ])('does not infer dates from an invalid or missing result range: %s', (header) => {
    const result = parseTimetable(`${header}<table><tr><th>Lớp</th><th>Buổi</th><th>Tiết</th><th>Thứ 2</th></tr><tr><td>A</td><td>Sáng</td><td>1</td><td>Toán</td></tr></table>`, { year: 'y', semester: 's', week: 'w' });
    expect(result).not.toHaveProperty('startDate');
    expect(result.lessons[0]).not.toHaveProperty('date');
  });

  it('distinguishes a valid header-only empty schedule from changed markup', () => {
    const result = parseTimetable('<table><tr><th>Lớp</th><th>Buổi</th><th>Tiết</th><th>Thứ 2</th><th>Thứ 3</th></tr></table>', { year: '2025', semester: '2', week: '50' });
    expect(result).toMatchObject({ isEmpty: true, lessons: [] });
  });

  it('extracts only explicit week dates and keeps the selected parent context', () => {
    const options = parseTimetableOptions('<select id="year"><option value="2026">2026</option></select><select id="semester"><option value="1">1</option></select><select id="week"><option value="10">Tuần 10 (01/11/2026 - 07/11/2026)</option></select>', { year: '2026', semester: '1' });
    expect(options.weeks[0]).toMatchObject({ value: '10', parent: { year: '2026', semester: '1' }, startDate: '2026-11-01', endDate: '2026-11-07' });
  });
});
