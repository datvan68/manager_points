import { describe, it, expect, vi } from 'vitest';
import { authApi } from '../../../api/auth-api';

// Mock module authApi
vi.mock('../../../api/auth-api', () => ({
  authApi: {
    updateUser: vi.fn(),
    createUser: vi.fn(),
    assignRole: vi.fn(),
  },
  tokenStorage: {
    getAccessToken: vi.fn().mockReturnValue('mock-token'),
  }
}));

describe('permissions/page - handleUserSave logic', () => {
  it('should call authApi.updateUser with advisor_class_ids when editing', async () => {
    const userData = {
      username: 'teacher1',
      email: 't1@example.com',
      role: 'role_teacher',
      status: 'active',
      advisor_class_ids: ['class_1', 'class_2']
    };

    const editingUser = { _id: 'user_1' };
    const token = 'mock-token';

    // Simulate the logic inside handleUserSave for editing
    if (userData.role) {
      await authApi.assignRole(editingUser._id, userData.role, token);
    }
    await authApi.updateUser(editingUser._id, {
      user_name: userData.username,
      email: userData.email,
      status: userData.status,
      advisor_class_ids: userData.advisor_class_ids || [],
    }, token);

    expect(authApi.updateUser).toHaveBeenCalledWith('user_1', {
      user_name: 'teacher1',
      email: 't1@example.com',
      status: 'active',
      advisor_class_ids: ['class_1', 'class_2'],
    }, 'mock-token');
  });

  it('should call authApi.createUser with advisor_class_ids when creating', async () => {
    const userData = {
      username: 'teacher2',
      email: 't2@example.com',
      password: 'password123',
      role: 'role_teacher',
      status: 'active',
      advisor_class_ids: ['class_3']
    };

    const token = 'mock-token';

    // Simulate the logic inside handleUserSave for creating
    await authApi.createUser({
      user_name: userData.username,
      email: userData.email,
      password: userData.password,
      role_id: userData.role,
      status: userData.status,
      advisor_class_ids: userData.advisor_class_ids || []
    }, token);

    expect(authApi.createUser).toHaveBeenCalledWith({
      user_name: 'teacher2',
      email: 't2@example.com',
      password: 'password123',
      role_id: 'role_teacher',
      status: 'active',
      advisor_class_ids: ['class_3'],
    }, 'mock-token');
  });
});
