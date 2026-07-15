import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ActivityMemberTable from './ActivityMemberTable';
import { ActivityMember } from '@/api/activity-api';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ActivityMemberTable - ConfirmModal Integration', () => {
  const mockMembers: ActivityMember[] = [
    {
      _id: 'member-1',
      activity_id: 'activity-1',
      student_id: {
        _id: 'student-1',
        full_name: 'Nguyen Van A',
        student_code: 'SV001',
        email: 'a@student.com',
      },
      role: 'member',
      status: 'active',
      joined_at: '2026-07-10T00:00:00Z',
      createdAt: '2026-07-10T00:00:00Z',
      semester_id: 'semester-1',
    },
  ];

  const defaultProps = {
    members: mockMembers,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onUpdateRole: vi.fn(),
    onRemove: vi.fn(),
    loading: false,
    isAdminOrAdvisor: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the member table and shows the trash button for admin', () => {
    render(<ActivityMemberTable {...defaultProps} />);
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByTitle('Xóa thành viên')).toBeInTheDocument();
  });

  it('opens ConfirmModal on clicking the trash button without calling onRemove immediately', async () => {
    render(<ActivityMemberTable {...defaultProps} />);
    const trashBtn = screen.getByTitle('Xóa thành viên');
    fireEvent.click(trashBtn);

    // Modal is opened
    expect(screen.getByText('Xóa thành viên')).toBeInTheDocument();
    expect(
      screen.getByText('Bạn có chắc chắn muốn xóa thành viên này khỏi hoạt động không? Hành động này không thể hoàn tác.')
    ).toBeInTheDocument();
    
    // onRemove should not be called yet
    expect(defaultProps.onRemove).not.toHaveBeenCalled();
  });

  it('closes ConfirmModal on clicking cancel button and does not call onRemove', async () => {
    render(<ActivityMemberTable {...defaultProps} />);
    const trashBtn = screen.getByTitle('Xóa thành viên');
    fireEvent.click(trashBtn);

    const cancelBtn = screen.getByRole('button', { name: 'Hủy bỏ' });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Bạn có chắc chắn muốn xóa thành viên này khỏi hoạt động không?')).not.toBeInTheDocument();
    });
    expect(defaultProps.onRemove).not.toHaveBeenCalled();
  });

  it('calls onRemove and closes modal when confirming deletion', async () => {
    defaultProps.onRemove.mockResolvedValueOnce(undefined);
    render(<ActivityMemberTable {...defaultProps} />);
    
    const trashBtn = screen.getByTitle('Xóa thành viên');
    fireEvent.click(trashBtn);

    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận xóa' });
    fireEvent.click(confirmBtn);

    expect(defaultProps.onRemove).toHaveBeenCalledTimes(1);
    expect(defaultProps.onRemove).toHaveBeenCalledWith('member-1');

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Đã xóa thành viên');
      expect(screen.queryByText('Bạn có chắc chắn muốn xóa thành viên này khỏi hoạt động không?')).not.toBeInTheDocument();
    });
  });

  it('prevents multiple removal submissions while in progress', async () => {
    let resolveRemove: () => void = () => {};
    const removePromise = new Promise<void>((resolve) => {
      resolveRemove = resolve;
    });
    defaultProps.onRemove.mockReturnValueOnce(removePromise);

    render(<ActivityMemberTable {...defaultProps} />);
    
    const trashBtn = screen.getByTitle('Xóa thành viên');
    fireEvent.click(trashBtn);

    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận xóa' });
    
    // Click confirm twice
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    // Should only trigger API call once
    expect(defaultProps.onRemove).toHaveBeenCalledTimes(1);

    // Try closing during removal
    const closeBtn = screen.getByRole('button', { name: 'Hủy bỏ' });
    fireEvent.click(closeBtn);
    
    // Modal should remain open because removal is in progress
    expect(screen.getByText('Xóa thành viên')).toBeInTheDocument();

    // Resolve the api call
    resolveRemove();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Đã xóa thành viên');
      expect(screen.queryByText('Xóa thành viên')).not.toBeInTheDocument();
    });
  });

  it('shows error toast and closes modal if onRemove fails', async () => {
    defaultProps.onRemove.mockRejectedValueOnce(new Error('API Error'));
    render(<ActivityMemberTable {...defaultProps} />);
    
    const trashBtn = screen.getByTitle('Xóa thành viên');
    fireEvent.click(trashBtn);

    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận xóa' });
    fireEvent.click(confirmBtn);

    expect(defaultProps.onRemove).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Lỗi khi xóa thành viên');
      expect(screen.queryByText('Xóa thành viên')).not.toBeInTheDocument();
    });
  });
});
