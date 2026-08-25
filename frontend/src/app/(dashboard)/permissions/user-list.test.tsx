import { describe, expect, it } from 'vitest';
import {
  filterPermissionUsers,
  getPermissionUsersForViewport,
  MOBILE_USER_BATCH_SIZE,
} from './page';
import { sortRolesByPriority, sortUsersByRolePriority } from './user-role-priority';

const users = [
  { _id: 'active-admin', user_name: 'admin', email: 'admin@example.com', role: { name: 'Admin' }, status: 'active' },
  { _id: 'locked-teacher', user_name: 'teacher', email: 'teacher@example.com', role: { name: 'Teacher' }, status: 'locked' },
  { _id: 'pending-student', user_name: 'student', email: 'student@example.com', role: { name: 'Student' }, status: 'pending' },
];

describe('permissions user list filtering and responsive datasets', () => {
  it('applies role and status filters directly while retaining search semantics', () => {
    expect(filterPermissionUsers(users, '', 'Admin', ['Tất cả']).map((user) => user._id)).toEqual(['active-admin']);
    expect(filterPermissionUsers(users, 'teacher', 'Tất cả', ['Bị khóa']).map((user) => user._id)).toEqual(['locked-teacher']);
    expect(filterPermissionUsers(users, '', 'Tất cả', ['Chưa kích hoạt']).map((user) => user._id)).toEqual(['pending-student']);
  });

  it('appends mobile batches from the filtered list and resets by slicing from the first row', () => {
    const manyUsers = Array.from({ length: MOBILE_USER_BATCH_SIZE * 2 + 1 }, (_, index) => ({ _id: String(index) }));
    expect(getPermissionUsersForViewport(manyUsers, true, MOBILE_USER_BATCH_SIZE, 4, 10)).toHaveLength(MOBILE_USER_BATCH_SIZE);
    expect(getPermissionUsersForViewport(manyUsers, true, MOBILE_USER_BATCH_SIZE * 2, 4, 10)).toHaveLength(MOBILE_USER_BATCH_SIZE * 2);
    expect(getPermissionUsersForViewport(manyUsers, true, MOBILE_USER_BATCH_SIZE, 1, 10)[0]._id).toBe('0');
  });

  it('keeps desktop page and page-size slicing unchanged', () => {
    const manyUsers = Array.from({ length: 25 }, (_, index) => ({ _id: String(index) }));
    expect(getPermissionUsersForViewport(manyUsers, false, 20, 2, 10).map((user) => user._id)).toEqual(
      Array.from({ length: 10 }, (_, index) => String(index + 10)),
    );
  });

  it('orders users by the highest assigned role priority with case-insensitive codes', () => {
    const prioritizedUsers = [
      { _id: 'unknown', role: { role_code: 'guest' } },
      { _id: 'teacher', role: { roleCode: 'teacher' } },
      { _id: 'multi-role', roles: [{ code: 'guest' }, { role_code: 'SuPeRvIsOr' }] },
      { _id: 'admin', roleCode: 'ADMIN' },
    ];

    expect(sortUsersByRolePriority(prioritizedUsers).map((user) => user._id)).toEqual([
      'admin',
      'multi-role',
      'teacher',
      'unknown',
    ]);
  });

  it('keeps source order for ties and missing or unknown role codes', () => {
    const usersWithTies = [
      { _id: 'first-unknown', role: { name: 'Guest' } },
      { _id: 'admin-a', role: { code: 'admin' } },
      { _id: 'admin-b', role_code: 'ADMIN' },
      { _id: 'second-unknown', role: { code: 'OTHER' } },
    ];

    expect(sortUsersByRolePriority(usersWithTies).map((user) => user._id)).toEqual([
      'admin-a',
      'admin-b',
      'first-unknown',
      'second-unknown',
    ]);
  });

  it('sorts role options by code while preserving localized labels and fallback order', () => {
    const roles = [
      { name: 'Khách', role_code: 'GUEST' },
      { name: 'Giáo viên', roleCode: 'teacher' },
      { name: 'Quản trị viên', code: 'ADMIN' },
      { name: 'Giám sát', role_code: 'SUPERVISOR' },
      { name: 'Khác' },
    ];

    expect(sortRolesByPriority(roles).map((role) => role.name)).toEqual([
      'Quản trị viên',
      'Giám sát',
      'Giáo viên',
      'Khách',
      'Khác',
    ]);
  });

  it('sorts before desktop pages and mobile visible batches', () => {
    const filteredUsers = sortUsersByRolePriority([
      { _id: 'teacher', role_code: 'TEACHER' },
      { _id: 'admin', role_code: 'ADMIN' },
      { _id: 'supervisor', role_code: 'SUPERVISOR' },
    ]);

    expect(getPermissionUsersForViewport(filteredUsers, false, 20, 1, 2).map((user) => user._id)).toEqual([
      'admin',
      'supervisor',
    ]);
    expect(getPermissionUsersForViewport(filteredUsers, true, 2, 1, 2).map((user) => user._id)).toEqual([
      'admin',
      'supervisor',
    ]);
  });
});
