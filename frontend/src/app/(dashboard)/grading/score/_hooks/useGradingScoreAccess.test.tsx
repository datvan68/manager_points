import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGradingScoreAccess } from './useGradingScoreAccess';

const mocks = vi.hoisted(() => ({
  getGradingAccess: vi.fn(),
  useAuth: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/api/summaries-point-api', () => ({
  summariesPointApi: { getGradingAccess: mocks.getGradingAccess },
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: mocks.useAuth,
}));

vi.mock('@/api/auth-api', () => ({
  tokenStorage: { getUser: mocks.getUser },
}));

describe('useGradingScoreAccess', () => {
  const student = { id: 'user-1', roleCode: 'STUDENT', roleName: 'Student' };
  const context = {
    studentId: 'student-1',
    semesterId: 'semester-1',
    summaryId: 'summary-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({ user: student, isLoading: false });
    mocks.getUser.mockReturnValue(student);
  });

  it('denies editing while the first matching backend response is loading', async () => {
    let resolveAccess!: (value: any) => void;
    mocks.getGradingAccess.mockReturnValue(new Promise((resolve) => {
      resolveAccess = resolve;
    }));

    const { result } = renderHook(() => useGradingScoreAccess(context));

    expect(result.current.loading).toBe(true);
    expect(result.current.canModifyScoreByRole).toBe(false);

    resolveAccess({ canModifyScore: true, canReadSummary: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canModifyScoreByRole).toBe(true);
  });

  it('denies editing and exposes a stable error when access resolution fails', async () => {
    mocks.getGradingAccess.mockRejectedValue(new Error('network')); 

    const { result } = renderHook(() => useGradingScoreAccess(context));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canModifyScoreByRole).toBe(false);
    expect(result.current.backendReasonCode).toBe('GRADING_ACCESS_UNAVAILABLE');
  });

  it('ignores a stale response after the grading context changes', async () => {
    let resolveFirst!: (value: any) => void;
    let resolveSecond!: (value: any) => void;
    mocks.getGradingAccess
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, rerender } = renderHook(
      (props) => useGradingScoreAccess(props),
      { initialProps: context },
    );

    rerender({ ...context, semesterId: 'semester-2' });
    resolveSecond({ canModifyScore: true, canReadSummary: true });
    await waitFor(() => expect(result.current.canModifyScoreByRole).toBe(true));

    resolveFirst({ canModifyScore: false, reason: 'stale denial' });
    await waitFor(() => expect(result.current.canModifyScoreByRole).toBe(true));
    expect(result.current.backendDeniedReason).not.toBe('stale denial');
  });

  it('keeps readable access when the backend denies only editing', async () => {
    mocks.getGradingAccess.mockResolvedValue({
      canModifyScore: false,
      canReadSummary: true,
      reason: 'Chưa đến giai đoạn sinh viên.',
      reasonCode: 'GRADING_EVALUATION_PENDING',
    });

    const { result } = renderHook(() => useGradingScoreAccess(context));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canModifyScoreByRole).toBe(false);
    expect(result.current.backendDeniedReason).toContain('Chưa đến');
  });
});
