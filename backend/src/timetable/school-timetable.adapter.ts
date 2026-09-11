import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { getTimetableConfig, SCHOOL_TIMETABLE_URL } from './timetable.config';
import { parseTimetable, parseTimetableOptions } from './timetable.parser';
import { TimetableFilters, TimetableOptions, TimetableResult, TimetableSourceError, TimetableSourcePage } from './timetable.types';

type CacheEntry = { expiresAt: number; value: TimetableResult | TimetableOptions };
type SessionContext = { jar: CookieJar; lastUsedAt: number; active: boolean };
type AcquiredSession = { jar: CookieJar; context?: SessionContext };

@Injectable()
export class SchoolTimetableAdapter {
  private readonly config;
  private readonly workflow = new Map<string, Promise<unknown>>();
  private readonly inFlight = new Map<string, Promise<TimetableResult | TimetableOptions>>();
  private readonly cache = new Map<string, CacheEntry>();
  private readonly sessions = new Map<string, SessionContext>();

  constructor(configService: ConfigService) { this.config = getTimetableConfig(configService); }

  async getOptions(contextKey: string, filters: Partial<TimetableFilters> = {}): Promise<TimetableOptions> {
    const key = `options:${contextKey}:${this.filterKey(filters)}`;
    if (this.getCached(key)) return this.getCached(key) as TimetableOptions;
    return this.coalesced(contextKey, key, async () => {
      const cached = this.getCached(key);
      if (cached) return cached as TimetableOptions;
      const value = await this.lookup(contextKey, filters, (page) => parseTimetableOptions(page.html));
      this.putCache(key, value);
      return value;
    }) as Promise<TimetableOptions>;
  }

  async getTimetable(contextKey: string, filters: TimetableFilters): Promise<TimetableResult> {
    const key = `result:${contextKey}:${this.filterKey(filters)}`;
    if (this.getCached(key)) return this.getCached(key) as TimetableResult;
    return this.coalesced(contextKey, key, async () => {
      const cached = this.getCached(key);
      if (cached) return cached as TimetableResult;
      const value = await this.lookup(contextKey, filters, (page) => parseTimetable(page.html, filters));
      this.putCache(key, value);
      return value;
    }) as Promise<TimetableResult>;
  }

  private filterKey(filters: Partial<TimetableFilters>): string {
    return JSON.stringify(['year', 'semester', 'week', 'faculty', 'course', 'className'].map((field) => [field, filters[field as keyof TimetableFilters] || '']));
  }

