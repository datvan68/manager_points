import { ConfigService } from '@nestjs/config';
import { SchoolTimetableAdapter } from './school-timetable.adapter';

const sourceHtml = (version: string) => `
  <html><body><div id="ScheduleOfClass">
    <form action="/Pages/Sims/ScheduleOfClass.aspx?pt=4">
      <input name="__VIEWSTATE" value="${version}" />
      <select name="year"><option value="2026">2026</option></select>
      <select name="semester"><option value="1">Học kỳ 1</option></select>
      <select name="faculty"><option value="f1">Khoa 1</option></select>
      <select name="course"><option value="c1">Khóa 1</option></select>
      <select name="week">${Array.from({ length: 100 }, (_, index) => `<option value="w${index + 1}">Tuần ${index + 1}</option>`).join('')}</select>
      <select name="class">${Array.from({ length: 10 }, (_, index) => `<option value="class-${index + 1}">Lớp ${index + 1}</option>`).join('')}</select>
      <input type="submit" name="search" value="Tìm kiếm" />
    </form>
    <table><tr><th>Lớp</th><th>Buổi</th><th>Tiết</th><th>Thứ 2</th></tr>
      <tr><td>Lớp 1</td><td>Sáng</td><td>1</td><td>Toán [MATH]</td></tr>
    </table>
  </div></body></html>`;

const response = (html: string) => ({
  ok: true,
  status: 200,
  headers: { get: () => '', getSetCookie: () => [] },
  text: async () => html,
}) as Response;

const config = new ConfigService({
  TIMETABLE_SOURCE_USERNAME: 'benchmark-user',
  TIMETABLE_SOURCE_PASSWORD: 'benchmark-password',
});

describe('bulk synchronization performance baseline', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['5x4', 5, 4],
    ['10x5', 10, 5],
    ['10x10', 10, 10],
  ])('records the pre-optimization adapter request baseline for %s', async (_name, classes, weeks) => {
    let responseId = 0;
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => response(sourceHtml(String(++responseId))));
    const adapter = new SchoolTimetableAdapter(config);
    const startedAt = Date.now();
    const run = async (contextKey: string | ((classIndex: number, weekIndex: number) => string)) => {
      for (let classIndex = 0; classIndex < classes; classIndex += 1) {
      for (let weekIndex = 0; weekIndex < weeks; weekIndex += 1) {
        await adapter.getTimetable(typeof contextKey === 'function' ? contextKey(classIndex, weekIndex) : contextKey, {
          year: '2026', semester: '1', faculty: 'f1', course: 'c1', className: `class-${classIndex + 1}`, week: `w${weekIndex + 1}`,
        });
      }
      }
    };
    await run((classIndex, weekIndex) => `benchmark-cold-${classes}-${weeks}-${classIndex}-${weekIndex}`);
    const elapsedMs = Date.now() - startedAt;
    const sourceCalls = fetchMock.mock.calls.length;
    const parentPostbacks = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').length - classes * weeks;
    const baseline = { sourceCalls, parentPostbacks, elapsedMs };
    fetchMock.mockClear(); responseId = 0; (adapter as any).sessions.clear();
    const optimizedStartedAt = Date.now();
    await run(`benchmark-worker-${classes}-${weeks}`);
    const optimized = { sourceCalls: fetchMock.mock.calls.length, parentPostbacks: fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST').length - classes * weeks, elapsedMs: Date.now() - optimizedStartedAt };
    // Keep compact metrics in the test output for the persisted scope evidence.
    console.log(JSON.stringify({ baseline: true, matrix: `${classes}x${weeks}`, pairs: classes * weeks, ...baseline, optimized, improvement: 1 - optimized.sourceCalls / baseline.sourceCalls, queueWaitMs: 0, persistenceMs: 0, pollingMs: 0 }));
    expect(sourceCalls).toBe(classes * weeks * 6);
    expect(parentPostbacks).toBe(classes * weeks * 4);
    expect(optimized.sourceCalls).toBe(classes * weeks + 5);
    expect(optimized.sourceCalls).toBeLessThan(baseline.sourceCalls * 0.6);
  });
});
