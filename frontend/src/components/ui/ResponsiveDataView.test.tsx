import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
