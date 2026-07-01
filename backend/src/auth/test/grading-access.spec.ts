import { getGradingRole, evaluateGradingAccess, assertCanAccessStudent, assertCanAccessClass } from '../utils/grading-access.util';
import { getRequesterRoleName, isAdminUser } from '../utils/role.util';
import { ForbiddenException } from '@nestjs/common';

describe('Grading Access and Role Normalization', () => {
  describe('role.util.ts modifications', () => {
    it('should correctly normalize roleName to Admin if roleCode is ADMIN', () => {
      const requester = {
        roleCode: 'ADMIN',
        roleName: '',
        role: {},
      };
      expect(getRequesterRoleName(requester)).toBe('Admin');
      expect(isAdminUser(requester)).toBe(true);
    });

    it('should correctly normalize roleName to Admin if permissions includes ADMIN_FULL', () => {
      const requester = {
        permissions: ['ADMIN_FULL'],
        roleName: 'StaleName',
      };
      expect(getRequesterRoleName(requester)).toBe('Admin');
      expect(isAdminUser(requester)).toBe(true);
    });

    it('should fall back to raw roleName if no admin signals are present', () => {
      const requester = {
        roleName: 'Teacher',
        roleCode: 'TEACHER',
      };
      expect(getRequesterRoleName(requester)).toBe('Teacher');
      expect(isAdminUser(requester)).toBe(false);
    });
  });

  describe('grading-access.util.ts', () => {
    it('should map various Admin indicators to admin key', () => {
      expect(getGradingRole({ roleCode: 'ADMIN' })).toBe('admin');
      expect(getGradingRole({ permissions: ['ADMIN_FULL'] })).toBe('admin');
      expect(getGradingRole({ roleName: 'Admin' })).toBe('admin');
      expect(getGradingRole({ role: { name: 'admin' } })).toBe('admin');
    });

    it('should map Supervisor indicators to supervisor key', () => {
      expect(getGradingRole({ roleName: 'Supervisor' })).toBe('supervisor');
      expect(getGradingRole({ role: { role_code: 'SUPERVISOR' } })).toBe('supervisor');
    });

    it('should map Teacher indicators to teacher key', () => {
      expect(getGradingRole({ roleName: 'Teacher' })).toBe('teacher');
      expect(getGradingRole({ roleName: 'Advisor' })).toBe('teacher');
    });

    it('should map Student indicators to student key', () => {
      expect(getGradingRole({ roleName: 'Student' })).toBe('student');
      expect(getGradingRole({ roleCode: 'STUDENT' })).toBe('student');
    });

    it('should return unknown for unrecognized roles', () => {
      expect(getGradingRole({ roleName: 'Guest' })).toBe('unknown');
    });

    it('should evaluate access decisions properly per role', () => {
      const adminAccess = evaluateGradingAccess({ roleCode: 'ADMIN' });
      expect(adminAccess.role).toBe('admin');
      expect(adminAccess.canModifyScore).toBe(true);
      expect(adminAccess.canDeleteSummary).toBe(true);
      expect(adminAccess.canManageEvaluationPeriod).toBe(true);

      const teacherAccess = evaluateGradingAccess({ roleName: 'Teacher' });
      expect(teacherAccess.role).toBe('teacher');
      expect(teacherAccess.canModifyScore).toBe(true);
      expect(teacherAccess.canDeleteSummary).toBe(false);
      expect(teacherAccess.canManageEvaluationPeriod).toBe(false);
    });

    it('should validate assertCanAccessStudent for student self scope', async () => {
      const studentRequester = { userId: 'student_123', roleCode: 'STUDENT' };
      
      // Self should succeed
      await expect(assertCanAccessStudent(studentRequester, 'student_123', {}, {})).resolves.not.toThrow();
      
      // Other student should throw ForbiddenException
      await expect(assertCanAccessStudent(studentRequester, 'student_456', {}, {})).rejects.toThrow(ForbiddenException);
    });

    it('should validate assertCanAccessClass for teacher class ownership', async () => {
      const teacherRequester = { userId: 'teacher_123', roleName: 'Teacher' };
      
      const mockClassModel = {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ advisor_id: 'teacher_123' })
          })
        })
      };

      // Owner should succeed
      await expect(assertCanAccessClass(teacherRequester, 'class_123', mockClassModel)).resolves.not.toThrow();

      // Non-owner should throw ForbiddenException
      const mockClassModelNonOwner = {
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ advisor_id: 'teacher_456' })
          })
        })
      };
      await expect(assertCanAccessClass(teacherRequester, 'class_123', mockClassModelNonOwner)).rejects.toThrow(ForbiddenException);
    });
  });
});
