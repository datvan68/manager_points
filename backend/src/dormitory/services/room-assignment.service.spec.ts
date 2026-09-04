jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { ConflictException } from '@nestjs/common';
import { RoomAssignmentService } from './room-assignment.service';

describe('RoomAssignmentService canonical roster flow', () => {
  it('assigns a bed using roster_entry_id and persists the canonical response', async () => {
    const roomModel: any = { findById: jest.fn().mockResolvedValue({ _id: 'room-1', status: 'Trống' }) };
    const bedModel: any = { findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'bed-1', room_id: 'room-1', status: 'Đang sử dụng' }) };
    const rosterModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'roster-1', room_type: 'Thường' }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1' }),
    };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue(null) };
    const roomsService: any = { syncRoomAvailability: jest.fn().mockResolvedValue(undefined) };
    const service = new RoomAssignmentService(roomModel, bedModel, rosterModel, contractModel, roomsService);

    const result = await service.assignRoom({ roster_entry_id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1' }, {});

    expect(result).toEqual(expect.objectContaining({ roster_entry: expect.objectContaining({ _id: 'roster-1' }) }));
    expect(contractModel.findOne).toHaveBeenCalledWith({ roster_entry_id: 'roster-1', status: 'Hiệu lực' });
    expect(rosterModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'roster-1', $or: [{ bed_id: { $exists: false } }, { bed_id: null }] },
      { $set: { room_id: 'room-1', bed_id: 'bed-1' } },
      { new: true },
    );
  });

  it('protects an assigned roster entry from unassignment while its contract is active', async () => {
    const rosterModel: any = { findById: jest.fn().mockResolvedValue({ _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1' }) };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue({ _id: 'contract-1' }) };
    const service = new RoomAssignmentService({} as any, {} as any, rosterModel, contractModel, {} as any);

    await expect(service.unassignRoom('roster-1', {})).rejects.toThrow(ConflictException);
    expect(contractModel.findOne).toHaveBeenCalledWith({ roster_entry_id: 'roster-1', status: 'Hiệu lực' });
  });

  it('resolves a room code and assigns its first available bed', async () => {
    const room = { _id: 'room-1', room_code: 'P101', status: 'Trống' };
    const roomModel: any = {
      findOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(room) })),
      findById: jest.fn().mockResolvedValue(room),
    };
    const bedModel: any = {
      findOne: jest.fn(() => ({ sort: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({ _id: 'bed-1', room_id: 'room-1' }) })) })),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'bed-1', room_id: 'room-1', status: 'Đang sử dụng' }),
    };
    const rosterModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'roster-1', room_type: 'Thường' }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1' }),
    };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new RoomAssignmentService(roomModel, bedModel, rosterModel, contractModel, { syncRoomAvailability: jest.fn().mockResolvedValue(undefined) } as any);

    await service.assignFirstAvailableBed('roster-1', ' p101 ', {});

    expect(roomModel.findOne).toHaveBeenCalledWith({ room_code: { $regex: '^P101$', $options: 'i' } });
    expect(bedModel.findOne).toHaveBeenCalledWith({ room_id: 'room-1', status: 'Trống' });
    expect(rosterModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'roster-1', $or: [{ bed_id: { $exists: false } }, { bed_id: null }] },
      { $set: { room_id: 'room-1', bed_id: 'bed-1' } },
      { new: true },
    );
  });
});
