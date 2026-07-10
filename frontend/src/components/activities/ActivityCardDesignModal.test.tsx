import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ActivityCardDesignModal from './ActivityCardDesignModal';

// Mock dialog component if radix portal behaves weird in test environment
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="mock-dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div data-testid="mock-dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

describe('ActivityCardDesignModal', () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const mockInitialConfig = {
    preset: 'academic',
    pattern: 'minimal-clean',
    accentColor: '#64748B',
    states: {
      none: { label: 'Đăng ký học', bgClass: 'bg-blue-500' }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with initial configuration inputs', () => {
    render(
      <ActivityCardDesignModal
        open={true}
        onClose={onClose}
        initialConfig={mockInitialConfig}
        onSave={onSave}
        activityName="Test Activity Preview"
      />
    );

    expect(screen.getByText('Thiết kế giao diện thẻ hoạt động')).toBeInTheDocument();
    expect(screen.getByText('Test Activity Preview')).toBeInTheDocument();
  });

  it('switches tabs and allows customizing state buttons', async () => {
    render(
      <ActivityCardDesignModal
        open={true}
        onClose={onClose}
        initialConfig={mockInitialConfig}
        onSave={onSave}
      />
    );

    // Switch to Buttons tab
    const buttonsTab = screen.getByText('Nút trạng thái Đăng ký');
    fireEvent.click(buttonsTab);

    expect(screen.getByText('Cấu hình nhãn & style cho: NONE')).toBeInTheDocument();
    
    // Change label value
    const labelInput = screen.getByDisplayValue('Đăng ký học');
    fireEvent.change(labelInput, { target: { value: 'Đăng ký ngay' } });

    // Click Save
    const saveBtn = screen.getByText('Lưu thiết kế');
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        states: expect.objectContaining({
          none: expect.objectContaining({
            label: 'Đăng ký ngay'
          })
        })
      })
    );
  });

  it('triggers onClose when cancel button is clicked', () => {
    render(
      <ActivityCardDesignModal
        open={true}
        onClose={onClose}
        initialConfig={mockInitialConfig}
        onSave={onSave}
      />
    );

    const cancelBtn = screen.getByText('Hủy bỏ');
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
