import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UserModal, { isTeacherRole } from '../UserModal';

describe('UserModal - isTeacherRole helper', () => {
  it('should identify TEACHER role correctly by role_code', () => {
    expect(isTeacherRole({ role_code: 'TEACHER', name: 'Random Name' })).toBe(true);
  });

  it('should identify TEACHER role correctly by name regex', () => {
    expect(isTeacherRole({ role_code: 'OTHER', name: 'Giáo viên' })).toBe(true);
    expect(isTeacherRole({ role_code: 'OTHER', name: 'Giảng viên' })).toBe(true);
    expect(isTeacherRole({ role_code: 'OTHER', name: 'Teacher' })).toBe(true);
    expect(isTeacherRole({ role_code: 'OTHER', name: 'GVCN' })).toBe(true);
  });

  it('should return false for non-teacher roles', () => {
    expect(isTeacherRole({ role_code: 'STUDENT', name: 'Học sinh' })).toBe(false);
  });
});

describe('UserModal - Component', () => {
  const mockRoles = [
    { _id: 'role_admin', name: 'Admin', role_code: 'ADMIN' },
    { _id: 'role_teacher', name: 'Giáo viên', role_code: 'TEACHER' },
  ];

  const mockClasses = [
    { _id: 'class_1', name: 'Lớp 1A', advisor_id: null },
    { _id: 'class_2', name: 'Lớp 1B', advisor_id: null },
  ];

  it('hydrates initialData correctly for edit mode', async () => {
    const initialData = {
      _id: 'user_1',
      username: 'teacher1',
      email: 't1@example.com',
      role: { _id: 'role_teacher', role_code: 'TEACHER' },
      status: 'active',
      advisor_class_ids: ['class_1', 'class_2']
    };

    render(
      <UserModal
        isOpen={true}
        onClose={vi.fn()}
        isEditing={true}
        initialData={initialData}
        roles={mockRoles}
        classes={mockClasses}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('teacher1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('t1@example.com')).toBeInTheDocument();
      
      // Tìm text của MultiClassSelect
      const classSelectText = screen.getByText('2 lớp đã chọn');
      expect(classSelectText).toBeInTheDocument();
    });
  });

  it('calls onSave with advisor_class_ids when submitting', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const initialData = {
      _id: 'user_1',
      username: 'teacher1',
      email: 't1@example.com',
      role: { _id: 'role_teacher', role_code: 'TEACHER' },
      status: 'active',
      advisor_class_ids: ['class_1']
    };

    render(
      <UserModal
        isOpen={true}
        onClose={vi.fn()}
        isEditing={true}
        initialData={initialData}
        roles={mockRoles}
        classes={mockClasses}
        onSave={handleSave}
      />
    );

    const saveButton = await screen.findByRole('button', { name: /Lưu thông tin/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(expect.objectContaining({
        username: 'teacher1',
        email: 't1@example.com',
        role: 'role_teacher',
        status: 'active',
        advisorClassIds: ['class_1'], // internal state
        advisor_class_ids: ['class_1'] // payload passed out
      }));
    });
  });
});
