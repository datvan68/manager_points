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

  it('clears room and bed assignments before deleting a room with occupied beds', async () => {
    const room = { _id: 'room-1', room_code: 'A101' };
    const roomModel: any = { findByIdAndDelete: jest.fn().mockReturnValue(resolvedQuery(room)) };
    const bedModel: any = {
      countDocuments: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockReturnValue(resolvedQuery({ deletedCount: 2 })),
    };
    const assignments = [{ _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1' }];
    const rosterModel: any = {
      find: jest.fn().mockReturnValue(resolvedQuery(assignments)),
      updateMany: jest.fn().mockReturnValue(resolvedQuery({ modifiedCount: 1 })),
      updateOne: jest.fn(),
    };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any, rosterModel);

    await expect(service.remove('room-1', {})).resolves.toBe(room);

    expect(rosterModel.updateMany).toHaveBeenCalledWith(
      { room_id: 'room-1' },
      { $unset: { room_id: '', bed_id: '' } },
    );
    expect(roomModel.findByIdAndDelete).toHaveBeenCalledWith('room-1');
    expect(bedModel.deleteMany).toHaveBeenCalledWith({ room_id: 'room-1' });
  });

  it('keeps members assigned when room deletion is rejected for protected bed history', async () => {
    const roomModel: any = { findByIdAndDelete: jest.fn() };
    const bedModel: any = { countDocuments: jest.fn().mockResolvedValue(1), deleteMany: jest.fn() };
    const rosterModel: any = { find: jest.fn(), updateMany: jest.fn() };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any, rosterModel);

    await expect(service.remove('room-1', {})).rejects.toThrow('lịch sử giường');

    expect(rosterModel.find).not.toHaveBeenCalled();
    expect(rosterModel.updateMany).not.toHaveBeenCalled();
    expect(roomModel.findByIdAndDelete).not.toHaveBeenCalled();
    expect(bedModel.deleteMany).not.toHaveBeenCalled();
  });

  it('does not restore room assignments after the room itself has been deleted', async () => {
    const roomModel: any = { findByIdAndDelete: jest.fn().mockReturnValue(resolvedQuery({ _id: 'room-1' })) };
    const bedModel: any = {
      countDocuments: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockReturnValue(resolvedQuery(Promise.reject(new Error('bed delete failed')))),
    };
    const rosterModel: any = {
      find: jest.fn().mockReturnValue(resolvedQuery([{ _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1' }])),
      updateMany: jest.fn().mockReturnValue(resolvedQuery({ modifiedCount: 1 })),
      updateOne: jest.fn(),
    };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any, rosterModel);

    await expect(service.remove('room-1', {})).rejects.toThrow('bed delete failed');

    expect(rosterModel.updateOne).not.toHaveBeenCalled();
  });

  it('maps a duplicate-key race during room creation to a conflict', async () => {
    const roomModel: any = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockRejectedValue({ code: 11000 }),
    }));
    roomModel.findOne = jest.fn().mockResolvedValue(null);
    const buildingModel: any = { findById: jest.fn().mockResolvedValue({ _id: 'building-1' }) };
    const service = new RoomsService(roomModel, {} as any, buildingModel, {} as any);

    await expect(service.create({
      room_code: ' a101 ', room_name: 'Room A101', building_id: 'building-1', room_type: 'Thường', bed_count: 2, room_price: 1,
    } as any, {})).rejects.toThrow('already exists');
  });

  it('rejects a missing room before attempting any update', async () => {
    const roomModel: any = {
      findById: jest.fn().mockReturnValue(resolvedQuery(null)),
      findByIdAndUpdate: jest.fn(),
    };
    const service = new RoomsService(roomModel, {} as any, {} as any, {} as any);

    await expect(service.update('missing', { room_name: 'Updated' } as any, {})).rejects.toThrow('Room not found');
    expect(roomModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent target building before changing the room', async () => {
    const roomModel: any = {
      findById: jest.fn().mockReturnValue(resolvedQuery({ _id: 'room-1', room_code: 'A101' })),
      findByIdAndUpdate: jest.fn(),
    };
    const buildingModel: any = { findById: jest.fn().mockReturnValue(resolvedQuery(null)) };
    const service = new RoomsService(roomModel, {} as any, buildingModel, {} as any);

    await expect(service.update('room-1', { building_id: 'building-missing' } as any, {})).rejects.toThrow('Building not found');
    expect(roomModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a duplicate normalized room code during update', async () => {
    const roomModel: any = {
      findById: jest.fn().mockReturnValue(resolvedQuery({ _id: 'room-1', room_code: 'A101' })),
      findOne: jest.fn().mockReturnValue(resolvedQuery({ _id: 'room-2', room_code: 'B202' })),
      findByIdAndUpdate: jest.fn(),
    };
    const service = new RoomsService(roomModel, {} as any, {} as any, {} as any);

    await expect(service.update('room-1', { room_code: ' b202 ' } as any, {})).rejects.toThrow('B202');
    expect(roomModel.findOne).toHaveBeenCalledWith({ room_code: 'B202', _id: { $ne: 'room-1' } });
    expect(roomModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('renames every canonical bed when the room code changes', async () => {
    const updatedRoom = { _id: 'room-1', room_code: 'B202' };
    const roomModel: any = {
      findById: jest.fn().mockReturnValue(resolvedQuery({ _id: 'room-1', room_code: 'A101' })),
      findOne: jest.fn().mockReturnValue(resolvedQuery(null)),
      findByIdAndUpdate: jest.fn().mockReturnValue(resolvedQuery(updatedRoom)),
    };
    const bedModel: any = {
      find: jest.fn().mockReturnValue(bedsQuery([
        { _id: 'bed-1', bed_code: 'A101-G1', status: DORMITORY_ENUMS.bedStatus[0] },
        { _id: 'bed-2', bed_code: 'A101-G2', status: DORMITORY_ENUMS.bedStatus[1] },
      ])),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any);

    await expect(service.update('room-1', { room_code: ' b202 ' } as any, {})).resolves.toBe(updatedRoom);
    expect(bedModel.updateOne).toHaveBeenNthCalledWith(1, { _id: 'bed-1', room_id: 'room-1' }, { $set: { bed_code: 'B202-G1' } });
    expect(bedModel.updateOne).toHaveBeenNthCalledWith(2, { _id: 'bed-2', room_id: 'room-1' }, { $set: { bed_code: 'B202-G2' } });
  });

  it('restores room fields and bed codes when bed synchronization fails', async () => {
    const originalRoom = { _id: 'room-1', room_code: 'A101', bed_count: 2 };
    const updatedRoom = { ...originalRoom, room_code: 'B202' };
    const roomModel: any = {
      findById: jest.fn().mockReturnValue(resolvedQuery(originalRoom)),
      findOne: jest.fn().mockReturnValue(resolvedQuery(null)),
      findByIdAndUpdate: jest.fn()
        .mockReturnValueOnce(resolvedQuery(updatedRoom))
        .mockResolvedValue(undefined),
    };
    const bedModel: any = {
      find: jest.fn()
        .mockReturnValueOnce(bedsQuery([{ _id: 'bed-1', bed_code: 'A101-G1', status: DORMITORY_ENUMS.bedStatus[0] }]))
        .mockReturnValueOnce(bedsQuery([{ _id: 'bed-1', bed_code: 'B202-G1', status: DORMITORY_ENUMS.bedStatus[0] }])),
      countDocuments: jest.fn().mockResolvedValue(1),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RoomsService(roomModel, bedModel, {} as any, {} as any);
    jest.spyOn(service, 'ensureRoomBeds').mockRejectedValue(new Error('bed sync failed'));

    await expect(service.update('room-1', { room_code: ' b202 ', bed_count: 3 } as any, {})).rejects.toThrow('bed sync failed');
    expect(roomModel.findByIdAndUpdate).toHaveBeenLastCalledWith('room-1', { $set: { room_code: 'A101', bed_count: 2 } });
    expect(bedModel.updateOne).toHaveBeenLastCalledWith(
      { _id: 'bed-1', room_id: 'room-1' },
      { $set: { bed_code: 'A101-G1', status: DORMITORY_ENUMS.bedStatus[0] } },
    );
  });
});
