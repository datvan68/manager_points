import { getMembershipPolicy } from './membership-policy';

describe('Frontend Membership Policy Mapper', () => {
  it('should return JOIN policy when student has no occupied membership in the semester', () => {
    const result = getMembershipPolicy({
      hasOccupiedMembership: false,
      targetClubId: 'club_target',
      selfServiceChangesUsed: 0,
    });

    expect(result.code).toBe('JOIN');
    expect(result.label).toBe('Đăng ký tham gia');
    expect(result.disabled).toBe(false);
  });

  it('should return PENDING policy if target membership is pending', () => {
    const result = getMembershipPolicy({
      hasOccupiedMembership: true,
      occupiedClubId: 'club_source',
      targetClubId: 'club_target',
      targetMembershipStatus: 'pending',
      selfServiceChangesUsed: 0,
    });

    expect(result.code).toBe('PENDING');
    expect(result.label).toBe('Đang chờ duyệt');
    expect(result.disabled).toBe(true);
  });

  it('should return SWITCH policy with remaining changes message if activity has not started and changes < 3', () => {
    const result = getMembershipPolicy({
      hasOccupiedMembership: true,
      occupiedClubId: 'club_source',
      targetClubId: 'club_target',
      selfServiceChangesUsed: 1,
      firstScheduleStartTime: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), // 2 hours in future
      now: new Date(),
    });

    expect(result.code).toBe('SWITCH');
    expect(result.label).toBe('Chuyển sang CLB này');
    expect(result.disabled).toBe(false);
    expect(result.message).toContain('còn 2 lượt tự chuyển');
  });

  it('should return ADMIN_REQUIRED policy if activity has not started but student already used 3 changes', () => {
    const result = getMembershipPolicy({
      hasOccupiedMembership: true,
      occupiedClubId: 'club_source',
      targetClubId: 'club_target',
      selfServiceChangesUsed: 3,
      firstScheduleStartTime: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
      now: new Date(),
    });

    expect(result.code).toBe('ADMIN_REQUIRED');
    expect(result.label).toBe('Cần Admin hỗ trợ chuyển');
    expect(result.disabled).toBe(true);
    expect(result.message).toContain('dùng hết 3 lượt');
  });

  it('should return TEACHER_APPROVAL_REQUIRED policy if source club activity has started', () => {
    const result = getMembershipPolicy({
      hasOccupiedMembership: true,
      occupiedClubId: 'club_source',
      targetClubId: 'club_target',
      selfServiceChangesUsed: 0,
      firstScheduleStartTime: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours in past
      now: new Date(),
    });

    expect(result.code).toBe('TEACHER_APPROVAL_REQUIRED');
    expect(result.label).toBe('Đăng ký chuyển (Cần GV duyệt)');
    expect(result.disabled).toBe(false);
    expect(result.requiresTeacherApproval).toBe(true);
  });
});
