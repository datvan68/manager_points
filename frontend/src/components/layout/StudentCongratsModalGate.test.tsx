import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next/font/google before importing the component that uses it
vi.mock('next/font/google', () => ({
  Dancing_Script: () => ({
    className: 'mock-dancing-script',
    style: {},
  }),
}));

// Dynamic React hooks mocking to support both raw hook/logic testing and full DOM rendering
let mockUseStateFn: any = null;
let mockUseEffectFn: any = null;

vi.mock('react', async (importOriginal) => {
  const original = await importOriginal<typeof import('react')>();
  return {
    ...original,
    useState: (initialValue: any) => {
      if (mockUseStateFn) return mockUseStateFn(initialValue);
      return original.useState(initialValue);
    },
    useEffect: (effect: any, deps: any) => {
      if (mockUseEffectFn) return mockUseEffectFn(effect, deps);
      return original.useEffect(effect, deps);
    },
  };
});

vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/utils/role.util', () => ({
  isStudentRole: vi.fn(),
}));

vi.mock('@/api/summaries-point-api', () => ({
  summariesPointApi: {
    getMyLatestSummary: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock framer-motion to simplify rendering and avoid animation timing issues in JSDOM
vi.mock('framer-motion', () => {
  const React = require('react');
  const mockMotion = new Proxy({}, {
    get: (target, propertyName) => {
      if (typeof propertyName !== 'string') return undefined;
      return ({ children, className, style, onClick, ...props }: any) => {
        // Filter out motion-specific properties that standard React/DOM elements do not support
        const { initial, animate, transition, exit, repeat, repeatDelay, yOffset, delay, duration, ...domProps } = props;
        return React.createElement(propertyName, { className, style, onClick, ...domProps }, children);
      };
    }
  });

  return {
    motion: mockMotion,
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

import { getCongratsStorageKey } from './congrats-storage';
import StudentCongratsModalGate from './StudentCongratsModalGate';
import { useAuth } from '@/providers/auth-provider';
import { isStudentRole } from '@/utils/role.util';
import { summariesPointApi } from '@/api/summaries-point-api';
import { useRouter } from 'next/navigation';

describe('StudentCongratsModalGate storage helpers', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    const mockSessionStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] || null,
    };
    
    vi.stubGlobal('sessionStorage', mockSessionStorage);
  });

  it('should generate correct format for congrats storage key', () => {
    const userId = 'student_A';
    const summaryId = 'summary_A';
    const lockedAt = '2026-06-13';
    
    // Case 1: lockedAt is provided
    const keyWithLockedAt = getCongratsStorageKey(userId, summaryId, lockedAt);
    expect(keyWithLockedAt).toBe(`congrats_shown_${userId}_${summaryId}_${lockedAt}`);
    
    // Case 2: lockedAt is undefined/empty
    const keyWithoutLockedAt = getCongratsStorageKey(userId, summaryId);
    expect(keyWithoutLockedAt).toBe(`congrats_shown_${userId}_${summaryId}_locked`);
  });

  it('should simulate Student A -> Student B login flow correctly', () => {
    // Mock user A (id: 'student_A') and summary A (_id: 'summary_A', locked_at: '2026-06-13')
    const userA = { id: 'student_A' };
    const summaryA = { _id: 'summary_A', locked_at: '2026-06-13' };
    
    // Generate storage key A, write to mock sessionStorage
    const keyA = getCongratsStorageKey(userA.id, summaryA._id, summaryA.locked_at);
    sessionStorage.setItem(keyA, 'true');
    
    // Mock user B (id: 'student_B') and summary B (_id: 'summary_B', locked_at: '2026-06-13')
    const userB = { id: 'student_B' };
    const summaryB = { _id: 'summary_B', locked_at: '2026-06-13' };
    
    // Generate storage key B
    const keyB = getCongratsStorageKey(userB.id, summaryB._id, summaryB.locked_at);
    
    // Assert that sessionStorage does NOT have key B (meaning Student B modal is not suppressed)
    expect(sessionStorage.getItem(keyB)).toBeNull();
    
    // Assert that sessionStorage still has key A
    expect(sessionStorage.getItem(keyA)).toBe('true');
  });
});

describe('StudentCongratsModalGate Component Logic Regression', () => {
  let store: Record<string, string>;
  let stateValue: any = null;
  let mockSetState: any;
  let effectCallback: (() => void | (() => void)) | null = null;

  beforeEach(() => {
    store = {};
    const mockSessionStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] || null,
    };
    
    vi.stubGlobal('sessionStorage', mockSessionStorage);

    stateValue = null;
    effectCallback = null;

    mockSetState = vi.fn((val) => {
      stateValue = typeof val === 'function' ? val(stateValue) : val;
    });

    mockUseStateFn = vi.fn((initialValue) => {
      return [stateValue, mockSetState];
    });

    mockUseEffectFn = vi.fn((callback) => {
      effectCallback = callback;
    });

    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
    } as any);
  });

  afterEach(() => {
    mockUseStateFn = null;
    mockUseEffectFn = null;
  });

  it('should handle Student A and B login transitions correctly', async () => {
    // Student A setup
    const userA = {
      id: 'student_A',
      user_name: 'Student A',
      studentId: 'student_A',
    };

    vi.mocked(useAuth).mockReturnValue({ user: userA } as any);
    vi.mocked(isStudentRole).mockReturnValue(true);

    const summaryA = {
      _id: 'summary_A',
      status: 'locked',
      total_score: 95,
      rank_tier: 'diamond',
      rank_label: 'Kim cương',
      semester: 'Học kỳ I',
      locked_at: '2026-06-13',
    };

    vi.mocked(summariesPointApi.getMyLatestSummary).mockResolvedValue(summaryA as any);

    // Call the component
    StudentCongratsModalGate();

    // Verify hooks registered
    expect(effectCallback).toBeInstanceOf(Function);
    expect(mockSetState).not.toHaveBeenCalled();

    // Trigger effect
    if (effectCallback) {
      effectCallback();
    }

    // Wait for the async API request to complete and state to be updated
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert setState called with summary A data
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Student A',
        id: 'student_A',
        score: 95,
        rankTier: 'diamond',
        rankLabel: 'Kim cương',
        semester: 'Học kỳ I',
        summaryId: 'summary_A',
        storageKey: 'congrats_shown_student_A_summary_A_2026-06-13',
      })
    );

    // Mock Student A's dismissal
    const keyA = 'congrats_shown_student_A_summary_A_2026-06-13';
    sessionStorage.setItem(keyA, 'true');
    stateValue = null;
    mockSetState.mockClear();

    // Transition / login of Student B
    const userB = {
      id: 'student_B',
      user_name: 'Student B',
      studentId: 'student_B',
    };

    vi.mocked(useAuth).mockReturnValue({ user: userB } as any);
    vi.mocked(isStudentRole).mockReturnValue(true);

    const summaryB = {
      _id: 'summary_B',
      status: 'locked',
      total_score: 88,
      rank_tier: 'gold',
      rank_label: 'Vàng',
      semester: 'Học kỳ II',
      locked_at: '2026-06-14',
    };

    vi.mocked(summariesPointApi.getMyLatestSummary).mockResolvedValue(summaryB as any);

    // Call component again
    StudentCongratsModalGate();

    // Trigger the effect callback for Student B
    if (effectCallback) {
      effectCallback();
    }

    // Wait for the async API request to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert setState called with summary B data
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Student B',
        id: 'student_B',
        score: 88,
        rankTier: 'gold',
        rankLabel: 'Vàng',
        semester: 'Học kỳ II',
        summaryId: 'summary_B',
        storageKey: 'congrats_shown_student_B_summary_B_2026-06-14',
      })
    );

    // Verify Student A's dismissal key is still in sessionStorage
    expect(sessionStorage.getItem(keyA)).toBe('true');
  });
});

