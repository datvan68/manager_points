import { ConflictException, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SchoolTimetableAdapter } from './school-timetable.adapter';
import { TimetableCoverageDto, TimetableSettingsDto, StartTimetableSyncDto, SavedTimetableClassSyncDto, SavedTimetableWeekSyncDto } from './dto/sync-timetable.dto';
import { TimetableSnapshot, TimetableSnapshotDocument } from './timetable-snapshot.schema';
import { TimetableSyncState, TimetableSyncStateDocument } from './timetable-sync-state.schema';
import { getTimetableConfig, TimetableConfig } from './timetable.config';
import { TimetableClassSelection, TimetableFilters, TimetableSourceError, TimetableWeekDate, TimetableClassSyncStatus } from './timetable.types';
import { timetableFields, timetableKey } from './timetable-selection';

const STATE = 'default';
const LEASE_MS = 60_000;
type QueueKind = 'demand' | 'scheduled';
type QueueItem = { key: string; selection: TimetableFilters; kind: QueueKind; requestedAt: string; force?: boolean };
type Failure = { coverage: TimetableFilters; reason: string };
const coverageKey = (coverage: Partial<TimetableFilters>) => timetableFields.map((field) => coverage[field] || '').join(':');
const transient = new Set(['SOURCE_TIMEOUT', 'SOURCE_UNAVAILABLE']);

@Injectable()
export class TimetableSyncService {
  private readonly logger = new Logger(TimetableSyncService.name);
  private readonly config: TimetableConfig;
  private draining = false;
  private drainPromise?: Promise<void>;

  constructor(
    private readonly adapter: SchoolTimetableAdapter,
    @InjectModel(TimetableSnapshot.name) private readonly snapshots: Model<TimetableSnapshotDocument>,
    @InjectModel(TimetableSyncState.name) private readonly states: Model<TimetableSyncStateDocument>,
    @Optional() configService?: ConfigService,
  ) { this.config = getTimetableConfig(configService || ({ get: () => undefined } as any)); }

  private assertAdmin(user: any) { if (String(user?.roleCode || '').toUpperCase() !== 'ADMIN') throw new ConflictException('Chỉ quản trị viên mới được đồng bộ thời khóa biểu.'); }

  private async state() {
    return this.states.findOneAndUpdate({ name: STATE }, { $setOnInsert: { name: STATE, settings: { enabled: false, intervalMinutes: 60, coverage: [], selectedClasses: [], rolling: { enabled: false, weekDates: [] } }, queue: [], statuses: [], coordinator: { demandStreak: 0 } } }, { upsert: true, new: true }).lean().exec();
  }
  private async readOnlyState() {
    const query = (this.states as any).findOne?.({ name: STATE });
    return query ? query.lean().exec() : this.state();
  }

  async getCatalog(user: any) {
    this.assertAdmin(user); const state = await this.state();
    if (!state.catalog) throw new NotFoundException({ reasonCode: 'TIMETABLE_CATALOG_NOT_SYNCED', message: 'Chưa tải danh mục nguồn.' });
    return state.catalog;
  }

  async loadCatalog(user: any, filters: Partial<TimetableFilters> = {}) {
    this.assertAdmin(user); const catalog = await this.adapter.getOptions(`sync-catalog:${String(user.userId)}`, filters); await this.state();
    const fields = ['years', 'semesters', 'weeks', 'faculties', 'courses', 'classes'] as const;
    const context = { filters, weeks: catalog.weeks };
    await this.states.updateOne({ name: STATE }, [{ $set: { catalog: Object.fromEntries(fields.map((field) => [field, { $setUnion: [{ $ifNull: [`$catalog.${field}`, []] }, { $literal: catalog[field] }] }])) as Record<string, any>, catalogContexts: { $setUnion: [{ $ifNull: ['$catalogContexts', []] }, { $literal: [context] }] } } }], { updatePipeline: true }).exec();
    return catalog;
  }

