import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { dormitoryInvoiceEventEmitter } from './dormitory-invoice-event-emitter';

export type DormitoryOverviewDomain =
  | 'buildings'
  | 'rooms'
  | 'beds'
  | 'contracts'
  | 'roster'
  | 'invoices'
  | 'maintenance';

export interface DormitoryOverviewInvalidatedEvent {
  type: 'dormitory_overview.invalidated';
  domain: DormitoryOverviewDomain;
  event_id: string;
  timestamp: number;
}

class DormitoryOverviewEventEmitter extends EventEmitter {}

export const dormitoryOverviewEventEmitter = new DormitoryOverviewEventEmitter();
dormitoryOverviewEventEmitter.setMaxListeners(100);

export function emitDormitoryOverviewInvalidated(domain: DormitoryOverviewDomain): void {
  const payload: DormitoryOverviewInvalidatedEvent = {
    type: 'dormitory_overview.invalidated',
    domain,
    event_id: randomUUID(),
    timestamp: Date.now(),
  };
  dormitoryOverviewEventEmitter.emit('dormitory_overview_event', payload);
}

// Bridge existing invoice events to overview invalidation
dormitoryInvoiceEventEmitter.on('dormitory_invoice_event', () => {
  emitDormitoryOverviewInvalidated('invoices');
});
