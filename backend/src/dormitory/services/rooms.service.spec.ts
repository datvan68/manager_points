jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { RoomsService } from './rooms.service';

function bedsQuery(value: Array<{ bed_code: string }>) {
  const query: any = {
    select: jest.fn(() => query),
    lean: jest.fn(() => query),
    exec: jest.fn().mockResolvedValue(value),
  };
  return query;
}

describe('RoomsService', () => {
  it('creates persisted beds when a room is created', async () => {
    const savedRoom = { _id: 'room-1', room_code: 'A101' };
    const save = jest.fn().mockResolvedValue(savedRoom);
    const roomModel: any = jest.fn().mockImplementation(() => ({ save }));
    roomModel.findOne = jest.fn().mockResolvedValue(null);
    const buildingModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'building-1' }),
    };
    const service = new RoomsService(roomModel, {} as any, buildingModel, {} as any);
    jest.spyOn(service, 'ensureRoomBeds').mockResolvedValue(undefined);

    await expect(service.create({
      room_code: 'A101',
      room_name: 'Room A101',
      building_id: 'building-1',
      room_type: 'Thường',
      bed_count: 4,
      room_price: 100000,
    } as any, {})).resolves.toBe(savedRoom);

    expect(service.ensureRoomBeds).toHaveBeenCalledWith('room-1', 4);
  });

  it('adds only missing bed records for an existing room', async () => {
    const bedModel: any = {
      find: jest.fn().mockReturnValue(bedsQuery([
        { bed_code: 'CUSTOM' },
        { bed_code: 'G01' },
      ])),
      bulkWrite: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RoomsService({} as any, bedModel, {} as any, {} as any);
    jest.spyOn(service, 'syncRoomAvailability').mockResolvedValue(undefined);

    await service.ensureRoomBeds('room-1', 4);

    expect(bedModel.bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          filter: { room_id: 'room-1', bed_code: 'G02' },
        }),
      }),
      expect.objectContaining({
        updateOne: expect.objectContaining({
          filter: { room_id: 'room-1', bed_code: 'G03' },
        }),
      }),
    ], { ordered: false });
    expect(service.syncRoomAvailability).toHaveBeenCalledWith('room-1');
  });
});
