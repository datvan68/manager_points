import { useCallback, useRef, useEffect } from 'react';
import { studentTaskApi } from '@/api/task-api';

interface UseLinkedTaskProgressProps {
  taskId?: string | null;
  linkedPage: string;
  sourceType: string;
}

export function useLinkedTaskProgress({
  taskId,
  linkedPage,
  sourceType,
}: UseLinkedTaskProgressProps) {
  const isStartedSent = useRef(false);

  // Reset isStartedSent flag when taskId changes
  useEffect(() => {
    isStartedSent.current = false;
  }, [taskId]);

  const markStarted = useCallback(async (sourceId?: string, metadata?: Record<string, unknown>) => {
    if (!taskId) return;
    if (isStartedSent.current) return; // Tránh gửi started nhiều lần trong cùng 1 session component
    try {
      await studentTaskApi.sendLinkedTaskProgressEvent({
        taskId,
        event: 'started',
        linkedPage,
        sourceType,
        sourceId,
        metadata,
      });
      isStartedSent.current = true;
    } catch (error) {
      console.error('Failed to send started event for task:', taskId, error);
      throw error;
    }
  }, [taskId, linkedPage, sourceType]);

  const markCompleted = useCallback(async (sourceId?: string, metadata?: Record<string, unknown>) => {
    if (!taskId) return;
    try {
      await studentTaskApi.sendLinkedTaskProgressEvent({
        taskId,
        event: 'completed',
        linkedPage,
        sourceType,
        sourceId,
        metadata,
      });
    } catch (error) {
      console.error('Failed to send completed event for task:', taskId, error);
      throw error;
    }
  }, [taskId, linkedPage, sourceType]);

  return {
    markStarted,
    markCompleted,
  };
}