describe('StudentCongratsModalGate DOM Rendering', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    const mockSessionStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => Object.keys(store)[index] || null,
    };
    
    vi.stubGlobal('sessionStorage', mockSessionStorage);
  });

  it('should render congrats modal, dismiss it, and transition to Student B correctly', async () => {
    // Mock Student A Setup
    const userA = {
      id: 'student_A',
      user_name: 'Student A',
      studentId: 'student_A',
    };
    vi.mocked(useAuth).mockReturnValue({ user: userA } as any);
    vi.mocked(isStudentRole).mockReturnValue(true);

    const summaryA = {
      _id: 'summary_A',
      status: 'locked',
      total_score: 95,
      rank_tier: 'diamond',
      rank_label: 'Kim cương',
      semester: 'Học kỳ I',
      locked_at: '2026-06-13',
    };
    vi.mocked(summariesPointApi.getMyLatestSummary).mockResolvedValue(summaryA as any);

    const mockRouter = { push: vi.fn() };
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);

    // Render the component
    const { rerender } = render(<StudentCongratsModalGate />);

    // Wait for the modal title to render (using heading role since text is split into spans)
    const title = await screen.findByRole('heading', { level: 2 });
    expect(title).toBeDefined();
    expect(title.textContent?.replace(/\u00a0/g, ' ')).toBe('Chúc mừng hoàn thành!');

    // Verify detailed content is rendering properly
    expect(screen.getByText('Student A')).toBeDefined();
    expect(screen.getByText('MSSV: student_A')).toBeDefined();
    expect(screen.getByText('95')).toBeDefined();
    expect(screen.getByText('Hạng: Kim cương')).toBeDefined();

    // Click Close ("Đóng")
    const closeBtn = screen.getByText('Đóng');
    fireEvent.click(closeBtn);

    // Assert user-scoped congrats storage key is set to true
    const expectedKeyA = 'congrats_shown_student_A_summary_A_2026-06-13';
    expect(sessionStorage.getItem(expectedKeyA)).toBe('true');

    // Assert the modal disappears
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();

    // Mock Login Transition to Student B
    const userB = {
      id: 'student_B',
      user_name: 'Student B',
      studentId: 'student_B',
    };
    vi.mocked(useAuth).mockReturnValue({ user: userB } as any);

    const summaryB = {
      _id: 'summary_B',
      status: 'locked',
      total_score: 88,
      rank_tier: 'gold',
      rank_label: 'Vàng',
      semester: 'Học kỳ II',
      locked_at: '2026-06-14',
    };
    vi.mocked(summariesPointApi.getMyLatestSummary).mockResolvedValue(summaryB as any);

    // Rerender with Student B configuration
    rerender(<StudentCongratsModalGate />);

    // Verify Student B's congrats modal renders successfully and is not blocked by Student A's key
    const titleB = await screen.findByText('Chúc mừng hoàn thành!');
    expect(titleB).toBeDefined();
    expect(screen.getByText('Student B')).toBeDefined();
    expect(screen.getByText('MSSV: student_B')).toBeDefined();
    expect(screen.getByText('88')).toBeDefined();
    expect(screen.getByText('Hạng: Vàng')).toBeDefined();
  });
});
