import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RoleModal from '../RoleModal';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  allPermissions: [],
  groups: [],
};

const fillRequiredFields = () => {
  fireEvent.change(screen.getByPlaceholderText('VD: Quản lý Đào tạo'), {
    target: { value: 'Quản lý đào tạo' },
  });
  fireEvent.change(screen.getByPlaceholderText('VD: QUAN_LY_DAO_TAO'), {
    target: { value: '  quan_ly_dao_tao  ' },
  });
};

describe('RoleModal', () => {
  it('renders role code and submits normalized data while preserving other fields', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<RoleModal {...defaultProps} onSave={onSave} />);
    fillRequiredFields();

    fireEvent.change(screen.getByPlaceholderText('Mô tả trách nhiệm của vai trò này trong hệ thống...'), {
      target: { value: 'Mô tả' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      name: 'Quản lý đào tạo',
      role_code: 'QUAN_LY_DAO_TAO',
      description: 'Mô tả',
      permissions: [],
    }));
  });

  it('blocks empty name and role code with field-level validation', async () => {
    const onSave = vi.fn();

    render(<RoleModal {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo' }));

    expect(await screen.findByText('Vui lòng nhập Tên vai trò')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập Mã vai trò')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('resets create state and initializes edit role code', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <RoleModal {...defaultProps} onSave={onSave} />
    );

    fireEvent.change(screen.getByPlaceholderText('VD: QUAN_LY_DAO_TAO'), {
      target: { value: 'TEMP' },
    });
    rerender(<RoleModal {...defaultProps} isOpen={false} onSave={onSave} />);
    rerender(<RoleModal {...defaultProps} isOpen={true} onSave={onSave} />);
    expect(screen.getByPlaceholderText('VD: QUAN_LY_DAO_TAO')).toHaveValue('');

    rerender(
      <RoleModal
        {...defaultProps}
        isEditing
        initialData={{ name: 'Admin', role_code: ' admin ', description: 'Mô tả', permissions: [] }}
        onSave={onSave}
      />
    );
    await waitFor(() => expect(screen.getByPlaceholderText('VD: QUAN_LY_DAO_TAO')).toHaveValue(' admin '));
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật ngay' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      name: 'Admin',
      role_code: 'ADMIN',
      description: 'Mô tả',
      permissions: [],
    }));
  });

  it('keeps the modal open when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Mã vai trò đã tồn tại'));
    const onClose = vi.fn();

    render(<RoleModal {...defaultProps} onClose={onClose} onSave={onSave} />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Xác nhận tạo' })).toBeInTheDocument();
  });
});
