import { ForbiddenException } from '@nestjs/common';
import { isAdminUser } from './role.util';

export type GradingRoleKey = 'admin' | 'supervisor' | 'teacher' | 'student' | 'unknown';

export interface GradingAccessDecision {
  role: GradingRoleKey;
  scope: 'all' | 'assigned_classes' | 'self' | 'none';
  canAccessPage: boolean;
  canReadRoster: boolean;
  canReadStudent: boolean;
  canReadSummary: boolean;
  canModifyScore: boolean;
  canCopyScore: boolean;
  canDeleteSummary: boolean;
  canDeleteHistory: boolean;
  canApproveSummary: boolean;
  canManageEvaluationPeriod: boolean;
  reasonCode?: string;
  reason?: string;
}

/**
 * Normalizes user object to one of the canonical GradingRoleKeys.
 */
export function getGradingRole(requester?: any): GradingRoleKey {
  if (!requester) return 'unknown';

  // 1. Safe override for Admin: roleCode, permissions, or roleName
  if (isAdminUser(requester)) {
    return 'admin';
  }

  // 2. Fetch raw role name from requester object
  let rawRole = '';
  if (typeof requester.roleName === 'string') {
    rawRole = requester.roleName;
  } else if (typeof requester.role === 'string') {
    rawRole = requester.role;
  } else if (requester.role && typeof requester.role === 'object' && requester.role.name) {
    rawRole = requester.role.name;
  }

  const roleCode = requester.roleCode || (requester.role && requester.role.role_code);
  const roleLower = (rawRole || '').toLowerCase();

  if (roleLower.includes('admin') || roleCode === 'ADMIN') return 'admin';
  
  if (
    roleLower.includes('supervisor') ||
    roleLower.includes('quản sinh') ||
    roleLower.includes('quan sinh') ||
    roleCode === 'SUPERVISOR'
  ) {
    return 'supervisor';
  }
  
  if (
    roleLower.includes('teacher') ||
    roleLower.includes('advisor') ||
    roleLower.includes('giảng viên') ||
    roleLower.includes('giang vien') ||
    roleCode === 'TEACHER'
  ) {
    return 'teacher';
  }
  
  if (
    roleLower.includes('student') ||
    roleLower.includes('sinh viên') ||
    roleLower.includes('sinh vien') ||
    roleCode === 'STUDENT'
  ) {
    return 'student';
  }

  return 'unknown';
}

/**
 * Evaluates authorization actions allowed for a given user.
 */
export function evaluateGradingAccess(requester?: any): GradingAccessDecision {
  const role = getGradingRole(requester);
  
  const decision: GradingAccessDecision = {
    role,
    scope: 'none',
    canAccessPage: false,
    canReadRoster: false,
    canReadStudent: false,
    canReadSummary: false,
    canModifyScore: false,
    canCopyScore: false,
    canDeleteSummary: false,
    canDeleteHistory: false,
    canApproveSummary: false,
    canManageEvaluationPeriod: false,
  };

  if (role === 'admin') {
    decision.scope = 'all';
    decision.canAccessPage = true;
    decision.canReadRoster = true;
    decision.canReadStudent = true;
    decision.canReadSummary = true;
    decision.canModifyScore = true;
    decision.canCopyScore = true;
    decision.canDeleteSummary = true;
    decision.canDeleteHistory = true;
    decision.canApproveSummary = true;
    decision.canManageEvaluationPeriod = true;
  } else if (role === 'supervisor') {
    decision.scope = 'all';
    decision.canAccessPage = true;
    decision.canReadRoster = true;
    decision.canReadStudent = true;
    decision.canReadSummary = true;
    decision.canModifyScore = true;
    decision.canCopyScore = true;
    decision.canDeleteSummary = true;
    decision.canDeleteHistory = true;
    decision.canApproveSummary = true;
    decision.canManageEvaluationPeriod = false;
  } else if (role === 'teacher') {
    decision.scope = 'assigned_classes';
    decision.canAccessPage = true;
    decision.canReadRoster = true;
    decision.canReadStudent = true;
    decision.canReadSummary = true;
    decision.canModifyScore = true;
    decision.canCopyScore = true;
    decision.canDeleteSummary = false;
    decision.canDeleteHistory = false;
    decision.canApproveSummary = false;
    decision.canManageEvaluationPeriod = false;
  } else if (role === 'student') {
    decision.scope = 'self';
    decision.canAccessPage = true;
    decision.canReadRoster = false;
    decision.canReadStudent = true;
    decision.canReadSummary = true;
    decision.canModifyScore = true;
    decision.canCopyScore = false;
    decision.canDeleteSummary = false;
    decision.canDeleteHistory = false;
    decision.canApproveSummary = false;
    decision.canManageEvaluationPeriod = false;
  }

  return decision;
}

/**
 * Asserts whether the requester has access to mutate or view a student's record.
 */
export async function assertCanAccessStudent(
  requester: any,
  studentId: string,
  classModel: any,
  studentModel: any,
): Promise<void> {
  const role = getGradingRole(requester);
  if (role === 'admin' || role === 'supervisor') {
    return;
  }

  if (role === 'student') {
    if (requester?.userId?.toString() !== studentId?.toString()) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không thể thao tác điểm của sinh viên khác.',
        error: 'Forbidden',
        reasonCode: 'GRADING_SCOPE_DENIED',
      });
    }
    return;
  }

  if (role === 'teacher') {
    const classes = await classModel.find({ advisor_id: requester?.userId }).select('_id').exec();
    const classIds = classes.map((c: any) => c._id.toString());
    const student = await studentModel.findById(studentId).select('class_id').exec();
    if (!student || !student.class_id || !classIds.includes(student.class_id.toString())) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền đánh giá sinh viên ngoài lớp phụ trách.',
        error: 'Forbidden',
        reasonCode: 'GRADING_SCOPE_DENIED',
      });
    }
    return;
  }

  throw new ForbiddenException({
    statusCode: 403,
    message: 'Bạn không có quyền thực hiện hành động này.',
    error: 'Forbidden',
    reasonCode: 'GRADING_ACCESS_DENIED',
  });
}

/**
 * Asserts whether the requester has access to perform actions on a class.
 */
export async function assertCanAccessClass(
  requester: any,
  classId: string,
  classModel: any,
): Promise<void> {
  const role = getGradingRole(requester);
  if (role === 'admin' || role === 'supervisor') {
    return;
  }

  if (role === 'teacher') {
    const classObj = await classModel.findById(classId).select('advisor_id').exec();
    if (!classObj || classObj.advisor_id?.toString() !== requester?.userId?.toString()) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Bạn không có quyền thao tác trên lớp học này.',
        error: 'Forbidden',
        reasonCode: 'GRADING_SCOPE_DENIED',
      });
    }
    return;
  }

  throw new ForbiddenException({
    statusCode: 403,
    message: 'Bạn không có quyền thao tác trên lớp học này.',
    error: 'Forbidden',
    reasonCode: 'GRADING_ACCESS_DENIED',
  });
}
