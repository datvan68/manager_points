jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { ConflictException } from '@nestjs/common';
import { RoomAssignmentService } from './room-assignment.service';

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

  it('does not reserve another bed for an already assigned student', async () => {
    const registrationModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'registration-1', status: 'Đã duyệt', bed_id: 'bed-existing' }),
    };
    const bedModel: any = { findOneAndUpdate: jest.fn() };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new RoomAssignmentService({} as any, bedModel, registrationModel, contractModel, {} as any, {} as any);

    await expect(service.assignRoom({ registration_id: 'registration-1', room_id: 'room-1', bed_id: 'bed-2' }, {})).rejects.toBeInstanceOf(ConflictException);
    expect(bedModel.findOneAndUpdate).not.toHaveBeenCalled();
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
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0),
    };
    const roomsService: any = {
      ensureRoomBeds: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RoomAssignmentService(roomModel, bedModel, registrationModel, {} as any, {} as any, roomsService);

    await expect(service.suggestRooms('registration-1')).resolves.toEqual([
      expect.objectContaining({ _id: 'room-1', available_bed_count: 2 }),
    ]);
    expect(roomsService.ensureRoomBeds).toHaveBeenCalledWith('room-1', 4);
    expect(roomsService.ensureRoomBeds).toHaveBeenCalledWith('room-2', 4);
    expect(bedModel.countDocuments).toHaveBeenCalledWith({ room_id: 'room-1', status: 'Trống' });
  });
});
