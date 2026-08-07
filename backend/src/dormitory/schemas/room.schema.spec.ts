import { RoomSchema } from './room.schema';

describe('RoomSchema', () => {
  it('defaults floor to one when omitted for compatibility', () => {
    expect(RoomSchema.path('floor').options.default).toBe(1);
  });
});