  private getCached(key: string): TimetableResult | TimetableOptions | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;
    if (cached.expiresAt <= Date.now()) { this.cache.delete(key); return undefined; }
    return cached.value;
  }

  private putCache(key: string, value: TimetableResult | TimetableOptions) {
    if (this.cache.size >= this.config.maxCacheEntries) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, { expiresAt: Date.now() + this.config.cacheTtlMs, value });
  }

  private coalesced<T extends TimetableResult | TimetableOptions>(contextKey: string, key: string, work: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing as Promise<T>;
    const next = this.serialized(contextKey, work);
    this.inFlight.set(key, next as Promise<TimetableResult | TimetableOptions>);
    next.finally(() => { if (this.inFlight.get(key) === next) this.inFlight.delete(key); }).catch(() => undefined);
    return next;
  }

  private async serialized<T>(contextKey: string, work: () => Promise<T>): Promise<T> {
    const previous = this.workflow.get(contextKey) || Promise.resolve();
    const next = previous.then(work, work);
    this.workflow.set(contextKey, next);
    try { return await next; } finally { if (this.workflow.get(contextKey) === next) this.workflow.delete(contextKey); }
  }

  private async lookup<T>(contextKey: string, filters: Partial<TimetableFilters>, parse: (page: TimetableSourcePage) => T): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const session = this.acquireSession(contextKey);
      try { return parse(await this.loadFreshPage(session.jar, filters)); }
      catch (error) {
        if (error instanceof TimetableSourceError && error.code === 'SOURCE_SESSION_EXPIRED' && attempt === 0) { this.invalidateSession(contextKey, session); continue; }
        throw error;
      } finally { this.releaseSession(contextKey, session); }
    }
    throw new TimetableSourceError('SOURCE_SESSION_EXPIRED', 'Phiên nguồn thời khóa biểu đã hết hạn.');
  }

  private acquireSession(contextKey: string): AcquiredSession {
    const now = Date.now();
    const current = this.sessions.get(contextKey);
    if (current && !current.active && current.lastUsedAt + this.config.sessionIdleTtlMs <= now) this.sessions.delete(contextKey);
    const existing = this.sessions.get(contextKey);
    if (existing) { existing.active = true; existing.lastUsedAt = now; return { jar: existing.jar, context: existing }; }
    for (const [key, session] of this.sessions) if (!session.active && session.lastUsedAt + this.config.sessionIdleTtlMs <= now) this.sessions.delete(key);
    if (this.sessions.size < this.config.maxSessionContexts) {
      const context = { jar: new CookieJar(), lastUsedAt: now, active: true };
      this.sessions.set(contextKey, context);
      return { jar: context.jar, context };
    }
    return { jar: new CookieJar() };
  }

  private releaseSession(contextKey: string, session: AcquiredSession) {
    if (!session.context || this.sessions.get(contextKey) !== session.context) return;
    session.context.active = false;
    session.context.lastUsedAt = Date.now();
  }

  private invalidateSession(contextKey: string, session: AcquiredSession) {
    if (session.context && this.sessions.get(contextKey) === session.context) this.sessions.delete(contextKey);
  }

  private async loadFreshPage(jar: CookieJar, filters: Partial<TimetableFilters>): Promise<TimetableSourcePage> {
    if (!this.config.username || !this.config.password) throw new TimetableSourceError('SOURCE_NOT_CONFIGURED', 'Nguồn thời khóa biểu chưa được cấu hình.');
    let page = await this.request(SCHOOL_TIMETABLE_URL, jar);
    if (this.isLoginPage(page.html)) {
      const $ = cheerio.load(page.html);
      const form = $('form').filter((_: number, el: any) => $(el).find('input[name="ctl00$cphMain1$MainLogin1$DemoLogin1$txtUserName"]').length > 0).first();
      if (!form.length) throw new TimetableSourceError('SOURCE_MARKUP_CHANGED', 'Biểu mẫu đăng nhập nguồn đã thay đổi.');
      const body = this.formBody($, form);
      body.set('ctl00$cphMain1$MainLogin1$DemoLogin1$txtUserName', this.config.username);
      body.set('ctl00$cphMain1$MainLogin1$DemoLogin1$txtPassword', this.config.password);
      body.set('ctl00$cphMain1$MainLogin1$DemoLogin1$btnLogin', 'Đăng nhập');
      const response = await this.request('./dang-nhap.html', jar, { method: 'POST', body, referer: page.url });
      if (this.isLoginPage(response.html)) throw new TimetableSourceError('SOURCE_SESSION_EXPIRED', 'Không thể xác thực nguồn thời khóa biểu.');
      page = await this.request(SCHOOL_TIMETABLE_URL, jar);
    }
    if (this.isLoginPage(page.html)) throw new TimetableSourceError('SOURCE_SESSION_EXPIRED', 'Phiên nguồn thời khóa biểu đã hết hạn.');
    for (const [field, value] of [['year', filters.year], ['semester', filters.semester], ['faculty', filters.faculty], ['course', filters.course] as const].filter(([, value]) => Boolean(value)) as [keyof TimetableFilters, string][]) page = await this.postback(page, jar, value, field);
    if (filters.week || filters.className) page = await this.submitSearch(page, jar, filters as TimetableFilters);
    return page;
  }

  private formBody($: cheerio.CheerioAPI, form: cheerio.Cheerio<any>): URLSearchParams {
    const body = new URLSearchParams();
    form.find('input').each((_: number, el: any) => { const name = $(el).attr('name'); if (name && $(el).attr('type') !== 'submit') body.set(name, $(el).attr('value') || ''); });
    return body;
  }

  private async postback(page: TimetableSourcePage, jar: CookieJar, value: string, field: keyof TimetableFilters): Promise<TimetableSourcePage> {
    const $ = cheerio.load(page.html);
    const select = this.selectForFilter($, $('select'), value, field);
    if (!select.length) throw new TimetableSourceError('SOURCE_INVALID_SELECTION', 'Bộ lọc thời khóa biểu không hợp lệ.');
    const form = select.closest('form');
    if (!form.length) throw new TimetableSourceError('SOURCE_MARKUP_CHANGED', 'Biểu mẫu thời khóa biểu đã thay đổi.');
    const body = this.formBody($, form);
    body.set($(select).attr('name') || '', value);
    body.set('__EVENTTARGET', $(select).attr('name') || '');
    body.set('__EVENTARGUMENT', '');
    const next = await this.request($(form).attr('action') || page.url, jar, { method: 'POST', body, referer: page.url });
    if (this.isLoginPage(next.html)) throw new TimetableSourceError('SOURCE_SESSION_EXPIRED', 'Phiên nguồn thời khóa biểu đã hết hạn.');
    return next;
  }

  private async submitSearch(page: TimetableSourcePage, jar: CookieJar, filters: TimetableFilters): Promise<TimetableSourcePage> {
    const $ = cheerio.load(page.html);
    const form = $('form').has('select').first();
    if (!form.length) throw new TimetableSourceError('SOURCE_MARKUP_CHANGED', 'Biểu mẫu thời khóa biểu đã thay đổi.');
    const body = this.formBody($, form);
    for (const [field, value] of [['year', filters.year], ['semester', filters.semester], ['week', filters.week], ['faculty', filters.faculty], ['course', filters.course], ['className', filters.className] as const].filter(([, value]) => Boolean(value)) as [keyof TimetableFilters, string][]) {
      const select = this.selectForFilter($, form.find('select'), value, field);
      if (!select.length || !$(select).attr('name')) throw new TimetableSourceError('SOURCE_INVALID_SELECTION', 'Bộ lọc thời khóa biểu không hợp lệ.');
      body.set($(select).attr('name') as string, value);
    }
    const submit = form.find('input[type="submit"],button[type="submit"]').filter((_: number, el: any) => /tìm|search|xem/i.test($(el).attr('value') || $(el).text())).first();
    if (submit.length && $(submit).attr('name')) body.set($(submit).attr('name') as string, $(submit).attr('value') || 'Tìm kiếm');
    const next = await this.request($(form).attr('action') || page.url, jar, { method: 'POST', body, referer: page.url });
    if (this.isLoginPage(next.html)) throw new TimetableSourceError('SOURCE_SESSION_EXPIRED', 'Phiên nguồn thời khóa biểu đã hết hạn.');
    return next;
  }

  private selectForFilter($: cheerio.CheerioAPI, selects: cheerio.Cheerio<any>, value: string, field: keyof TimetableFilters): cheerio.Cheerio<any> {
    const aliases: Record<keyof TimetableFilters, string[]> = { year: ['year'], semester: ['semester'], week: ['week'], faculty: ['faculty', 'science'], course: ['course'], className: ['class'] };
    const matches = selects.filter((_: number, el: any) => {
      const identity = `${$(el).attr('id') || ''} ${$(el).attr('name') || ''}`.toLowerCase();
      return aliases[field].some((alias) => identity.includes(alias)) && $(el).find('option').toArray().some((option: any) => $(option).attr('value') === value);
    }).first();
    if (matches.length) return matches;
    return selects.filter((_: number, el: any) => $(el).find('option').toArray().some((option: any) => $(option).attr('value') === value)).first();
  }

  private isLoginPage(html: string) { return html.includes('ctl00$cphMain1$MainLogin1$DemoLogin1$txtPassword') || /đăng nhập|dang-nhap/i.test(html) && !html.includes('ScheduleOfClass'); }

  private async request(input: string, jar: CookieJar, options: { method?: string; body?: URLSearchParams; referer?: string; redirects?: number } = {}): Promise<TimetableSourcePage> {
    const url = new URL(input, options.referer || SCHOOL_TIMETABLE_URL);
    if (url.origin !== this.config.origin) throw new TimetableSourceError('SOURCE_UNAVAILABLE', 'Nguồn thời khóa biểu chuyển hướng ngoài miền cho phép.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const cookie = await jar.getCookieString(url.href);
      const response = await fetch(url, { method: options.method || 'GET', redirect: 'manual', signal: controller.signal, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(options.referer ? { Referer: options.referer } : {}), ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) }, body: options.body });
      const setCookies = typeof (response.headers as any).getSetCookie === 'function' ? (response.headers as any).getSetCookie() : (response.headers.get('set-cookie') || '').split(/,(?=[^;]+?=)/).filter(Boolean);
      for (const value of setCookies) await jar.setCookie(value, url.href);
      if (response.status >= 300 && response.status < 400) {
        if ((options.redirects || 0) >= 3) throw new TimetableSourceError('SOURCE_UNAVAILABLE', 'Nguồn thời khóa biểu chuyển hướng quá nhiều lần.');
        const location = response.headers.get('location');
        if (!location) throw new TimetableSourceError('SOURCE_UNAVAILABLE', 'Nguồn thời khóa biểu trả về chuyển hướng không hợp lệ.');
        return this.request(location, jar, { referer: url.href, redirects: (options.redirects || 0) + 1 });
      }
      if (!response.ok) throw new TimetableSourceError('SOURCE_UNAVAILABLE', `Nguồn thời khóa biểu trả về HTTP ${response.status}.`);
      return { html: await response.text(), url: url.href };
    } catch (error: any) {
      if (error instanceof TimetableSourceError) throw error;
      if (error?.name === 'AbortError') throw new TimetableSourceError('SOURCE_TIMEOUT', 'Nguồn thời khóa biểu phản hồi quá lâu.');
      throw new TimetableSourceError('SOURCE_UNAVAILABLE', 'Không thể kết nối nguồn thời khóa biểu.');
    } finally { clearTimeout(timer); }
  }
}
