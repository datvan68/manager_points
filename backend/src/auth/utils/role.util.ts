import { Types } from 'mongoose';

/**
 * Normalize and retrieve the role name for the current requester.
 * Handles both string and object variations, as well as Vietnamese terms.
 */
export function getRequesterRoleName(requester?: any): string {
  if (!requester) return 'User';

  // Safe override: if has admin signals, return Admin immediately
  const roleCode = requester.roleCode || (requester.role && requester.role.role_code);
  const permissions = requester.permissions || [];
  if (roleCode === 'ADMIN' || permissions.includes('ADMIN_FULL')) {
    return 'Admin';
  }

  let rawRole = '';
  if (typeof requester.roleName === 'string') {
    rawRole = requester.roleName;
  } else if (typeof requester.role === 'string') {
    rawRole = requester.role;
  } else if (requester.role && typeof requester.role === 'object' && requester.role.name) {
    rawRole = requester.role.name;
  }

  const roleLower = rawRole.toLowerCase();
  if (roleLower.includes('admin')) return 'Admin';
  if (
    roleLower.includes('teacher') ||
    roleLower.includes('advisor') ||
    roleLower.includes('adviser') ||
    roleLower.includes('giang vien') ||
    roleLower.includes('cố vấn') ||
    roleLower.includes('giảng viên')
  ) {
    return 'Teacher';
  }
  if (
    roleLower.includes('supervisor') ||
    roleLower.includes('quan sinh') ||
    roleLower.includes('quản sinh') ||
    roleLower.includes('giam sat') ||
    roleLower.includes('giám sát')
  ) {
    return 'Supervisor';
  }
  if (
    roleLower.includes('student') ||
    roleLower.includes('sinh vien') ||
    roleLower.includes('hoc sinh') ||
    roleLower.includes('học sinh') ||
    roleLower.includes('sinh viên')
  ) {
    return 'Student';
  }

  return rawRole || 'User';
}

export function isStudent(requester?: any): boolean {
  return getRequesterRoleName(requester) === 'Student';
}

export function isTeacher(requester?: any): boolean {
  return getRequesterRoleName(requester) === 'Teacher';
}

export function isSupervisor(requester?: any): boolean {
  return getRequesterRoleName(requester) === 'Supervisor';
}

export function isAdmin(requester?: any): boolean {
  return getRequesterRoleName(requester) === 'Admin';
}

export function isAdminUser(requester?: any): boolean {
  if (!requester) return false;
  const roleCode = requester.roleCode || (requester.role && requester.role.role_code);
  const permissions = requester.permissions || [];
  return (
    roleCode === 'ADMIN' ||
    permissions.includes('ADMIN_FULL') ||
    getRequesterRoleName(requester) === 'Admin'
  );
}