  private async recoverInterrupted() {
    const now = new Date();
    await this.states.updateOne({ name: STATE, 'job.status': 'running', $or: [{ 'lease.expiresAt': { $lte: now } }, { lease: null, 'job.startedAt': { $lte: new Date(now.getTime() - LEASE_MS) } }, { lease: null, 'job.startedAt': { $exists: false } }] }, [{ $set: { 'job.status': 'failed', 'job.error': 'SYNC_INTERRUPTED', 'job.finishedAt': now, queue: { $let: { vars: { existing: { $ifNull: ['$queue', []] }, keys: { $map: { input: { $ifNull: ['$queue', []] }, as: 'queued', in: '$$queued.key' } } }, in: { $cond: [{ $and: [{ $ne: ['$job.selection', null] }, { $not: { $in: ['$job.selection.key', '$$keys'] } }] }, { $concatArrays: [['$job.selection'], '$$existing'] }, '$$existing'] } } } } }, { $unset: 'lease' }], { updatePipeline: true }).exec();
    await this.drainQueue();
  }

  async start(user: any, dto: StartTimetableSyncDto) {
    this.assertAdmin(user); const coverage = this.validateCoverage(dto.coverage); await this.state(); await this.recoverInterrupted();
    const id = randomUUID(); const owner = `${id}:${randomUUID()}`; const now = new Date();
    const claimed = await this.states.findOneAndUpdate({ name: STATE, 'job.status': { $ne: 'running' }, $or: [{ lease: null }, { 'lease.expiresAt': { $lte: now } }] }, { $set: { job: { id, status: 'running', startedAt: now, operatorId: String(user.userId), total: coverage.length, completed: 0, failures: [], coverage }, lease: { owner, expiresAt: new Date(now.getTime() + LEASE_MS), epoch: now.getTime() } } }, { new: true }).lean().exec();
    if (!claimed) throw new ConflictException('Đã có một tiến trình đồng bộ đang chạy.');
    void this.run(id, owner, coverage).catch(() => this.logger.error('Timetable synchronization failed; recovery will follow lease expiry.'));
    return { id, status: 'running', total: coverage.length };
  }

  async getStatus(user: any) {
    this.assertAdmin(user); await this.recoverInterrupted(); const [state, latest] = await Promise.all([this.state(), this.snapshots.findOne().sort({ syncedAt: -1 }).lean().exec()]);
    return { job: state.job, settings: state.settings, lastSuccessfulUpdate: latest?.syncedAt || null, queue: state.queue || [], classStatuses: await this.classStatuses(state) };
  }
  async getSettings(user: any) { this.assertAdmin(user); return (await this.state()).settings; }

  async updateSettings(user: any, dto: TimetableSettingsDto) {
    this.assertAdmin(user); const coverage = this.validateCoverage(dto.coverage || [], true); const selectedClasses = this.validateSelectedClasses(dto.selectedClasses || []); const rolling = this.validateRolling(dto.rolling || { enabled: false, weekDates: [] });
    if (!coverage.length && !selectedClasses.length) throw new ConflictException('Cần chọn ít nhất một lớp hoặc phạm vi đồng bộ.');
    await this.states.updateOne({ name: STATE }, { $set: { settings: { enabled: dto.enabled, intervalMinutes: dto.intervalMinutes, coverage, selectedClasses, rolling } } }, { upsert: true }).exec(); return (await this.state()).settings;
  }

