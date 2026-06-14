export function isTeacherRole(user: any): boolean {
  if (!user) return false;
  if (user.roleCode === 'TEACHER') return true;
  const role = String(user.roleName || user.role || '').toLowerCase();
  return role.includes('teacher') || role.includes('giáo viên') || role.includes('giảng viên') || role.includes('advisor') || role.includes('cố vấn');
}

export function isStudentRole(user: any): boolean {
  if (!user) return false;
  if (user.roleCode === 'STUDENT') return true;
  const role = String(user.roleName || user.role || '').toLowerCase();
  return role.includes('student') || role.includes('học sinh') || role.includes('sinh viên') || role.includes('hssv');
}

export function isAdminOrSupervisor(user: any): boolean {
  if (!user) return false;
  if (user.roleCode === 'ADMIN' || user.roleCode === 'SUPERVISOR') return true;
  const role = String(user.roleName || user.role || '').toLowerCase();
  return role.includes('admin') || role.includes('supervisor') || role.includes('quản sinh');
}
