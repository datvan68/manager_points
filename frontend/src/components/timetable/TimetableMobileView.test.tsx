import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TimetableMobileView from './TimetableMobileView';

const dummyResult = {
  filters: { year: 'y', semester: 's', week: 'w' },
  startDate: '2026-09-14',
  endDate: '2026-09-20',
  periods: ['1', '2', '3', '4'],
  lessons: [
    {
      day: 1, // Thứ 2
      startPeriod: 1,
      endPeriod: 4,
      subject: 'CD-TTCAD-CAM',
      teacher: 'ThS. Nguyễn Nhơn Hải',
      room: 'B0.7',
      durationLabel: '4h',
      sourceTime: '07:00-10:15',
      sessionLabel: 'Sáng',
    },
    {
      day: 2, // Thứ 3
      startPeriod: 7,
      endPeriod: 9,
      subject: 'CD-DACNCTM',
      teacher: 'ThS. Lê Quang Trung',
      onlineUrl: 'https://meet.google.com/test',
      sessionLabel: 'Chiều',
    },
  ],
  isEmpty: false,
};

describe('TimetableMobileView', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-14T08:00:00Z'));
  });
  it('renders day strip and defaults to initial day with lessons', () => {
    render(<TimetableMobileView result={dummyResult} />);
    expect(screen.getByTestId('timetable-mobile-view')).toBeInTheDocument();
    expect(screen.getByText('CD-TTCAD-CAM')).toBeInTheDocument();
    expect(screen.getByText('GV: ThS. Nguyễn Nhơn Hải')).toBeInTheDocument();
    expect(screen.getByText('Phòng: B0.7')).toBeInTheDocument();
  });

  it('switches day on tapping another day in the strip', () => {
    render(<TimetableMobileView result={dummyResult} />);
    const tuesdayBtn = screen.getByRole('button', { name: /T3/i });
    fireEvent.click(tuesdayBtn);

    expect(screen.getByText('CD-DACNCTM')).toBeInTheDocument();
    expect(screen.getByText('GV: ThS. Lê Quang Trung')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Họp trực tuyến/i })).toHaveAttribute(
      'href',
      'https://meet.google.com/test'
    );
  });

  it('shows empty friendly message on day with no classes', () => {
    render(<TimetableMobileView result={dummyResult} />);
    const sundayBtn = screen.getByRole('button', { name: /CN/i });
    fireEvent.click(sundayBtn);

    expect(screen.getByText('Không có lịch học trong ngày')).toBeInTheDocument();
  });
});
