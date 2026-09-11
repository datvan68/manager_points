import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { SchoolTimetableAdapter } from './school-timetable.adapter';
import { TimetableCoverageDto, TimetableSettingsDto, StartTimetableSyncDto } from './dto/sync-timetable.dto';
import { TimetableSnapshot, TimetableSnapshotDocument } from './timetable-snapshot.schema';
import { TimetableSyncState, TimetableSyncStateDocument } from './timetable-sync-state.schema';
import { TimetableOptions, TimetableSourceError } from './timetable.types';

const STATE = 'default';
const keyOf = (coverage: TimetableCoverageDto) => JSON.stringify(['year', 'semester', 'week', 'faculty', 'course', 'className'].map((field) => [field, (coverage as any)[field] || '']));
const coverageKey = (coverage: TimetableCoverageDto) => `${coverage.year}:${coverage.semester}:${coverage.week}:${coverage.faculty || ''}:${coverage.course || ''}:${coverage.className || ''}`;

@Injectable()
export class TimetableSyncService {
  private running = false;
  constructor(
    private readonly adapter: SchoolTimetableAdapter,
    @InjectModel(TimetableSnapshot.name) private readonly snapshots: Model<TimetableSnapshotDocument>,
    @InjectModel(TimetableSyncState.name) private readonly states: Model<TimetableSyncStateDocument>,
  ) {}

  private assertAdmin(user: any) { if (String(user?.roleCode || '').toUpperCase() !== 'ADMIN') throw new ConflictException('Chỉ quản trị viên mới được đồng bộ thời khóa biểu.'); }
  private async state() { return this.states.findOneAndUpdate({ name: STATE }, { $setOnInsert: { name: STATE, settings: { enabled: false, intervalMinutes: 60, coverage: [] } } }, { upsert: true, new: true }).lean().exec(); }
  async getCatalog(user: any) { this.assertAdmin(user); const state = await this.state(); if (!state.catalog) throw new NotFoundException({ reasonCode: 'TIMETABLE_CATALOG_NOT_SYNCED', message: 'Chưa tải danh mục nguồn.' }); return state.catalog; }
  async loadCatalog(user: any) { this.assertAdmin(user); const catalog = await this.adapter.getOptions('sync-catalog'); await this.states.updateOne({ name: STATE }, { $set: { catalog } }, { upsert: true }).exec(); return catalog; }
  async start(user: any, dto: StartTimetableSyncDto) { this.assertAdmin(user); const coverage = this.validateCoverage(dto.coverage); const current = await this.state(); if (current.job?.status === 'running') throw new ConflictException('Đã có một tiến trình đồng bộ đang chạy.'); const id = randomUUID(); await this.states.updateOne({ name: STATE }, { $set: { job: { id, status: 'running', startedAt: new Date(), operatorId: String(user.userId), total: coverage.length, completed: 0, failures: [], coverage } } }).exec(); void this.run(id, coverage); return { id, status: 'running', total: coverage.length };
  }
  async getStatus(user: any) { this.assertAdmin(user); const state = await this.state(); return { job: state.job, settings: state.settings, lastSuccessfulUpdate: (await this.snapshots.findOne().sort({ syncedAt: -1 }).lean().exec())?.syncedAt || null }; }
  async getSettings(user: any) { this.assertAdmin(user); return (await this.state()).settings; }
  async updateSettings(user: any, dto: TimetableSettingsDto) { this.assertAdmin(user); const coverage = this.validateCoverage(dto.coverage); await this.states.updateOne({ name: STATE }, { $set: { settings: { enabled: dto.enabled, intervalMinutes: dto.intervalMinutes, coverage } } }, { upsert: true }).exec(); return (await this.state()).settings; }

  private validateCoverage(coverage: TimetableCoverageDto[]) { if (!coverage?.length || coverage.length > 100 || coverage.some((item) => !item.year || !item.semester || !item.week)) throw new ConflictException('Phạm vi đồng bộ không hợp lệ.'); return coverage.map((item) => ({ ...item })); }
  private async acquire(id: string) { const owner = `${id}:${randomUUID()}`; const expiresAt = new Date(Date.now() + 60_000); const state = await this.states.findOneAndUpdate({ name: STATE, $or: [{ lease: null }, { 'lease.expiresAt': { $lt: new Date() } }, { 'lease.owner': owner }] }, { $set: { lease: { owner, expiresAt, epoch: Date.now() } } }, { new: true }).lean().exec(); return state ? { owner, epoch: state.lease?.epoch || 0 } : null; }
  private async run(id: string, coverage: TimetableCoverageDto[]) { if (this.running) return; this.running = true; const lease = await this.acquire(id); if (!lease) { await this.states.updateOne({ name: STATE, 'job.id': id }, { $set: { 'job.status': 'failed', 'job.error': 'Không giành được lease.' } }).exec(); this.running = false; return; } const failures: any[] = []; let completed = 0; try { for (const selection of coverage) { try { const ownerState = await this.states.findOne({ name: STATE, 'job.id': id, 'lease.owner': lease.owner }).lean().exec(); if (!ownerState) throw new ConflictException('Lease không còn hợp lệ.'); const result = await this.adapter.getTimetable(`sync:${id}`, selection as any); const updated = await this.snapshots.findOneAndUpdate({ key: keyOf(selection) }, { $set: { key: keyOf(selection), ...selection, coverageKey: coverageKey(selection), result, syncedAt: new Date(), jobId: id } }, { upsert: true, new: true }).exec(); if (!updated) throw new ConflictException('Không thể công bố snapshot.'); completed += 1; await this.states.updateOne({ name: STATE, 'job.id': id, 'lease.owner': lease.owner }, { $set: { 'job.completed': completed, 'lease.expiresAt': new Date(Date.now() + 60_000) } }).exec(); } catch (error: any) { failures.push({ coverage: selection, reason: error instanceof TimetableSourceError ? error.code : 'SYNC_FAILED' }); } } await this.states.updateOne({ name: STATE, 'job.id': id, 'lease.owner': lease.owner }, { $set: { 'job.status': failures.length ? 'failed' : 'succeeded', 'job.completed': completed, 'job.failures': failures, 'job.finishedAt': new Date() }, $unset: { lease: 1 } }).exec(); } finally { this.running = false; } }
  @Cron(CronExpression.EVERY_MINUTE)
  async scheduled() { const state = await this.state(); const settings = state.settings || {}; const last = state.job?.finishedAt ? new Date(state.job.finishedAt).getTime() : 0; if (settings.enabled && settings.coverage?.length && Date.now() - last >= Number(settings.intervalMinutes || 60) * 60_000 && !state.job?.status?.includes('running')) await this.start({ roleCode: 'ADMIN', userId: 'scheduler' }, { coverage: settings.coverage }); }
}
