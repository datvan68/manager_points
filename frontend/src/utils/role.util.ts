function getRoleString(user: any): string {
  if (!user) return '';
  const roleNames: string[] = [];

  if (user.roleName) {
    roleNames.push(String(user.roleName));
  }

  if (typeof user.role === 'string') {
    roleNames.push(user.role);
  } else if (user.role && typeof user.role === 'object') {
    const roleName = user.role.name || user.role.role_code || '';
    if (roleName) roleNames.push(String(roleName));
  }

  if (Array.isArray(user.roles)) {
    user.roles.forEach((r: any) => {
      if (r) {
        const name = typeof r === 'string' ? r : r.name || r.role_code || '';
        if (name) roleNames.push(String(name));
      }
    });
  }

  return Array.from(new Set(roleNames.filter(Boolean))).join(' ');
}

export function isTeacherRole(user: any): boolean {
  if (!user) return false;
  if (user.roleCode === 'TEACHER') return true;
  const role = getRoleString(user).toLowerCase();
  return role.includes('teacher') || role.includes('giáo viên') || role.includes('giảng viên') || role.includes('advisor') || role.includes('cố vấn');
}

export function isStudentRole(user: any): boolean {
  if (!user) return false;
  if (user.roleCode === 'STUDENT') return true;
  const role = getRoleString(user).toLowerCase();
  return role.includes('student') || role.includes('học sinh') || role.includes('sinh viên') || role.includes('hssv');
}

export function isAdminOrSupervisor(user: any): boolean {
  if (!user) return false;
  if (user.roleCode === 'ADMIN' || user.roleCode === 'SUPERVISOR') return true;
  const role = getRoleString(user).toLowerCase();
  return role.includes('admin') || role.includes('supervisor') || role.includes('quản sinh');
}

export function isAdminRole(user: any): boolean {
  if (!user) return false;
  if (user.roleCode === 'ADMIN') return true;
  const role = getRoleString(user).toLowerCase();
  return role.includes('admin');
}

