import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLinkedTaskProgress } from './useLinkedTaskProgress';
import { studentTaskApi } from '@/api/task-api';

vi.mock('@/api/task-api', () => ({
  studentTaskApi: {
    resolveAutoLinkedTask: vi.fn(),
    markTaskAccess: vi.fn(),
    sendLinkedTaskProgressEvent: vi.fn(),
  }
}));

describe('useLinkedTaskProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call markAccess automatically if initialTaskId is provided', async () => {
    (studentTaskApi.markTaskAccess as any).mockResolvedValue({});

    renderHook(() => useLinkedTaskProgress({
      taskId: 'test-task-1',
      linkedPage: '/test',
      sourceType: 'test_source'
    }));

    await waitFor(() => {
      expect(studentTaskApi.markTaskAccess).toHaveBeenCalledWith('test-task-1', '/test');
    });
  });

  it('should resolve taskId and call markAccess if initialTaskId is missing', async () => {
    (studentTaskApi.resolveAutoLinkedTask as any).mockResolvedValue({ taskId: 'resolved-task-2' });
    (studentTaskApi.markTaskAccess as any).mockResolvedValue({});

    renderHook(() => useLinkedTaskProgress({
      linkedPage: '/test',
      sourceType: 'test_source'
    }));

    await waitFor(() => {
      expect(studentTaskApi.resolveAutoLinkedTask).toHaveBeenCalledWith('/test');
      expect(studentTaskApi.markTaskAccess).toHaveBeenCalledWith('resolved-task-2', '/test');
    });
  });

  it('should only call markAccess once per resolvedTaskId', async () => {
    (studentTaskApi.markTaskAccess as any).mockResolvedValue({});

    const { rerender } = renderHook((props) => useLinkedTaskProgress(props as any), {
      initialProps: {
        taskId: 'test-task-1',
        linkedPage: '/test',
        sourceType: 'test_source'
      }
    });

    await waitFor(() => {
      expect(studentTaskApi.markTaskAccess).toHaveBeenCalledTimes(1);
    });

    // Re-render with same props
    rerender({
      taskId: 'test-task-1',
      linkedPage: '/test',
      sourceType: 'test_source'
    });

    // Should not be called again
    expect(studentTaskApi.markTaskAccess).toHaveBeenCalledTimes(1);
  });
});
