const GROUP_ORDER = [
  'G_ADMIN_RBAC',
  'G_SYSTEM_OPERATIONS',
  'G_STUDENT',
  'G_STUDENT_RECORD',
  'G_GRADING',
  'G_TASK',
  'G_REPORT',
  'G_CLUB',
  'G_DORMITORY',
  'G_UNGROUPED',
] as const;

const PERMISSION_ORDER = [
  'READ_STUDENT_RECORD',
  'CREATE_STUDENT_RECORD',
  'UPDATE_STUDENT_RECORD',
  'DELETE_STUDENT_RECORD',
  'READ_CLASS_RECORD',
  'READ_ALL_CLASS_RECORD',
  'CREATE_CLASS_RECORD',
  'UPDATE_CLASS_RECORD',
  'DELETE_CLASS_RECORD',
  'GRADING_PAGE',
  'GRADING_SEMESTER_MANAGE',
  'CONFIG_RECORD',
] as const;

const groupRank = new Map<string, number>(GROUP_ORDER.map((code, index) => [code, index]));
const permissionRank = new Map<string, number>(PERMISSION_ORDER.map((code, index) => [code, index]));

export function sortPermissionGroups<T extends { tag?: string; name?: string }>(groups: T[]): T[] {
  return groups
    .map((group, index) => ({ group, index }))
    .sort((left, right) => {
      const leftRank = groupRank.get(left.group.tag || '');
      const rightRank = groupRank.get(right.group.tag || '');
      if (leftRank !== undefined || rightRank !== undefined) {
        return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER)
          || left.index - right.index;
      }
      return (left.group.name || '').localeCompare(right.group.name || '') || left.index - right.index;
    })
    .map(({ group }) => group);
}

export function sortPermissions<T extends { code?: string; name?: string }>(permissions: T[]): T[] {
  return permissions
    .map((permission, index) => ({ permission, index }))
    .sort((left, right) => {
      const leftRank = permissionRank.get(left.permission.code || '');
      const rightRank = permissionRank.get(right.permission.code || '');
      if (leftRank !== undefined || rightRank !== undefined) {
        return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER)
          || left.index - right.index;
      }
      return (left.permission.name || '').localeCompare(right.permission.name || '') || left.index - right.index;
    })
    .map(({ permission }) => permission);
}
