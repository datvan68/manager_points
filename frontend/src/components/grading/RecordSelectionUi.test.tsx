import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecordOptionRow, RecordSelectionDialog, quickGridClass, toggleSelectionValue, MobileStudentSelectionDialog } from './RecordSelectionUi';

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

  it('can suppress the mobile class close control without preventing manual search focus', () => {
    render(
      <RecordSelectionDialog
        isMobile
        searchable
        mobileShowCloseButton={false}
        mobilePreventOpenAutoFocus
        label="Lớp học"
        title="Chọn lớp học"
        value=""
        placeholder="Chọn lớp"
        onConfirm={vi.fn()}
      >
        {() => <div>Nội dung</div>}
      </RecordSelectionDialog>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chọn lớp' }));
    const search = screen.getByRole('combobox');
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(document.activeElement).not.toBe(search);

    search.focus();
    expect(document.activeElement).toBe(search);
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

  it('renders sr-only title and description when hideHeader is true in RecordSelectionDialog', () => {
    render(
      <RecordSelectionDialog
        label="Lớp học"
        title="Chọn lớp học"
        description="Mô tả chọn lớp học"
        hideHeader={true}
        value=""
        placeholder="Chọn lớp"
        onConfirm={vi.fn()}
      >
        {() => <div data-testid="content">Nội dung</div>}
      </RecordSelectionDialog>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chọn lớp' }));
    const title = screen.getByText('Chọn lớp học');
    const description = screen.getByText('Mô tả chọn lớp học');
    expect(title.className).toContain('sr-only');
    expect(description.className).toContain('sr-only');
  });

  it('handles mobile student selection with draft state, cancel and confirm', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onLoadMore = vi.fn();
    const students = [
      { _id: 'st-1', full_name: 'Nguyễn Văn A', student_code: 'SV001' },
      { _id: 'st-2', full_name: 'Trần Thị B', student_code: 'SV002' },
    ];

    const { rerender } = render(
      <MobileStudentSelectionDialog
        open={true}
        onOpenChange={vi.fn()}
        students={students}
        selectedStudentIds={['st-1']}
        onConfirm={onConfirm}
        onCancel={onCancel}
        hasMore={true}
        onLoadMore={onLoadMore}
      />
    );

    expect(screen.queryByText('Nghỉ học không phép')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    const optionA = screen.getByRole('option', { name: /Nguyễn Văn A/i });
    const optionB = screen.getByRole('option', { name: /Trần Thị B/i });
    expect(optionA).toHaveAttribute('aria-selected', 'true');
    expect(optionB).toHaveAttribute('aria-selected', 'false');

    // Toggle option B to select it
    fireEvent.click(optionB);
    expect(optionB).toHaveAttribute('aria-selected', 'true');

    // Click load more
    const loadMoreBtn = screen.getByRole('button', { name: /Tải thêm sinh viên/i });
    fireEvent.click(loadMoreBtn);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // Cancel flow
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    // Confirm flow
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(['st-1', 'st-2']);
  });
});
