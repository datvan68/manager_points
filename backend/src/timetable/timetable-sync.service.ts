import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { SchoolTimetableAdapter } from './school-timetable.adapter';
import { TimetableCoverageDto, TimetableSettingsDto, StartTimetableSyncDto } from './dto/sync-timetable.dto';
import { TimetableSnapshot, TimetableSnapshotDocument } from './timetable-snapshot.schema';
import { TimetableSyncState, TimetableSyncStateDocument } from './timetable-sync-state.schema';
import { TimetableFilters, TimetableOptions, TimetableSourceError } from './timetable.types';
import { timetableFields, timetableKey } from './timetable-selection';

const STATE = 'default';
const LEASE_MS = 60_000;
const coverageKey = (coverage: TimetableCoverageDto) => timetableFields.map((field) => coverage[field] || '').join(':');

@Injectable()
export class TimetableSyncService {
  private readonly logger = new Logger(TimetableSyncService.name);

  constructor(
    private readonly adapter: SchoolTimetableAdapter,
    @InjectModel(TimetableSnapshot.name) private readonly snapshots: Model<TimetableSnapshotDocument>,
    @InjectModel(TimetableSyncState.name) private readonly states: Model<TimetableSyncStateDocument>,
  ) {}

  private assertAdmin(user: any) {
    if (String(user?.roleCode || '').toUpperCase() !== 'ADMIN') throw new ConflictException('Chỉ quản trị viên mới được đồng bộ thời khóa biểu.');
  }

  private async state() {
    return this.states.findOneAndUpdate({ name: STATE }, {
      $setOnInsert: { name: STATE, settings: { enabled: false, intervalMinutes: 60, coverage: [] } },
    }, { upsert: true, new: true }).lean().exec();
  }

  async getCatalog(user: any) {
    this.assertAdmin(user);
    const state = await this.state();
    if (!state.catalog) throw new NotFoundException({ reasonCode: 'TIMETABLE_CATALOG_NOT_SYNCED', message: 'Chưa tải danh mục nguồn.' });
    return state.catalog;
  }

  async loadCatalog(user: any, filters: Partial<TimetableFilters> = {}) {
    this.assertAdmin(user);
    const catalog = await this.adapter.getOptions(`sync-catalog:${String(user.userId)}`, filters);
    await this.state();
    // Preserve labels from other parent selections using one atomic update.
    const fields = ['years', 'semesters', 'weeks', 'faculties', 'courses', 'classes'] as const;
    await this.states.updateOne({ name: STATE }, [{ $set: {
      catalog: Object.fromEntries(fields.map((field) => [field, {
        $setUnion: [{ $ifNull: [`$catalog.${field}`, []] }, { $literal: catalog[field] }],
      }])),
    } }], { updatePipeline: true }).exec();
    return catalog;
  }

  private async recoverInterrupted() {
    const now = new Date();
    await this.states.updateOne({
      name: STATE,
      'job.status': 'running',
      $or: [
        { 'lease.expiresAt': { $lte: now } },
        { lease: null, 'job.startedAt': { $lte: new Date(now.getTime() - LEASE_MS) } },
        { lease: null, 'job.startedAt': { $exists: false } },
      ],
    }, {
      $set: { 'job.status': 'failed', 'job.error': 'SYNC_INTERRUPTED', 'job.finishedAt': now },
      $unset: { lease: 1 },
    }).exec();
  }

  async start(user: any, dto: StartTimetableSyncDto) {
    this.assertAdmin(user);
    const coverage = this.validateCoverage(dto.coverage);
    await this.state();
    await this.recoverInterrupted();
    const id = randomUUID();
    const owner = `${id}:${randomUUID()}`;
    const now = new Date();
    const claimed = await this.states.findOneAndUpdate({
      name: STATE,
      'job.status': { $ne: 'running' },
      $or: [{ lease: null }, { 'lease.expiresAt': { $lte: now } }],
    }, { $set: {
      job: { id, status: 'running', startedAt: now, operatorId: String(user.userId), total: coverage.length, completed: 0, failures: [], coverage },
      lease: { owner, expiresAt: new Date(now.getTime() + LEASE_MS), epoch: now.getTime() },
    } }, { new: true }).lean().exec();
    if (!claimed) throw new ConflictException('Đã có một tiến trình đồng bộ đang chạy.');
    void this.run(id, owner, coverage).catch(() => {
      // Do not expose source/connection errors. An unavailable database leaves
      // an expiring lease that the next status read or scheduler can recover.
      this.logger.error('Timetable synchronization failed; recovery will follow lease expiry.');
    });
    return { id, status: 'running', total: coverage.length };
  }

