import { ConfigService } from '@nestjs/config';
import { CookieJar } from 'tough-cookie';
import { SchoolTimetableAdapter } from './school-timetable.adapter';

const filters = { year: '2025', semester: '1', week: '10' };
const optionsHtml = (version = 'one') => `ScheduleOfClass<form><input name="__VIEWSTATE" value="${version}"/><select name="year"><option value="2025">2025</option></select><select name="semester"><option value="1">Học kỳ 1</option></select><select name="week"><option value="10">10</option></select></form>`;
const resultHtml = `<table><tr><th>Lớp</th><th>Buổi</th><th>Tiết</th><th>Thứ 2</th></tr><tr><td>Lớp A</td><td>Sáng</td><td>1</td><td>Toán [MATH]</td></tr></table>`;
const response = (html: string, init: Partial<Response> = {}) => ({ ok: true, status: 200, headers: { get: () => '', getSetCookie: () => [] }, text: async () => html, ...init }) as Response;
const configured = () => ({ get: (key: string) => ({ TIMETABLE_SOURCE_USERNAME: 'user', TIMETABLE_SOURCE_PASSWORD: 'pass' } as Record<string, string>)[key] || '' }) as unknown as ConfigService;

describe('SchoolTimetableAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fails closed without source credentials and does not expose them', async () => {
    const adapter = new SchoolTimetableAdapter({ get: () => '' } as unknown as ConfigService);
    await expect(adapter.getOptions('viewer-1')).rejects.toMatchObject({ code: 'SOURCE_NOT_CONFIGURED' });
  });

  it('reproduces the cold login workflow once, coalesces identical misses, and caches the result', async () => {
    let release!: () => void;
    const deferred = new Promise<void>((resolve) => { release = resolve; });
    let firstGet = true;
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method !== 'POST') await deferred;
      if (init?.method !== 'POST' && firstGet) { firstGet = false; return response('<form><input name="ctl00$cphMain1$MainLogin1$DemoLogin1$txtUserName"/><input name="ctl00$cphMain1$MainLogin1$DemoLogin1$txtPassword"/></form>'); }
      if (init?.method !== 'POST') return response(optionsHtml());
      return response(optionsHtml());
    });
    const adapter = new SchoolTimetableAdapter(configured());
    const first = adapter.getOptions('viewer-1');
    const second = adapter.getOptions('viewer-1', {});
    release();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('dang-nhap'))).toHaveLength(1);
    await adapter.getOptions('viewer-1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reuses a requester session for a warm miss and keeps requesters isolated', async () => {
    let firstGet = true;
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method !== 'POST' && firstGet) { firstGet = false; return response('<form><input name="ctl00$cphMain1$MainLogin1$DemoLogin1$txtUserName"/><input name="ctl00$cphMain1$MainLogin1$DemoLogin1$txtPassword"/></form>'); }
      if (init?.method !== 'POST') return response(optionsHtml(String(fetchMock.mock.calls.length)));
      return response(optionsHtml());
    });
    const adapter = new SchoolTimetableAdapter(configured());
    await adapter.getOptions('viewer-1', { year: '2025' });
    await adapter.getOptions('viewer-1', { semester: '1' });
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('dang-nhap'))).toHaveLength(1);
    const callsAfterViewerOne = fetchMock.mock.calls.length;
    await adapter.getOptions('viewer-2', { year: '2025' });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterViewerOne);
  });

  it('removes failed in-flight work so the next request can succeed', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(response('<html>changed</html>')).mockResolvedValueOnce(response(optionsHtml()));
    const adapter = new SchoolTimetableAdapter(configured());
    await expect(adapter.getOptions('viewer-1')).rejects.toMatchObject({ code: 'SOURCE_MARKUP_CHANGED' });
    await expect(adapter.getOptions('viewer-1')).resolves.toMatchObject({ years: [{ value: '2025' }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reauthenticates once and replays the full lookup after expiry during a postback', async () => {
    let step = 0;
    const loginHtml = '<form><input name="ctl00$cphMain1$MainLogin1$DemoLogin1$txtUserName"/><input name="ctl00$cphMain1$MainLogin1$DemoLogin1$txtPassword"/></form>';
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const current = step++;
      if (current === 2 || current === 3) return response(loginHtml);
      return response(optionsHtml());
    });
    const adapter = new SchoolTimetableAdapter(configured());
    await adapter.getOptions('viewer-1');
    await adapter.getOptions('viewer-1', { year: '2025' });
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('dang-nhap'))).toHaveLength(1);
  });

  it('serializes different filter misses for one requester', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => {
      if (fetchMock.mock.calls.length === 1) await gate;
      return response(optionsHtml());
    });
    const adapter = new SchoolTimetableAdapter(configured());
    const first = adapter.getOptions('viewer-1', { year: '2025' });
    const second = adapter.getOptions('viewer-1', { semester: '1' });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('expires idle contexts, caps retained contexts, and keeps requester cookies separate', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const cookie = init?.headers && (init.headers as Record<string, string>).Cookie;
      const id = cookie?.match(/SID=([^;]+)/)?.[1] || String(fetchMock.mock.calls.length);
      return response(optionsHtml(id), { headers: { get: () => '', getSetCookie: () => cookie ? [] : [`SID=${id}`] } } as any);
    });
    const adapter = new SchoolTimetableAdapter(configured());
    await adapter.getOptions('viewer-1');
    await adapter.getOptions('viewer-2');
    const calls = fetchMock.mock.calls.filter(([input]) => String(input).includes('ScheduleOfClass'));
    expect((calls[0][1]?.headers as Record<string, string>).Cookie).toBeUndefined();
    expect((calls[1][1]?.headers as Record<string, string>).Cookie).toBeUndefined();
    expect((adapter as any).sessions.size).toBe(2);
    await adapter.getOptions('viewer-1', { year: '2025' });
    await adapter.getOptions('viewer-2', { year: '2025' });
    const warmGets = fetchMock.mock.calls.filter(([, init]) => init?.method === 'GET' && (init?.headers as Record<string, string>).Cookie);
    expect(warmGets).toHaveLength(2);
    expect((warmGets[0][1]?.headers as Record<string, string>).Cookie).not.toBe((warmGets[1][1]?.headers as Record<string, string>).Cookie);

    jest.useFakeTimers();
    jest.advanceTimersByTime(5 * 60_000 + 1);
    await adapter.getOptions('viewer-1', { year: '2025' });
    expect((adapter as any).sessions.size).toBe(1);
    jest.useRealTimers();

    (adapter as any).sessions.clear();
    for (let index = 0; index < 100; index += 1) (adapter as any).sessions.set(`viewer-${index}`, { jar: new CookieJar(), lastUsedAt: Date.now(), active: true });
    await adapter.getOptions('viewer-over-capacity', { year: '2025' });
    expect((adapter as any).sessions.size).toBe(100);
  });

  it('preserves populated result filters and does not share cached results across requesters', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => response(init?.method === 'POST' && String(init.body).includes('week=') ? resultHtml : optionsHtml()));
    const adapter = new SchoolTimetableAdapter(configured());
    const first = await adapter.getTimetable('viewer-1', filters);
    expect(first).toMatchObject({ filters, isEmpty: false });
    const callsAfterFirst = fetchMock.mock.calls.length;
    await adapter.getTimetable('viewer-1', filters);
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirst);
    await adapter.getTimetable('viewer-2', filters);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });
});
