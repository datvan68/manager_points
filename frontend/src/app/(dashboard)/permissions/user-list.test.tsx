import { describe, expect, it } from 'vitest';
import {
  filterPermissionUsers,
  getPermissionUsersForViewport,
  MOBILE_USER_BATCH_SIZE,
} from './page';

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
});
