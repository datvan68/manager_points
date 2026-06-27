import { useCallback, useRef, useEffect, useState } from 'react';
import { studentTaskApi } from '@/api/task-api';

interface UseLinkedTaskProgressProps {
  taskId?: string | null;
  linkedPage: string;
  sourceType: string;
}

export function useLinkedTaskProgress({
  taskId: initialTaskId,
  linkedPage,
  sourceType,
}: UseLinkedTaskProgressProps) {
  const isStartedSent = useRef(false);
  const [resolvedTaskId, setResolvedTaskId] = useState<string | null>(initialTaskId || null);

  // Update resolvedTaskId if initialTaskId changes
  useEffect(() => {
    if (initialTaskId) {
      setResolvedTaskId(initialTaskId);
    } else {
      // Try to resolve auto linked task if no taskId provided
      const resolveTask = async () => {
        try {
          const res = await studentTaskApi.resolveAutoLinkedTask(linkedPage);
          if (res && res.taskId) {
            setResolvedTaskId(res.taskId);
          }
        } catch (error) {
          console.error('Failed to resolve auto linked task:', error);
        }
      };
      resolveTask();
    }
  }, [initialTaskId, linkedPage]);

  // Reset isStartedSent flag when resolvedTaskId changes
  useEffect(() => {
    isStartedSent.current = false;
  }, [resolvedTaskId]);

  const markAccess = useCallback(async () => {
    if (!resolvedTaskId) return;
    if (isStartedSent.current) return;
    try {
      const res = await studentTaskApi.markTaskAccess(resolvedTaskId, linkedPage);
      if (res && res.tracked === false) {
        // Admin/supervisor bypass
        console.log('Task access bypassed:', res.reason);
      }
      isStartedSent.current = true;
    } catch (error: any) {
      console.error('Failed to mark access for task:', resolvedTaskId, error);
      import('sonner').then(({ toast }) => {
        toast.error(error.message || 'Lỗi truy cập nhiệm vụ');
      });
      // Do not rethrow to avoid blocking unhandled promise rejection in browser
    }
  }, [resolvedTaskId, linkedPage]);

  useEffect(() => {
    if (resolvedTaskId && !isStartedSent.current) {
      markAccess();
    }
  }, [resolvedTaskId, markAccess]);

  return {
    resolvedTaskId,
    markAccess,
  };
}
