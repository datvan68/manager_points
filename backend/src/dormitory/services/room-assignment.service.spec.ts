jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { ConflictException } from '@nestjs/common';
import { RoomAssignmentService } from './room-assignment.service';
import { DORMITORY_ENUMS } from '../dormitory-enums';

function roomsQuery(value: any[]) {
  const query: any = {
    populate: jest.fn(() => query),
    lean: jest.fn(() => query),
    exec: jest.fn().mockResolvedValue(value),
  };
  return query;
}

describe('RoomAssignmentService', () => {
  it('reserves one available bed and persists it on the registration', async () => {
    const registration = { _id: 'registration-1', status: 'Đã duyệt' };
    const assignedRegistration = { ...registration, room_id: 'room-1', bed_id: 'bed-1' };
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue(registration),
      findOneAndUpdate: jest.fn().mockResolvedValue(assignedRegistration),
    };
    const roomModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'room-1', room_code: 'A101', status: 'Trống' }),
    };
    const bedModel: any = {
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'bed-1', room_id: 'room-1', status: 'Đang sử dụng' }),
    };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue(null) };
    const publicRegistrationModel: any = {};
    const roomsService: any = { syncRoomAvailability: jest.fn().mockResolvedValue(undefined) };
    const service = new RoomAssignmentService(roomModel, bedModel, registrationModel, contractModel, publicRegistrationModel, roomsService);

    const result = await service.assignRoom({ registration_id: 'registration-1', room_id: 'room-1', bed_id: 'bed-1' }, {});

    expect(bedModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'bed-1', room_id: 'room-1', status: 'Trống' },
      { $set: { status: 'Đang sử dụng' } },
      { new: true },
    );
    expect(registrationModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'registration-1' }),
      { $set: { room_id: 'room-1', bed_id: 'bed-1' } },
      { new: true },
    );
    expect(roomsService.syncRoomAvailability).toHaveBeenCalledWith('room-1');
    expect(result.registration).toBe(assignedRegistration);
  });

  it('reassigns an already assigned student through the same command', async () => {
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'registration-1', status: 'Đã duyệt', bed_id: 'bed-existing' }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'registration-1', room_id: 'room-2', bed_id: 'bed-2' }),
    };
    const bedModel: any = { findOneAndUpdate: jest.fn()
      .mockResolvedValueOnce({ _id: 'bed-2', room_id: 'room-2', status: 'Đang sử dụng' })
      .mockResolvedValueOnce({ _id: 'bed-existing', room_id: 'room-1', status: 'Trống' }) };
    const roomModel: any = { findById: jest.fn().mockResolvedValue({ _id: 'room-2', room_code: 'A102', status: 'Trống' }) };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue(null) };
    const roomsService: any = { syncRoomAvailability: jest.fn().mockResolvedValue(undefined) };
    const service = new RoomAssignmentService(roomModel, bedModel, registrationModel, contractModel, {} as any, roomsService);

    await expect(service.assignRoom({ registration_id: 'registration-1', room_id: 'room-2', bed_id: 'bed-2' }, {})).resolves.toEqual(expect.objectContaining({ message: 'Chuyển phòng thành công' }));
    expect(bedModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('calculates free-bed counts when room suggestions are opened', async () => {
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'registration-1', preference: {} }),
    };
    const roomModel: any = {
      find: jest.fn().mockReturnValue(roomsQuery([
        { _id: 'room-1', room_code: 'A101', bed_count: 4, status: 'Trống' },
        { _id: 'room-2', room_code: 'A102', bed_count: 4, status: 'Đầy' },
      ])),
    };
    const bedModel: any = {
      countDocuments: jest.fn()
        .mockResolvedValueOnce(4).mockResolvedValueOnce(2).mockResolvedValueOnce(2)
        .mockResolvedValueOnce(4).mockResolvedValueOnce(4).mockResolvedValueOnce(0),
    };
    const roomsService: any = {
      ensureRoomBeds: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RoomAssignmentService(roomModel, bedModel, registrationModel, {} as any, {} as any, roomsService);

    await expect(service.suggestRooms('registration-1')).resolves.toEqual([
      expect.objectContaining({ _id: 'room-1', max_students: 4, current_students: 2, available_bed_count: 2 }),
    ]);
    expect(roomsService.ensureRoomBeds).not.toHaveBeenCalled();
    expect(bedModel.countDocuments).toHaveBeenCalledWith({ room_id: 'room-1', status: 'Trống' });
  });

  it('keeps the effective current room visible when it has no free beds', async () => {
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'registration-1', room_id: 'room-current', preference: {} }),
    };
    const roomModel: any = {
      find: jest.fn().mockReturnValue(roomsQuery([
        { _id: 'room-current', room_code: 'A101', status: 'Đầy' },
        { _id: 'room-other', room_code: 'A102', status: 'Trống' },
      ])),
    };
    const bedModel: any = {
      countDocuments: jest.fn()
        .mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2).mockResolvedValueOnce(0).mockResolvedValueOnce(2),
    };
    const service = new RoomAssignmentService(
      roomModel,
      bedModel,
      registrationModel,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      {} as any,
    );

    await expect(service.suggestRooms('registration-1')).resolves.toEqual([
      expect.objectContaining({ _id: 'room-other', available_bed_count: 2 }),
      expect.objectContaining({ _id: 'room-current', available_bed_count: 0 }),
    ]);
  });

  it('keeps a protected current room visible without making its free beds selectable', async () => {
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'registration-1', room_id: 'room-current', preference: {} }),
    };
    const roomModel: any = {
      find: jest.fn().mockReturnValue(roomsQuery([
        { _id: 'room-current', room_code: 'A101', status: DORMITORY_ENUMS.roomStatus[2] },
      ])),
    };
    const bedModel: any = {
      countDocuments: jest.fn()
        .mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(1),
    };
    const service = new RoomAssignmentService(
      roomModel,
      bedModel,
      registrationModel,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      {} as any,
    );

    await expect(service.suggestRooms('registration-1')).resolves.toEqual([
      expect.objectContaining({
        _id: 'room-current',
        available_bed_count: 1,
        status: DORMITORY_ENUMS.roomStatus[2],
      }),
    ]);
  });

  it('releases the bed when registration persistence fails', async () => {
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'registration-1', status: DORMITORY_ENUMS.registrationStatus[1] }),
      findOneAndUpdate: jest.fn().mockRejectedValueOnce(new Error('registration write failed')),
    };
    const roomModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'room-1', room_code: 'A101', status: DORMITORY_ENUMS.roomStatus[0] }),
    };
    const bedModel: any = {
      findOneAndUpdate: jest.fn()
        .mockResolvedValueOnce({ _id: 'bed-1', room_id: 'room-1', status: DORMITORY_ENUMS.bedStatus[1] })
        .mockResolvedValueOnce({ _id: 'bed-1', room_id: 'room-1', status: DORMITORY_ENUMS.bedStatus[0] }),
    };
    const service = new RoomAssignmentService(
      roomModel,
      bedModel,
      registrationModel,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      { syncRoomAvailability: jest.fn() } as any,
    );

    await expect(service.assignRoom({ registration_id: 'registration-1', room_id: 'room-1', bed_id: 'bed-1' }, {})).rejects.toThrow('registration write failed');
    expect(bedModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('compensates registration and bed writes when availability synchronization fails', async () => {
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'registration-1', status: DORMITORY_ENUMS.registrationStatus[1] }),
      findOneAndUpdate: jest.fn()
        .mockResolvedValueOnce({ _id: 'registration-1', room_id: 'room-1', bed_id: 'bed-1' })
        .mockResolvedValueOnce({ _id: 'registration-1' }),
    };
    const roomModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'room-1', room_code: 'A101', status: DORMITORY_ENUMS.roomStatus[0] }),
    };
    const bedModel: any = {
      findOneAndUpdate: jest.fn()
        .mockResolvedValueOnce({ _id: 'bed-1', room_id: 'room-1', status: DORMITORY_ENUMS.bedStatus[1] })
        .mockResolvedValueOnce({ _id: 'bed-1', room_id: 'room-1', status: DORMITORY_ENUMS.bedStatus[0] }),
    };
    const syncRoomAvailability = jest.fn()
      .mockRejectedValueOnce(new Error('availability write failed'))
      .mockResolvedValue(undefined);
    const service = new RoomAssignmentService(
      roomModel,
      bedModel,
      registrationModel,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      { syncRoomAvailability } as any,
    );

    await expect(service.assignRoom({ registration_id: 'registration-1', room_id: 'room-1', bed_id: 'bed-1' }, {})).rejects.toThrow('availability write failed');
    expect(registrationModel.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'registration-1', bed_id: 'bed-1' },
      { $unset: { room_id: '', bed_id: '' } },
      { new: true },
    );
    expect(bedModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(syncRoomAvailability).toHaveBeenCalledTimes(2);
  });

  it('lets only one concurrent request reserve a shared bed', async () => {
    let bedStatus = DORMITORY_ENUMS.bedStatus[0];
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'registration-1', status: DORMITORY_ENUMS.registrationStatus[1] }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'registration-1', room_id: 'room-1', bed_id: 'bed-1' }),
    };
    const roomModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'room-1', room_code: 'A101', status: DORMITORY_ENUMS.roomStatus[0] }),
    };
    const bedModel: any = {
      findOneAndUpdate: jest.fn(async () => {
        if (bedStatus !== DORMITORY_ENUMS.bedStatus[0]) return null;
        bedStatus = DORMITORY_ENUMS.bedStatus[1];
        return { _id: 'bed-1', room_id: 'room-1', status: bedStatus };
      }),
    };
    const service = new RoomAssignmentService(
      roomModel,
      bedModel,
      registrationModel,
      { findOne: jest.fn().mockResolvedValue(null) } as any,
      {} as any,
      { syncRoomAvailability: jest.fn().mockResolvedValue(undefined) } as any,
    );

    const results = await Promise.allSettled([
      service.assignRoom({ registration_id: 'registration-1', room_id: 'room-1', bed_id: 'bed-1' }, {}),
      service.assignRoom({ registration_id: 'registration-2', room_id: 'room-1', bed_id: 'bed-1' }, {}),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(bedStatus).toBe(DORMITORY_ENUMS.bedStatus[1]);
  });
});
