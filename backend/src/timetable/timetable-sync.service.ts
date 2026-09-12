import { ConflictException, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { SchoolTimetableAdapter } from './school-timetable.adapter';
import { TimetableCoverageDto, TimetableSettingsDto, StartTimetableSyncDto } from './dto/sync-timetable.dto';
import { TimetableSnapshot, TimetableSnapshotDocument } from './timetable-snapshot.schema';
import { TimetableSyncState, TimetableSyncStateDocument } from './timetable-sync-state.schema';
import { getTimetableConfig, TimetableConfig } from './timetable.config';
import { TimetableClassSelection, TimetableFilters, TimetableSourceError, TimetableWeekDate } from './timetable.types';
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
    await this.states.updateOne({ name: STATE, 'job.status': 'running', $or: [{ 'lease.expiresAt': { $lte: now } }, { lease: null, 'job.startedAt': { $lte: new Date(now.getTime() - LEASE_MS) } }, { lease: null, 'job.startedAt': { $exists: false } }] }, [{ $set: { 'job.status': 'failed', 'job.error': 'SYNC_INTERRUPTED', 'job.finishedAt': now, queue: { $let: { vars: { existing: { $ifNull: ['$queue', []] }, keys: { $map: { input: { $ifNull: ['$queue', []] }, as: 'queued', in: '$$queued.key' } } }, in: { $cond: [{ $and: [{ $ne: ['$job.selection', null] }, { $not: { $in: ['$job.selection.key', '$$keys'] } }] }, { $concatArrays: [['$job.selection'], '$$existing'] }, '$$existing'] } } } } }, { $unset: 'lease' }]).exec();
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
    return { job: state.job, settings: state.settings, lastSuccessfulUpdate: latest?.syncedAt || null, queue: state.queue || [] };
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
    return [...new Map(items.map((item) => [JSON.stringify([item.year, item.semester, item.faculty || '', item.course || '', item.className]), { year: item.year!, semester: item.semester!, faculty: item.faculty || '', course: item.course || '', className: item.className! }])).values()];
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
    await this.states.updateOne({ name: STATE, 'job.id': id, 'lease.owner': owner }, [{ $set: { 'job.status': 'failed', 'job.error': 'LEASE_LOST', 'job.finishedAt': new Date(), queue, statuses } }, { $unset: 'lease' }]).exec();
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
      const written = await this.states.updateOne({ name: STATE, $expr: { $lte: [{ $add: [{ $size: { $ifNull: ['$queue', []] } }, newUnique] }, this.config.queueLimit] } }, [{ $set: { queue: nextQueue, statuses: { $slice: [{ $concatArrays: [{ $ifNull: ['$statuses', []] }, { $literal: pending }] }, -this.config.statusRetention] } } }]).exec();
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
  private rollingCoverage(settings: any): TimetableFilters[] { if (!settings.rolling?.enabled || !settings.selectedClasses?.length) return []; const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const today = `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}`; const map = [...(settings.rolling.weekDates || []) as TimetableWeekDate[]].sort((a, b) => a.startDate.localeCompare(b.startDate)); const currentIndex = map.findIndex((item) => item.startDate <= today && item.endDate >= today); const weeks = currentIndex >= 0 ? [map[currentIndex], map[currentIndex + 1]].filter(Boolean) : []; return weeks.flatMap((week) => settings.selectedClasses.map((item: TimetableClassSelection) => ({ ...item, week: week.week }))); }
  private addDays(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
  @Cron(CronExpression.EVERY_MINUTE)
  async scheduled() { await this.recoverInterrupted(); const state = await this.state(); const settings = state.settings || {}; const last = state.job?.finishedAt ? new Date(state.job.finishedAt).getTime() : 0; if (!settings.enabled || Date.now() - last < Number(settings.intervalMinutes || 60) * 60_000) return; const coverage = [...(settings.coverage || []), ...this.rollingCoverage(settings)]; const batchSize = Math.max(1, this.config.queueLimit - this.config.interactiveReserve); for (let offset = 0; offset < coverage.length; offset += batchSize) { try { await this.enqueue(coverage.slice(offset, offset + batchSize), 'scheduled', false); await this.drainQueue(); } catch (error) { if (error instanceof ServiceUnavailableException) break; throw error; } } }
}
