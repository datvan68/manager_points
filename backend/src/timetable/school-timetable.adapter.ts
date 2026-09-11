import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieJar } from 'tough-cookie';
import { getTimetableConfig, SCHOOL_TIMETABLE_URL } from './timetable.config';
import { parseTimetable, parseTimetableOptions } from './timetable.parser';
import { TimetableFilters, TimetableOptions, TimetableResult, TimetableSourceError, TimetableSourcePage } from './timetable.types';

@Injectable()
export class SchoolTimetableAdapter {
  private readonly config;
  private readonly workflow = new Map<string, Promise<unknown>>();
  private readonly cache = new Map<string, { expiresAt: number; value: TimetableResult | TimetableOptions }>();

  constructor(configService: ConfigService) { this.config = getTimetableConfig(configService); }

  async getOptions(contextKey: string, filters: Partial<TimetableFilters> = {}): Promise<TimetableOptions> {
    const key = `options:${contextKey}:${JSON.stringify(filters)}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as TimetableOptions;
    return this.serialized(contextKey, async () => {
      const page = await this.login(filters as TimetableFilters);
      const value = parseTimetableOptions(page.html);
      this.putCache(key, value);
      return value;
    });
  }

  async getTimetable(contextKey: string, filters: TimetableFilters): Promise<TimetableResult> {
    const key = `result:${contextKey}:${JSON.stringify(filters)}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as TimetableResult;
    return this.serialized(contextKey, async () => {
      const page = await this.login(filters);
      const result = parseTimetable(page.html, filters);
      this.putCache(key, result);
      return result;
    });
  }

  private putCache(key: string, value: TimetableResult | TimetableOptions) {
    if (this.cache.size >= this.config.maxCacheEntries) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, { expiresAt: Date.now() + this.config.cacheTtlMs, value });
  }

  private async serialized<T>(contextKey: string, work: () => Promise<T>): Promise<T> {
    const previous = this.workflow.get(contextKey) || Promise.resolve();
    const next = previous.then(work, work);
    this.workflow.set(contextKey, next);
    try { return await next; } finally { if (this.workflow.get(contextKey) === next) this.workflow.delete(contextKey); }
  }

  private async login(filters?: TimetableFilters): Promise<TimetableSourcePage> {
    if (!this.config.username || !this.config.password) throw new TimetableSourceError('SOURCE_NOT_CONFIGURED', 'Nguồn thời khóa biểu chưa được cấu hình.');
    const jar = new CookieJar();
    const loginPage = await this.request(SCHOOL_TIMETABLE_URL, jar);
    if (this.isLoginPage(loginPage.html)) {
      const $ = require('cheerio').load(loginPage.html);
      const form = $('form').filter((_: number, el: any) => $(el).find('input[name="ctl00$cphMain1$MainLogin1$DemoLogin1$txtUserName"]').length).first();
      if (!form.length) throw new TimetableSourceError('SOURCE_MARKUP_CHANGED', 'Biểu mẫu đăng nhập nguồn đã thay đổi.');
      const body = new URLSearchParams();
      form.find('input').each((_: number, el: any) => { const name = $(el).attr('name'); if (name && $(el).attr('type') !== 'submit') body.set(name, $(el).attr('value') || ''); });
      body.set('ctl00$cphMain1$MainLogin1$DemoLogin1$txtUserName', this.config.username);
      body.set('ctl00$cphMain1$MainLogin1$DemoLogin1$txtPassword', this.config.password);
      body.set('ctl00$cphMain1$MainLogin1$DemoLogin1$btnLogin', 'Đăng nhập');
      const response = await this.request('./dang-nhap.html', jar, { method: 'POST', body, referer: loginPage.url });
      if (this.isLoginPage(response.html)) throw new TimetableSourceError('SOURCE_SESSION_EXPIRED', 'Không thể xác thực nguồn thời khóa biểu.');
    }
    let page = await this.request(SCHOOL_TIMETABLE_URL, jar);
    if (this.isLoginPage(page.html)) throw new TimetableSourceError('SOURCE_SESSION_EXPIRED', 'Phiên nguồn thời khóa biểu đã hết hạn.');
    if (filters) {
      for (const value of [filters.year, filters.semester, filters.faculty, filters.course].filter(Boolean)) page = await this.postback(page, jar, value as string);
      if (filters.week || filters.className) page = await this.submitSearch(page, jar, filters);
    }
    return page;
  }

  private async postback(page: TimetableSourcePage, jar: CookieJar, value: string): Promise<TimetableSourcePage> {
    const cheerio = require('cheerio');
    const $ = cheerio.load(page.html);
    const select = $('select').filter((_: number, el: any) => $(el).find(`option[value="${value.replace(/"/g, '\\"')}"]`).length).first();
    if (!select.length) throw new TimetableSourceError('SOURCE_INVALID_SELECTION', 'Bộ lọc thời khóa biểu không hợp lệ.');
    const form = select.closest('form');
    if (!form.length) throw new TimetableSourceError('SOURCE_MARKUP_CHANGED', 'Biểu mẫu thời khóa biểu đã thay đổi.');
    const body = new URLSearchParams();
    form.find('input').each((_: number, el: any) => { const name = $(el).attr('name'); if (name && $(el).attr('type') !== 'submit') body.set(name, $(el).attr('value') || ''); });
    body.set($(select).attr('name') || '', value);
    body.set('__EVENTTARGET', $(select).attr('name') || '');
    body.set('__EVENTARGUMENT', '');
    const action = $(form).attr('action') || page.url;
    const next = await this.request(action, jar, { method: 'POST', body, referer: page.url });
    if (this.isLoginPage(next.html)) throw new TimetableSourceError('SOURCE_SESSION_EXPIRED', 'Phiên nguồn thời khóa biểu đã hết hạn.');
    return next;
  }

  private async submitSearch(page: TimetableSourcePage, jar: CookieJar, filters: TimetableFilters): Promise<TimetableSourcePage> {
    const cheerio = require('cheerio');
    const $ = cheerio.load(page.html);
    const form = $('form').has('select').first();
    if (!form.length) throw new TimetableSourceError('SOURCE_MARKUP_CHANGED', 'Biểu mẫu thời khóa biểu đã thay đổi.');
    const body = new URLSearchParams();
    form.find('input').each((_: number, el: any) => { const name = $(el).attr('name'); if (name && $(el).attr('type') !== 'submit') body.set(name, $(el).attr('value') || ''); });
    const values = [filters.year, filters.semester, filters.week, filters.faculty, filters.course, filters.className].filter(Boolean) as string[];
    for (const value of values) {
      const select = form.find('select').filter((_: number, el: any) => $(el).find(`option[value="${value.replace(/"/g, '\\"')}"]`).length).first();
      if (!select.length || !$(select).attr('name')) throw new TimetableSourceError('SOURCE_INVALID_SELECTION', 'Bộ lọc thời khóa biểu không hợp lệ.');
      body.set($(select).attr('name'), value);
    }
    const submit = form.find('input[type="submit"],button[type="submit"]').filter((_: number, el: any) => /tìm|search|xem/i.test($(el).attr('value') || $(el).text())).first();
    if (submit.length && $(submit).attr('name')) body.set($(submit).attr('name'), $(submit).attr('value') || 'Tìm kiếm');
    const next = await this.request($(form).attr('action') || page.url, jar, { method: 'POST', body, referer: page.url });
    if (this.isLoginPage(next.html)) throw new TimetableSourceError('SOURCE_SESSION_EXPIRED', 'Phiên nguồn thời khóa biểu đã hết hạn.');
    return next;
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
