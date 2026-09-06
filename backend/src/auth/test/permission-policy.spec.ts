import {
  DECLARED_PERMISSION_CODES,
  PERMISSION_POLICIES,
  getPermissionPolicy,
  validatePermissionPolicyCatalog,
} from '../permissions.registry';
import { isAdminUser } from '../utils/role.util';

describe('canonical permission policy registry', () => {
  it('classifies every declared seed exactly once and gives it an owner', () => {
    expect(validatePermissionPolicyCatalog()).toEqual([]);
    expect(new Set(PERMISSION_POLICIES.map((policy) => policy.code)).size).toBe(
      DECLARED_PERMISSION_CODES.length,
    );
    for (const code of DECLARED_PERMISSION_CODES) {
      const policy = getPermissionPolicy(code);
      expect(policy).toBeDefined();
      expect(policy?.owners.length).toBeGreaterThan(0);
      expect(policy?.kind).toBeTruthy();
    }
  });

  it('uses real destination and API owners for parent/read-sensitive capabilities', () => {
    expect(getPermissionPolicy('READ_STUDENT_RECORD')).toMatchObject({
      routePath: '/students/record',
      kind: 'read',
    });
    expect(getPermissionPolicy('CREATE_CLASS_RECORD')).toMatchObject({
      requires: ['READ_CLASS_RECORD'],
      owners: expect.arrayContaining(['POST /daily-class-reports']),
    });
    expect(getPermissionPolicy('ACTIVITY_ATTENDANCE_READ')).toMatchObject({
      routePath: '/activities/attendance',
      owners: expect.arrayContaining(['GET /activity-attendance']),
    });
  });

  it('does not label backend-only capabilities as visible UI actions', () => {
    expect(getPermissionPolicy('DORM_QR_CHECKIN')?.kind).toBe('backend-only');
    expect(getPermissionPolicy('DORM_QR_CHECKIN')?.owners.join(' ')).toContain(
      'backend/src/dormitory/controllers',
    );
  });

  it('keeps sensitive system and database operations as guarded actions', () => {
    expect(getPermissionPolicy('DATABASE_BACKUP_DELETE')).toMatchObject({
      kind: 'action',
      requires: ['SYSTEM_ADMIN', 'DATABASE_BACKUP_READ'],
      owners: expect.arrayContaining(['DELETE /system/backups/:id']),
    });
    expect(getPermissionPolicy('SYSTEM_MAIL_CONFIG_MANAGE')?.kind).toBe('action');
  });

  it('does not treat an arbitrary role name containing admin as an ADMIN bypass', () => {
    expect(isAdminUser({ roleName: 'Assistant Admin', permissions: [] })).toBe(false);
    expect(isAdminUser({ roleCode: 'ADMIN', permissions: [] })).toBe(true);
    expect(isAdminUser({ roleCode: 'TEACHER', permissions: ['ADMIN_FULL'] })).toBe(true);
  });
});
