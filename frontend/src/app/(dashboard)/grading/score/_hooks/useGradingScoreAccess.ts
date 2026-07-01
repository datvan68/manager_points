import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { tokenStorage } from '@/api/auth-api';
import { summariesPointApi } from '@/api/summaries-point-api';

export type GradingRoleKey = 'admin' | 'supervisor' | 'teacher' | 'student' | 'unknown';

export interface GradingAccessState {
  role: GradingRoleKey;
  isAdmin: boolean;
  isSupervisor: boolean;
  isAdminOrSupervisor: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  canReadRoster: boolean;
  canModifyScoreByRole: boolean;
  canDeleteSummaryByRole: boolean;
  canDeleteHistoryByRole: boolean;
  canManageEvaluationPeriod: boolean;
  backendDeniedReason?: string;
  backendReasonCode?: string;
  loading: boolean;
}

function getClientGradingRole(user: any): GradingRoleKey {
  if (!user) return 'unknown';

  const roleCode = user.roleCode;
  const permissions = user.permissions || [];
  
  // 1. Admin checks
  if (
    roleCode === 'ADMIN' || 
    permissions.includes('ADMIN_FULL') || 
    user.role === 'Admin' || 
    user.roleName === 'Admin'
  ) {
    return 'admin';
  }

  // 2. Normalize and check other roles
  const roleStr = (user.roleName || user.role || '').toLowerCase();
  
  if (roleStr.includes('admin') || roleCode === 'ADMIN') {
    return 'admin';
  }
  if (roleStr.includes('supervisor') || roleStr.includes('quản sinh') || roleStr.includes('quan sinh') || roleCode === 'SUPERVISOR') {
    return 'supervisor';
  }
  if (roleStr.includes('teacher') || roleStr.includes('advisor') || roleCode === 'TEACHER') {
    return 'teacher';
  }
  if (roleStr.includes('student') || roleCode === 'STUDENT') {
    return 'student';
  }

  return 'unknown';
}

export function useGradingScoreAccess(context?: {
  classId?: string;
  studentId?: string;
  semesterId?: string;
  summaryId?: string;
}): GradingAccessState {
  const { user, isLoading: authLoading } = useAuth();
  const [backendAccess, setBackendAccess] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Active user details (fallback to localStorage if auth context is loading)
  const activeUser = authLoading ? tokenStorage.getUser() : (user || tokenStorage.getUser());
  const role = getClientGradingRole(activeUser);

  // Client-side quick access logic
  const isAdmin = role === 'admin';
  const isSupervisor = role === 'supervisor';
  const isAdminOrSupervisor = isAdmin || isSupervisor;
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';

  const canReadRoster = role !== 'student';
  const canModifyScoreByRole = role !== 'unknown';
  const canDeleteSummaryByRole = isAdminOrSupervisor;
  const canDeleteHistoryByRole = isAdminOrSupervisor;
  const canManageEvaluationPeriod = isAdmin;

  // Sync access state from backend when parameters are provided
  useEffect(() => {
    if (!activeUser) return;
    
    // Only call backend if we have context coordinates
    const hasCoordinates = context && (context.classId || context.studentId || context.semesterId || context.summaryId);
    if (!hasCoordinates) {
      setBackendAccess(null);
      return;
    }

    let isMounted = true;
    const fetchBackendAccess = async () => {
      try {
        setLoading(true);
        const res = await summariesPointApi.getGradingAccess({
          classId: context?.classId,
          studentId: context?.studentId,
          semesterId: context?.semesterId,
          summaryId: context?.summaryId,
        });
        if (isMounted) {
          setBackendAccess(res);
        }
      } catch (err) {
        console.error('Failed to retrieve backend grading access:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchBackendAccess();

    return () => {
      isMounted = false;
    };
  }, [context?.classId, context?.studentId, context?.semesterId, context?.summaryId, activeUser]);

  // Combine client-side quick rules with backend strict evaluations
  const mergedState: GradingAccessState = {
    role,
    isAdmin,
    isSupervisor,
    isAdminOrSupervisor,
    isTeacher,
    isStudent,
    canReadRoster,
    canModifyScoreByRole: backendAccess ? backendAccess.canModifyScore : canModifyScoreByRole,
    canDeleteSummaryByRole: backendAccess ? backendAccess.canDeleteSummary : canDeleteSummaryByRole,
    canDeleteHistoryByRole: backendAccess ? backendAccess.canDeleteHistory : canDeleteHistoryByRole,
    canManageEvaluationPeriod: backendAccess ? backendAccess.canManageEvaluationPeriod : canManageEvaluationPeriod,
    backendDeniedReason: backendAccess?.reason,
    backendReasonCode: backendAccess?.reasonCode,
    loading: loading || authLoading,
  };

  return mergedState;
}
