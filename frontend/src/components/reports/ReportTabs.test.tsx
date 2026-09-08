import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReportTabs from './ReportTabs';

describe('ReportTabs', () => {
  it('renders the current five tabs in order and hides removed tabs', () => {
    render(<ReportTabs activeTab="overview" onChange={vi.fn()} />);

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Tổng quan',
      'Sinh viên',
      'Điểm rèn luyện',
      'Ghi nhận sv',
      'Ghi nhận lớp'
    ]);
    expect(screen.queryByText('Ghi nhận rèn luyện')).not.toBeInTheDocument();
    expect(screen.queryByText('Chuyên cần')).not.toBeInTheDocument();
    expect(screen.queryByText('Nhiệm vụ')).not.toBeInTheDocument();
    expect(screen.queryByText('Hệ thống & Logs')).not.toBeInTheDocument();
  });

  it('keeps record and attendance callbacks mapped to their existing ids', () => {
    const onChange = vi.fn();
    render(<ReportTabs activeTab="overview" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận sv' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận lớp' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 'record');
    expect(onChange).toHaveBeenNthCalledWith(2, 'attendance');
  });
});
