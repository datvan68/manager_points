export interface PolicyInput {
  hasOccupiedMembership: boolean; // whether student is active/pending in another club in the semester
  occupiedClubId?: string;
  targetClubId: string;
  targetMembershipStatus?: string; // 'pending' | 'active' | 'rejected' | 'left'
  selfServiceChangesUsed: number;
  firstScheduleStartTime?: string | null; // start time of the occupied club
  now?: Date;
}

export interface PolicyResult {
  code: 'JOIN' | 'SWITCH' | 'ADMIN_REQUIRED' | 'TEACHER_APPROVAL_REQUIRED' | 'PENDING';
  label: string;
  disabled: boolean;
  requiresTeacherApproval: boolean;
  message?: string;
}

export function getMembershipPolicy(input: PolicyInput): PolicyResult {
  const {
    hasOccupiedMembership,
    occupiedClubId,
    targetClubId,
    targetMembershipStatus,
    selfServiceChangesUsed,
    firstScheduleStartTime,
    now = new Date(),
  } = input;

  // 1. If student is already pending approval in target club
  if (targetMembershipStatus === 'pending') {
    return {
      code: 'PENDING',
      label: 'Đang chờ duyệt',
      disabled: true,
      requiresTeacherApproval: false,
      message: 'Đăng ký tham gia câu lạc bộ đang chờ duyệt.',
    };
  }

  // 2. If no occupied membership elsewhere in the semester
  if (!hasOccupiedMembership || !occupiedClubId) {
    return {
      code: 'JOIN',
      label: 'Đăng ký tham gia',
      disabled: false,
      requiresTeacherApproval: false,
      message: 'Đăng ký tham gia câu lạc bộ này.',
    };
  }

  // If student already occupies a membership in the target club itself
  if (occupiedClubId === targetClubId) {
    if (targetMembershipStatus === 'active') {
      return {
        code: 'PENDING', // or keep active label but disabled
        label: 'Đã tham gia',
        disabled: true,
        requiresTeacherApproval: false,
        message: 'Bạn đã là thành viên chính thức của câu lạc bộ này.',
      };
    }
  }

  // 3. Compare with first schedule of source club
  let activityStarted = false;
  if (firstScheduleStartTime) {
    activityStarted = now.getTime() >= new Date(firstScheduleStartTime).getTime();
  }

  if (activityStarted) {
    return {
      code: 'TEACHER_APPROVAL_REQUIRED',
      label: 'Đăng ký chuyển (Cần GV duyệt)',
      disabled: false,
      requiresTeacherApproval: true,
      message: 'Câu lạc bộ hiện tại đã bắt đầu hoạt động. Yêu cầu chuyển cần có sự phê duyệt từ Giảng viên cố vấn CLB mới.',
    };
  }

  // 4. Check changes limit
  if (selfServiceChangesUsed >= 3) {
    return {
      code: 'ADMIN_REQUIRED',
      label: 'Cần Admin hỗ trợ chuyển',
      disabled: true,
      requiresTeacherApproval: false,
      message: 'Bạn đã dùng hết 3 lượt tự chuyển câu lạc bộ. Vui lòng liên hệ Admin để chuyển đổi.',
    };
  }

  // 5. Pre-start self-service switch
  const remaining = 3 - selfServiceChangesUsed;
  return {
    code: 'SWITCH',
    label: 'Chuyển sang CLB này',
    disabled: false,
    requiresTeacherApproval: false,
    message: `Bạn còn ${remaining} lượt tự chuyển câu lạc bộ trước khi hoạt động bắt đầu.`,
  };
}
