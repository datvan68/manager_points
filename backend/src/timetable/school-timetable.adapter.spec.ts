import { ConfigService } from '@nestjs/config';
import { SchoolTimetableAdapter } from './school-timetable.adapter';

describe('SchoolTimetableAdapter', () => {
  it('fails closed without source credentials and does not expose them', async () => {
    const adapter = new SchoolTimetableAdapter({ get: () => '' } as unknown as ConfigService);
    await expect(adapter.getOptions('viewer-1')).rejects.toMatchObject({ code: 'SOURCE_NOT_CONFIGURED' });
  });
});
