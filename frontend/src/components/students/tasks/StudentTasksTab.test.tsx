import { describe, expect, it } from 'vitest';
import { mapBackendToClientTask, mapClientToBackendDto, TASK_LIST_LIMIT } from './StudentTasksTab';

describe('student task presentation contract', () => {
  it('normalizes legacy project and assignment tasks to Thường xuyên', () => {
    expect(mapBackendToClientTask({ type: 'project', subject: 'Nội dung' } as any).type).toBe('Thường xuyên');
    expect(mapBackendToClientTask({ type: 'assignment', subject: 'Nội dung' } as any).type).toBe('Thường xuyên');
    expect(mapBackendToClientTask({ type: 'activity', subject: 'Nội dung' } as any).type).toBe('Hoạt động');
  });

  it('keeps the existing API values for the new labels and limit', () => {
    expect(mapClientToBackendDto({ type: 'Thường xuyên', subject: 'Nội dung' }).type).toBe('assignment');
    expect(mapClientToBackendDto({ type: 'Hoạt động', subject: 'Nội dung' }).type).toBe('activity');
    expect(TASK_LIST_LIMIT).toBe(100);
  });
});
