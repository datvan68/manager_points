import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TimetableLookup from './TimetableLookup';
import { timetableApi, type TimetableOptions } from '@/api/timetable-api';

vi.mock('@/api/timetable-api', () => ({ timetableApi: { getOptions: vi.fn(), getTimetable: vi.fn() } }));
const coverage = { year: 'y', semester: 's', week: 'w', faculty: '', course: '', className: 'a' };
const options: TimetableOptions = {
  years: [{ label: '2026', value: 'y' }], semesters: [{ label: 'Học kỳ 1', value: 's' }],
  weeks: [{ label: 'Tuần 3', value: 'w' }], faculties: [{ value: '', label: 'Tất cả khoa' }],
  courses: [{ value: '', label: 'Tất cả khóa' }], classes: [{ label: 'Lớp A', value: 'a' }], availableCoverage: [coverage],
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(timetableApi.getOptions).mockResolvedValue(options);
  vi.mocked(timetableApi.getTimetable).mockResolvedValue({ filters: coverage, lessons: [], periods: [], isEmpty: true });
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

describe('TimetableLookup', () => {
  it('reloads dependent choices on week changes and only searches exact synchronized coverage', async () => {
    render(<TimetableLookup />);
    await screen.findByRole('option', { name: '2026' });
    await choose('Niên học', 'y'); await choose('Học kỳ', 's'); await choose('Tuần', 'w');
    expect(timetableApi.getOptions).toHaveBeenCalledWith(expect.objectContaining({ week: 'w' }));
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toBeDisabled();
    const count = vi.mocked(timetableApi.getOptions).mock.calls.length;
    await choose('Lớp', 'a');
    expect(timetableApi.getOptions).toHaveBeenCalledTimes(count);
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    expect(await screen.findByText('Không có lịch cho bộ lọc đã chọn.')).toBeInTheDocument();
    expect(timetableApi.getTimetable).toHaveBeenCalledWith(coverage);
    vi.mocked(timetableApi.getTimetable).mockRejectedValueOnce(new Error('Nguồn phản hồi quá lâu.'));
    fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nguồn phản hồi quá lâu.');
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toBeEnabled();
  });

  it('clears dependent class selection when a parent changes', async () => {
    render(<TimetableLookup />);
    await screen.findByRole('option', { name: '2026' });
    await choose('Niên học', 'y'); await choose('Học kỳ', 's'); await choose('Tuần', 'w'); await choose('Lớp', 'a');
    await choose('Niên học', '');
    expect(screen.getByRole('combobox', { name: 'Lớp' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Tìm kiếm' })).toBeDisabled();
  });

  it('reloads after synchronization and allows retrying a missing initial catalog', async () => {
    vi.mocked(timetableApi.getOptions).mockRejectedValueOnce(new Error('Chưa đồng bộ'));
    const { rerender } = render(<TimetableLookup refreshKey={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa đồng bộ');
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới danh mục' }));
    await screen.findByRole('option', { name: '2026' });
    const count = vi.mocked(timetableApi.getOptions).mock.calls.length;
    rerender(<TimetableLookup refreshKey={1} />);
    await waitFor(() => expect(timetableApi.getOptions).toHaveBeenCalledTimes(count + 1));
  });
});
