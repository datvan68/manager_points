import { EventEmitter } from 'events';

// Tăng max listeners nếu có nhiều người dùng kết nối cùng lúc
class GradingEventEmitter extends EventEmitter {}

export const gradingEventEmitter = new GradingEventEmitter();
gradingEventEmitter.setMaxListeners(100);
