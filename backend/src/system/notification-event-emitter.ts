import { EventEmitter } from 'events';

export interface NotificationCreatedEvent {
  type: 'notification.created';
}

export const notificationEventEmitter = new EventEmitter();
notificationEventEmitter.setMaxListeners(100);
