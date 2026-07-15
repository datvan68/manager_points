import { httpClient, handleResponse } from './http-client';
import { API_BASE } from './config';

// ── Types ──

export interface ClubFavoriteState {
  activity_id: string;
  is_favorited: boolean;
  favorite_count: number;
}

export interface Club {
  _id: string;
  name: string;
  code: string;
  classroom: string;
  description?: string;
  category: string;
  logo_url?: string;
  cover_url?: string;
  advisor_id: any;
  president_id?: any;
  vice_president_ids?: any[];
  max_members?: number;
  founded_date?: string;
  activity_start_date?: string;
  activity_end_date?: string;
  status: string;
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

export interface ClubMember {
  _id: string;
  activity_id: any;
  student_id: any;
  role: string;
  status: string;
  joined_at?: string;
  left_at?: string;
  approved_by?: any;
  semester_id: any;
  occupies_slot?: boolean;
  transfer?: any;
  createdAt: string;
}

export interface ClubMembershipPolicyResponse {
  membership: ClubMember;
  transfer: any | null;
  self_service_changes_used: number;
  self_service_changes_remaining: number;
  requires_teacher_approval: boolean;
  first_schedule_start_time: string | null;
}

export interface ClubSchedule {
  _id: string;
  activity_id: any;
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

export interface ClubAttendance {
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

export interface StudentTimelineItem extends ClubSchedule {
  my_attendance: ClubAttendance | null;
  is_today: boolean;
  is_active: boolean;
}

export interface StaffAttendanceRecord {
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

export interface StaffTimelineItem extends ClubSchedule {
  attendance_records: StaffAttendanceRecord[];
  is_today: boolean;
  is_active: boolean;
}

export type ClubTimelineResponse =
  | { viewer_mode: 'student'; items: StudentTimelineItem[]; timezone: string; week_start: string; week_end: string }
  | { viewer_mode: 'staff'; items: StaffTimelineItem[]; timezone: string; week_start: string; week_end: string };

export interface AttendanceConfig {
  _id: string;
  activity_id?: any;
  semester_id: any;
  criterion_id: any;
  point_per_attendance: number;
  point_per_late: number;
  max_points_per_semester?: number;
  min_attendance_for_points: number;
  auto_sync_on_approve: boolean;
  require_all_approved: boolean;
  status: string;
  created_by: any;
  createdAt: string;
}

export interface AttendanceSummary {
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

// ── Clubs API ──

export const clubApi = {
  async getAll(): Promise<Club[]> {
    const res = await httpClient(`${API_BASE}/clubs`);
    return handleResponse<Club[]>(res);
  },

  async getMyClubs(): Promise<ClubMember[]> {
    const res = await httpClient(`${API_BASE}/clubs/my`);
    return handleResponse<ClubMember[]>(res);
  },

  async getMyTransferPolicy(params: { semester_id: string }): Promise<{
    self_service_changes_used: number;
    self_service_changes_remaining: number;
    occupied_activity_id: string | null;
    first_schedule_start_time: string | null;
  }> {
    const res = await httpClient(`${API_BASE}/clubs/my/transfer-policy${buildQuery(params)}`);
    return handleResponse<{
      self_service_changes_used: number;
      self_service_changes_remaining: number;
      occupied_activity_id: string | null;
      first_schedule_start_time: string | null;
    }>(res);
  },

  async getById(id: string): Promise<Club> {
    const res = await httpClient(`${API_BASE}/clubs/${id}`);
    return handleResponse<Club>(res);
  },

  async create(data: Partial<Club>): Promise<Club> {
    const res = await httpClient(`${API_BASE}/clubs`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<Club>(res);
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

    const res = await httpClient(`${API_BASE}/clubs/media/upload`, {
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

  async update(id: string, data: Partial<Club>): Promise<Club> {
    const res = await httpClient(`${API_BASE}/clubs/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<Club>(res);
  },

  async delete(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/clubs/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  async getStats(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/clubs/${id}/stats`);
    return handleResponse(res);
  },

  // Members
  async getMembers(clubId: string, params?: { status?: string; semester_id?: string }): Promise<ClubMember[]> {
    const res = await httpClient(`${API_BASE}/clubs/${clubId}/members${buildQuery(params)}`);
    return handleResponse<ClubMember[]>(res);
  },

  async addMember(clubId: string, data: { student_id: string; role?: string; semester_id: string }): Promise<ClubMember> {
    const res = await httpClient(`${API_BASE}/clubs/${clubId}/members`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ClubMember>(res);
  },

  async joinClub(clubId: string, data: { semester_id: string }): Promise<ClubMembershipPolicyResponse> {
    const res = await httpClient(`${API_BASE}/clubs/${clubId}/join`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ClubMembershipPolicyResponse>(res);
  },

  async leaveClub(clubId: string, data: { semester_id: string }): Promise<ClubMembershipPolicyResponse> {
    const res = await httpClient(`${API_BASE}/clubs/${clubId}/leave`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ClubMembershipPolicyResponse>(res);
  },

  async switchClub(targetClubId: string, data: { semester_id: string }): Promise<ClubMembershipPolicyResponse> {
    const res = await httpClient(`${API_BASE}/clubs/${targetClubId}/switch`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ClubMembershipPolicyResponse>(res);
  },

  async adminTransferClub(targetClubId: string, data: { student_id: string; semester_id: string }): Promise<ClubMembershipPolicyResponse> {
    const res = await httpClient(`${API_BASE}/clubs/${targetClubId}/admin-transfer`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ClubMembershipPolicyResponse>(res);
  },

  async updateMember(clubId: string, memberId: string, data: any): Promise<ClubMember> {
    const res = await httpClient(`${API_BASE}/clubs/${clubId}/members/${memberId}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ClubMember>(res);
  },

  async removeMember(clubId: string, memberId: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/clubs/${clubId}/members/${memberId}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  async approveMember(clubId: string, memberId: string, data: { status: string; rejection_reason?: string }): Promise<ClubMember> {
    const res = await httpClient(`${API_BASE}/clubs/${clubId}/members/${memberId}/approve`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ClubMember>(res);
  },

  async favoriteClub(clubId: string): Promise<ClubFavoriteState> {
    const res = await httpClient(`${API_BASE}/clubs/${clubId}/favorite`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse<ClubFavoriteState>(res);
  },

  async unfavoriteClub(clubId: string): Promise<ClubFavoriteState> {
    const res = await httpClient(`${API_BASE}/clubs/${clubId}/favorite`, {
      method: 'DELETE',
    });
    return handleResponse<ClubFavoriteState>(res);
  },

  async getMyFavoriteClubIds(): Promise<string[]> {
    const res = await httpClient(`${API_BASE}/clubs/favorites/me`);
    const data = await handleResponse<{ activity_ids: string[] }>(res);
    return data.activity_ids || [];
  },
};

// ── Schedules API ──

export const clubScheduleApi = {
  async getAll(params?: any): Promise<{ items: ClubSchedule[]; total: number }> {
    const res = await httpClient(`${API_BASE}/club-schedules${buildQuery(params)}`);
    return handleResponse(res);
  },

  async getClubTimeline(clubId: string): Promise<ClubTimelineResponse> {
    const res = await httpClient(`${API_BASE}/club-schedules/club/${clubId}/timeline`);
    return handleResponse<ClubTimelineResponse>(res);
  },

  async getMySchedules(): Promise<any[]> {
    const res = await httpClient(`${API_BASE}/club-schedules/my`);
    return handleResponse(res);
  },

  async getUpcoming(params?: { activity_id?: string; limit?: number }): Promise<ClubSchedule[]> {
    const res = await httpClient(`${API_BASE}/club-schedules/upcoming${buildQuery(params)}`);
    return handleResponse<ClubSchedule[]>(res);
  },

  async getById(id: string): Promise<ClubSchedule> {
    const res = await httpClient(`${API_BASE}/club-schedules/${id}`);
    return handleResponse<ClubSchedule>(res);
  },

  async create(data: any): Promise<ClubSchedule> {
    const res = await httpClient(`${API_BASE}/club-schedules`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ClubSchedule>(res);
  },

  async update(id: string, data: any): Promise<ClubSchedule> {
    const res = await httpClient(`${API_BASE}/club-schedules/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ClubSchedule>(res);
  },

  async delete(id: string, deleteSeries?: boolean): Promise<any> {
    const url = `${API_BASE}/club-schedules/${id}${deleteSeries ? '?deleteSeries=true' : ''}`;
    const res = await httpClient(url, { method: 'DELETE' });
    return handleResponse(res);
  },

  async cancelRecurrence(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-schedules/${id}/cancel-recurrence`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse(res);
  },


  async register(id: string, clubId: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-schedules/${id}/register`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ activity_id: clubId }),
    });
    return handleResponse(res);
  },

  async cancelRegistration(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-schedules/${id}/cancel-registration`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse(res);
  },

  async getRegistrations(id: string): Promise<any[]> {
    const res = await httpClient(`${API_BASE}/club-schedules/${id}/registrations`);
    return handleResponse(res);
  },

  async markCompleted(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-schedules/${id}/complete`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({}),
    });
    return handleResponse(res);
  },
};

// ── Attendance API ──

export const clubAttendanceApi = {
  async getAll(params?: any): Promise<{ items: ClubAttendance[]; total: number }> {
    const res = await httpClient(`${API_BASE}/club-attendance${buildQuery(params)}`);
    return handleResponse(res);
  },

  async getMyAttendance(params?: { semester_id?: string; activity_id?: string }): Promise<ClubAttendance[]> {
    const res = await httpClient(`${API_BASE}/club-attendance/my${buildQuery(params)}`);
    return handleResponse<ClubAttendance[]>(res);
  },

  async getPendingCount(clubId?: string): Promise<{ count: number }> {
    const res = await httpClient(`${API_BASE}/club-attendance/pending-count${buildQuery(clubId ? { activity_id: clubId } : {})}`);
    return handleResponse(res);
  },

  async getSummary(clubId: string, semesterId: string): Promise<AttendanceSummary[]> {
    const res = await httpClient(`${API_BASE}/club-attendance/summary/${clubId}${buildQuery({ semester_id: semesterId })}`);
    return handleResponse<AttendanceSummary[]>(res);
  },

  async getById(id: string): Promise<ClubAttendance> {
    const res = await httpClient(`${API_BASE}/club-attendance/${id}`);
    return handleResponse<ClubAttendance>(res);
  },

  async create(data: any): Promise<ClubAttendance> {
    const res = await httpClient(`${API_BASE}/club-attendance`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<ClubAttendance>(res);
  },

  async batchCreate(data: {
    activity_id: string;
    schedule_id: string;
    semester_id: string;
    entries: { student_id: string; status: string; note?: string }[];
  }): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-attendance/batch`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
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

  async batchSync(clubId: string, semesterId: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-attendance/sync/${clubId}${buildQuery({ semester_id: semesterId })}`, {
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

// ── Config API ──

export const clubConfigApi = {
  async getAll(semesterId?: string): Promise<AttendanceConfig[]> {
    const res = await httpClient(`${API_BASE}/club-attendance-config${buildQuery(semesterId ? { semester_id: semesterId } : {})}`);
    return handleResponse<AttendanceConfig[]>(res);
  },

  async getByClub(clubId: string, semesterId: string): Promise<AttendanceConfig | null> {
    const res = await httpClient(`${API_BASE}/club-attendance-config/club/${clubId}${buildQuery({ semester_id: semesterId })}`);
    return handleResponse(res);
  },

  async getById(id: string): Promise<AttendanceConfig> {
    const res = await httpClient(`${API_BASE}/club-attendance-config/${id}`);
    return handleResponse<AttendanceConfig>(res);
  },

  async create(data: any): Promise<AttendanceConfig> {
    const res = await httpClient(`${API_BASE}/club-attendance-config`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<AttendanceConfig>(res);
  },

  async update(id: string, data: any): Promise<AttendanceConfig> {
    const res = await httpClient(`${API_BASE}/club-attendance-config/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    return handleResponse<AttendanceConfig>(res);
  },

  async delete(id: string): Promise<any> {
    const res = await httpClient(`${API_BASE}/club-attendance-config/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },
};

// ── Attendance Sessions API (Universal) ──

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
