import { EventEmitter } from 'events';

export type DormitoryInvoiceKind = 'utility' | 'room_fee';
export type DormitoryInvoiceAction = 'created' | 'updated' | 'deleted';

export interface DormitoryInvoiceRealtimePayload {
  kind: DormitoryInvoiceKind;
  action: DormitoryInvoiceAction;
  id?: string;
  ids?: string[];
  timestamp?: number;
}

class DormitoryInvoiceEventEmitter extends EventEmitter {}

export const dormitoryInvoiceEventEmitter = new DormitoryInvoiceEventEmitter();
dormitoryInvoiceEventEmitter.setMaxListeners(100);
