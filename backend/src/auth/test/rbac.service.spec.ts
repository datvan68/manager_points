import { Types } from 'mongoose';
import { RbacService } from '../services/rbac.service';

describe('RbacService role permission replacement', () => {
  it('rejects transitive parent and read prerequisites for descendant permissions', async () => {
    const selected = ['ACTIVITY_SCHEDULE_MANAGE', 'ACTIVITY_SCHEDULE_READ', 'ACTIVITY_PAGE', 'ACTIVITY_READ']
      .map((code) => ({ _id: new Types.ObjectId(), code }));
    const permissionModel = {
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([selected[0]]),
      }),
    };
    const service = new RbacService(
      {} as any,
      permissionModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      (service as any).resolvePermissionSelection([selected[0]._id.toString()]),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        missingPermissions: expect.arrayContaining([
          'ACTIVITY_SCHEDULE_READ',
          'ACTIVITY_PAGE',
          'ACTIVITY_READ',
        ]),
      }),
    });
  });

  it('treats an empty permission selection as authoritative and invalidates affected users', async () => {
    const roleId = new Types.ObjectId();
    const userId = new Types.ObjectId();
    const role = {
      _id: roleId,
      permissions: [new Types.ObjectId()],
      save: jest.fn().mockResolvedValue({ _id: roleId, permissions: [] }),
    };
    const revokeAllUserTokens = jest.fn().mockResolvedValue(undefined);
    const service = new RbacService(
      { findById: jest.fn().mockResolvedValue(role) } as any,
      {} as any,
      {} as any,
      { find: jest.fn().mockResolvedValue([{ _id: userId }]) } as any,
      {} as any,
      { revokeAllUserTokens } as any,
    );

    await service.updateRole(roleId.toString(), { permissions: [] });

    expect(role.save).toHaveBeenCalled();
    expect(role.permissions).toEqual([]);
    expect(revokeAllUserTokens).toHaveBeenCalledWith(userId.toString());
  });
});
