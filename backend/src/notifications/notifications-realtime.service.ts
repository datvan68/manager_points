import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { notificationEventEmitter } from '../system/notification-event-emitter';

@Injectable()
export class NotificationsRealtimeService {
  getStream(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      subscriber.next({ data: { type: 'connected' } });
      const heartbeat = setInterval(() => subscriber.next({ data: { type: 'ping' } }), 30000);
      const listener = () => subscriber.next({ data: { type: 'notification.created' } });
      notificationEventEmitter.on('notification.created', listener);
      return () => {
        clearInterval(heartbeat);
        notificationEventEmitter.off('notification.created', listener);
      };
    });
  }
}
