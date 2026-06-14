import { describe, it, expect } from 'vitest';
import { 
  resolvePreviewSubject, 
  getPreviewPermissions, 
  buildSystemPreviewAccess,
  getPagePreviewScope
} from './preview-permissions';

describe('Preview Permissions Helper Logic', () => {
  const mockRoles = [
    { id: 'r1', name: 'Admin', role_code: 'ADMIN', permissions: ['ADMIN_FULL', 'LOGIN_LOG_READ'] },
    { id: 'r2', name: 'Teacher', role_code: 'TEACHER', permissions: ['STUDENT_READ', 'GRADING_PAGE'] },
    { id: 'r3', name: 'Guest', role_code: 'GUEST', permissions: [] }
  ];

  const mockUsers = [
    { id: 'u1', username: 'john_admin', role: mockRoles[0], permissions: [] },
    { id: 'u2', username: 'jane_teacher', role: mockRoles[1], permissions: ['STUDENT_CREATE'] }, // direct permission
    { id: 'u3', username: 'bob_guest', role: mockRoles[2], permissions: ['LOGIN_LOG_READ'] } // guest but has log read
  ];

  describe('resolvePreviewSubject', () => {
    it('should resolve default subject (ADMIN) when no user or role selected', () => {
      const result = resolvePreviewSubject({
        users: mockUsers,
        roles: mockRoles,
        selectedPreviewUser: '',
        selectedPreviewRole: ''
      });
      expect(result.type).toBe('default');
      expect(result.role?.role_code).toBe('ADMIN');
      expect(result.user).toBeNull();
    });

    it('should resolve by role when role selected and no user selected', () => {
      const result = resolvePreviewSubject({
        users: mockUsers,
        roles: mockRoles,
        selectedPreviewUser: '',
        selectedPreviewRole: 'r2'
      });
      expect(result.type).toBe('role');
      expect(result.role?.role_code).toBe('TEACHER');
      expect(result.user).toBeNull();
    });

    it('should resolve by user when user selected', () => {
      const result = resolvePreviewSubject({
        users: mockUsers,
        roles: mockRoles,
        selectedPreviewUser: 'u2',
        selectedPreviewRole: ''
      });
      expect(result.type).toBe('user');
      expect(result.user?.username).toBe('jane_teacher');
      expect(result.role?.role_code).toBe('TEACHER');
    });
  });

  describe('getPreviewPermissions (Union Model)', () => {
    it('should return role permissions if only role is resolved', () => {
      const subject = {
        type: 'role' as const,
        role: mockRoles[1],
        user: undefined
      };
      const result = getPreviewPermissions(subject);
      expect(result).toContain('STUDENT_READ');
      expect(result).toContain('GRADING_PAGE');
      expect(result.length).toBe(2);
    });

    it('should union direct user permissions and role permissions, removing duplicates', () => {
      const subject = {
        type: 'user' as const,
        role: mockRoles[1], // TEACHER (has STUDENT_READ, GRADING_PAGE)
        user: mockUsers[1] // jane_teacher (has direct STUDENT_CREATE)
      };
      const result = getPreviewPermissions(subject);
      expect(result).toContain('STUDENT_READ');
      expect(result).toContain('GRADING_PAGE');
      expect(result).toContain('STUDENT_CREATE');
      expect(result.length).toBe(3);
    });

    it('should handle guest user with direct permissions', () => {
      const subject = {
        type: 'user' as const,
        role: mockRoles[2], // GUEST (has no permissions)
        user: mockUsers[2] // bob_guest (has direct LOGIN_LOG_READ)
      };
      const result = getPreviewPermissions(subject);
      expect(result).toContain('LOGIN_LOG_READ');
      expect(result.length).toBe(1);
    });

    it('should handle null/empty inputs safely', () => {
      expect(getPreviewPermissions({ type: 'default', role: null })).toEqual([]);
    });
  });

  describe('buildSystemPreviewAccess', () => {
    it('should grant full access to ADMIN role', () => {
      const access = buildSystemPreviewAccess(['LOGIN_LOG_READ'], mockRoles[0]); // ADMIN role_code
      expect(access.isPreviewAdmin).toBe(true);
      expect(access.showSystem).toBe(true);
      expect(access.showStudents).toBe(true);
      expect(access.previewCanReadLogs).toBe(true);
      expect(access.previewCanDeleteBackup).toBe(true);
    });

    it('should grant partial access to TEACHER role', () => {
      const access = buildSystemPreviewAccess(['STUDENT_READ', 'GRADING_PAGE'], mockRoles[1]); // TEACHER
      expect(access.isPreviewAdmin).toBe(false);
      expect(access.showStudents).toBe(true);
      expect(access.showGrading).toBe(true);
      expect(access.showSystem).toBe(false); // teacher doesn't have system permission
    });

    it('should restrict access for users without permissions', () => {
      const access = buildSystemPreviewAccess([], mockRoles[2]); // GUEST
      expect(access.isPreviewAdmin).toBe(false);
      expect(access.showSystem).toBe(false);
      expect(access.showStudents).toBe(false);
      expect(access.previewCanReadLogs).toBe(false);
    });
  });

  describe('getPagePreviewScope', () => {
    const mockPagePermissionScopes = [
      {
        route_path: '/permissions',
        access_permissions: ['admin'],
        action_permissions: ['view_users', 'USER_CREATE', 'MISSING_PERM']
      }
    ];

    const mockRoutePermissions = [
      {
        route_path: '/permissions',
        permissions: ['admin', 'view_users', 'USER_CREATE']
      }
    ];

    const mockAllPermissions = [
      { code: 'admin', name: 'Truy cập Admin', description: 'Xem trang admin' },
      { code: 'view_users', name: 'Xem user', description: 'Xem danh sách user' },
      { code: 'USER_CREATE', name: 'Tạo user', description: 'Tạo tài khoản user' }
    ];

    it('should map items correctly when subject has direct permissions', () => {
      const result = getPagePreviewScope({
        routePath: '/permissions',
        pagePermissionScopes: mockPagePermissionScopes,
        routePermissions: mockRoutePermissions,
        allPermissions: mockAllPermissions,
        previewPermissions: ['admin'],
        isPreviewAdmin: false
      });

      const adminItem = result.find(r => r.code === 'admin');
      expect(adminItem).toBeDefined();
      expect(adminItem?.isRoute).toBe(true);
      expect(adminItem?.status).toBe('route_enforced');
      expect(adminItem?.allowedStatus).toBe('allowed');

      const viewUsersItem = result.find(r => r.code === 'view_users');
      expect(viewUsersItem?.isRoute).toBe(false);
      expect(viewUsersItem?.status).toBe('scope_defined');
      expect(viewUsersItem?.allowedStatus).toBe('denied');

      const createItem = result.find(r => r.code === 'USER_CREATE');
      expect(createItem?.status).toBe('proposed');

      const missingItem = result.find(r => r.code === 'MISSING_PERM');
      expect(missingItem?.status).toBe('missing');
    });

    it('should map status to admin_override when isPreviewAdmin is true', () => {
      const result = getPagePreviewScope({
        routePath: '/permissions',
        pagePermissionScopes: mockPagePermissionScopes,
        routePermissions: mockRoutePermissions,
        allPermissions: mockAllPermissions,
        previewPermissions: [],
        isPreviewAdmin: true
      });

      const adminItem = result.find(r => r.code === 'admin');
      expect(adminItem?.allowedStatus).toBe('admin_override');

      const viewUsersItem = result.find(r => r.code === 'view_users');
      expect(viewUsersItem?.allowedStatus).toBe('admin_override');
    });

    it('should flag unmapped permission if not found in routePermissions configuration', () => {
      const mockRoutePermissionsEmpty: any[] = [];
      const result = getPagePreviewScope({
        routePath: '/permissions',
        pagePermissionScopes: mockPagePermissionScopes,
        routePermissions: mockRoutePermissionsEmpty,
        allPermissions: mockAllPermissions,
        previewPermissions: [],
        isPreviewAdmin: false
      });

      const adminItem = result.find(r => r.code === 'admin');
      expect(adminItem?.status).toBe('unmapped');
    });

    it('should fallback to static scope when pagePermissionScopes is empty or has no match', () => {
      const result = getPagePreviewScope({
        routePath: '/permissions',
        pagePermissionScopes: [],
        routePermissions: mockRoutePermissions,
        allPermissions: mockAllPermissions,
        previewPermissions: ['admin'],
        isPreviewAdmin: false
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toContain('Fallback');
    });
  });
});
