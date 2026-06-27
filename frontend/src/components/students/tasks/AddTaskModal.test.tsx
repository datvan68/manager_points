import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddTaskModal from './AddTaskModal';
import { studentTaskApi } from '@/api/task-api';

// Mock dependencies
vi.mock('@/api/task-api', () => ({
  studentTaskApi: {
    getLinkedDeadline: vi.fn(),
    getTeachers: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('@/api/class-api', () => ({
  classApi: {
    getClasses: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('@/api/student-api', () => ({
  studentApi: {
    getStudents: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}));

// Mock inner components to avoid complex DOM for Radix
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div data-testid="mock-select" onClick={() => onValueChange('/grading/score')}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <div>Select Value</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/calendar/CustomCalendar', () => ({
  CustomCalendar: () => <div>Calendar</div>
}));

describe('AddTaskModal auto fill deadline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should auto fill deadline when selecting a linked page that has a deadline', async () => {
    const mockDeadline = new Date('2026-06-27T00:00:00.000Z').toISOString();
    (studentTaskApi.getLinkedDeadline as any).mockResolvedValue({ deadline: mockDeadline });

    render(
      <AddTaskModal 
        isOpen={true} 
        onClose={vi.fn()} 
        onSave={vi.fn()} 
      />
    );

    const selectElements = screen.getAllByTestId('mock-select');
    
    // The second select is Linked Page (first is Task Type, second is Priority, third is Status, fourth is Target Scope, fifth is Linked Page...)
    // Wait, let's just trigger the one we know handles the page selection:
    const linkedPageSelect = selectElements.find(el => el.innerHTML.includes('/grading/score')) || selectElements[4]; 
    if(linkedPageSelect) {
        linkedPageSelect.click();
    }

    await waitFor(() => {
      expect(studentTaskApi.getLinkedDeadline).toHaveBeenCalledWith('/grading/score');
    });
  });
});
