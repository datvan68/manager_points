import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TimetableGrid from './TimetableGrid';
it.each([['Sáng', 1], ['Chiều', 7], ['Tối', 13]] as const)('renders six periods for %s and bounds merged cells', (sessionLabel, start) => {
  const { container } = render(<TimetableGrid result={{ filters: { year: 'y', semester: 's', week: 'w' }, periods: Array.from({ length: 18 }, (_, index) => String(index + 1)), lessons: [{ sessionLabel, day: 1, startPeriod: start, endPeriod: start + 7, subject: 'Môn học' }], isEmpty: false }} />);
  expect(Array.from(container.querySelectorAll('tbody tr')).map((row) => Array.from(row.querySelectorAll('th')).find((cell) => cell.textContent?.startsWith('Tiết '))?.textContent)).toEqual(Array.from({ length: 6 }, (_, index) => `Tiết ${start + index}`));
  expect(screen.getByText('Môn học').closest('td')).toHaveAttribute('rowspan', '6');
  expect(screen.getByText(sessionLabel)).toHaveAttribute('rowspan', '6');
});
describe('TimetableGrid', () => { it('keeps merged multi-period lesson and all week columns', () => { render(<TimetableGrid result={{ filters: { year: 'y', semester: 's', week: 'w' }, periods: ['13', '14'], lessons: [{ day: 1, startPeriod: 13, endPeriod: 14, subject: 'Toán', teacher: 'Cô A' }], isEmpty: false }} />); expect(screen.getByText('Toán')).toBeInTheDocument(); expect(screen.getByText('Chủ nhật')).toBeInTheDocument(); }); });
