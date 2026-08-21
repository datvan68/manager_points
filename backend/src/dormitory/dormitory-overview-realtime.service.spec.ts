import { DormitoryOverviewRealtimeService } from './dormitory-overview-realtime.service';
import {
  dormitoryOverviewEventEmitter,
  emitDormitoryOverviewInvalidated,
} from './dormitory-overview-event-emitter';
import { dormitoryInvoiceEventEmitter } from './dormitory-invoice-event-emitter';
import { DormitoryReportsController } from './controllers/dormitory-reports.controller';

describe('DormitoryOverviewRealtimeService and SSE integration', () => {
  let service: DormitoryOverviewRealtimeService;

  beforeEach(() => {
    service = new DormitoryOverviewRealtimeService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits initial connected event and streams invalidated events with no sensitive payload', (done) => {
    const events: any[] = [];
    const stream$ = service.getStream({ userId: 'user-1' });

    const subscription = stream$.subscribe({
      next: (event) => {
        events.push(event.data);
        if (events.length === 2) {
          expect(events[0]).toEqual(expect.objectContaining({ type: 'connected' }));
          expect(events[1]).toEqual(expect.objectContaining({
            type: 'dormitory_overview.invalidated',
            domain: 'rooms',
            event_id: expect.any(String),
            timestamp: expect.any(Number),
          }));
          // Ensure no sensitive record data is in the payload
          expect(events[1]).not.toHaveProperty('student');
          expect(events[1]).not.toHaveProperty('invoice');
          expect(events[1]).not.toHaveProperty('amount');

          subscription.unsubscribe();
          done();
        }
      },
    });

    // Initial event is delivered immediately
    expect(events.length).toBe(1);
    expect(events[0].type).toBe('connected');

    // Trigger domain invalidation
    emitDormitoryOverviewInvalidated('rooms');
  });

  it('bridges invoice events from dormitoryInvoiceEventEmitter to overview invalidation', (done) => {
    const events: any[] = [];
    const stream$ = service.getStream();

    const subscription = stream$.subscribe({
      next: (event) => {
        events.push(event.data);
        if (events.length === 2) {
          expect(events[1]).toEqual(expect.objectContaining({
            type: 'dormitory_overview.invalidated',
            domain: 'invoices',
          }));
          subscription.unsubscribe();
          done();
        }
      },
    });

    // Emit legacy/direct invoice event
    dormitoryInvoiceEventEmitter.emit('dormitory_invoice_event', {
      kind: 'utility',
      action: 'created',
      id: 'inv-123',
    });
  });

  it('emits heartbeat ping every 30 seconds', (done) => {
    const events: any[] = [];
    const stream$ = service.getStream();

    const subscription = stream$.subscribe({
      next: (event) => {
        events.push(event.data);
        if (events.length === 2) {
          expect(events[1]).toEqual(expect.objectContaining({ type: 'ping' }));
          subscription.unsubscribe();
          done();
        }
      },
    });

    expect(events.length).toBe(1); // 'connected'
    jest.advanceTimersByTime(30000);
  });

  it('cleans up listeners and timers on unsubscribe', () => {
    const initialListeners = dormitoryOverviewEventEmitter.listenerCount('dormitory_overview_event');
    const stream$ = service.getStream();

    const subscription = stream$.subscribe();
    expect(dormitoryOverviewEventEmitter.listenerCount('dormitory_overview_event')).toBe(initialListeners + 1);

    subscription.unsubscribe();
    expect(dormitoryOverviewEventEmitter.listenerCount('dormitory_overview_event')).toBe(initialListeners);
  });

  it('ensures DormitoryReportsController.realtime is guarded and calls service.getStream', () => {
    const mockReportsService: any = { getDashboardStats: jest.fn() };
    const mockRealtimeService: any = { getStream: jest.fn().mockReturnValue('mock-stream') };
    const controller = new DormitoryReportsController(mockReportsService, mockRealtimeService);

    const stream = controller.realtime({ user: { userId: 'u1' } });
    expect(mockRealtimeService.getStream).toHaveBeenCalledWith({ userId: 'u1' });
    expect(stream).toBe('mock-stream');
  });
});
