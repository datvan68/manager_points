import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TabNavigation from './TabNavigation';

describe('TabNavigation responsive distribution', () => {
  const tabs = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'roster', label: 'Danh sách' },
    { id: 'rooms', label: 'Phòng' },
    { id: 'invoices', label: 'Hóa đơn' },
    { id: 'pdf', label: 'PDF' },
  ];

  it('uses an even, minimum-width inner track when responsive scrolling is enabled', () => {
    const { container } = render(<TabNavigation tabs={tabs} activeTab="overview" onTabChange={vi.fn()} responsiveScrollable />);
    const viewport = container.firstElementChild;
    const track = viewport?.firstElementChild;

    expect(viewport).toHaveClass('overflow-x-auto');
    expect(track).toHaveClass('min-w-full');
    expect(track).toHaveClass('w-max');
    expect(screen.getByRole('button', { name: 'Tổng quan' })).toHaveClass('min-w-[104px]');
    expect(screen.getByRole('button', { name: 'Tổng quan' }).querySelector('[class*="bg-[#1A73E8]"]')).toBeTruthy();
  });

  it('keeps tab navigation callbacks intact', () => {
    const onTabChange = vi.fn();
    render(<TabNavigation tabs={tabs} activeTab="overview" onTabChange={onTabChange} responsiveScrollable />);

    fireEvent.click(screen.getByRole('button', { name: 'Danh sách' }));
    expect(onTabChange).toHaveBeenCalledWith('roster');
  });
});
