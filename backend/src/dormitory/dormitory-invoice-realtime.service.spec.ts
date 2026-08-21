import { BadRequestException } from '@nestjs/common';
import { DormitoryInvoiceRealtimeService } from './dormitory-invoice-realtime.service';
import { dormitoryInvoiceEventEmitter } from './dormitory-invoice-event-emitter';

describe('DormitoryInvoiceRealtimeService', () => {
  let service: DormitoryInvoiceRealtimeService;

  beforeEach(() => {
    service = new DormitoryInvoiceRealtimeService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects invalid kind parameter', () => {
    expect(() => service.getStream({ userId: 'u1' }, 'invalid_kind')).toThrow(
      BadRequestException,
    );
  });

  it('emits connected event upon subscription and ping every 30s', () => {
    const stream$ = service.getStream({ userId: 'u1' });
    const events: any[] = [];

    const subscription = stream$.subscribe((event) => {
      events.push(event.data);
    });

    expect(events).toEqual([{ type: 'connected' }]);

    jest.advanceTimersByTime(30000);
    expect(events).toEqual([{ type: 'connected' }, { type: 'ping' }]);

    jest.advanceTimersByTime(30000);
    expect(events.length).toBe(3);
    expect(events[2]).toEqual({ type: 'ping' });

    subscription.unsubscribe();
  });

  it('delivers matching events and ignores non-matching kind events', () => {
    const utilityStream$ = service.getStream({ userId: 'u1' }, 'utility');
    const roomFeeStream$ = service.getStream({ userId: 'u2' }, 'room_fee');

    const utilityEvents: any[] = [];
    const roomFeeEvents: any[] = [];

    const sub1 = utilityStream$.subscribe((e) => utilityEvents.push(e.data));
    const sub2 = roomFeeStream$.subscribe((e) => roomFeeEvents.push(e.data));

    expect(utilityEvents).toEqual([{ type: 'connected' }]);
    expect(roomFeeEvents).toEqual([{ type: 'connected' }]);

    // Emit utility event
    dormitoryInvoiceEventEmitter.emit('dormitory_invoice_event', {
      kind: 'utility',
      action: 'created',
      id: 'inv-1',
      timestamp: 123456,
    });

    // Emit room_fee event
    dormitoryInvoiceEventEmitter.emit('dormitory_invoice_event', {
      kind: 'room_fee',
      action: 'updated',
      ids: ['rfi-1', 'rfi-2'],
      timestamp: 123457,
    });

    expect(utilityEvents).toEqual([
      { type: 'connected' },
      {
        type: 'created',
        kind: 'utility',
        action: 'created',
        id: 'inv-1',
        ids: undefined,
        timestamp: 123456,
      },
    ]);

    expect(roomFeeEvents).toEqual([
      { type: 'connected' },
      {
        type: 'updated',
        kind: 'room_fee',
        action: 'updated',
        id: undefined,
        ids: ['rfi-1', 'rfi-2'],
        timestamp: 123457,
      },
    ]);

    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it('cleans up listener on unsubscribe', () => {
    const stream$ = service.getStream({ userId: 'u1' }, 'utility');
    const events: any[] = [];

    const listenerCountBefore = dormitoryInvoiceEventEmitter.listenerCount(
      'dormitory_invoice_event',
    );

    const subscription = stream$.subscribe((e) => events.push(e.data));
    expect(
      dormitoryInvoiceEventEmitter.listenerCount('dormitory_invoice_event'),
    ).toBe(listenerCountBefore + 1);

    subscription.unsubscribe();
    expect(
      dormitoryInvoiceEventEmitter.listenerCount('dormitory_invoice_event'),
    ).toBe(listenerCountBefore);
  });
});
