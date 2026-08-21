import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  dormitoryOverviewEventEmitter,
  DormitoryOverviewInvalidatedEvent,
} from './dormitory-overview-event-emitter';

@Injectable()
export class DormitoryOverviewRealtimeService {
  getStream(user?: any): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({
        data: {
          type: 'connected',
          timestamp: Date.now(),
        },
      });

      const heartbeat = setInterval(() => {
        subscriber.next({
          data: {
            type: 'ping',
            timestamp: Date.now(),
          },
        });
      }, 30000);

      const listener = (payload: DormitoryOverviewInvalidatedEvent) => {
        subscriber.next({
          data: {
            type: payload.type,
            domain: payload.domain,
            event_id: payload.event_id,
            timestamp: payload.timestamp || Date.now(),
          },
        });
      };

      dormitoryOverviewEventEmitter.on('dormitory_overview_event', listener);

      return () => {
        clearInterval(heartbeat);
        dormitoryOverviewEventEmitter.off('dormitory_overview_event', listener);
      };
    });
  }
}
