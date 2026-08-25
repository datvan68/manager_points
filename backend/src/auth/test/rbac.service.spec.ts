import { Types } from 'mongoose';
import { RbacService } from '../services/rbac.service';

describe('RbacService role permission replacement', () => {
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
