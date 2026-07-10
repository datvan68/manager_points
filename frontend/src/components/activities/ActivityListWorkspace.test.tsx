import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ActivityListWorkspace from './ActivityListWorkspace';

const mockGetUser = vi.fn();
vi.mock('@/api/auth-api', () => ({
  tokenStorage: {
    getUser: () => mockGetUser(),
    getAccessToken: () => 'mock-token',
  },
}));

vi.mock('@/api/activity-api', () => ({
  activityApi: {
    getAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  activityScheduleApi: {
    getAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    create: vi.fn(),
    delete: vi.fn(),
    cancelRecurrence: vi.fn(),
  },
}));

describe('ActivityListWorkspace', () => {
  const mockActivities = [
    {
      _id: 'act1',
      name: 'IT Club Activity',
      code: 'IT_CLUB',
      category: 'academic',
      participation_status: 'published',
      classroom: 'A.101',
      membership_status: 'none',
      is_favorited: false,
    },
    {
      _id: 'act2',
      name: 'Sports Club Activity',
      code: 'SP_CLUB',
      category: 'sports',
      participation_status: 'draft',
      classroom: 'B.202',
      membership_status: 'none',
      is_favorited: false,
    }
  ];

  const onJoinClick = vi.fn();
  const onFavoriteClick = vi.fn();
  const onEditClick = vi.fn();
  const onDeleteClick = vi.fn();
  const onCreateClick = vi.fn();
  const canManage = vi.fn();
  const onNavigateToDetail = vi.fn();
  const onConfigureDesign = vi.fn();
  const onSelectedActivityIdsChange = vi.fn();
  const onBulkActionClick = vi.fn();
  const onSingleStatusChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue({ role: 'teacher' }); // Default to manager
    canManage.mockReturnValue(true);
  });

  const renderWorkspace = (props = {}) => {
    return render(
      <ActivityListWorkspace
        activities={mockActivities}
        loading={false}
        onJoinClick={onJoinClick}
        onFavoriteClick={onFavoriteClick}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        onCreateClick={onCreateClick}
        canManage={canManage}
        onNavigateToDetail={onNavigateToDetail}
        onConfigureDesign={onConfigureDesign}
        onSelectedActivityIdsChange={onSelectedActivityIdsChange}
        onBulkActionClick={onBulkActionClick}
        onSingleStatusChange={onSingleStatusChange}
        {...props}
      />
    );
  };

  it('renders list with grid view by default, and can switch to table view', () => {
    const { container } = renderWorkspace();
    expect(screen.getByText('IT Club Activity')).toBeInTheDocument();
    
    // Switch to table view
    const buttons = container.querySelectorAll('button');
    const listBtn = Array.from(buttons).find(btn => btn.querySelector('svg.lucide-list'));
    expect(listBtn).toBeInTheDocument();
    fireEvent.click(listBtn!);

    // Now headers of the table should render
    expect(screen.getByText('Tên hoạt động')).toBeInTheDocument();
    expect(screen.getByText('Mã')).toBeInTheDocument();
  });

  describe('Manager View (canManage=true, role=teacher)', () => {
    beforeEach(() => {
      mockGetUser.mockReturnValue({ role: 'teacher' });
      canManage.mockReturnValue(true);
    });

    it('displays checkboxes for row selection and header checkbox for select-all', () => {
      const { container } = renderWorkspace();
      const listBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.querySelector('svg.lucide-list'));
      fireEvent.click(listBtn!);

      // Check for checkboxes. 1 header checkbox + 2 row checkboxes = 3 checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(3);

      // Click select-all checkbox (first checkbox)
      fireEvent.click(checkboxes[0]);
      expect(onSelectedActivityIdsChange).toHaveBeenCalledWith(['act1', 'act2']);
    });

    it('supports selecting all filtered activities', () => {
      const { container } = renderWorkspace();
      const listBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.querySelector('svg.lucide-list'));
      fireEvent.click(listBtn!);

      // Filter by category "academic"
      const categorySelect = screen.getByRole('combobox');
      fireEvent.change(categorySelect, { target: { value: 'academic' } });

      // After filtering, only 'IT Club Activity' should be visible.
      // Click header checkbox. It should select only 'act1'
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      expect(onSelectedActivityIdsChange).toHaveBeenCalledWith(['act1']);
    });

    it('renders icon-only buttons (edit, delete, configure-design) with accessible names/labels', () => {
      const { container } = renderWorkspace();
      const listBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.querySelector('svg.lucide-list'));
      fireEvent.click(listBtn!);

      // Check design configuration button
      const designBtns = screen.getAllByTitle('Cấu hình thiết kế');
      expect(designBtns.length).toBe(2);
      expect(designBtns[0]).toHaveAttribute('aria-label', 'Cấu hình thiết kế');

      // Check edit button
      const editBtns = screen.getAllByTitle('Chỉnh sửa');
      expect(editBtns.length).toBe(2);
      expect(editBtns[0]).toHaveAttribute('aria-label', 'Chỉnh sửa');

      // Check delete button
      const deleteBtns = screen.getAllByTitle('Xóa');
      expect(deleteBtns.length).toBe(2);
      expect(deleteBtns[0]).toHaveAttribute('aria-label', 'Xóa');
    });

    it('prevents click event propagation on manager action buttons', () => {
      const { container } = renderWorkspace();
      const listBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.querySelector('svg.lucide-list'));
      fireEvent.click(listBtn!);

      // Click edit button
      const editBtn = screen.getAllByTitle('Chỉnh sửa')[0];
      fireEvent.click(editBtn);
      expect(onEditClick).toHaveBeenCalledWith(mockActivities[0]);
      expect(onNavigateToDetail).not.toHaveBeenCalled();

      // Reset mock
      onNavigateToDetail.mockClear();

      // Click delete button
      const deleteBtn = screen.getAllByTitle('Xóa')[0];
      fireEvent.click(deleteBtn);
      expect(onDeleteClick).toHaveBeenCalledWith(mockActivities[0]);
      expect(onNavigateToDetail).not.toHaveBeenCalled();

      // Reset mock
      onNavigateToDetail.mockClear();

      // Click configure design button
      const designBtn = screen.getAllByTitle('Cấu hình thiết kế')[0];
      fireEvent.click(designBtn);
      expect(onConfigureDesign).toHaveBeenCalledWith(mockActivities[0]);
      expect(onNavigateToDetail).not.toHaveBeenCalled();
    });

    it('renders 3 status action buttons and triggers appropriate onSingleStatusChange callbacks', () => {
      const { container } = renderWorkspace();
      const listBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.querySelector('svg.lucide-list'));
      fireEvent.click(listBtn!);

      // "Đưa về nháp" button
      const draftBtns = screen.getAllByTitle('Đưa về nháp');
      expect(draftBtns.length).toBe(2);
      fireEvent.click(draftBtns[0]);
      expect(onSingleStatusChange).toHaveBeenCalledWith('act1', 'draft');

      // "Công khai đăng ký" button
      const publishBtns = screen.getAllByTitle('Công khai đăng ký');
      expect(publishBtns.length).toBe(2);
      fireEvent.click(publishBtns[0]);
      expect(onSingleStatusChange).toHaveBeenCalledWith('act1', 'published');

      // "Hủy hoạt động" button
      const cancelBtns = screen.getAllByTitle('Hủy hoạt động');
      expect(cancelBtns.length).toBe(2);
      fireEvent.click(cancelBtns[0]);
      expect(onSingleStatusChange).toHaveBeenCalledWith('act1', 'cancelled');
    });
  });

  describe('Student View (role=student)', () => {
    beforeEach(() => {
      mockGetUser.mockReturnValue({ role: 'student' });
      canManage.mockReturnValue(false);
    });

    it('does not display manager selection checkboxes and administrative buttons to student', () => {
      const { container } = renderWorkspace();
      const listBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.querySelector('svg.lucide-list'));
      fireEvent.click(listBtn!);

      // Checkboxes should not exist. Only row click navigation, but no checkboxes.
      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes.length).toBe(0);

      // Manager administrative buttons should not render
      expect(screen.queryByTitle('Cấu hình thiết kế')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Chỉnh sửa')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Xóa')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Đưa về nháp')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Công khai đăng ký')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Hủy hoạt động')).not.toBeInTheDocument();
    });
  });
});
