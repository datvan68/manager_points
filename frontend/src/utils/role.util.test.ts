import { describe, it, expect } from 'vitest';
import { isStudentRole, isTeacherRole, isAdminRole, isAdminOrSupervisor } from './role.util';

describe('role.util tests', () => {
  describe('isStudentRole', () => {
    it('should return false for null, undefined, or empty user', () => {
      expect(isStudentRole(null)).toBe(false);
      expect(isStudentRole(undefined)).toBe(false);
      expect(isStudentRole({})).toBe(false);
    });

    it('should identify student role from roleCode', () => {
      expect(isStudentRole({ roleCode: 'STUDENT' })).toBe(true);
      expect(isStudentRole({ roleCode: 'TEACHER' })).toBe(false);
    });

    it('should identify student role from string roleName', () => {
      expect(isStudentRole({ roleName: 'STUDENT' })).toBe(true);
      expect(isStudentRole({ roleName: 'Sinh viên' })).toBe(true);
      expect(isStudentRole({ roleName: 'Học sinh' })).toBe(true);
      expect(isStudentRole({ roleName: 'HSSV' })).toBe(true);
      expect(isStudentRole({ roleName: 'TEACHER' })).toBe(false);
    });

    it('should identify student role from string role field', () => {
      expect(isStudentRole({ role: 'student' })).toBe(true);
      expect(isStudentRole({ role: 'sinh viên' })).toBe(true);
      expect(isStudentRole({ role: 'học sinh' })).toBe(true);
      expect(isStudentRole({ role: 'HSSV' })).toBe(true);
      expect(isStudentRole({ role: 'teacher' })).toBe(false);
    });

    it('should identify student role from object role field', () => {
      expect(isStudentRole({ role: { name: 'student' } })).toBe(true);
      expect(isStudentRole({ role: { role_code: 'STUDENT' } })).toBe(true);
      expect(isStudentRole({ role: { name: 'sinh viên' } })).toBe(true);
      expect(isStudentRole({ role: { name: 'học sinh' } })).toBe(true);
      expect(isStudentRole({ role: { name: 'teacher' } })).toBe(false);
      expect(isStudentRole({ role: { role_code: 'TEACHER' } })).toBe(false);
    });

    // Array support tests
    it('should identify student role from array of strings', () => {
      expect(isStudentRole({ roles: ['STUDENT', 'TEACHER'] })).toBe(true);
      expect(isStudentRole({ roles: ['TEACHER', 'ADMIN'] })).toBe(false);
    });

    it('should identify student role from array of objects', () => {
      expect(isStudentRole({ roles: [{ name: 'student' }, { name: 'teacher' }] })).toBe(true);
      expect(isStudentRole({ roles: [{ role_code: 'TEACHER' }, { role_code: 'ADMIN' }] })).toBe(false);
    });

    it('should identify student role from mixed array', () => {
      expect(isStudentRole({ roles: ['TEACHER', { name: 'student' }] })).toBe(true);
    });

    it('should handle array with null, undefined, or empty elements correctly', () => {
      expect(isStudentRole({ roles: [null, undefined, '', 'STUDENT'] })).toBe(true);
      expect(isStudentRole({ roles: [null, undefined, { name: '' }, { name: 'student' }] })).toBe(true);
      expect(isStudentRole({ roles: [null, undefined, { role_code: '' }, 'TEACHER'] })).toBe(false);
    });
  });

  describe('isTeacherRole', () => {
    it('should return false for null, undefined, or empty user', () => {
      expect(isTeacherRole(null)).toBe(false);
      expect(isTeacherRole(undefined)).toBe(false);
      expect(isTeacherRole({})).toBe(false);
    });

    it('should identify teacher role from roleCode', () => {
      expect(isTeacherRole({ roleCode: 'TEACHER' })).toBe(true);
      expect(isTeacherRole({ roleCode: 'STUDENT' })).toBe(false);
    });

    it('should identify teacher role from string roleName', () => {
      expect(isTeacherRole({ roleName: 'TEACHER' })).toBe(true);
      expect(isTeacherRole({ roleName: 'Giáo viên' })).toBe(true);
      expect(isTeacherRole({ roleName: 'Giảng viên' })).toBe(true);
      expect(isTeacherRole({ roleName: 'Advisor' })).toBe(true);
      expect(isTeacherRole({ roleName: 'Cố vấn' })).toBe(true);
      expect(isTeacherRole({ roleName: 'STUDENT' })).toBe(false);
    });

    it('should identify teacher role from string role field', () => {
      expect(isTeacherRole({ role: 'teacher' })).toBe(true);
      expect(isTeacherRole({ role: 'giáo viên' })).toBe(true);
      expect(isTeacherRole({ role: 'giảng viên' })).toBe(true);
      expect(isTeacherRole({ role: 'advisor' })).toBe(true);
      expect(isTeacherRole({ role: 'cố vấn' })).toBe(true);
      expect(isTeacherRole({ role: 'student' })).toBe(false);
    });

    it('should identify teacher role from object role field', () => {
      expect(isTeacherRole({ role: { name: 'teacher' } })).toBe(true);
      expect(isTeacherRole({ role: { role_code: 'TEACHER' } })).toBe(true);
      expect(isTeacherRole({ role: { name: 'giảng viên' } })).toBe(true);
      expect(isTeacherRole({ role: { name: 'cố vấn' } })).toBe(true);
      expect(isTeacherRole({ role: { name: 'student' } })).toBe(false);
      expect(isTeacherRole({ role: { role_code: 'STUDENT' } })).toBe(false);
    });

    // Array support tests
    it('should identify teacher role from array of strings', () => {
      expect(isTeacherRole({ roles: ['STUDENT', 'TEACHER'] })).toBe(true);
      expect(isTeacherRole({ roles: ['STUDENT', 'ADMIN'] })).toBe(false);
    });

    it('should identify teacher role from array of objects', () => {
      expect(isTeacherRole({ roles: [{ name: 'student' }, { name: 'teacher' }] })).toBe(true);
      expect(isTeacherRole({ roles: [{ role_code: 'STUDENT' }, { role_code: 'ADMIN' }] })).toBe(false);
    });

    it('should identify teacher role from mixed array', () => {
      expect(isTeacherRole({ roles: ['STUDENT', { name: 'teacher' }] })).toBe(true);
    });

    it('should handle array with null, undefined, or empty elements correctly', () => {
      expect(isTeacherRole({ roles: [null, undefined, '', 'TEACHER'] })).toBe(true);
      expect(isTeacherRole({ roles: [null, undefined, { name: '' }, { name: 'giáo viên' }] })).toBe(true);
      expect(isTeacherRole({ roles: [null, undefined, { role_code: '' }, 'STUDENT'] })).toBe(false);
    });
  });

  describe('isAdminRole', () => {
    it('should return false for null, undefined, or empty user', () => {
      expect(isAdminRole(null)).toBe(false);
      expect(isAdminRole(undefined)).toBe(false);
      expect(isAdminRole({})).toBe(false);
    });

    it('should identify admin role from roleCode', () => {
      expect(isAdminRole({ roleCode: 'ADMIN' })).toBe(true);
      expect(isAdminRole({ roleCode: 'TEACHER' })).toBe(false);
    });

    it('should identify admin role from string roleName', () => {
      expect(isAdminRole({ roleName: 'ADMIN' })).toBe(true);
      expect(isAdminRole({ roleName: 'Admin' })).toBe(true);
      expect(isAdminRole({ roleName: 'STUDENT' })).toBe(false);
    });

    it('should identify admin role from string role field', () => {
      expect(isAdminRole({ role: 'admin' })).toBe(true);
      expect(isAdminRole({ role: 'student' })).toBe(false);
    });

    it('should identify admin role from object role field', () => {
      expect(isAdminRole({ role: { name: 'admin' } })).toBe(true);
      expect(isAdminRole({ role: { role_code: 'ADMIN' } })).toBe(true);
      expect(isAdminRole({ role: { name: 'student' } })).toBe(false);
    });

    // Array support tests
    it('should identify admin role from array of strings', () => {
      expect(isAdminRole({ roles: ['STUDENT', 'ADMIN'] })).toBe(true);
      expect(isAdminRole({ roles: ['STUDENT', 'TEACHER'] })).toBe(false);
    });

    it('should identify admin role from array of objects', () => {
      expect(isAdminRole({ roles: [{ name: 'student' }, { name: 'admin' }] })).toBe(true);
      expect(isAdminRole({ roles: [{ role_code: 'STUDENT' }, { role_code: 'TEACHER' }] })).toBe(false);
    });

    it('should identify admin role from mixed array', () => {
      expect(isAdminRole({ roles: ['STUDENT', { name: 'admin' }] })).toBe(true);
    });

    it('should handle array with null, undefined, or empty elements correctly', () => {
      expect(isAdminRole({ roles: [null, undefined, '', 'ADMIN'] })).toBe(true);
      expect(isAdminRole({ roles: [null, undefined, { name: '' }, { name: 'admin' }] })).toBe(true);
      expect(isAdminRole({ roles: [null, undefined, { role_code: '' }, 'STUDENT'] })).toBe(false);
    });
  });

  describe('isAdminOrSupervisor', () => {
    it('should return false for null, undefined, or empty user', () => {
      expect(isAdminOrSupervisor(null)).toBe(false);
      expect(isAdminOrSupervisor(undefined)).toBe(false);
      expect(isAdminOrSupervisor({})).toBe(false);
    });

    it('should identify admin/supervisor role from roleCode', () => {
      expect(isAdminOrSupervisor({ roleCode: 'ADMIN' })).toBe(true);
      expect(isAdminOrSupervisor({ roleCode: 'SUPERVISOR' })).toBe(true);
      expect(isAdminOrSupervisor({ roleCode: 'STUDENT' })).toBe(false);
    });

    it('should identify admin/supervisor role from string roleName', () => {
      expect(isAdminOrSupervisor({ roleName: 'ADMIN' })).toBe(true);
      expect(isAdminOrSupervisor({ roleName: 'Supervisor' })).toBe(true);
      expect(isAdminOrSupervisor({ roleName: 'Quản sinh' })).toBe(true);
      expect(isAdminOrSupervisor({ roleName: 'STUDENT' })).toBe(false);
    });

    it('should identify admin/supervisor role from string role field', () => {
      expect(isAdminOrSupervisor({ role: 'admin' })).toBe(true);
      expect(isAdminOrSupervisor({ role: 'supervisor' })).toBe(true);
      expect(isAdminOrSupervisor({ role: 'quản sinh' })).toBe(true);
      expect(isAdminOrSupervisor({ role: 'student' })).toBe(false);
    });

    it('should identify admin/supervisor role from object role field', () => {
      expect(isAdminOrSupervisor({ role: { name: 'admin' } })).toBe(true);
      expect(isAdminOrSupervisor({ role: { role_code: 'SUPERVISOR' } })).toBe(true);
      expect(isAdminOrSupervisor({ role: { name: 'quản sinh' } })).toBe(true);
      expect(isAdminOrSupervisor({ role: { name: 'student' } })).toBe(false);
    });

    // Array support tests
    it('should identify admin/supervisor role from array of strings', () => {
      expect(isAdminOrSupervisor({ roles: ['STUDENT', 'ADMIN'] })).toBe(true);
      expect(isAdminOrSupervisor({ roles: ['STUDENT', 'SUPERVISOR'] })).toBe(true);
      expect(isAdminOrSupervisor({ roles: ['STUDENT', 'TEACHER'] })).toBe(false);
    });

    it('should identify admin/supervisor role from array of objects', () => {
      expect(isAdminOrSupervisor({ roles: [{ name: 'student' }, { name: 'admin' }] })).toBe(true);
      expect(isAdminOrSupervisor({ roles: [{ role_code: 'STUDENT' }, { role_code: 'SUPERVISOR' }] })).toBe(true);
      expect(isAdminOrSupervisor({ roles: [{ role_code: 'STUDENT' }, { role_code: 'TEACHER' }] })).toBe(false);
    });

    it('should identify admin/supervisor role from mixed array', () => {
      expect(isAdminOrSupervisor({ roles: ['STUDENT', { name: 'admin' }] })).toBe(true);
      expect(isAdminOrSupervisor({ roles: ['STUDENT', { name: 'supervisor' }] })).toBe(true);
    });

    it('should handle array with null, undefined, or empty elements correctly', () => {
      expect(isAdminOrSupervisor({ roles: [null, undefined, '', 'SUPERVISOR'] })).toBe(true);
      expect(isAdminOrSupervisor({ roles: [null, undefined, { name: '' }, { name: 'admin' }] })).toBe(true);
      expect(isAdminOrSupervisor({ roles: [null, undefined, { role_code: '' }, 'STUDENT'] })).toBe(false);
    });
  });
});