  private validateCoverage(coverage: TimetableCoverageDto[] = [], allowEmpty = false) {
    if ((!allowEmpty && !coverage.length) || coverage.length > this.config.queueLimit || coverage.some((item) => !item.year || !item.semester || !item.week)) throw new ConflictException('Phạm vi đồng bộ không hợp lệ.');
    return [...new Map(coverage.map((item) => [timetableKey(item), { ...item }])).values()];
  }
  private validateSelectedClasses(items: Array<Partial<TimetableClassSelection>>) {
    if (items.length > this.config.queueLimit || items.some((item) => !item.year || !item.semester || !item.className)) throw new ConflictException('Danh sách lớp đã chọn không hợp lệ.');
    if (items.some((item) => item.weekCount !== undefined && (!Number.isInteger(item.weekCount) || item.weekCount < 1 || item.weekCount > 100))) throw new ConflictException('Số tuần của lớp phải là số nguyên từ 1 đến 100.');
    const keys = items.map((item) => JSON.stringify([item.year, item.semester, item.faculty || '', item.course || '', item.className]));
    if (new Set(keys).size !== keys.length) throw new ConflictException('Không được cấu hình trùng lớp trong cùng ngữ cảnh.');
    return items.map((item) => ({ year: item.year!, semester: item.semester!, faculty: item.faculty || '', course: item.course || '', className: item.className!, weekCount: Number.isInteger(item.weekCount) ? item.weekCount : 1 }));
  }
  private validateRolling(value: { enabled: boolean; weekDates?: TimetableWeekDate[] }) {
    const weekDates = value.weekDates || [];
    if (weekDates.length > this.config.queueLimit || weekDates.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(item.endDate) || item.startDate > item.endDate)) throw new ConflictException('Bản đồ tuần/ngày không hợp lệ.');
    return { enabled: Boolean(value.enabled), weekDates };
  }
  private owned(id: string, owner: string) { return { name: STATE, 'job.id': id, 'job.status': 'running', 'lease.owner': owner, 'lease.expiresAt': { $gt: new Date() } }; }

  private async fetchWithRetry(selection: TimetableFilters): Promise<any> {
    let last: unknown; const deadline = Date.now() + this.config.overallDeadlineMs; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.config.overallDeadlineMs);
    try {
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
        const remaining = deadline - Date.now(); if (remaining <= 0 || controller.signal.aborted) throw new TimetableSourceError('SOURCE_TIMEOUT', 'Nguồn thời khóa biểu phản hồi quá lâu.');
        try { return await this.adapter.getTimetable(`sync-demand:${timetableKey(selection)}`, selection, controller.signal); }
        catch (error) {
          last = error; if (!(error instanceof TimetableSourceError) || !transient.has(error.code) || attempt >= this.config.maxRetries) throw error;
          const backoff = Math.min(100 * 2 ** attempt, Math.max(0, deadline - Date.now()));
          if (backoff) await new Promise((resolve, reject) => { const wake = setTimeout(() => { controller.signal.removeEventListener('abort', abort); resolve(undefined); }, backoff); const abort = () => { clearTimeout(wake); reject(new TimetableSourceError('SOURCE_TIMEOUT', 'Nguồn thời khóa biểu phản hồi quá lâu.')); }; controller.signal.addEventListener('abort', abort, { once: true }); });
        }
      }
      throw last;
    } finally { clearTimeout(timer); }
  }
  private statusEntry(item: QueueItem, status: string, extra: Record<string, any> = {}) { return { key: item.key, selection: item.selection, kind: item.kind, status, updatedAt: new Date(), ...extra }; }
  private async requeueLeaseLost(item: QueueItem, id: string, owner: string) {
    const existingKeys = { $map: { input: { $ifNull: ['$queue', []] }, as: 'queued', in: '$$queued.key' } };
    const queue = { $let: { vars: { existing: { $ifNull: ['$queue', []] } }, in: { $cond: [{ $in: [item.key, existingKeys] }, { $slice: ['$$existing', this.config.queueLimit] }, { $slice: [{ $concatArrays: [[{ $literal: item }], '$$existing'] }, this.config.queueLimit] }] } } };
    const statuses = { $slice: [{ $concatArrays: [{ $ifNull: ['$statuses', []] }, { $literal: [this.statusEntry(item, 'pending', { recovery: true })] }] }, -this.config.statusRetention] };
    await this.states.updateOne({ name: STATE, 'job.id': id, 'lease.owner': owner }, [{ $set: { 'job.status': 'failed', 'job.error': 'LEASE_LOST', 'job.finishedAt': new Date(), queue, statuses } }, { $unset: 'lease' }], { updatePipeline: true }).exec();
  }

  async enqueueDemand(_user: any, selection: TimetableFilters, force = false) {
    const state = await this.ensureDemandScope(selection);
    return this.enqueue([selection], 'demand', force, state);
  }
  async ensureDemandScope(selection: TimetableFilters) {
    const state = await this.state(); if (!this.isSelectedScope(state.settings || {}, selection, state.catalog)) throw new NotFoundException({ reasonCode: 'TIMETABLE_SCOPE_NOT_ALLOWED', message: 'Lớp hoặc tuần này chưa được quản trị viên cho phép.' }); return state;
  }
  async refresh(user: any, selection: TimetableFilters) { return this.enqueueDemand(user, selection, true); }
  async getDemandStatus(_user: any, selection: TimetableFilters) {
    const state = await this.state(); if (!this.isSelectedScope(state.settings || {}, selection, state.catalog)) throw new NotFoundException({ reasonCode: 'TIMETABLE_SCOPE_NOT_ALLOWED', message: 'Lớp hoặc tuần này chưa được quản trị viên cho phép.' });
    const key = timetableKey(selection); if (state.job?.selection?.key === key && state.job.status === 'running') return { status: 'running', key, selection };
    const queued = (state.queue || []).find((item: QueueItem) => item.key === key); if (queued) return { status: 'pending', key, selection };
    const terminal = [...(state.statuses || [])].reverse().find((item: any) => item.key === key); return terminal || { status: 'missing', key, selection };
  }
  private isSelectedScope(settings: any, selection: TimetableFilters, catalog: any) {
    const selected = (settings.selectedClasses || []) as TimetableClassSelection[];
    const selectedClass = selected.some((item) => item.year === selection.year && item.semester === selection.semester && item.className === selection.className && (!item.faculty || item.faculty === (selection.faculty || '')) && (!item.course || item.course === (selection.course || '')));
    const catalogWeeks = (catalog?.weeks || []).some((item: any) => item.value === selection.week && item.parent?.year === selection.year && item.parent?.semester === selection.semester && Object.entries(item.parent).every(([field, value]) => (selection as any)[field] === value));
    const mappedWeeks = (settings.rolling?.weekDates || []).some((item: TimetableWeekDate) => item.year === selection.year && item.semester === selection.semester && item.week === selection.week);
    const legacy = (settings.coverage || []).some((item: TimetableFilters) => timetableKey(item) === timetableKey(selection)); return Boolean(selection.className && selectedClass && (catalogWeeks || mappedWeeks)) || legacy;
  }

  private classIdentity(item: TimetableClassSelection) { return JSON.stringify([item.year, item.semester, item.faculty || '', item.course || '', item.className]); }
  private weekOptions(state: any, item: TimetableClassSelection) {
    const catalogWeeks = (state.catalog?.weeks || []) as Array<Record<string, any>>;
    const rollingWeeks = (state.settings?.rolling?.weekDates || []) as TimetableWeekDate[];
    const matches = (week: any) => week.value && week.year === item.year && week.semester === item.semester;
    const options = [
      ...catalogWeeks.filter((week) => matches({ ...week, year: week.parent?.year, semester: week.parent?.semester }) && week.parent && Object.entries(week.parent).every(([field, value]) => (item as any)[field] === value)),
      ...rollingWeeks.filter((week) => week.year === item.year && week.semester === item.semester),
    ];
    return [...new Map(options.map((week: any) => [week.value || week.week, { value: week.value || week.week, label: week.label || week.value || week.week, ...(week.startDate && week.endDate ? { startDate: week.startDate, endDate: week.endDate } : {}) }])).values()];
  }
  private savedClass(state: any, dto: TimetableClassSelection) {
    return ((state.settings?.selectedClasses || []) as TimetableClassSelection[]).find((item) => this.classIdentity(item) === this.classIdentity(dto));
  }
  private manualSelection(state: any, dto: SavedTimetableWeekSyncDto) {
    const saved = this.savedClass(state, dto);
    if (!saved) throw new NotFoundException({ reasonCode: 'TIMETABLE_CLASS_NOT_CONFIGURED', message: 'Lớp chưa được lưu cấu hình đồng bộ.' });
    const option = this.weekOptions(state, saved).find((item: any) => item.value === dto.week);
    if (!option) throw new NotFoundException({ reasonCode: 'TIMETABLE_WEEK_NOT_ALLOWED', message: 'Tuần không thuộc đúng ngữ cảnh lớp đã lưu.' });
    return { ...saved, week: dto.week } as TimetableFilters;
  }
  private todayInHoChiMinh() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}`;
  }
  private resolveClassCoverage(settings: any, item: TimetableClassSelection): TimetableFilters[] {
    const weekCount = Number.isInteger(item.weekCount) ? item.weekCount! : 1;
    const all = (settings.rolling?.weekDates || []) as TimetableWeekDate[];
    const context = all.filter((week) => week.year === item.year && week.semester === item.semester).sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (!settings.rolling?.enabled) throw new ConflictException({ reasonCode: 'TIMETABLE_CLASS_RANGE_NOT_CONFIGURED', message: `Lớp ${item.className} chưa có cấu hình tuần lưu.` });
    if (new Set(context.map((week) => week.week)).size !== context.length || context.some((week, index) => index > 0 && week.startDate <= context[index - 1].endDate)) throw new ConflictException({ reasonCode: 'TIMETABLE_WEEK_MAP_INVALID', message: `Bản đồ tuần của lớp ${item.className} bị trùng hoặc chồng lấn.` });
    const today = this.todayInHoChiMinh();
    const current = context.findIndex((week) => week.startDate <= today && week.endDate >= today);
    if (current < 0) throw new ConflictException({ reasonCode: 'TIMETABLE_CURRENT_WEEK_UNRESOLVED', message: `Không xác định được tuần hiện tại cho lớp ${item.className}.` });
    const target = context.slice(current + 1, current + 1 + weekCount);
    if (target.length !== weekCount) throw new ConflictException({ reasonCode: 'TIMETABLE_WEEK_MAP_INSUFFICIENT', message: `Bản đồ tuần của lớp ${item.className} không đủ ${weekCount} tuần kế tiếp.` });
    return target.map((week) => ({ year: item.year, semester: item.semester, week: week.week, faculty: item.faculty || '', course: item.course || '', className: item.className }));
  }
  private async classStatuses(state: any): Promise<TimetableClassSyncStatus[]> {
    const selected = (state.settings?.selectedClasses || []) as TimetableClassSelection[];
    const rows: TimetableClassSyncStatus[] = [];
    for (const item of selected) {
      try {
        const options = this.weekOptions(state, item);
        const coverage = options.map((option: any) => ({ year: item.year, semester: item.semester, week: option.value, faculty: item.faculty || '', course: item.course || '', className: item.className }));
        if (!coverage.length) throw new ConflictException({ reasonCode: 'TIMETABLE_CLASS_WEEKS_NOT_FOUND', message: `Không tìm thấy tuần nguồn cho lớp ${item.className}.` });
        const keys = coverage.map((selection) => timetableKey(selection));
        const snapshots = typeof (this.snapshots as any).find === 'function' ? await (this.snapshots as any).find({ key: { $in: keys } }).lean().exec() : [];
        const byKey = new Map<string, any>((snapshots || []).map((snapshot: any) => [snapshot.key, snapshot] as [string, any]));
        const weeks = coverage.map((selection) => {
          const key = timetableKey(selection); const snapshot = byKey.get(key); const queued = (state.queue || []).some((entry: QueueItem) => entry.key === key); const running = state.job?.selection?.key === key && state.job.status === 'running'; const terminal = [...(state.statuses || [])].reverse().find((entry: any) => entry.key === key);
          const option = options.find((value: any) => value.value === selection.week);
          return { week: selection.week, label: option?.label, startDate: option?.startDate, endDate: option?.endDate, snapshotExists: Boolean(snapshot), lastSuccessfulUpdate: snapshot?.syncedAt ? new Date(snapshot.syncedAt).toISOString() : undefined, isEmpty: snapshot?.result?.isEmpty, status: snapshot ? 'valid' : running ? 'running' : queued ? 'pending' : terminal?.status === 'failed' ? 'failed' : 'missing', ...(terminal?.failure ? { failure: terminal.failure } : {}) } as any;
        });
        rows.push({ classSelection: item, weekCount: item.weekCount || 1, targetWeeks: coverage.map((value) => value.week), status: weeks.some((week) => week.status === 'failed') ? 'failed' : weeks.every((week) => week.status === 'valid') ? 'valid' : weeks.some((week) => week.status === 'running') ? 'running' : weeks.some((week) => week.status === 'pending') ? 'pending' : 'missing', weeks });
      } catch (error) { rows.push({ classSelection: item, weekCount: item.weekCount || 1, targetWeeks: [], status: 'configuration', weeks: [], error: error instanceof ConflictException ? String((error.getResponse() as any).message) : 'Cấu hình tuần không hợp lệ.' }); }
    }
    return rows;
  }

  async startSavedClass(user: any, dto: SavedTimetableClassSyncDto) {
    this.assertAdmin(user); const state = await this.state(); const saved = ((state.settings?.selectedClasses || []) as TimetableClassSelection[]).find((item) => this.classIdentity(item) === this.classIdentity(dto));
    if (!saved) throw new NotFoundException({ reasonCode: 'TIMETABLE_CLASS_NOT_CONFIGURED', message: 'Lớp chưa được lưu cấu hình đồng bộ.' });
    return this.start(user, { coverage: this.resolveClassCoverage(state.settings || {}, saved) } as StartTimetableSyncDto);
  }
  async getSavedClassWeekStatus(user: any, dto: SavedTimetableWeekSyncDto) {
    this.assertAdmin(user); const state = await this.readOnlyState(); const selection = this.manualSelection(state, dto); const key = timetableKey(selection);
    const snapshot = await this.snapshots.findOne({ key }).lean().exec();
    const running = state.job?.selection?.key === key && state.job.status === 'running';
    const queued = (state.queue || []).some((item: QueueItem) => item.key === key);
    const terminal = [...(state.statuses || [])].reverse().find((item: any) => item.key === key);
    return { key, selection, status: snapshot ? 'valid' : running ? 'running' : queued ? 'pending' : terminal?.status === 'failed' ? 'failed' : 'missing', snapshotExists: Boolean(snapshot), lastSuccessfulUpdate: snapshot?.syncedAt ? new Date(snapshot.syncedAt).toISOString() : null, isEmpty: snapshot?.result?.isEmpty === true, failure: terminal?.failure || null, cooldownUntil: terminal?.lastRequestedAt ? new Date(Date.parse(terminal.lastRequestedAt) + this.config.refreshCooldownMs).toISOString() : null };
  }
  async startSavedClassWeek(user: any, dto: SavedTimetableWeekSyncDto) {
    this.assertAdmin(user); const state = await this.state(); const selection = this.manualSelection(state, dto);
    return this.enqueue([selection], 'demand', dto.intent === 'update', state);
  }
  private async enqueue(selections: TimetableFilters[], kind: QueueKind, force: boolean, current?: any) {
    const state = current || await this.state(); const now = new Date().toISOString(); const queue = (state.queue || []) as QueueItem[]; const statuses = (state.statuses || []) as any[]; const known = new Set(queue.map((item) => item.key)); if (state.job?.selection?.key) known.add(state.job.selection.key);
    const additions: QueueItem[] = [];
    for (const selection of selections) { const key = timetableKey(selection); if (known.has(key)) continue; const terminal = [...statuses].reverse().find((item) => item.key === key); if (terminal?.status === 'pending' || terminal?.status === 'running') return { status: terminal.status, key, selection }; if (terminal?.lastRequestedAt && Date.parse(terminal.lastRequestedAt) + this.config.refreshCooldownMs > Date.now() && (force || !terminal.failure)) return { status: terminal.status, key, selection, cooldown: true }; additions.push({ key, selection, kind, requestedAt: now, force }); known.add(key); }
    const scheduledCount = queue.filter((item) => item.kind === 'scheduled').length;
    if (queue.length + additions.length > this.config.queueLimit || (kind === 'scheduled' && scheduledCount + additions.length > this.config.queueLimit - this.config.interactiveReserve)) throw new ServiceUnavailableException({ reasonCode: 'TIMETABLE_QUEUE_BUSY', message: 'Hệ thống đang bận, vui lòng thử lại sau.' });
    if (additions.length) {
      const pending = additions.map((item) => ({ key: item.key, selection: item.selection, status: 'pending', lastRequestedAt: now, updatedAt: new Date() }));
      const existingKeys = { $map: { input: { $ifNull: ['$queue', []] }, as: 'queued', in: '$$queued.key' } };
      const newUnique = { $size: { $filter: { input: { $literal: additions }, as: 'candidate', cond: { $not: { $in: ['$$candidate.key', existingKeys] } } } } };
      const nextQueue = { $let: { vars: { existing: { $ifNull: ['$queue', []] }, incoming: { $literal: additions } }, in: { $slice: [{ $concatArrays: ['$$existing', { $filter: { input: '$$incoming', as: 'candidate', cond: { $not: { $in: ['$$candidate.key', { $map: { input: '$$existing', as: 'queued', in: '$$queued.key' } }] } } } }] }, this.config.queueLimit] } } };
      const written = await this.states.updateOne({ name: STATE, $expr: { $lte: [{ $add: [{ $size: { $ifNull: ['$queue', []] } }, newUnique] }, this.config.queueLimit] } }, [{ $set: { queue: nextQueue, statuses: { $slice: [{ $concatArrays: [{ $ifNull: ['$statuses', []] }, { $literal: pending }] }, -this.config.statusRetention] } } }], { updatePipeline: true }).exec();
      if (!written.matchedCount) throw new ServiceUnavailableException({ reasonCode: 'TIMETABLE_QUEUE_BUSY', message: 'Hệ thống đang bận, vui lòng thử lại sau.' });
      void this.drainQueue();
    }
    return additions[0] ? { status: 'pending', key: additions[0].key, selection: additions[0].selection } : { status: 'pending', key: timetableKey(selections[0]), selection: selections[0] };
  }
  private async claimNext() {
    const state = await this.state(); if (!state) return null; const queue = (state.queue || []) as QueueItem[]; if (!queue.length) return null;
    const recent = [...(state.statuses || [])].reverse().filter((item: any) => item.status === 'valid' || item.status === 'failed'); let demandStreak = 0;
    for (const item of recent) { if (item.kind !== 'demand') break; demandStreak += 1; }
    const item = demandStreak >= 5 ? (queue.find((entry) => entry.kind === 'scheduled') || queue[0]) : (queue.find((entry) => entry.kind === 'demand') || queue[0]);
    const id = randomUUID(); const owner = `${id}:${randomUUID()}`; const now = new Date();
    const claimed = await this.states.findOneAndUpdate({ name: STATE, queue: { $elemMatch: { key: item.key } }, $or: [{ lease: null }, { 'lease.expiresAt': { $lte: now } }] }, { $pull: { queue: { key: item.key } }, $set: { job: { id, status: 'running', selection: item, startedAt: now, total: 1, completed: 0, failures: [] }, lease: { owner, expiresAt: new Date(now.getTime() + LEASE_MS), epoch: now.getTime() }, 'coordinator.demandStreak': item.kind === 'demand' ? demandStreak + 1 : 0 } }, { new: true }).lean().exec(); return claimed ? { item, id, owner } : null;
  }
  private async processQueued(claim: { item: QueueItem; id: string; owner: string }) {
    const { item, id, owner } = claim;
    let lost = false; let renewing: Promise<void> | undefined; const timer = setInterval(() => { if (renewing || lost) return; renewing = this.states.updateOne(this.owned(id, owner), { $set: { 'lease.expiresAt': new Date(Date.now() + LEASE_MS) } }).exec().then((result) => { if (!result.matchedCount) lost = true; }).catch(() => { lost = true; }).finally(() => { renewing = undefined; }); }, LEASE_MS / 3); timer.unref();
    try {
      try { const result = await this.fetchWithRetry(item.selection); if (lost) throw new ConflictException('Lease không còn hợp lệ.'); const session = await this.snapshots.db.startSession(); try { await session.withTransaction(async () => { const progress = await this.states.updateOne(this.owned(id, owner), { $set: { 'job.completed': 1 } }, { session }).exec(); if (!progress.matchedCount) throw new ConflictException('Lease không còn hợp lệ.'); await this.snapshots.findOneAndUpdate({ key: item.key }, { $set: { key: item.key, ...item.selection, coverageKey: coverageKey(item.selection), result, syncedAt: new Date(), jobId: id } }, { upsert: true, new: true, session }).exec(); await this.states.updateOne(this.owned(id, owner), { $set: { 'job.status': 'succeeded', 'job.finishedAt': new Date() }, $push: { statuses: { $each: [this.statusEntry(item, 'valid', { lastSuccessfulUpdate: new Date().toISOString(), lastRequestedAt: item.requestedAt })], $slice: -this.config.statusRetention } }, $unset: { lease: 1 } }, { session }).exec(); }); } finally { await session.endSession(); } }
      catch (error) { const reason = error instanceof TimetableSourceError ? error.code : error instanceof ConflictException ? 'LEASE_LOST' : 'SYNC_FAILED'; if (reason === 'LEASE_LOST') await this.requeueLeaseLost(item, id, owner); else await this.states.updateOne({ name: STATE, 'job.id': id, 'lease.owner': owner }, { $set: { 'job.status': 'failed', 'job.error': reason, 'job.finishedAt': new Date() }, $push: { statuses: { $each: [this.statusEntry(item, 'failed', { failure: reason, lastRequestedAt: item.requestedAt })], $slice: -this.config.statusRetention } }, $unset: { lease: 1 } }).exec(); }
    } finally { clearInterval(timer); await renewing; }
  }
  private async drainQueue() { if (this.drainPromise) return this.drainPromise; this.drainPromise = (async () => { this.draining = true; try { for (let count = 0; count < this.config.queueLimit; count += 1) { const claim = await this.claimNext(); if (!claim) break; await this.processQueued(claim); } } finally { this.draining = false; } })().finally(() => { this.drainPromise = undefined; }); return this.drainPromise; }

  private async run(id: string, owner: string, coverage: TimetableCoverageDto[]) {
    const failures: Failure[] = []; let completed = 0; let lost = false; let renewing: Promise<void> | undefined; const timer = setInterval(() => { if (renewing || lost) return; renewing = this.states.updateOne(this.owned(id, owner), { $set: { 'lease.expiresAt': new Date(Date.now() + LEASE_MS) } }).exec().then((result) => { if (!result.matchedCount) lost = true; }).catch(() => { lost = true; }).finally(() => { renewing = undefined; }); }, LEASE_MS / 3); timer.unref();
    try { for (const selection of coverage) { if (lost) break; try { const result = await this.fetchWithRetry(selection); if (lost) break; const session = await this.snapshots.db.startSession(); try { await session.withTransaction(async () => { const progress = await this.states.updateOne(this.owned(id, owner), { $set: { 'job.completed': completed + 1, 'lease.expiresAt': new Date(Date.now() + LEASE_MS) } }, { session }).exec(); if (!progress.matchedCount) { lost = true; throw new ConflictException('Lease không còn hợp lệ.'); } await this.snapshots.findOneAndUpdate({ key: timetableKey(selection) }, { $set: { key: timetableKey(selection), ...selection, coverageKey: coverageKey(selection), result, syncedAt: new Date(), jobId: id } }, { upsert: true, new: true, session }).exec(); }); } finally { await session.endSession(); } completed += 1; } catch (error) { if (lost) break; failures.push({ coverage: selection, reason: error instanceof TimetableSourceError ? error.code : 'SYNC_FAILED' }); await this.states.updateOne(this.owned(id, owner), { $set: { 'job.failures': failures } }).exec().then((r) => { if (!r.matchedCount) lost = true; }); } } if (!lost) await this.states.updateOne(this.owned(id, owner), { $set: { 'job.status': failures.length ? 'failed' : 'succeeded', 'job.completed': completed, 'job.failures': failures, 'job.finishedAt': new Date() }, $unset: { lease: 1 } }).exec(); } finally { clearInterval(timer); await renewing; }
  }
  private rollingCoverage(settings: any): TimetableFilters[] { if (!settings.rolling?.enabled || !settings.selectedClasses?.length) return []; return settings.selectedClasses.flatMap((item: TimetableClassSelection) => { try { return this.resolveClassCoverage(settings, item); } catch (error) { this.logger.warn(error instanceof ConflictException ? String((error.getResponse() as any).message) : 'Invalid saved timetable range'); return []; } }); }
  private addDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
  @Cron(CronExpression.EVERY_MINUTE)
  async scheduled() { await this.recoverInterrupted(); const state = await this.state(); const settings = state.settings || {}; const last = state.job?.finishedAt ? new Date(state.job.finishedAt).getTime() : 0; if (!settings.enabled || Date.now() - last < Number(settings.intervalMinutes || 60) * 60_000) return; const coverage = [...(settings.coverage || []), ...this.rollingCoverage(settings)]; const batchSize = Math.max(1, this.config.queueLimit - this.config.interactiveReserve); for (let offset = 0; offset < coverage.length; offset += batchSize) { try { await this.enqueue(coverage.slice(offset, offset + batchSize), 'scheduled', false); await this.drainQueue(); } catch (error) { if (error instanceof ServiceUnavailableException) break; throw error; } } }
}
