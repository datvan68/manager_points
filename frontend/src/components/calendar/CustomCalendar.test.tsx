import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CustomCalendar } from './CustomCalendar';

describe('CustomCalendar component', () => {
  it('renders single date mode with quick presets', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onRangeSelect = vi.fn();

    render(
      <CustomCalendar
        mode="single"
        startDate={new Date(2026, 8, 18)} // 18 Sep 2026
        endDate={null}
        onRangeSelect={onRangeSelect}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('Chọn nhanh:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hôm nay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hôm qua' })).toBeInTheDocument();
    expect(screen.getByText('18/09/2026')).toBeInTheDocument();
  });

  it('selects a single day and updates confirmation payload without creating a range', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onRangeSelect = vi.fn();
    const onRangeConfirm = vi.fn();

    render(
      <CustomCalendar
        mode="single"
        startDate={new Date(2026, 8, 18)}
        endDate={null}
        onRangeSelect={onRangeSelect}
        onRangeConfirm={onRangeConfirm}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    // Click on day 25
    const day25Button = screen.getByRole('button', { name: '25' });
    fireEvent.click(day25Button);

    // Footer should display 25/09/2026
    expect(screen.getByText('25/09/2026')).toBeInTheDocument();

    // Click confirm button
    const confirmButton = screen.getByRole('button', { name: 'Xác nhận' });
    fireEvent.click(confirmButton);

    expect(onRangeConfirm).toHaveBeenCalledWith(
      expect.any(Date),
      null
    );
    expect(onConfirm).toHaveBeenCalled();
  });

  it('sets date to today when clicking Hôm nay preset', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const onRangeSelect = vi.fn();

    render(
      <CustomCalendar
        mode="single"
        startDate={new Date(2025, 0, 1)}
        endDate={null}
        onRangeSelect={onRangeSelect}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Hôm nay' }));

    const today = new Date();
    const expectedDay = today.getDate().toString().padStart(2, '0');
    const expectedMonth = (today.getMonth() + 1).toString().padStart(2, '0');
    const expectedYear = today.getFullYear();
    const expectedDateStr = `${expectedDay}/${expectedMonth}/${expectedYear}`;

    expect(screen.getByText(expectedDateStr)).toBeInTheDocument();
  });

  it('renders correctly in mobile view', () => {
    const { container } = render(
      <CustomCalendar
        mode="single"
        isMobileView={true}
        startDate={new Date(2026, 8, 18)}
        endDate={null}
        onRangeSelect={vi.fn()}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    // In mobile view, container should have w-full and bg-transparent
    expect(container.firstChild).toHaveClass('w-full', 'bg-transparent');
  });
});
