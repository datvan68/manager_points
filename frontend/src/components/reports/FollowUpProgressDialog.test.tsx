import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FollowUpProgressDialog, { FollowUpProgress } from './FollowUpProgressDialog';

const processing: FollowUpProgress = {
  phase: 'processing', processed: 0, total: 4, succeeded: 0, failed: 0, unconfirmed: 0, unsent: 4,
};

describe('FollowUpProgressDialog', () => {
  it('renders bounded determinate progress and counters', () => {
    render(<FollowUpProgressDialog open progress={{ ...processing, processed: 3, succeeded: 2, failed: 1, unsent: 1 }} onOpenChange={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Tiến độ xử lý ghi nhận' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
    expect(screen.getByText('3/4 · 75%')).toBeInTheDocument();
    expect(screen.getByText('Thành công')).toBeInTheDocument();
    expect(screen.getByText('Thất bại')).toBeInTheDocument();
  });

  it('prevents outside and keyboard close while processing', () => {
    const onOpenChange = vi.fn();
    render(<FollowUpProgressDialog open progress={processing} onOpenChange={onOpenChange} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Đang xử lý…' }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('allows terminal close', () => {
    const onOpenChange = vi.fn();
    render(<FollowUpProgressDialog open progress={{ ...processing, phase: 'partial', processed: 4, succeeded: 3, failed: 1, unsent: 0 }} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
