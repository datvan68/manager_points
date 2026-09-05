jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import { ConflictException } from '@nestjs/common';
import { RoomAssignmentService } from './room-assignment.service';
import { dormitoryOverviewEventEmitter } from '../dormitory-overview-event-emitter';

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

  it('preserves the leader when only the bed changes inside the same room', async () => {
    const rosterEntry = { _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1', room_type: 'Thường', is_room_leader: true };
    const roomModel: any = { findById: jest.fn().mockResolvedValue({ _id: 'room-1', status: 'Trống' }) };
    const bedModel: any = { findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'bed-2', room_id: 'room-1', status: 'Đang sử dụng' }) };
    const rosterModel: any = {
      findById: jest.fn().mockResolvedValue(rosterEntry),
      findOneAndUpdate: jest.fn().mockResolvedValue({ ...rosterEntry, bed_id: 'bed-2' }),
    };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue(null) };
    const roomsService: any = { syncRoomAvailability: jest.fn().mockResolvedValue(undefined) };
    const service = new RoomAssignmentService(roomModel, bedModel, rosterModel, contractModel, roomsService);

    const result = await service.assignRoom({ roster_entry_id: 'roster-1', room_id: 'room-1', bed_id: 'bed-2' }, {});

    expect(rosterModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'roster-1', bed_id: 'bed-1' },
      { $set: { room_id: 'room-1', bed_id: 'bed-2' } },
      { new: true },
    );
    expect(result.roster_entry).toEqual(expect.objectContaining({ is_room_leader: true }));
  });

  it('clears the leader when an assignment moves to another room', async () => {
    const rosterEntry = { _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1', room_type: 'Thường', is_room_leader: true };
    const roomModel: any = { findById: jest.fn().mockResolvedValue({ _id: 'room-2', status: 'Trống' }) };
    const bedModel: any = { findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'bed-2', room_id: 'room-2', status: 'Đang sử dụng' }) };
    const rosterModel: any = {
      findById: jest.fn().mockResolvedValue(rosterEntry),
      findOneAndUpdate: jest.fn().mockResolvedValue({ ...rosterEntry, room_id: 'room-2', bed_id: 'bed-2', is_room_leader: false }),
    };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue(null) };
    const roomsService: any = { syncRoomAvailability: jest.fn().mockResolvedValue(undefined) };
    const service = new RoomAssignmentService(roomModel, bedModel, rosterModel, contractModel, roomsService);

    await service.assignRoom({ roster_entry_id: 'roster-1', room_id: 'room-2', bed_id: 'bed-2' }, {});

    expect(rosterModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'roster-1', bed_id: 'bed-1' },
      { $set: { room_id: 'room-2', bed_id: 'bed-2' }, $unset: { is_room_leader: '' } },
      { new: true },
    );
  });

  it('restores the leader flag when an active-contract assignment rolls back', async () => {
    const rosterEntry = { _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1', room_type: 'Thường', is_room_leader: true };
    const contract = { _id: 'contract-1', roster_entry_id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1', status: 'Hiệu lực' };
    const roomModel: any = { findById: jest.fn().mockResolvedValue({ _id: 'room-2', status: 'Trống' }) };
    const bedModel: any = { findOneAndUpdate: jest.fn()
      .mockResolvedValueOnce({ _id: 'bed-2', room_id: 'room-2', status: 'Đang sử dụng' })
      .mockResolvedValue({ _id: 'bed-2', room_id: 'room-2', status: 'Trống' })
      .mockResolvedValueOnce({ _id: 'bed-1', room_id: 'room-1', status: 'Đang sử dụng' }) };
    const rosterModel: any = {
      findById: jest.fn().mockResolvedValue(rosterEntry),
      findOneAndUpdate: jest.fn()
        .mockRejectedValueOnce(new ConflictException('roster changed'))
        .mockResolvedValueOnce({ ...rosterEntry }),
    };
    const contractModel: any = {
      findOne: jest.fn().mockResolvedValue(contract),
      findOneAndUpdate: jest.fn().mockResolvedValue({ ...contract, room_id: 'room-2', bed_id: 'bed-2' }),
    };
    const roomsService: any = { syncRoomAvailability: jest.fn().mockResolvedValue(undefined) };
    const service = new RoomAssignmentService(roomModel, bedModel, rosterModel, contractModel, roomsService);

    await expect(service.assignRoom({ roster_entry_id: 'roster-1', room_id: 'room-2', bed_id: 'bed-2' }, {})).rejects.toThrow('roster changed');
    expect(rosterModel.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'roster-1', bed_id: 'bed-2' },
      { $set: { room_id: 'room-1', bed_id: 'bed-1', is_room_leader: true } },
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

  it('releases an occupied bed and deletes the assigned roster entry without checking contracts', async () => {
    const rosterEntry = { _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1' };
    const rosterModel: any = {
      findById: jest.fn().mockResolvedValue(rosterEntry),
      findOneAndUpdate: jest.fn()
        .mockResolvedValueOnce({ _id: 'roster-1' })
        .mockResolvedValueOnce(null),
      findOneAndDelete: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(rosterEntry) })),
    };
    const bedModel: any = { findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'bed-1', status: 'Trống' }) };
    const contractModel: any = { findOne: jest.fn() };
    const roomsService: any = { syncRoomAvailability: jest.fn().mockResolvedValue(undefined) };
    const service = new RoomAssignmentService({} as any, bedModel, rosterModel, contractModel, roomsService);
    const events: unknown[] = [];
    const listener = (event: unknown) => events.push(event);
    dormitoryOverviewEventEmitter.on('dormitory_overview_event', listener);

    await service.deleteRosterEntry('roster-1');

    dormitoryOverviewEventEmitter.off('dormitory_overview_event', listener);
    expect(contractModel.findOne).not.toHaveBeenCalled();
    expect(bedModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'bed-1', status: 'Đang sử dụng' },
      { $set: { status: 'Trống' } },
    );
    expect(roomsService.syncRoomAvailability).toHaveBeenCalledWith('room-1');
    expect(events).toHaveLength(0);
  });

  it('restores the assignment and occupied bed when deleting the roster entry fails', async () => {
    const rosterModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1', is_room_leader: true }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'roster-1' }),
      findOneAndDelete: jest.fn(() => ({ exec: jest.fn().mockResolvedValue(null) })),
    };
    const bedModel: any = { findOneAndUpdate: jest.fn()
      .mockResolvedValueOnce({ _id: 'bed-1', status: 'Trống' })
      .mockResolvedValueOnce({ _id: 'bed-1', status: 'Đang sử dụng' }) };
    const roomsService: any = { syncRoomAvailability: jest.fn().mockResolvedValue(undefined) };
    const service = new RoomAssignmentService({} as any, bedModel, rosterModel, {} as any, roomsService);

    await expect(service.deleteRosterEntry('roster-1')).rejects.toThrow(ConflictException);
    expect(rosterModel.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'roster-1', bed_id: { $exists: false } },
      { $set: { room_id: 'room-1', bed_id: 'bed-1', is_room_leader: true } },
      { new: true },
    );
    expect(bedModel.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'bed-1', status: 'Trống' },
      { $set: { status: 'Đang sử dụng' } },
    );
  });

  it('restores the leader flag when unassignment rolls back', async () => {
    const rosterModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'roster-1', room_id: 'room-1', bed_id: 'bed-1', is_room_leader: true }),
      findOneAndUpdate: jest.fn()
        .mockResolvedValueOnce({ _id: 'roster-1' })
        .mockResolvedValueOnce({ _id: 'roster-1' }),
    };
    const bedModel: any = { findOneAndUpdate: jest.fn().mockResolvedValue(null) };
    const contractModel: any = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new RoomAssignmentService({} as any, bedModel, rosterModel, contractModel, {} as any);

    await expect(service.unassignRoom('roster-1', {})).rejects.toThrow(ConflictException);
    expect(rosterModel.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'roster-1', bed_id: { $exists: false } },
      { $set: { room_id: 'room-1', bed_id: 'bed-1', is_room_leader: true } },
      { new: true },
    );
  });

  it('deletes an unassigned roster entry without touching beds or contracts', async () => {
    const rosterModel: any = {
      findById: jest.fn().mockResolvedValue({ _id: 'roster-1' }),
      findByIdAndDelete: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({ _id: 'roster-1' }) })),
    };
    const bedModel: any = { findOneAndUpdate: jest.fn() };
    const contractModel: any = { findOne: jest.fn() };
    const service = new RoomAssignmentService({} as any, bedModel, rosterModel, contractModel, {} as any);

    await service.deleteRosterEntry('roster-1');

    expect(rosterModel.findByIdAndDelete).toHaveBeenCalledWith('roster-1');
    expect(bedModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(contractModel.findOne).not.toHaveBeenCalled();
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
