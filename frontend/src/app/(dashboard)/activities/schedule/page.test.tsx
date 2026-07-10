import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ActivitiesSchedulePage from './page';

let mockSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'user1',
      studentId: 'student1',
      role: { role_code: 'TEACHER' },
    },
    isLoading: false,
  }),
  isAdminUser: () => true,
}));

vi.mock('@/components/activities/ActivityScheduleWorkspace', () => ({
  default: vi.fn(({ initialActivityId, openCreateOnLoad }: any) => (
    <div data-testid="mock-workspace">
      Workspace for {initialActivityId} (openCreate: {openCreateOnLoad ? 'true' : 'false'})
    </div>
  )),
}));

describe('ActivitiesSchedulePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('');
  });

  it('should render schedule page and pass props correctly', () => {
    mockSearchParams = new URLSearchParams('activityId=act123&openCreate=1');
    render(<ActivitiesSchedulePage />);
    
    expect(screen.getByText('Workspace for act123 (openCreate: true)')).toBeInTheDocument();
  });

  it('should pass openCreate as false when parameter is missing', () => {
    mockSearchParams = new URLSearchParams('activityId=act456');
    render(<ActivitiesSchedulePage />);
    expect(screen.getByText('Workspace for act456 (openCreate: false)')).toBeInTheDocument();
  });
});
