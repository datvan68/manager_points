import { ClubMember } from '@/api/club-api';

/**
 * Normalizes the user role string.
 */
export function normalizeRole(role?: string): string {
  return (role || '').toLowerCase();
}

/**
 * Finds the club membership for a specific club from a list of memberships.
 */
export function findClubMembership(memberships: any[], clubId: string): any | undefined {
  return memberships.find((m) => {
    const mClubId = m.club_id?._id || m.club_id;
    return mClubId === clubId;
  });
}

/**
 * Checks if the user is an active student member.
 */
export function isJoinedStudent(role?: string, membershipStatus?: string): boolean {
  return normalizeRole(role) === 'student' && membershipStatus === 'active';
}

/**
 * Filters tabs dynamically based on whether the student is an active member.
 */
export function filterDetailTabs<T extends { id: string }>(tabs: T[], isActiveStudentMember: boolean): T[] {
  if (isActiveStudentMember) {
    return tabs.filter((tab) => tab.id !== 'members');
  }
  return tabs;
}
