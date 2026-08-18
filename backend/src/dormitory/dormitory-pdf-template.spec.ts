import { DORMITORY_ROSTER_APPLICATION_DESCRIPTOR } from './pdf-template-adapter';

describe('dormitory-pdf-template contract', () => {
  it('exposes the one-page normalized KTX layout', () => {
    expect(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.templateTypeCode).toBe('DORMITORY_ROSTER_APPLICATION');
    expect(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.moduleCode).toBe('DORMITORY');
    expect(DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.fields.length).toBe(25);
  });
});
