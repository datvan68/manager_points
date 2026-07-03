import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { gradingEventEmitter } from '../system/grading-event-emitter';
import { ProjectionService } from './projection.service';
import { CountResolutionService } from './count-resolution.service';
import { normalizeObjectId } from './academic-record.utils';

/**
 * Listens to grading events emitted via gradingEventEmitter and
 * triggers async projection updates.
 *
 * This keeps the incremental projection path ($inc) in sync with
 * record creation/deletion events without blocking the main request.
 */
@Injectable()
export class ProjectionListener implements OnModuleInit {
  private readonly logger = new Logger(ProjectionListener.name);

  constructor(
    private readonly projectionService: ProjectionService,
    private readonly countResolutionService: CountResolutionService,
  ) {}

  onModuleInit() {
    // Listen for record-level events for incremental projection sync
    gradingEventEmitter.on('academic_record_created', async (payload: any) => {
      try {
        await this.handleRecordCreated(payload);
      } catch (err) {
        this.logger.error(`[ProjectionListener] Error handling academic_record_created: ${err}`);
      }
    });

    gradingEventEmitter.on('academic_record_cancelled', async (payload: any) => {
      try {
        await this.handleRecordCancelled(payload);
      } catch (err) {
        this.logger.error(`[ProjectionListener] Error handling academic_record_cancelled: ${err}`);
      }
    });

    gradingEventEmitter.on('academic_record_deleted', async (payload: any) => {
      try {
        await this.handleRecordDeleted(payload);
      } catch (err) {
        this.logger.error(`[ProjectionListener] Error handling academic_record_deleted: ${err}`);
      }
    });

    this.logger.log('[ProjectionListener] Registered event listeners');
  }

  private async handleRecordCreated(payload: any): Promise<void> {
    const studentId = normalizeObjectId(payload.student_id);
    const semesterId = normalizeObjectId(payload.semester_id);
    const criterionId = normalizeObjectId(payload.criterion_id);
    const recordedByRole = payload.recorded_by_role || 'system';
    const recordId = payload.record_id || '';

    if (!studentId || !semesterId || !criterionId) {
      this.logger.warn('[ProjectionListener] Missing IDs in academic_record_created payload');
      return;
    }

    await this.projectionService.incrementCount({
      studentId,
      semesterId,
      criterionId,
      recorded_by_role: recordedByRole,
      quantity: payload.quantity || 1,
      recordId,
    });
  }

  private async handleRecordCancelled(payload: any): Promise<void> {
    const studentId = normalizeObjectId(payload.student_id);
    const semesterId = normalizeObjectId(payload.semester_id);
    const criterionId = normalizeObjectId(payload.criterion_id);
    const recordedByRole = payload.recorded_by_role || 'system';
    const recordId = payload.record_id || '';

    if (!studentId || !semesterId || !criterionId) {
      this.logger.warn('[ProjectionListener] Missing IDs in academic_record_cancelled payload');
      return;
    }

    await this.projectionService.incrementCount({
      studentId,
      semesterId,
      criterionId,
      recorded_by_role: recordedByRole,
      quantity: -(payload.quantity || 1),
      recordId,
    });
  }

  private async handleRecordDeleted(payload: any): Promise<void> {
    // Same as cancelled — decrement the count
    await this.handleRecordCancelled(payload);
  }
}
