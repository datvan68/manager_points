import 'reflect-metadata';
import { StudentsController } from '../students.controller';

describe('StudentsController', () => {
  it('keeps the student list route protected by the stricter named throttles', () => {
    const handler = StudentsController.prototype.findAll;

    expect(Reflect.getMetadata('THROTTLER:LIMITburst', handler)).toBe(20);
    expect(Reflect.getMetadata('THROTTLER:TTLburst', handler)).toBe(10_000);
    expect(Reflect.getMetadata('THROTTLER:LIMITsustained', handler)).toBe(120);
    expect(Reflect.getMetadata('THROTTLER:TTLsustained', handler)).toBe(60_000);
  });
});
