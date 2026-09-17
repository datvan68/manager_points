import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TimetableLookup from './TimetableLookup';
import { timetableApi, type TimetableOptions } from '@/api/timetable-api';

vi.mock('@/api/timetable-api', () => ({ timetableApi: { getOptions: vi.fn(), getTimetable: vi.fn(), getTimetables: vi.fn() } }));
const coverage = { year: 'y', semester: 's', week: 'w', faculty: '', course: '', className: 'a' };
const options: TimetableOptions = {
  years: [{ label: '2026', value: 'y' }], semesters: [{ label: 'Học kỳ 1', value: 's' }],
  weeks: [{ label: 'Tuần 3', value: 'w' }], faculties: [{ value: '', label: 'Tất cả khoa' }],
  courses: [{ value: '', label: 'Tất cả khóa' }], classes: [{ label: 'Lớp A', value: 'a' }], availableCoverage: [coverage],
};
const openConfig = () => fireEvent.click(screen.getByRole('button', { name: 'Mở cấu hình nâng cao' }));
async function weekLabels(name: string) {
  fireEvent.click(screen.getByRole('combobox', { name }));
  await waitFor(() => expect(screen.getAllByRole('listbox', { name: 'Options', hidden: true })
    .some((element) => !element.className.includes('opacity-0'))).toBe(true));
  const listbox = screen.getAllByRole('listbox', { name: 'Options', hidden: true })
    .find((element) => !element.className.includes('opacity-0'));
  if (!listbox) throw new Error('No open select listbox');
  return within(listbox).getAllByRole('option', { hidden: true }).map((item) => item.textContent?.trim());
}

async function visibleWeekLabels() {
  await waitFor(() => expect(screen.getAllByRole('listbox', { name: 'Options', hidden: true })
    .some((element) => !element.className.includes('opacity-0'))).toBe(true));
  const listbox = screen.getAllByRole('listbox', { name: 'Options', hidden: true })
    .find((element) => !element.className.includes('opacity-0'));
  if (!listbox) throw new Error('No open select listbox');
  return within(listbox).getAllByRole('option', { hidden: true }).map((item) => item.textContent?.trim());
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(timetableApi.getOptions).mockResolvedValue(options);
  vi.mocked(timetableApi.getTimetable).mockResolvedValue({ filters: coverage, lessons: [], periods: [], isEmpty: true });
  vi.mocked(timetableApi.getTimetables).mockResolvedValue({ results: [{ filters: coverage, lessons: [], periods: [], isEmpty: true }], missing: [] });
});

async function choose(label: string, value: string) {
  const trigger = screen.getByRole('combobox', { name: label });
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getAllByRole('listbox', { name: 'Options', hidden: true })
    .some((element) => !element.className.includes('opacity-0'))).toBe(true));
  const listbox = screen.getAllByRole('listbox', { name: 'Options', hidden: true })
    .find((element) => !element.className.includes('opacity-0'));
  if (!listbox) throw new Error('No open select listbox');
  const options = within(listbox).getAllByRole('option', { hidden: true });
  fireEvent.click(options[value ? options.length - 1 : 0]);
  await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());
}

function chooseDesktopClasses(...labels: string[]) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Lớp' }));
  const popover = document.querySelector('[data-desktop-class-popover="true"]') as HTMLElement;
  labels.forEach((label) => fireEvent.click(within(popover).getByRole('option', { name: label })));
  fireEvent.click(within(popover).getByRole('button', { name: 'Xác nhận' }));
}

