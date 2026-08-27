import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecordOptionRow, RecordSelectionDialog, quickGridClass, toggleSelectionValue } from './RecordSelectionUi';

describe('RecordSelectionUi', () => {
  it('keeps a single selection as draft until confirmation and rolls back on cancel', () => {
    const onConfirm = vi.fn();
    render(<RecordSelectionDialog label="Tiêu chí" title="Chọn tiêu chí" value="one" placeholder="Chọn tiêu chí" onConfirm={onConfirm}>
      {(draft, setDraft) => <button type="button" onClick={() => setDraft('two')}>{draft}</button>}
    </RecordSelectionDialog>);

    fireEvent.click(screen.getByRole('button', { name: /one/i }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('button', { name: 'one' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /one/i }));
    expect(within(screen.getByRole('listbox')).getByRole('button', { name: 'one' })).toBeInTheDocument();
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
    expect(quickGridClass(7)).toContain('auto-rows-[52px]');
    expect(quickGridClass(7)).toContain('sm:auto-rows-[56px]');
    expect(quickGridClass(7)).toContain('xl:auto-rows-[52px]');
    expect(quickGridClass(7)).toContain('sm:max-h-[190px]');
    expect(quickGridClass(7)).toContain('xl:max-h-[206px]');
  });

  it('uses fullscreen confirmation on mobile and shows the display label', () => {
    const onConfirm = vi.fn();
    render(<RecordSelectionDialog isMobile label="Sinh viên" title="Chọn sinh viên" value="id-1" displayValue="Nguyễn Văn A" placeholder="Chọn sinh viên" onConfirm={onConfirm}>
      {(draft, setDraft) => <button type="button" role="option" onClick={() => setDraft('id-2')}>{String(draft)}</button>}
    </RecordSelectionDialog>);

    fireEvent.click(screen.getByRole('button', { name: 'Nguyễn Văn A' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(onConfirm).toHaveBeenCalledWith('id-2');
  });

  it('renders RecordOptionRow with option role, aria-selected, checkmark and no checkboxes', () => {
    const onClick = vi.fn();
    const { rerender, container } = render(
      <RecordOptionRow
        id="class-1"
        label="CNTT-01"
        subLabel="Khóa 2025"
        badge="-5đ"
        selected={false}
        onClick={onClick}
      />
    );

    const option = screen.getByRole('option', { name: /CNTT-01/i });
    expect(option).toHaveAttribute('aria-selected', 'false');
    expect(option.className).toContain('min-h-[44px]');
    expect(option.className).toContain('text-sm');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);

    fireEvent.click(option);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <RecordOptionRow
        id="class-1"
        label="CNTT-01"
        subLabel="Khóa 2025"
        badge="-5đ"
        selected={true}
        onClick={onClick}
      />
    );

    const selectedOption = screen.getByRole('option', { name: /CNTT-01/i });
    expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    expect(selectedOption.className).toContain('bg-blue-50');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });
});
