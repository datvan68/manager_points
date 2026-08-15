jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { RoomsService } from './rooms.service';
import { DORMITORY_ENUMS } from '../dormitory-enums';

function resolvedQuery<T>(value: T) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function bedsQuery(value: Array<{ bed_code: string; status?: string }>) {
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

  it('normalizes room codes before duplicate checks and persistence', async () => {
    const savedRoom = { _id: 'room-2', room_code: 'B202' };
    const save = jest.fn().mockResolvedValue(savedRoom);
    const roomModel: any = jest.fn().mockImplementation((payload) => {
      expect(payload.room_code).toBe('B202');
      return { save };
    });
    roomModel.findOne = jest.fn().mockResolvedValue(null);
    const buildingModel: any = { findById: jest.fn().mockResolvedValue({ _id: 'building-1' }) };
    const service = new RoomsService(roomModel, {} as any, buildingModel, {} as any);
    jest.spyOn(service, 'ensureRoomBeds').mockResolvedValue(undefined);
    jest.spyOn(service, 'findOne').mockResolvedValue(savedRoom as any);

    await service.create({ room_code: ' b202 ', room_name: 'Room B202', building_id: 'building-1', room_type: 'Thường', bed_count: 2, room_price: 100000 } as any, {});

    expect(roomModel.findOne).toHaveBeenCalledWith({ room_code: 'B202' });
  });

  it('adds only missing bed records for an existing room', async () => {
    const bedModel: any = {
      find: jest.fn().mockReturnValueOnce(bedsQuery([
        { bed_code: 'CUSTOM' },
        { bed_code: 'G01' },
      ])).mockReturnValueOnce(bedsQuery([
        { bed_code: 'A101-G1' }, { bed_code: 'A101-G2' }, { bed_code: 'A101-G3' }, { bed_code: 'A101-G4' },
      ])),
      bulkWrite: jest.fn().mockResolvedValue(undefined),
    };
    const roomModel: any = { findById: jest.fn().mockResolvedValue({ room_code: 'A101' }) };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any);
    jest.spyOn(service, 'syncRoomAvailability').mockResolvedValue(undefined);

    await service.ensureRoomBeds('room-1', 4);

    expect(bedModel.bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          filter: { room_id: 'room-1', bed_code: 'A101-G1' },
        }),
      }),
      expect.objectContaining({
        updateOne: expect.objectContaining({
          filter: { room_id: 'room-1', bed_code: 'A101-G2' },
        }),
      }),
    ], { ordered: false });
    expect(service.syncRoomAvailability).toHaveBeenCalledWith('room-1');
  });

  it('grows capacity by provisioning only the missing beds', async () => {
    const currentRoom = { _id: 'room-1', bed_count: 2 };
    const updatedRoom = { _id: 'room-1', bed_count: 4, available_bed_count: 4 };
    const roomModel: any = {
      findById: jest.fn()
        .mockReturnValueOnce(resolvedQuery(currentRoom))
        .mockReturnValueOnce(resolvedQuery(updatedRoom)),
      findByIdAndUpdate: jest.fn().mockReturnValue(resolvedQuery(updatedRoom)),
    };
    const bedModel: any = { countDocuments: jest.fn().mockResolvedValue(2) };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any);
    jest.spyOn(service, 'ensureRoomBeds').mockResolvedValue(undefined);
    jest.spyOn(service, 'findOne').mockResolvedValue(updatedRoom as any);

    await expect(service.update('room-1', { bed_count: 4 } as any, {})).resolves.toBe(updatedRoom);
    expect(service.ensureRoomBeds).toHaveBeenCalledWith('room-1', 4);
  });

  it('reactivates canonical retired beds when capacity grows again', async () => {
    const bedModel: any = {
      find: jest.fn().mockReturnValueOnce(bedsQuery([
        { _id: 'bed-1', bed_code: 'KTX01-G1', status: DORMITORY_ENUMS.bedStatus[3], has_history: false },
        { _id: 'bed-2', bed_code: 'KTX01-G2', status: DORMITORY_ENUMS.bedStatus[0], has_history: false },
      ])).mockReturnValueOnce(bedsQuery([
        { bed_code: 'KTX01-G1', status: 'Trống' }, { bed_code: 'KTX01-G2', status: 'Trống' },
      ])),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      bulkWrite: jest.fn(),
    };
    const roomModel: any = { findById: jest.fn().mockResolvedValue({ room_code: 'KTX01' }) };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any);
    jest.spyOn(service, 'syncRoomAvailability').mockResolvedValue(undefined);

    await expect(service.ensureRoomBeds('room-1', 2)).resolves.toBeUndefined();
    expect(bedModel.updateMany).toHaveBeenCalledWith(expect.objectContaining({ _id: { $in: ['bed-1'] } }), expect.any(Object));
    expect(bedModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('rejects capacity shrink below the existing bed records without updating the room', async () => {
    const roomModel: any = {
      findById: jest.fn().mockReturnValue(resolvedQuery({ _id: 'room-1', bed_count: 4 })),
      findByIdAndUpdate: jest.fn(),
    };
    const bedModel: any = { countDocuments: jest.fn().mockResolvedValue(4) };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any);

    await expect(service.update('room-1', { bed_count: 2 } as any, {})).rejects.toThrow();
    expect(roomModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a partial duplicate-key result after the final postcondition check', async () => {
    const bedModel: any = {
      find: jest.fn().mockReturnValue(bedsQuery([])),
      bulkWrite: jest.fn().mockRejectedValue({ code: 11000 }),
    };
    const roomModel: any = { findById: jest.fn().mockResolvedValue({ room_code: 'A101' }) };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any);
    jest.spyOn(service, 'syncRoomAvailability').mockResolvedValue(undefined);

    await expect(service.ensureRoomBeds('room-1', 2)).rejects.toThrow();
    expect(service.syncRoomAvailability).not.toHaveBeenCalled();
  });

  it('accepts a duplicate-key race only when the final canonical beds exist', async () => {
    const bedModel: any = {
      find: jest.fn().mockReturnValueOnce(bedsQuery([])).mockReturnValueOnce(bedsQuery([
        { bed_code: 'A101-G1' }, { bed_code: 'A101-G2' },
      ])),
      bulkWrite: jest.fn().mockRejectedValue({ code: 11000 }),
    };
    const roomModel: any = { findById: jest.fn().mockResolvedValue({ room_code: 'A101' }) };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any);
    jest.spyOn(service, 'syncRoomAvailability').mockResolvedValue(undefined);

    await expect(service.ensureRoomBeds('room-1', 2)).resolves.toBeUndefined();
    expect(service.syncRoomAvailability).toHaveBeenCalledWith('room-1');
  });

  it('rejects invalid bed counts', async () => {
    const service = new RoomsService({} as any, {} as any, {} as any, {} as any);
    await expect(service.ensureRoomBeds('room-1', 0)).rejects.toThrow();
    await expect(service.ensureRoomBeds('room-1', 1.5)).rejects.toThrow();
  });
});
