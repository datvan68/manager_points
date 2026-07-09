import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClubLayout from './layout';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/club'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

describe('ClubLayout Navigation', () => {
  it('should render allowed navigation entries and omit the removed ones', () => {
    render(
      <ClubLayout>
        <div data-testid="child-content">Children Content</div>
      </ClubLayout>
    );

    // Verify children content is rendered
    expect(screen.getByTestId('child-content')).toBeDefined();

    // Verify existing navigation links
    expect(screen.getByText('Tổng quan')).toBeDefined();
    expect(screen.getByText('Danh sách CLB')).toBeDefined();
    expect(screen.getByText('Lịch sinh hoạt')).toBeDefined();
    expect(screen.getByText('Cấu hình điểm')).toBeDefined();

    // Verify removed navigation links are not in the document
    expect(screen.queryByText('CLB của tôi')).toBeNull();
    expect(screen.queryByText('Điểm danh')).toBeNull();
    expect(screen.queryByText('Duyệt điểm danh')).toBeNull();
  });
});
