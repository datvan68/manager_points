import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResponsiveDataView from './ResponsiveDataView';

describe('ResponsiveDataView', () => {
  const mockData = [
    { id: '1', name: 'Student 1' },
    { id: '2', name: 'Student 2' }
  ];

  const mockColumns = [
    { key: 'name', header: 'Name', priority: 'primary' as const }
  ];

  it('renders mobile and desktop footers when provided (Infinite Scroll)', () => {
    render(
      <ResponsiveDataView
        data={mockData}
        columns={mockColumns}
        keyExtractor={(row) => row.id}
        mobileFooter={<div data-testid="mobile-footer">Mobile Footer</div>}
        desktopFooter={<div data-testid="desktop-footer">Desktop Footer</div>}
      />
    );

    expect(screen.getByTestId('mobile-footer')).toBeTruthy();
    expect(screen.getByTestId('desktop-footer')).toBeTruthy();
  });

  it('attaches scroll refs to the respective container elements', () => {
    const mobileRef = React.createRef<HTMLDivElement>();
    const desktopRef = React.createRef<HTMLDivElement>();

    render(
      <ResponsiveDataView
        data={mockData}
        columns={mockColumns}
        keyExtractor={(row) => row.id}
        mobileScrollRef={mobileRef}
        desktopScrollRef={desktopRef}
      />
    );

    expect(mobileRef.current).toBeTruthy();
    expect(desktopRef.current).toBeTruthy();
    
    // Verify mobile container has correct class for scrolling
    expect(mobileRef.current?.className).toContain('overflow-y-auto');
    // Verify desktop container has correct class for scrolling
    expect(desktopRef.current?.className).toContain('overflow-auto');
  });

  it('uses an accessible toggle for opt-in mobile selection while retaining desktop checkboxes', () => {
    const onSelectRow = vi.fn();
    const { container } = render(
      <ResponsiveDataView
        data={mockData}
        columns={mockColumns}
        keyExtractor={(row) => row.id}
        selection={{ selectedKeys: [], onSelectRow, mobileControl: 'toggle', getMobileSelectionLabel: (row, checked) => `${checked ? 'Bỏ chọn' : 'Chọn'} ${row.name}` }}
      />
    );

    const toggle = screen.getByRole('button', { name: 'Chọn Student 1' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(onSelectRow).toHaveBeenCalledWith('1', true);
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0);
  });

  it('keeps the native checkbox as the default mobile selection control', () => {
    render(
      <ResponsiveDataView
        data={mockData}
        columns={mockColumns}
        keyExtractor={(row) => row.id}
        selection={{ selectedKeys: [], onSelectRow: vi.fn() }}
      />
    );

    expect(screen.queryByRole('button', { name: /Chọn Student 1/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });
});
