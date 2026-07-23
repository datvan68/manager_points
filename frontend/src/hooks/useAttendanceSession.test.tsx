import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activityAttendanceGrantApi, attendanceSessionApi } from '@/api/activity-api';
import { useAttendanceSession } from './useAttendanceSession';

let emitRealtime: ((event: any) => void) | undefined;

vi.mock('@/api/activity-api', () => ({
  activityAttendanceGrantApi: {
    getCapabilities: vi.fn(),
  },
  attendanceSessionApi: {
    getActiveSession: vi.fn(),
    getCheckins: vi.fn(),
    getManualRoster: vi.fn(),
    getQrData: vi.fn(),
    openSession: vi.fn(),
    closeSession: vi.fn(),
    checkinQr: vi.fn(),
    checkinProximity: vi.fn(),
    manualCheckin: vi.fn(),
  },
}));

vi.mock('./useAttendanceRealtime', () => ({
  useAttendanceRealtime: (options: { onEvent: (event: any) => void }) => {
    emitRealtime = options.onEvent;
    return { status: 'disconnected' };
  },
}));

const manualSession = {
  _id: 'manual-session-1',
  context_type: 'activity',
  context_id: 'activity-1',
  schedule_id: 'schedule-today',
  semester_id: 'semester-1',
  method: 'manual_class',
  class_id: 'class-1',
  status: 'active',
  opened_by: 'teacher-1',
  opened_at: '2026-07-23T01:00:00.000Z',
  checkin_count: 0,
} as any;

const capabilities = {
  can_administer_grants: false,
  grant_status: 'active',
  effective_methods: ['manual_class'],
  classes: [{ _id: 'class-1', class_name: '12A1' }],
} as any;

describe('useAttendanceSession owner-scoped manual lanes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitRealtime = undefined;
    vi.mocked(activityAttendanceGrantApi.getCapabilities).mockResolvedValue(capabilities);
    vi.mocked(attendanceSessionApi.getCheckins).mockResolvedValue([]);
    vi.mocked(attendanceSessionApi.getManualRoster).mockResolvedValue({
      class_id: 'class-1',
      total: 0,
      students: [],
    });
    vi.mocked(attendanceSessionApi.getActiveSession).mockImplementation(async (params: any) =>
      params.method === 'manual_class' ? manualSession : null,
    );
  });

  it('hydrates each manual lane with method, class, and today schedule filters', async () => {
    const { result } = renderHook(() => useAttendanceSession({
      contextType: 'activity',
      contextId: 'activity-1',
      activityId: 'activity-1',
      currentUserId: 'teacher-1',
      manualScheduleId: 'schedule-today',
    }));

    await waitFor(() => expect(result.current.manualLanes['class-1']?.session?._id).toBe('manual-session-1'));

    expect(attendanceSessionApi.getActiveSession).toHaveBeenCalledWith({
      context_type: 'activity',
      context_id: 'activity-1',
      method: 'manual_class',
      class_id: 'class-1',
      schedule_id: 'schedule-today',
    });
    expect(attendanceSessionApi.getManualRoster).toHaveBeenCalledWith('manual-session-1');
    expect(result.current.session).toBeNull();
  });

  it('recovers a same-owner duplicate open by refetching the active manual lane', async () => {
    vi.mocked(attendanceSessionApi.getActiveSession)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(manualSession);
    vi.mocked(attendanceSessionApi.openSession).mockRejectedValue(new Error('duplicate active session'));

    const { result } = renderHook(() => useAttendanceSession({
      contextType: 'activity',
      contextId: 'activity-1',
      activityId: 'activity-1',
      currentUserId: 'teacher-1',
      manualScheduleId: 'schedule-today',
    }));
    await waitFor(() => expect(result.current.manualLanes['class-1']?.loading).toBe(false));

    await act(async () => {
      const recovered = await result.current.openManualSession('class-1', {
        schedule_id: 'schedule-today',
        semester_id: 'semester-1',
      });
      expect(recovered?._id).toBe('manual-session-1');
    });

    expect(result.current.manualLanes['class-1'].session?._id).toBe('manual-session-1');
  });

  it('ignores foreign-owner lifecycle events and accepts the exact owner lane scope', async () => {
    const { result } = renderHook(() => useAttendanceSession({
      contextType: 'activity',
      contextId: 'activity-1',
      activityId: 'activity-1',
      currentUserId: 'teacher-1',
      manualScheduleId: 'schedule-today',
    }));
    await waitFor(() => expect(result.current.manualLanes['class-1']?.session?._id).toBe('manual-session-1'));

    await act(async () => emitRealtime?.({
      type: 'attendance.session_opened',
      sessionId: 'foreign-session',
      method: 'manual_class',
      classId: 'class-1',
      scheduleId: 'schedule-today',
      openedBy: 'teacher-2',
      session: { ...manualSession, _id: 'foreign-session', opened_by: 'teacher-2' },
    }));
    expect(result.current.manualLanes['class-1'].session?._id).toBe('manual-session-1');

    await act(async () => emitRealtime?.({
      type: 'attendance.session_opened',
      sessionId: 'owner-session',
      method: 'manual_class',
      classId: 'class-1',
      scheduleId: 'schedule-today',
      openedBy: 'teacher-1',
      session: { ...manualSession, _id: 'owner-session' },
    }));
    await waitFor(() => expect(attendanceSessionApi.getManualRoster).toHaveBeenCalledWith('owner-session'));
    expect(result.current.manualLanes['class-1'].session?._id).toBe('owner-session');
  });
});
