import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dormitoryApi } from './dormitory-api';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('dormitory roster API', () => {
  beforeEach(() => fetchMock.mockResolvedValue({ ok: true, text: vi.fn().mockResolvedValue(JSON.stringify({})) }));

  it('uses canonical roster CRUD endpoints and persists PATCH payloads', async () => {
    await dormitoryApi.roster.create({ full_name: 'Nguyễn A', date_of_birth: '2003-01-01', gender: 'Other', phone_number: '0912345678', room_type: 'Thường' });
    await dormitoryApi.roster.update('entry-1', { notes: 'updated' });
    await dormitoryApi.roster.delete('entry-1');
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining('/dormitory/roster'),
      expect.stringContaining('/dormitory/roster/entry-1'),
      expect.stringContaining('/dormitory/roster/entry-1'),
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ notes: 'updated' });
  });

  it('sends only roster_entry_id for room assignment', async () => {
    await dormitoryApi.roster.assignRoom({ roster_entry_id: 'entry-1', room_id: 'room-1', bed_id: 'bed-1' });
    await dormitoryApi.roster.unassignRoom('entry-1');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ roster_entry_id: 'entry-1', room_id: 'room-1', bed_id: 'bed-1' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ roster_entry_id: 'entry-1' });
  });
});
