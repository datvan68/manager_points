import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecordSelectionDialog, quickGridClass, toggleSelectionValue } from './RecordSelectionUi';

describe('RecordSelectionUi', () => {
  it('keeps a single selection as draft until confirmation and rolls back on cancel', () => {
    const onConfirm = vi.fn();
    render(<RecordSelectionDialog label="Tiêu chí" title="Chọn tiêu chí" value="one" placeholder="Chọn tiêu chí" onConfirm={onConfirm}>
      {(draft, setDraft) => <button type="button" onClick={() => setDraft('two')}>{draft}</button>}
    </RecordSelectionDialog>);

    fireEvent.click(screen.getByRole('button', { name: /one/i }));
    fireEvent.click(screen.getByRole('button', { name: 'one' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /one/i }));
    expect(screen.getByRole('button', { name: 'one' })).toBeInTheDocument();
  });

  it('confirms single and multi selections once', () => {
    const single = vi.fn();
    render(<RecordSelectionDialog label="Một" title="Một" value="" placeholder="Chọn" onConfirm={single}>
      {(draft, setDraft) => <button type="button" onClick={() => setDraft('x')}>{String(draft) || 'x'}</button>}
    </RecordSelectionDialog>);
    fireEvent.click(screen.getByRole('button', { name: 'Chọn' }));
    fireEvent.click(screen.getByRole('button', { name: 'x' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(single).toHaveBeenCalledTimes(1);
    expect(single).toHaveBeenCalledWith('x');

    expect(toggleSelectionValue(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleSelectionValue(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('only enables the six-card viewport from the seventh item', () => {
    expect(quickGridClass(6)).toContain('overflow-visible');
    expect(quickGridClass(7)).toContain('overflow-y-auto');
    expect(quickGridClass(7)).toContain('max-h-[300px]');
  });
});
