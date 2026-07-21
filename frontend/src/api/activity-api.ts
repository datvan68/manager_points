import { httpClient, handleResponse } from './http-client';
import { API_BASE } from './config';

// ── Types ──

export interface ActivityFavoriteState {
  activity_id: string;
  is_favorited: boolean;
  favorite_count: number;
}

export interface Activity {
  _id: string;
  name: string;
  code: string;
  activity_type: 'club' | 'event' | 'activity' | 'festival';
  participation_status: 'draft' | 'published' | 'completed' | 'cancelled';
  classroom: string;
  description?: string;
  category: 'academic' | 'sports' | 'art' | 'volunteer' | 'technology' | 'other';
  logo_url?: string;
  cover_url?: string;
  advisor_id: any;
  president_id?: any;
  vice_president_ids?: any[];
  max_members?: number;
  active_members_count: number;
  membership_status?: 'none' | 'pending' | 'active' | 'rejected' | 'inactive' | 'left';
  founded_date?: string;
  activity_start_date?: string;
  activity_end_date?: string;
  semester_id?: any;
  settings: {
    allow_self_registration: boolean;
    require_approval: boolean;
    attendance_point_enabled: boolean;
    point_per_attendance: number;
    criterion_id?: string;
  };
  card_ui?: {
    theme: 'default' | 'academic' | 'sports' | 'art' | 'volunteer' | 'technology' | 'other';
    accent_color?: string;
    style: 'classic' | 'spotlight' | 'minimal';
  };
  background_config?: {
    preset?: string;
    accentColor?: string;
    backgroundImageUrl?: string;
    useAvatarAsBackground?: boolean;
    backgroundFrameUrl?: string;
    pattern?: string;
    petAccentType?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ActivityMember {
  _id: string;
  activity_id: any; // backend database maps to activity_id
  student_id?: any;
  user_id?: any;
  role: string;
  status: string;
  joined_at?: string;
  left_at?: string;
  approved_by?: any;
  semester_id: any;
  occupies_slot?: boolean;
  transfer?: any;
  createdAt: string;
  participation_count?: number;
  self_service_leaves_remaining?: number;
}

export interface ActivityMembershipPolicyResponse {
  membership: ActivityMember;
  transfer: any | null;
  self_service_changes_used: number;
  self_service_changes_remaining: number;
  self_service_leaves_used?: number;
  self_service_leaves_remaining?: number;
  requires_teacher_approval: boolean;
  first_schedule_start_time: string | null;
}

export interface ActivitySchedule {
  _id: string;
  activity_id?: any;
  title: string;
  description?: string;
  schedule_type: string;
  location?: string;
  start_time: string;
  end_time: string;
  recurrence?: { 
    type: string; 
    day_of_week?: number; 
    until?: string; 
    start?: string; 
    source_week_start_date?: string; 
    source_week_end_date?: string; 
  };
  recurrence_id?: string;
  semester_id: any;
  instructor_id?: any;
  max_attendees?: number;
  status: string;
  created_by: any;
  registration_count?: number;
  createdAt: string;
}

export interface ActivityAttendance {
  _id: string;
  activity_id: any;
  schedule_id: any;
  student_id: any;
  semester_id: any;
  status: string;
  check_in_time?: string;
  check_out_time?: string;
  note?: string;
  recorded_by: any;
  recorded_by_role: string;
  recorded_at: string;
  approval_status: string;
  approved_by?: any;
  approved_at?: string;
  rejection_reason?: string;
  synced_to_academic_record: boolean;
  createdAt: string;
}

export interface StudentActivityTimelineItem extends ActivitySchedule {
  my_attendance: ActivityAttendance | null;
  is_today: boolean;
  is_active: boolean;
}

export interface StaffActivityAttendanceRecord {
  _id: string;
  student_id: {
    _id: string;
    full_name: string;
    student_code: string;
  } | null;
  status: string;
  check_in_time?: string;
  check_out_time?: string;
  approval_status: string;
  recorded_at: string;
  note?: string;
}

export interface StaffActivityTimelineItem extends ActivitySchedule {
  attendance_records: StaffActivityAttendanceRecord[];
  is_today: boolean;
  is_active: boolean;
}

export type ActivityTimelineResponse =
  | { viewer_mode: 'student'; items: StudentActivityTimelineItem[]; timezone: string }
  | { viewer_mode: 'staff'; items: StaffActivityTimelineItem[]; timezone: string };

export interface ActivityCompletionRule {
  _id: string;
  activity_id?: any;
  semester_id: any;
  minimum_attendance: number;
  criterion_ids: any[];
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityAttendanceSummary {
  student_id: string;
  student_name: string;
  student_code: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  approved_count: number;
  pending_count: number;
  attendance_rate: number;
}

// ── Helpers ──

function buildQuery(params?: Record<string, any>): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null);
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

const jsonHeaders = { 'Content-Type': 'application/json' };

function normalizeActivityIdPayload(data: any): any {
  if (!data) return data;
  const result = { ...data };
  
  let rawId = result.activity_id;
  if (rawId && typeof rawId === 'object' && rawId._id) {
    rawId = rawId._id;
  }
  
  if (rawId) {
    if (typeof rawId !== 'string' || !/^[a-f\d]{24}$/i.test(rawId)) {
      throw new Error(`activity_id must be a mongodb id. Received: ${rawId}`);
    }
    result.activity_id = rawId;
  }


  if (result.semester_id && typeof result.semester_id === 'object' && result.semester_id._id) {
    result.semester_id = result.semester_id._id;
  }
  
  if (result.instructor_id && typeof result.instructor_id === 'object' && result.instructor_id._id) {
    result.instructor_id = result.instructor_id._id;
  }

  return result;
}

// ── Activities API ──

export const activityApi = {
  async getAll(params?: any): Promise<Activity[]> {
    const res = await httpClient(`${API_BASE}/activities${buildQuery(params)}`);
    return handleResponse<Activity[]>(res);
  },

  async getMyActivities(): Promise<ActivityMember[]> {
    const res = await httpClient(`${API_BASE}/activities/my`);
    return handleResponse<ActivityMember[]>(res);
  },

  async getMyTransferPolicy(params: { semester_id: string }): Promise<{
    self_service_changes_used: number;
    self_service_changes_remaining: number;
    occupied_activity_id: string | null;
    first_schedule_start_time: string | null;
    self_service_leaves_used: number;
    self_service_leaves_remaining: number;
  }> {
    const res = await httpClient(`${API_BASE}/activities/my/transfer-policy${buildQuery(params)}`);
    return handleResponse<{
      self_service_changes_used: number;
      self_service_changes_remaining: number;
      occupied_activity_id: string | null;
      first_schedule_start_time: string | null;
      self_service_leaves_used: number;
      self_service_leaves_remaining: number;
    }>(res);
  },

  async getById(id: string): Promise<Activity> {
    const res = await httpClient(`${API_BASE}/activities/${id}`);
    return handleResponse<Activity>(res);
  },

  async create(data: Partial<Activity>): Promise<Activity> {
    const res = await httpClient(`${API_BASE}/activities`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<Activity>(res);
  },

  async uploadMedia(file: File, kind: 'cover' | 'logo' | 'frame'): Promise<{
    url: string;
    file_name: string;
    mime_type: string;
    size: number;
    kind: 'cover' | 'logo' | 'frame';
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);

    const res = await httpClient(`${API_BASE}/activities/media/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<{
      url: string;
      file_name: string;
      mime_type: string;
      size: number;
      kind: 'cover' | 'logo' | 'frame';
    }>(res);
  },

  async update(id: string, data: Partial<Activity>): Promise<Activity> {
    const res = await httpClient(`${API_BASE}/activities/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<Activity>(res);
  },

  async delete(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/activities/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  async getStats(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/activities/${id}/stats`);
    return handleResponse(res);
  },

  // Members
  async getMembers(activityId: string, params?: { status?: string; semester_id?: string }): Promise<ActivityMember[]> {
    const res = await httpClient(`${API_BASE}/activities/${activityId}/members${buildQuery(params)}`);
    return handleResponse<ActivityMember[]>(res);
  },

  async addMember(activityId: string, data: { student_id: string; role?: string; semester_id: string }): Promise<ActivityMember> {
    const res = await httpClient(`${API_BASE}/activities/${activityId}/members`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ActivityMember>(res);
  },

  async joinActivity(activityId: string, data: { semester_id: string }): Promise<ActivityMembershipPolicyResponse> {
    const res = await httpClient(`${API_BASE}/activities/${activityId}/join`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ActivityMembershipPolicyResponse>(res);
  },

  async leaveActivity(activityId: string, data: { semester_id: string }): Promise<ActivityMembershipPolicyResponse> {
    const res = await httpClient(`${API_BASE}/activities/${activityId}/leave`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ActivityMembershipPolicyResponse>(res);
  },

  async switchActivity(targetActivityId: string, data: { semester_id: string }): Promise<ActivityMembershipPolicyResponse> {
    const res = await httpClient(`${API_BASE}/activities/${targetActivityId}/switch`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ActivityMembershipPolicyResponse>(res);
  },

  async adminTransferActivity(targetActivityId: string, data: { student_id: string; semester_id: string }): Promise<ActivityMembershipPolicyResponse> {
    const res = await httpClient(`${API_BASE}/activities/${targetActivityId}/admin-transfer`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ActivityMembershipPolicyResponse>(res);
  },

  async updateMember(activityId: string, memberId: string, data: any): Promise<ActivityMember> {
    const res = await httpClient(`${API_BASE}/activities/${activityId}/members/${memberId}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ActivityMember>(res);
  },

  async removeMember(activityId: string, memberId: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/activities/${activityId}/members/${memberId}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  async removeMembers(activityId: string, memberIds: string[]): Promise<{ failedIds?: string[] }> {
    const res = await httpClient(`${API_BASE}/activities/${activityId}/members/batch-delete`, {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify({ member_ids: memberIds }),
    });
    return handleResponse(res);
  },

  async resetMemberProgress(activityId: string, memberId: string, semesterId: string): Promise<{ participation_count: number }> {
    const res = await httpClient(`${API_BASE}/activity-completion-rules/activity/${activityId}/members/${memberId}/reset`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ semester_id: semesterId }) });
    return handleResponse(res);
  },

  async approveMember(activityId: string, memberId: string, data: { status: string; rejection_reason?: string }): Promise<ActivityMember> {
    const res = await httpClient(`${API_BASE}/activities/${activityId}/members/${memberId}/approve`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ActivityMember>(res);
  },

  async favoriteActivity(activityId: string): Promise<ActivityFavoriteState> {
    const res = await httpClient(`${API_BASE}/activities/${activityId}/favorite`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse<ActivityFavoriteState>(res);
  },

  async unfavoriteActivity(activityId: string): Promise<ActivityFavoriteState> {
    const res = await httpClient(`${API_BASE}/activities/${activityId}/favorite`, {
      method: 'DELETE',
    });
    return handleResponse<ActivityFavoriteState>(res);
  },

  async getMyFavoriteActivityIds(): Promise<string[]> {
    const res = await httpClient(`${API_BASE}/activities/favorites/me`);
    const data = await handleResponse<{ activity_ids: string[] }>(res);
    return data.activity_ids || [];
  },
};

// ── Activity Schedules API ──

export const activityScheduleApi = {
  async getAll(params?: any): Promise<{ items: ActivitySchedule[]; total: number }> {
    const res = await httpClient(`${API_BASE}/activity-schedules${buildQuery(params)}`);
    return handleResponse(res);
  },

  async getActivityTimeline(activityId: string): Promise<ActivityTimelineResponse> {
    const res = await httpClient(`${API_BASE}/activity-schedules/activity/${activityId}/timeline`);
    return handleResponse<ActivityTimelineResponse>(res);
  },

  async getMySchedules(): Promise<any[]> {
    const res = await httpClient(`${API_BASE}/activity-schedules/my`);
    return handleResponse(res);
  },

  async getUpcoming(params?: { activity_id?: string; limit?: number }): Promise<ActivitySchedule[]> {
    const res = await httpClient(`${API_BASE}/activity-schedules/upcoming${buildQuery(params)}`);
    return handleResponse<ActivitySchedule[]>(res);
  },

  async getById(id: string): Promise<ActivitySchedule> {
    const res = await httpClient(`${API_BASE}/activity-schedules/${id}`);
    return handleResponse<ActivitySchedule>(res);
  },

  async create(data: any): Promise<ActivitySchedule> {
    const payload = normalizeActivityIdPayload(data);
    const res = await httpClient(`${API_BASE}/activity-schedules`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    return handleResponse<ActivitySchedule>(res);
  },

  async update(id: string, data: any): Promise<ActivitySchedule> {
    const payload = normalizeActivityIdPayload(data);
    const res = await httpClient(`${API_BASE}/activity-schedules/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    return handleResponse<ActivitySchedule>(res);
  },

  async delete(id: string, deleteSeries?: boolean): Promise<any> {
    const url = `${API_BASE}/activity-schedules/${id}${deleteSeries ? '?deleteSeries=true' : ''}`;
    const res = await httpClient(url, { method: 'DELETE' });
    return handleResponse(res);
  },

  async cancelRecurrence(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/activity-schedules/${id}/cancel-recurrence`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse(res);
  },

  async cancelEntireRecurrence(id: string): Promise<{ message: string; cancelledSchedules: number }> {
    const res = await httpClient(`${API_BASE}/activity-schedules/${id}/cancel-entire-recurrence`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse(res);
  },

  async register(id: string, activityId: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/activity-schedules/${id}/register`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ activity_id: activityId }),
    });
    return handleResponse(res);
  },

  async cancelRegistration(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/activity-schedules/${id}/cancel-registration`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse(res);
  },

  async getRegistrations(id: string): Promise<any[]> {
    const res = await httpClient(`${API_BASE}/activity-schedules/${id}/registrations`);
    return handleResponse(res);
  },

  async markCompleted(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/activity-schedules/${id}/complete`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse(res);
  },
};

// ── Activity Attendance API ──

export const activityAttendanceApi = {
  async getAll(params?: any): Promise<{ items: ActivityAttendance[]; total: number }> {
    const res = await httpClient(`${API_BASE}/club-attendance${buildQuery(params)}`);
    return handleResponse(res);
  },

  async getMyAttendance(params?: { semester_id?: string; activity_id?: string }): Promise<ActivityAttendance[]> {
    const res = await httpClient(`${API_BASE}/club-attendance/my${buildQuery(params)}`);
    return handleResponse<ActivityAttendance[]>(res);
  },

  async getPendingCount(activityId?: string): Promise<{ count: number }> {
    const res = await httpClient(`${API_BASE}/club-attendance/pending-count${buildQuery(activityId ? { activity_id: activityId } : {})}`);
    return handleResponse(res);
  },

  async getSummary(activityId: string, semesterId: string): Promise<ActivityAttendanceSummary[]> {
    const res = await httpClient(`${API_BASE}/club-attendance/summary/${activityId}${buildQuery({ semester_id: semesterId })}`);
    return handleResponse<ActivityAttendanceSummary[]>(res);
  },

  async getById(id: string): Promise<ActivityAttendance> {
    const res = await httpClient(`${API_BASE}/club-attendance/${id}`);
    return handleResponse<ActivityAttendance>(res);
  },

  async create(data: any): Promise<ActivityAttendance> {
    const res = await httpClient(`${API_BASE}/club-attendance`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ActivityAttendance>(res);
  },

  async batchCreate(data: {
    activity_id?: string;
    schedule_id: string;
    semester_id: string;
    entries: { student_id: string; status: string; note?: string }[];
  }): Promise<any> {
    const payload = normalizeActivityIdPayload(data);
    const res = await httpClient(`${API_BASE}/club-attendance/batch`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async update(id: string, data: any): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-attendance/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async delete(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-attendance/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  async approve(id: string, data: { status: string; rejection_reason?: string }): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-attendance/${id}/approve`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async reject(id: string, data: { status: string; rejection_reason?: string }): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-attendance/${id}/reject`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async batchApprove(ids: string[]): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-attendance/batch-approve`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ ids }),
    });
    return handleResponse(res);
  },

  async batchSync(activityId: string, semesterId: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-attendance/sync/${activityId}${buildQuery({ semester_id: semesterId })}`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse(res);
  },

  async retrySync(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-attendance/${id}/retry-sync`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse(res);
  },
};

// ── Activity Completion Rule API ──

export const activityCompletionRuleApi = {
  async getMemberProgress(activityId: string, semesterId: string): Promise<Array<{ member_id: string; participation_count: number }>> {
    const res = await httpClient(`${API_BASE}/activity-completion-rules/activity/${activityId}/progress?semester_id=${encodeURIComponent(semesterId)}`);
    return handleResponse(res);
  },
  async getAll(): Promise<ActivityCompletionRule[]> {
    const res = await httpClient(`${API_BASE}/activity-completion-rules`);
    return handleResponse<ActivityCompletionRule[]>(res);
  },

  async getById(id: string): Promise<ActivityCompletionRule> {
    const res = await httpClient(`${API_BASE}/activity-completion-rules/${id}`);
    return handleResponse<ActivityCompletionRule>(res);
  },

  async create(data: Partial<ActivityCompletionRule>): Promise<ActivityCompletionRule> {
    const payload = normalizeActivityIdPayload(data);
    const res = await httpClient(`${API_BASE}/activity-completion-rules`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    return handleResponse<ActivityCompletionRule>(res);
  },

  async update(id: string, data: Partial<ActivityCompletionRule>): Promise<ActivityCompletionRule> {
    const payload = normalizeActivityIdPayload(data);
    const res = await httpClient(`${API_BASE}/activity-completion-rules/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    return handleResponse<ActivityCompletionRule>(res);
  },

  async delete(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/activity-completion-rules/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },
};

// ── Attendance Session API & Types ──

export interface AttendanceSessionData {
  _id: string;
  context_type: string;
  context_id: string;
  schedule_id?: string;
  semester_id: string;
  method: 'qr' | 'proximity' | 'manual';
  status: 'active' | 'closed' | 'expired';
  qr_token?: string;
  qr_token_expires_at?: string;
  qr_refresh_interval?: number;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  opened_by: any;
  opened_at: string;
  closed_at?: string;
  auto_close_at?: string;
  allow_late_checkin: boolean;
  auto_approve: boolean;
  max_checkins?: number;
  title?: string;
  description?: string;
  checkin_count: number;
  createdAt: string;
}

export interface AttendanceCheckinData {
  _id: string;
  session_id: string;
  student_id: any;
  method: 'qr' | 'proximity';
  status: string;
  checked_in_at: string;
  latitude?: number;
  longitude?: number;
  distance_meters?: number;
  qr_token_used?: string;
  synced: boolean;
  createdAt: string;
}

export interface QrData {
  token: string;
  expires_at: string;
  refresh_interval: number;
  checkin_count: number;
}

export const attendanceSessionApi = {
  async openSession(data: {
    context_type: string;
    context_id: string;
    schedule_id?: string;
    semester_id: string;
    method: 'qr' | 'proximity';
    latitude?: number;
    longitude?: number;
    radius_meters?: number;
    qr_refresh_interval?: number;
    auto_approve?: boolean;
    allow_late_checkin?: boolean;
    auto_close_at?: string;
    title?: string;
    description?: string;
    max_checkins?: number;
  }): Promise<AttendanceSessionData> {
    const res = await httpClient(`${API_BASE}/attendance-sessions`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<AttendanceSessionData>(res);
  },

  async getActiveSession(params: {
    context_type: string;
    context_id: string;
  }): Promise<AttendanceSessionData | null> {
    const res = await httpClient(
      `${API_BASE}/attendance-sessions/active${buildQuery(params)}`,
    );
    return handleResponse<AttendanceSessionData | null>(res);
  },

  async getSessionById(id: string): Promise<AttendanceSessionData> {
    const res = await httpClient(`${API_BASE}/attendance-sessions/${id}`);
    return handleResponse<AttendanceSessionData>(res);
  },

  async getQrData(id: string): Promise<QrData> {
    const res = await httpClient(`${API_BASE}/attendance-sessions/${id}/qr`);
    return handleResponse<QrData>(res);
  },

  async closeSession(id: string): Promise<AttendanceSessionData> {
    const res = await httpClient(`${API_BASE}/attendance-sessions/${id}/close`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse<AttendanceSessionData>(res);
  },

  async checkinQr(data: { token: string }): Promise<AttendanceCheckinData> {
    const res = await httpClient(`${API_BASE}/attendance-sessions/checkin/qr`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<AttendanceCheckinData>(res);
  },

  async checkinProximity(data: {
    session_id: string;
    latitude: number;
    longitude: number;
  }): Promise<AttendanceCheckinData> {
    const res = await httpClient(`${API_BASE}/attendance-sessions/checkin/proximity`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<AttendanceCheckinData>(res);
  },

  async getCheckins(sessionId: string): Promise<AttendanceCheckinData[]> {
    const res = await httpClient(`${API_BASE}/attendance-sessions/${sessionId}/checkins`);
    return handleResponse<AttendanceCheckinData[]>(res);
  },

  async getSessionHistory(params: {
    context_type: string;
    context_id: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: AttendanceSessionData[]; total: number }> {
    const res = await httpClient(
      `${API_BASE}/attendance-sessions/history${buildQuery(params)}`,
    );
    return handleResponse(res);
  },
};

