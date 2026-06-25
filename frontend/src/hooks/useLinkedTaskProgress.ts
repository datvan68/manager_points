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

  const markStarted = useCallback(async (options?: { sourceId?: string, assigneeStudentId?: string, metadata?: Record<string, unknown> }) => {
    if (!resolvedTaskId) return;
    if (isStartedSent.current) return; // Tránh gửi started nhiều lần trong cùng 1 session component
    try {
      await studentTaskApi.sendLinkedTaskProgressEvent({
        taskId: resolvedTaskId,
        event: 'started',
        linkedPage,
        sourceType,
        sourceId: options?.sourceId,
        assigneeStudentId: options?.assigneeStudentId,
        metadata: options?.metadata,
      });
      isStartedSent.current = true;
    } catch (error) {
      console.error('Failed to send started event for task:', resolvedTaskId, error);
      throw error;
    }
  }, [resolvedTaskId, linkedPage, sourceType]);

  const markCompleted = useCallback(async (options?: { sourceId?: string, assigneeStudentId?: string, metadata?: Record<string, unknown> }) => {
    if (!resolvedTaskId) return;
    try {
      await studentTaskApi.sendLinkedTaskProgressEvent({
        taskId: resolvedTaskId,
        event: 'completed',
        linkedPage,
        sourceType,
        sourceId: options?.sourceId,
        assigneeStudentId: options?.assigneeStudentId,
        metadata: options?.metadata,
      });
    } catch (error) {
      console.error('Failed to send completed event for task:', resolvedTaskId, error);
      throw error;
    }
  }, [resolvedTaskId, linkedPage, sourceType]);

  return {
    resolvedTaskId,
    markStarted,
    markCompleted,
  };
}
