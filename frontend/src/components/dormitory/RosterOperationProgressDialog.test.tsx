import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RosterOperationProgressDialog, { rosterOperationPercentage } from './RosterOperationProgressDialog';

describe('RosterOperationProgressDialog', () => {
  const progress = { phase: 'processing' as const, processed: 2, total: 5, counters: { deleted: 1, blocked: 0 }, unconfirmed: 1, unsent: 2 };

  it('reports integer acknowledged progress and keeps a pending operation dismissible only by completion', () => {
    const onOpenChange = vi.fn();
    render(<RosterOperationProgressDialog open operation="delete" progress={progress} pending onOpenChange={onOpenChange} />);

    expect(rosterOperationPercentage(progress)).toBe(40);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByText('Chưa xác nhận: 1 · Chưa gửi: 2. Không tự động gửi lại.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('keeps terminal results visible until the user closes the dialog', () => {
    const onOpenChange = vi.fn();
    render(<RosterOperationProgressDialog open operation="import" progress={{ phase: 'partial', processed: 5, total: 5, counters: { created: 4, failed: 1 } }} pending={false} onOpenChange={onOpenChange} />);
    expect(screen.getByText('Hoàn tất một phần')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