  async getStatus(user: any) {
    this.assertAdmin(user);
    await this.recoverInterrupted();
    const [state, latest] = await Promise.all([
      this.state(), this.snapshots.findOne().sort({ syncedAt: -1 }).lean().exec(),
    ]);
    return { job: state.job, settings: state.settings, lastSuccessfulUpdate: latest?.syncedAt || null };
  }

  async getSettings(user: any) { this.assertAdmin(user); return (await this.state()).settings; }

  async updateSettings(user: any, dto: TimetableSettingsDto) {
    this.assertAdmin(user);
    const coverage = this.validateCoverage(dto.coverage);
    await this.states.updateOne({ name: STATE }, {
      $set: { settings: { enabled: dto.enabled, intervalMinutes: dto.intervalMinutes, coverage } },
    }, { upsert: true }).exec();
    return (await this.state()).settings;
  }

  private validateCoverage(coverage: TimetableCoverageDto[]) {
    if (!coverage?.length || coverage.length > 100 || coverage.some((item) => !item.year || !item.semester || !item.week)) {
      throw new ConflictException('Phạm vi đồng bộ không hợp lệ.');
    }
    return [...new Map(coverage.map((item) => [timetableKey(item), { ...item }])).values()];
  }

  private owned(id: string, owner: string) {
    return { name: STATE, 'job.id': id, 'job.status': 'running', 'lease.owner': owner, 'lease.expiresAt': { $gt: new Date() } };
  }

  private async run(id: string, owner: string, coverage: TimetableCoverageDto[]) {
    const failures: Array<{ coverage: TimetableCoverageDto; reason: string }> = [];
    let completed = 0;
    let lost = false;
    let renewing: Promise<void> | undefined;
    const timer = setInterval(() => {
      if (renewing || lost) return;
      renewing = this.states.updateOne(this.owned(id, owner), {
        $set: { 'lease.expiresAt': new Date(Date.now() + LEASE_MS) },
      }).exec().then((result) => { if (!result.matchedCount) lost = true; })
        .catch(() => { lost = true; }).finally(() => { renewing = undefined; });
    }, LEASE_MS / 3);
    timer.unref();
    try {
      for (const selection of coverage) {
        if (lost) break;
        try {
          const result = await this.adapter.getTimetable(`sync:${id}`, selection);
          if (lost) break;
          const session = await this.snapshots.db.startSession();
          try {
            // The lease check, snapshot publication and progress update commit
            // together. A worker that lost ownership cannot publish late data.
            await session.withTransaction(async () => {
              const progress = await this.states.updateOne(this.owned(id, owner), {
                $set: { 'job.completed': completed + 1, 'lease.expiresAt': new Date(Date.now() + LEASE_MS) },
              }, { session }).exec();
              if (!progress.matchedCount) { lost = true; throw new ConflictException('Lease không còn hợp lệ.'); }
              await this.snapshots.findOneAndUpdate({ key: timetableKey(selection) }, { $set: {
                key: timetableKey(selection),
                ...selection,
                coverageKey: coverageKey(selection),
                result,
                syncedAt: new Date(),
                jobId: id,
              } }, { upsert: true, new: true, session }).exec();
            });
            completed += 1;
          } finally { await session.endSession(); }
        } catch (error: unknown) {
          if (lost) break;
          failures.push({ coverage: selection, reason: error instanceof TimetableSourceError ? error.code : 'SYNC_FAILED' });
          const progress = await this.states.updateOne(this.owned(id, owner), {
            $set: { 'job.failures': failures },
          }).exec();
          if (!progress.matchedCount) lost = true;
        }
      }
      if (!lost) await this.states.updateOne(this.owned(id, owner), {
        $set: { 'job.status': failures.length ? 'failed' : 'succeeded', 'job.completed': completed, 'job.failures': failures, 'job.finishedAt': new Date() },
        $unset: { lease: 1 },
      }).exec();
    } finally {
      clearInterval(timer);
      await renewing;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduled() {
    await this.recoverInterrupted();
    const state = await this.state();
    const settings = state.settings || {};
    const last = state.job?.finishedAt ? new Date(state.job.finishedAt).getTime() : 0;
    if (!settings.enabled || !settings.coverage?.length || state.job?.status === 'running' || Date.now() - last < Number(settings.intervalMinutes || 60) * 60_000) return;
    try { await this.start({ roleCode: 'ADMIN', userId: 'scheduler' }, { coverage: settings.coverage }); }
    catch (error) { if (!(error instanceof ConflictException)) throw error; }
  }
}
