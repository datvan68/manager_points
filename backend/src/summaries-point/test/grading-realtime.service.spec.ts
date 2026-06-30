import { Test, TestingModule } from '@nestjs/testing';
import { GradingRealtimeService } from '../grading-realtime.service';
import { gradingEventEmitter } from '../../system/grading-event-emitter';

describe('GradingRealtimeService', () => {
  let service: GradingRealtimeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GradingRealtimeService],
    }).compile();

    service = module.get<GradingRealtimeService>(GradingRealtimeService);
  });

  afterEach(() => {
    gradingEventEmitter.removeAllListeners('grading_event');
  });

  it('should filter events strictly by classId and semesterId', (done) => {
    const user = { userId: 'student-1', roleName: 'student' };
    const classId = 'class-A';
    const semesterId = 'semester-1';

    const events: any[] = [];
    const subscription = service.getStream(user, classId, semesterId).subscribe({
      next: (val) => {
        if (val.data.type !== 'ping' && val.data.type !== 'connected') {
          events.push(val.data);
        }
      }
    });

    // 1. Event with matching classId and semesterId -> should be received
    gradingEventEmitter.emit('grading_event', {
      type: 'academic_record_changed',
      classId: 'class-A',
      semesterId: 'semester-1',
      studentId: 'student-1',
      summaryId: 'summary-1',
    });

    // 2. Event with mismatching classId -> should be dropped
    gradingEventEmitter.emit('grading_event', {
      type: 'academic_record_changed',
      classId: 'class-B',
      semesterId: 'semester-1',
      studentId: 'student-2',
      summaryId: 'summary-2',
    });

    // 3. Event with mismatching semesterId -> should be dropped
    gradingEventEmitter.emit('grading_event', {
      type: 'academic_record_changed',
      classId: 'class-A',
      semesterId: 'semester-2',
      studentId: 'student-3',
      summaryId: 'summary-3',
    });

    // 4. Event missing classId or semesterId when filtered -> should be dropped
    gradingEventEmitter.emit('grading_event', {
      type: 'academic_record_changed',
      semesterId: 'semester-1', // missing classId
      studentId: 'student-4',
      summaryId: 'summary-4',
    });

    setTimeout(() => {
      subscription.unsubscribe();
      expect(events.length).toBe(1);
      expect(events[0].studentId).toBe('student-1');
      done();
    }, 100);
  });
});
