import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RosterOperationProgressDialog, { rosterOperationPercentage } from './RosterOperationProgressDialog';

vi.mock('lucide-react', () => ({ AlertTriangle: () => <span />, CheckCircle2: () => <span />, Loader2: () => <span />, X: () => <span /> }));

describe('RosterOperationProgressDialog', () => {
  it('keeps determinate percentages bounded and exposes counters', () => {
    expect(rosterOperationPercentage({ processed: 4, total: 10 })).toBe(40);
    expect(rosterOperationPercentage({ processed: 12, total: 10 })).toBe(100);
    render(<RosterOperationProgressDialog open operation="delete" pending={false} onOpenChange={vi.fn()} progress={{ phase: 'completed', processed: 10, total: 10, counters: { deleted: 10 } }} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
    expect(screen.getByText('Đã xóa')).toBeInTheDocument();
  });

  it('uses an accessible indeterminate state while reconciliation scans', () => {
    render(<RosterOperationProgressDialog open operation="reconcile" pending progress={{ phase: 'processing', processed: 120, total: null, counters: { linked: 5 } }} onOpenChange={vi.fn()} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).not.toHaveAttribute('aria-valuenow');
    expect(progressbar).toHaveAttribute('aria-valuetext', 'Đã quét 120');
    expect(screen.getByText('Đã quét 120')).toBeInTheDocument();
  });
});
