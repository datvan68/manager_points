import { describe, it, expect } from 'vitest';
import {
  normalizeRole,
  findActivityMembership,
  isJoinedStudent,
  filterDetailTabs,
} from './student-activity-view';

describe('student-activity-view helpers', () => {
  describe('normalizeRole', () => {
    it('should return normalized lowercase role', () => {
      expect(normalizeRole('STUDENT')).toBe('student');
      expect(normalizeRole('Admin')).toBe('admin');
      expect(normalizeRole('')).toBe('');
      expect(normalizeRole(undefined)).toBe('');
    });
  });

  describe('findActivityMembership', () => {
    const mockMemberships = [
      { activity_id: 'club-1', status: 'active' },
      { activity_id: { _id: 'club-2' }, status: 'pending' },
    ];

    it('should find club membership by string ID', () => {
      const match = findActivityMembership(mockMemberships, 'club-1');
      expect(match).toBeDefined();
      expect(match?.status).toBe('active');
    });

    it('should find club membership by populated object ID', () => {
      const match = findActivityMembership(mockMemberships, 'club-2');
      expect(match).toBeDefined();
      expect(match?.status).toBe('pending');
    });

    it('should return undefined if no matching club ID exists', () => {
      const match = findActivityMembership(mockMemberships, 'club-3');
      expect(match).toBeUndefined();
    });

    it('should return undefined for empty memberships list', () => {
      const match = findActivityMembership([], 'club-1');
      expect(match).toBeUndefined();
    });
  });

  describe('isJoinedStudent', () => {
    it('should return true for active student membership', () => {
      expect(isJoinedStudent('student', 'active')).toBe(true);
      expect(isJoinedStudent('STUDENT', 'active')).toBe(true);
    });

    it('should return false for pending student membership', () => {
      expect(isJoinedStudent('student', 'pending')).toBe(false);
    });

    it('should return false for left student membership', () => {
      expect(isJoinedStudent('student', 'left')).toBe(false);
    });

    it('should return false for active non-student role', () => {
      expect(isJoinedStudent('admin', 'active')).toBe(false);
      expect(isJoinedStudent('teacher', 'active')).toBe(false);
      expect(isJoinedStudent(undefined, 'active')).toBe(false);
    });

    it('should return false for missing membership status', () => {
      expect(isJoinedStudent('student', undefined)).toBe(false);
    });
  });

  describe('filterDetailTabs', () => {
    const mockTabs = [
      { id: 'info', label: 'Thông tin' },
      { id: 'members', label: 'Thành viên' },
      { id: 'schedules', label: 'Lịch sinh hoạt' },
    ];

    it('should remove members tab if active student member is true', () => {
      const filtered = filterDetailTabs(mockTabs, true);
      expect(filtered).toHaveLength(2);
      expect(filtered.find((t) => t.id === 'members')).toBeUndefined();
    });

    it('should keep all tabs if active student member is false', () => {
      const filtered = filterDetailTabs(mockTabs, false);
      expect(filtered).toHaveLength(3);
      expect(filtered.find((t) => t.id === 'members')).toBeDefined();
    });
  });
});