describe('TimetableLookup', () => {
  it('sorts both week selectors by displayed week number without mutating API options', async () => {
    const unorderedWeeks = [
      { label: 'Tuần 3', value: 'opaque-3' },
      { label: '4', value: 'opaque-4' },
      { label: 'Tuần 1', value: 'opaque-1' },
      { label: 'Tuần 2', value: 'opaque-2' },
      { label: 'Tuần 5', value: 'opaque-5' },
      { label: 'Tuần 10', value: 'opaque-10' },
      { label: 'Ngày 2026-09-15', value: 'opaque-date' },
      { label: 'Tất cả', value: '' },
    ];
    const unorderedOptions = { ...options, weeks: unorderedWeeks };
    vi.mocked(timetableApi.getOptions).mockResolvedValue(unorderedOptions);
    render(<TimetableLookup />);
    await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());

    expect(await weekLabels('Tuần')).toEqual(['Tất cả', 'Tuần 1 · Chưa có khoảng thời gian', 'Tuần 2 · Chưa có khoảng thời gian', 'Tuần 3 · Chưa có khoảng thời gian', '4 · Chưa có khoảng thời gian', 'Tuần 5 · Chưa có khoảng thời gian', 'Tuần 10 · Chưa có khoảng thời gian', 'Ngày 2026-09-15 · Chưa có khoảng thời gian']);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Mở bộ lọc tra cứu thời khóa biểu' }));
    const mobileDialog = screen.getByRole('dialog', { name: 'Bộ lọc tra cứu thời khóa biểu' });
    fireEvent.click(within(mobileDialog).getByRole('combobox', { name: 'Tuần' }));
    expect(await visibleWeekLabels()).toEqual(['Tất cả', 'Tuần 1 · Chưa có khoảng thời gian', 'Tuần 2 · Chưa có khoảng thời gian', 'Tuần 3 · Chưa có khoảng thời gian', '4 · Chưa có khoảng thời gian', 'Tuần 5 · Chưa có khoảng thời gian', 'Tuần 10 · Chưa có khoảng thời gian', 'Ngày 2026-09-15 · Chưa có khoảng thời gian']);
    expect(unorderedOptions.weeks).toEqual(unorderedWeeks);
  });

  it('applies default year and semester, reloads choices on week changes, and searches synchronized coverage', async () => {
    render(<TimetableLookup />);
    await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Mở cấu hình nâng cao' })).toBeInTheDocument();

    await choose('Tuần', 'w');
    expect(timetableApi.getOptions).toHaveBeenCalledWith(expect.objectContaining({ week: 'w' }));
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toBeDisabled();

    const count = vi.mocked(timetableApi.getOptions).mock.calls.length;
    chooseDesktopClasses('Lớp A');
    expect(timetableApi.getOptions).toHaveBeenCalledTimes(count);
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    expect(await screen.findByText('Không có lịch cho bộ lọc đã chọn.')).toBeInTheDocument();
    expect(timetableApi.getTimetables).toHaveBeenCalledWith([coverage]);

    vi.mocked(timetableApi.getTimetables).mockRejectedValueOnce(new Error('Nguồn phản hồi quá lâu.'));
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nguồn phản hồi quá lâu.');
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toBeEnabled();
  });

  it('renders the desktop class chevron with the correct open state', async () => {
    render(<TimetableLookup />);
    await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());
    await choose('Tuần', 'w');

    const trigger = screen.getByRole('combobox', { name: 'Lớp' });
    const chevron = trigger.querySelector('svg');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(chevron).toHaveAttribute('width', '16');
    expect(chevron).toHaveAttribute('height', '16');
    expect(chevron).toHaveClass('text-[#64748B]', 'transition-transform', 'duration-200', 'motion-reduce:transition-none');
    expect(chevron).not.toHaveClass('rotate-180');
    expect(trigger).not.toHaveTextContent('⌄');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.querySelector('svg')).toHaveClass('rotate-180');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger.querySelector('svg')).not.toHaveClass('rotate-180');

    const weekInput = screen.getByRole('combobox', { name: 'Tuần' });
    const weekTrigger = weekInput.parentElement;
    const weekChevron = weekTrigger?.querySelector('svg');
    expect(weekTrigger).toHaveAttribute('data-state', 'closed');
    expect(weekChevron).toHaveClass('h-4', 'w-4', 'text-[#64748B]');
    expect(weekTrigger).toHaveClass(
      '[&>svg]:ml-0',
      '[&>svg]:opacity-100',
      '[&>svg]:text-[#64748B]',
      '[&>svg]:transition-transform',
      '[&>svg]:duration-200',
      '[&>svg]:motion-reduce:transition-none',
      '[&[data-state=open]>svg]:rotate-180',
    );
    expect(weekChevron).not.toHaveClass('rotate-180');

    fireEvent.click(weekInput);
    expect(weekTrigger).toHaveAttribute('data-state', 'open');

    fireEvent.keyDown(weekInput, { key: 'Escape' });
    expect(weekTrigger).toHaveAttribute('data-state', 'closed');
    expect(weekChevron).not.toHaveClass('rotate-180');
  });

  it('bounds the desktop class popover and keeps the list as its only scroll owner', async () => {
    render(<TimetableLookup />);
    await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());
    await choose('Tuần', 'w');

    fireEvent.click(screen.getByRole('combobox', { name: 'Lớp' }));
    const popover = document.querySelector('[data-desktop-class-popover="true"]') as HTMLElement;
    const listbox = within(popover).getByRole('listbox', { name: 'Danh sách lớp học' });
    const footer = within(popover).getByRole('button', { name: 'Hủy' }).parentElement;

    expect(popover).toHaveClass('h-[min(560px,var(--radix-popover-content-available-height))]', 'min-h-0', 'overflow-hidden');
    expect(popover).not.toHaveClass('max-h-[min(560px,calc(100vh-7rem))]');
    expect(listbox).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(footer).toHaveClass('shrink-0');
  });

  it('derives cross-faculty classes from the selected week and preserves the chosen source context', async () => {
    const multiContext = {
      ...options,
      weeks: [{ label: 'Tuần 3', value: 'w', startDate: '2026-09-14', endDate: '2026-09-20' }],
      availableCoverage: [
        { year: 'y', semester: 's', week: 'w', faculty: 'f1', course: 'c1', className: 'a' },
        { year: 'y', semester: 's', week: 'w', faculty: 'f2', course: 'c2', className: 'a' },
      ],
      faculties: [{ value: 'f1', label: 'Khoa 1' }, { value: 'f2', label: 'Khoa 2' }],
      courses: [{ value: 'c1', label: 'Khóa 1' }, { value: 'c2', label: 'Khóa 2' }],
    };
    vi.mocked(timetableApi.getOptions).mockResolvedValue(multiContext);
    render(<TimetableLookup />);
    await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());
    await choose('Tuần', 'w');
    fireEvent.click(screen.getByRole('combobox', { name: 'Lớp' }));
    const classPopover = document.querySelector('[data-desktop-class-popover="true"]') as HTMLElement;
    const listbox = within(classPopover).getByRole('listbox', { name: 'Danh sách lớp học' });
    expect(within(listbox).getAllByRole('option')).toHaveLength(2);
    expect(within(listbox).getByRole('option', { name: 'Lớp A · f2 · c2' })).toBeInTheDocument();
    fireEvent.click(within(listbox).getByRole('option', { name: 'Lớp A · f2 · c2' }));
    fireEvent.click(within(classPopover).getByRole('button', { name: 'Xác nhận' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    await waitFor(() => expect(timetableApi.getTimetables).toHaveBeenCalledWith([{ year: 'y', semester: 's', week: 'w', faculty: 'f2', course: 'c2', className: 'a' }]));
  });

  it('allows changing year and semester via config popover and resets dependent selections', async () => {
    render(<TimetableLookup />);
    await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());

    await choose('Tuần', 'w');
    openConfig();
    await screen.findByRole('option', { name: '2026' });
    await choose('Niên học', '');

    expect(screen.getByRole('combobox', { name: 'Lớp' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toBeDisabled();
  });

  it('reloads after synchronization and allows retrying a missing initial catalog', async () => {
    vi.mocked(timetableApi.getOptions).mockRejectedValueOnce(new Error('Chưa đồng bộ'));
    const { rerender } = render(<TimetableLookup refreshKey={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa đồng bộ');

    fireEvent.click(screen.getByRole('button', { name: 'Làm mới danh mục' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    const count = vi.mocked(timetableApi.getOptions).mock.calls.length;

    rerender(<TimetableLookup refreshKey={1} />);
    await waitFor(() => expect(timetableApi.getOptions).toHaveBeenCalledTimes(count + 2));
  });

  it('does not search an unsynchronized selection', async () => {
    const uncached = { ...options, availableCoverage: [] };
    vi.mocked(timetableApi.getOptions).mockResolvedValue(uncached);
    render(<TimetableLookup />);
    await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());

    await choose('Tuần', 'w');
    expect(screen.getByRole('combobox', { name: 'Lớp' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toBeDisabled();
    expect(timetableApi.getTimetables).not.toHaveBeenCalled();
  });

  it('handles mobile choice popover selection, search filter, and confirmation', async () => {
    render(<TimetableLookup />);
    await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Mở bộ lọc tra cứu thời khóa biểu' }));
    const mobileDialog = screen.getByRole('dialog', { name: 'Bộ lọc tra cứu thời khóa biểu' });

    // Open week choice popover
    fireEvent.click(within(mobileDialog).getByRole('combobox', { name: 'Tuần' }));
    const popover = document.querySelector('[data-mobile-choice-popover="true"]');
    expect(popover).toBeInTheDocument();

    // Verify search input, options list, and buttons exist
    const popoverEl = popover as HTMLElement;
    const searchInput = within(popoverEl).getByPlaceholderText('Tìm tuần học...');
    expect(searchInput).toBeInTheDocument();
    expect(within(popoverEl).getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
    expect(within(popoverEl).getByRole('button', { name: 'Xác nhận' })).toBeInTheDocument();

    // Filter weeks
    fireEvent.change(searchInput, { target: { value: 'Tuần 3' } });
    const listbox = within(popoverEl).getByRole('listbox', { name: 'Options' });
    const optionsFound = within(listbox).getAllByRole('option');
    expect(optionsFound).toHaveLength(1);
    expect(optionsFound[0]).toHaveTextContent('Tuần 3');

    // Select Tuần 3 and click Xác nhận
    fireEvent.click(optionsFound[0]);
    fireEvent.click(within(popoverEl).getByRole('button', { name: 'Xác nhận' }));

    // Popover should close
    expect(document.querySelector('[data-mobile-choice-popover="true"]')).not.toBeInTheDocument();
  });

  it('cancels mobile week and class drafts without dismissing the lookup dialog', async () => {
    vi.mocked(timetableApi.getOptions).mockResolvedValue({
      ...options,
      weeks: [...options.weeks, { label: 'Tuần 4', value: 'w4' }],
      classes: [...options.classes, { label: 'Lớp B', value: 'b' }],
      availableCoverage: [...(options.availableCoverage || []), { ...coverage, className: 'b' }],
    });
    render(<TimetableLookup />);
    await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Mở bộ lọc tra cứu thời khóa biểu' }));
    const mobileDialog = screen.getByRole('dialog', { name: 'Bộ lọc tra cứu thời khóa biểu' });

    fireEvent.click(within(mobileDialog).getByRole('combobox', { name: 'Tuần' }));
    const initialWeekPopover = document.querySelector('[data-mobile-choice-popover="true"]') as HTMLElement;
    fireEvent.click(within(initialWeekPopover).getByRole('option', { name: /^Tuần 3/ }));
    fireEvent.click(within(initialWeekPopover).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(screen.queryByText('Đang tải bộ lọc...')).not.toBeInTheDocument());

    const cancelChoice = async (label: string, optionLabel: string | RegExp, selectedLabel: string) => {
      const trigger = within(mobileDialog).getByRole('combobox', { name: label });
      fireEvent.click(trigger);
      const popover = document.querySelector('[data-mobile-choice-popover="true"]') as HTMLElement;
      expect(popover).toBeInTheDocument();
      fireEvent.click(within(popover).getByRole('option', { name: optionLabel }));
      fireEvent.click(within(popover).getByRole('button', { name: 'Hủy' }));
      await waitFor(() => expect(document.querySelector('[data-mobile-choice-popover="true"]')).not.toBeInTheDocument());
      expect(screen.getByRole('dialog', { name: 'Bộ lọc tra cứu thời khóa biểu' })).toBeInTheDocument();
      expect(trigger).toHaveTextContent(selectedLabel);
      expect(document.activeElement).toBe(trigger);
    };

    await cancelChoice('Tuần', /^Tuần 4/, 'Tuần 3');
    await cancelChoice('Lớp', 'Lớp B', 'Chọn lớp');

    // X closes only the child and restores the committed draft.
    const classTrigger = within(mobileDialog).getByRole('combobox', { name: 'Lớp' });
    fireEvent.click(classTrigger);
    const closePopover = document.querySelector('[data-mobile-choice-popover="true"]') as HTMLElement;
    fireEvent.click(within(closePopover).getByRole('option', { name: 'Lớp B' }));
    fireEvent.click(within(closePopover).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(document.querySelector('[data-mobile-choice-popover="true"]')).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Bộ lọc tra cứu thời khóa biểu' })).toBeInTheDocument();
    expect(classTrigger).toHaveTextContent('Chọn lớp');
    expect(document.activeElement).toBe(classTrigger);

    // Reopening resets the query and starts from the committed value.
    fireEvent.click(classTrigger);
    const reopenedPopover = document.querySelector('[data-mobile-choice-popover="true"]') as HTMLElement;
    expect(within(reopenedPopover).getByPlaceholderText('Tìm mã lớp học...')).toHaveValue('');
    fireEvent.click(within(reopenedPopover).getByRole('option', { name: 'Lớp B' }));
    fireEvent.click(within(reopenedPopover).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(document.querySelector('[data-mobile-choice-popover="true"]')).not.toBeInTheDocument());
    expect(classTrigger).toHaveTextContent('1 lớp đã chọn');
    expect(screen.getByRole('dialog', { name: 'Bộ lọc tra cứu thời khóa biểu' })).toBeInTheDocument();

    fireEvent.click(within(mobileDialog).getByRole('combobox', { name: 'Lớp' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.querySelector('[data-mobile-choice-popover="true"]')).not.toBeInTheDocument());
    expect(screen.getByRole('dialog', { name: 'Bộ lọc tra cứu thời khóa biểu' })).toBeInTheDocument();
  });
});
