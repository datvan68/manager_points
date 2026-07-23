import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ActivityAttendanceGrantsService } from './activity-attendance-grants.service';

const query = (value: any) => ({
  select: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('ActivityAttendanceGrantsService', () => {
  const activityId = new Types.ObjectId().toString();
  const teacherId = new Types.ObjectId().toString();
  const advisorId = new Types.ObjectId().toString();
  let activityModel: any;
  let grantModel: any;
  let classModel: any;
  let userModel: any;
  let service: ActivityAttendanceGrantsService;

  beforeEach(() => {
    activityModel = { findById: jest.fn(() => query({ _id: activityId, advisor_id: advisorId })) };
    grantModel = {
      find: jest.fn(() => query([])),
      findOne: jest.fn(() => query(null)),
      findOneAndUpdate: jest.fn(() => query({ teacher_id: teacherId, allowed_methods: [], status: 'active' })),
    };
    classModel = { find: jest.fn(() => query([])), exists: jest.fn() };
    userModel = { find: jest.fn(() => query([])), findOne: jest.fn(() => query({ role: { role_code: 'TEACHER' } })) };
    service = new ActivityAttendanceGrantsService(activityModel, grantModel, classModel, userModel);
  });

  it('allows manual_class by default for an active teacher and denies QR', async () => {
    await expect(service.assertMethod(activityId, teacherId, 'TEACHER', 'manual_class')).resolves.toBeUndefined();
    await expect(service.assertMethod(activityId, teacherId, 'TEACHER', 'qr')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('treats an explicit empty active override as authoritative', async () => {
    grantModel.findOne.mockReturnValue(query({ status: 'active', allowed_methods: [] }));
    await expect(service.assertMethod(activityId, teacherId, 'TEACHER', 'manual_class')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('treats a revoked override as authoritative', async () => {
    grantModel.findOne.mockReturnValue(query({ status: 'revoked', allowed_methods: ['manual_class'] }));
    const result = await service.capabilities(activityId, { id: teacherId, roleCode: 'TEACHER' });
    expect(result.effective_methods).toEqual([]);
    expect(result.grant_status).toBe('revoked');
  });

  it('rejects a grant mutation for a non-teacher account', async () => {
    userModel.findOne.mockReturnValue(query({ role: { role_code: 'STUDENT' } }));
    await expect(service.upsert(activityId, teacherId, [], { id: advisorId })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns each active teacher account once with its effective default', async () => {
    userModel.find.mockReturnValue(query([
      { _id: teacherId, user_name: 'Teacher', email: 't@example.edu', role: { role_code: 'TEACHER' } },
      { _id: new Types.ObjectId(), user_name: 'Student', role: { role_code: 'STUDENT' } },
    ]));
    const result = await service.candidates(activityId, { id: advisorId });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ _id: teacherId, effective_methods: ['manual_class'], grant_status: 'default' });
  });

  it('lists complete effective state including default, empty, and revoked teachers', async () => {
    const emptyId = new Types.ObjectId().toString();
    const revokedId = new Types.ObjectId().toString();
    userModel.find.mockReturnValue(query([
      { _id: teacherId, user_name: 'Default', role: { role_code: 'TEACHER' } },
      { _id: emptyId, user_name: 'Empty', role: { role_code: 'TEACHER' } },
      { _id: revokedId, user_name: 'Revoked', role: { role_code: 'TEACHER' } },
    ]));
    grantModel.find.mockReturnValue(query([
      { teacher_id: emptyId, status: 'active', allowed_methods: [] },
      { teacher_id: revokedId, status: 'revoked', allowed_methods: ['manual_class'] },
    ]));

    const result = await service.list(activityId, { id: advisorId });

    expect(result.map((row: any) => ({
      id: row.teacher_id._id.toString(),
      status: row.grant_status,
      methods: row.effective_methods,
    }))).toEqual([
      { id: teacherId, status: 'default', methods: ['manual_class'] },
      { id: emptyId, status: 'active', methods: [] },
      { id: revokedId, status: 'revoked', methods: [] },
    ]);
  });

  it('denies grant administration to a delegated teacher', async () => {
    await expect(service.list(activityId, { id: teacherId, roleCode: 'TEACHER' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps manual attendance restricted to the requester own class', async () => {
    classModel.exists.mockResolvedValue(null);
    await expect(service.assertOwnClass(new Types.ObjectId().toString(), teacherId, 'TEACHER'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('preserves inherent attendance methods for the assigned advisor', async () => {
    await expect(service.assertMethod(activityId, advisorId, 'TEACHER', 'qr')).resolves.toBeUndefined();
    await expect(service.assertMethod(activityId, advisorId, 'TEACHER', 'proximity')).resolves.toBeUndefined();
    const capabilities = await service.capabilities(activityId, { id: advisorId, roleCode: 'TEACHER' });
    expect(capabilities).toMatchObject({
      can_administer_grants: true,
      grant_status: 'inherent',
      effective_methods: ['qr', 'proximity', 'manual_class'],
    });
  });
});
