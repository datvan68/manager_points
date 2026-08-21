import { Injectable, MessageEvent, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  dormitoryInvoiceEventEmitter,
  DormitoryInvoiceRealtimePayload,
} from './dormitory-invoice-event-emitter';

@Injectable()
export class DormitoryInvoiceRealtimeService {
  getStream(user: any, kind?: string): Observable<MessageEvent> {
    if (kind && kind !== 'utility' && kind !== 'room_fee') {
      throw new BadRequestException('Loại hóa đơn realtime không hợp lệ');
    }

    return new Observable((subscriber) => {
      subscriber.next({ data: { type: 'connected' } });

      const heartbeat = setInterval(() => {
        subscriber.next({ data: { type: 'ping' } });
      }, 30000);

      const listener = (payload: DormitoryInvoiceRealtimePayload) => {
        if (kind && payload.kind !== kind) {
          return;
        }

        subscriber.next({
          data: {
            type: payload.action,
            kind: payload.kind,
            action: payload.action,
            id: payload.id,
            ids: payload.ids,
            timestamp: payload.timestamp || Date.now(),
          },
        });
      };

      dormitoryInvoiceEventEmitter.on('dormitory_invoice_event', listener);

      return () => {
        clearInterval(heartbeat);
        dormitoryInvoiceEventEmitter.off('dormitory_invoice_event', listener);
      };
    });
  }
}
