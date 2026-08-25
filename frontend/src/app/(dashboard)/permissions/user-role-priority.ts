const PRIORITIZED_ROLE_CODES = ['ADMIN', 'SUPERVISOR', 'TEACHER'] as const;

const ROLE_PRIORITY: Map<string, number> = new Map(PRIORITIZED_ROLE_CODES.map((code, index) => [code, index]));

export function normalizeRoleCode(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    return normalized || null;
  }

  if (!value || typeof value !== 'object') return null;

  const role = value as Record<string, unknown>;
  for (const key of ['role_code', 'roleCode', 'code']) {
    const normalized = normalizeRoleCode(role[key]);
    if (normalized) return normalized;
  }

  return null;
}

export function getRolePriority(value: unknown): number {
  return ROLE_PRIORITY.get(normalizeRoleCode(value) || '') ?? PRIORITIZED_ROLE_CODES.length;
}

export function getUserRolePriority(user: any): number {
  const assignedRoles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role,
    user?.roleCode,
    user?.role_code,
  ];

  return assignedRoles.reduce((highestPriority, role) => Math.min(highestPriority, getRolePriority(role)), PRIORITIZED_ROLE_CODES.length);
}

export function sortUsersByRolePriority<T>(users: T[]): T[] {
  return users
    .map((user, index) => ({ user, index, priority: getUserRolePriority(user) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ user }) => user);
}

export function sortRolesByPriority<T>(roles: T[]): T[] {
  return roles
    .map((role, index) => ({ role, index, priority: getRolePriority(role) }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ role }) => role);
}
