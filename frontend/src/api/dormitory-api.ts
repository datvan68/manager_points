import { httpClient, handleResponse } from './http-client';
import { API_BASE } from './config';
import { pdfTemplateApi } from './pdf-template-api';

// ── Type Definitions ──

export interface Building {
  _id: string;
  building_code: string;
  name: string;
  address?: string;
  status: 'Trống' | 'Đầy';
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Room {
  _id: string;
  room_code: string;
  room_name?: string;
  building_id: Building | string;
  room_type: string;
  bed_count: number;
  max_students: number;
  physical_capacity?: number;
  assignable_capacity?: number;
  occupied_count?: number;
  maintenance_count?: number;
  current_students: number;
  available_bed_count: number;
  room_price: number;
  status: 'Trống' | 'Đầy' | 'Khóa' | 'Bảo trì';
  amenities: string[];
  qr_code: string;
  public_url: string;
  description?: string;
  createdAt?: string;
}

export interface Bed {
  _id: string;
  bed_code: string;
  room_id: Room | string;
  position?: string;
  status: 'Trống' | 'Đang sử dụng' | 'Bảo trì' | 'Đã nghỉ';
  has_history?: boolean;
}

export interface DormitoryRosterEntry {
  _id: string;
  roster_entry_code: string;
  student_id?: any;
  full_name?: string;
  student_code?: string;
  room_id?: Room | string | null;
  bed_id?: Bed | string | null;
  semester: string;
  academic_year: string;
  semester_id?: string;
  room_type?: 'Thường' | 'Máy lạnh';
  notes?: string;
  date_of_birth?: string;
  gender?: 'Male' | 'Female' | 'Other';
  phone_number?: string;
  applicant_profile?: ApplicantProfile;
  identity_state?: 'LINKED' | 'UNLINKED' | 'CONFLICT';
  createdAt?: string;
  assigned_room_name?: string;
  active_contract_id?: string;
  active_contract?: DormContract | null;
  editable_fields?: string[];
  full_name_normalized?: string;
}

export interface ParentApplicantProfile {
  full_name?: string; age?: string | number; permanent_address?: string; contact_address?: string; occupation?: string; phone_number?: string;
}
export interface ApplicantProfile {
  ethnicity?: string; religion?: string; citizen_id_number?: string; citizen_id_issue_date?: string; citizen_id_issue_place?: string; permanent_address?: string;
  priority_certificate_details?: string; father?: ParentApplicantProfile; mother?: ParentApplicantProfile;
}
export interface SelfDormitoryRosterResponse {
  has_dormitory_roster: boolean;
  roster_entry: DormitoryRosterEntry | null;
  history: Array<Pick<DormitoryRosterEntry, '_id' | 'roster_entry_code' | 'semester' | 'academic_year' | 'createdAt'>>;
  editable_fields?: string[];
}

export interface CreateDormitoryRosterEntryInput {
  student_id?: string;
  full_name?: string;
  date_of_birth?: string;
  gender?: 'Male' | 'Female' | 'Other';
  phone_number: string;
  student_code?: string;
  room_type: 'Thường' | 'Máy lạnh';
  notes?: string;
  applicant_profile?: ApplicantProfile;
}

export interface PublicDormitorySemester {
  semester_name: string;
  semester: string;
  academic_year: string;
}

export interface PublicDormitoryRegistrationInput {
  full_name: string;
  student_code?: string;
  date_of_birth: string;
  gender: 'Male' | 'Female' | 'Other';
  phone_number: string;
  room_type?: 'Thường' | 'Máy lạnh';
  notes?: string;
  qr_room_id?: string;
  applicant_profile?: ApplicantProfile;
}

export type UpdateDormitoryRosterEntryInput = Partial<CreateDormitoryRosterEntryInput>;

export interface DormContract {
  _id: string;
  contract_code: string;
  student_id: any;
  bed_id: any;
  room_id: any;
  roster_entry_id?: any;
  start_date: string;
  end_date: string;
  status: 'Hiệu lực' | 'Hết hạn' | 'Đã hủy';
  cancellation_reason?: string;
  createdAt?: string;
}

export interface DormInvoice {
  _id: string;
  invoice_code: string;
  contract_id: any;
  student_id: any;
  billing_period: string;
  items: { type: string; description?: string; amount: number }[];
  total_amount: number;
  status: 'Chưa thanh toán' | 'Đã thanh toán' | 'Quá hạn';
  due_date: string;
  paid_at?: string;
  payment_method?: string;
  confirmed_by_id?: any;
  notes?: string;
  createdAt?: string;
}

export interface DormViolation {
  _id: string;
  violation_code: string;
  student_id: any;
  room_id?: any;
  violation_type: string;
  severity: 'Nhẹ' | 'Trung bình' | 'Nghiêm trọng';
  deducted_points: number;
  recorded_at: string;
  description?: string;
  evidence?: string[];
  resolution_type: string;
  status: 'Mới' | 'Đã xử lý' | 'Đang xét';
  recorded_by_id?: any;
  resolved_by_id?: any;
  resolution_notes?: string;
  createdAt?: string;
}

export interface DormMaintenance {
  _id: string;
  request_code: string;
  room_id: any;
  student_id?: any;
  issue_type: string;
  description: string;
  images?: string[];
  status: 'Mới' | 'Đang xử lý' | 'Hoàn tất' | 'Từ chối';
  priority: string;
  technician_id?: any;
  resolution_notes?: string;
  completed_at?: string;
  createdAt?: string;
}

export type DormitoryRoomType = 'Thường' | 'Máy lạnh' | 'Chưa xác định';
export type DormitoryRoomState = 'Trống' | 'Còn chỗ' | 'Đầy' | 'Bảo trì' | 'Khóa' | 'Chưa cấu hình';

export interface DormitoryRoomSummary {
  total_rooms: number;
  total_beds: number;
  occupied_beds: number;
  free_beds: number;
  by_type: { thuong: number; may_lanh: number; unknown: number };
  by_state: {
    trong: number;
    con_cho: number;
    day: number;
    bao_tri: number;
    khoa: number;
    chua_cau_hinh: number;
  };
}

export interface DormitoryRoomMember {
  full_name: string;
  class_name: string;
}

export interface DormitoryRoomRow {
  room_id: string;
  room_code: string;
  room_name: string;
  building_id?: string | null;
  building_code: string;
  building_name: string;
  room_type: DormitoryRoomType;
  total_beds: number;
  occupied_beds: number;
  free_beds: number;
  state: DormitoryRoomState;
  members?: DormitoryRoomMember[];
}

export interface DormitoryRegistrationSummary {
  total: number;
  assigned: number;
  male: number;
  female: number;
  unlinked: number;
  unassigned: number;
  requested_room_type: { thuong: number; may_lanh: number; unknown: number };
}

export interface DormitoryInvoiceDebtRow {
  room_id: string;
  room_code: string;
  room_name: string;
  building_name: string;
  debtor_count: number;
  unpaid_count: number;
  overdue_count: number;
  total_outstanding_amount: number;
}

export interface DormitoryInvoiceSummary {
  outstanding_invoice_count: number;
  unpaid_count: number;
  overdue_count: number;
  total_outstanding_amount: number;
  anomaly_amount: number;
  anomaly_count: number;
  rows: DormitoryInvoiceDebtRow[];
}

export interface DormDashboardStats {
  total_rooms: number;
  available_rooms: number;
  active_contracts: number;
  pending_registrations: number;
  unpaid_invoices: number;
  pending_maintenance: number;
  rooms: { occupied: number; available: number; air_conditioned: number; standard: number };
  beds: { used: number; free: number };
  students: { registered: number; residing: number };
  dormitory_fees: { paid: number; unpaid: number };
  utilities: { paid: number; unpaid: number };
  monthly: Array<{ month: string; registrations: number; move_ins: number; dormitory_fee_paid: number; dormitory_fee_unpaid: number; utility_paid: number; utility_unpaid: number }>;
  room_summary: DormitoryRoomSummary;
  room_rows: DormitoryRoomRow[];
  registration_summary: DormitoryRegistrationSummary;
  invoice_summary: DormitoryInvoiceSummary;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type QueryParams = Record<string, string | number | undefined>;

// ── Helper ──
function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value));
    }
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

// ── API Client ──

export const dormitoryApi = {
  pdfTemplates: {
    catalog: () => pdfTemplateApi.catalog(),
    metadata: (templateTypeCode: string) => pdfTemplateApi.metadata(templateTypeCode),
    source: (templateTypeCode: string) => pdfTemplateApi.source(templateTypeCode),
    preview: (templateTypeCode: string, layout: any, fixture = 'short', source?: File) => pdfTemplateApi.preview(templateTypeCode, layout, fixture, source),
    save: (templateTypeCode: string, version: number, layout: any, source?: File) => pdfTemplateApi.save(templateTypeCode, version, layout, source),
  },
  // ── Buildings ──
  buildings: {
    async getAll(params?: QueryParams): Promise<PaginatedResponse<Building>> {
      const res = await httpClient(`${API_BASE}/dormitory/buildings${buildQuery(params)}`);
      return handleResponse(res);
    },
    async getOne(id: string): Promise<Building> {
      const res = await httpClient(`${API_BASE}/dormitory/buildings/${id}`);
      return handleResponse(res);
    },
    async create(dto: Partial<Building>): Promise<Building> {
      const res = await httpClient(`${API_BASE}/dormitory/buildings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async update(id: string, dto: Partial<Building>): Promise<Building> {
      const res = await httpClient(`${API_BASE}/dormitory/buildings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async delete(id: string): Promise<Building> {
      const res = await httpClient(`${API_BASE}/dormitory/buildings/${id}`, { method: 'DELETE' });
      return handleResponse(res);
    },
  },

  // ── Rooms ──
  rooms: {
    async getAll(params?: QueryParams): Promise<PaginatedResponse<Room>> {
      const res = await httpClient(`${API_BASE}/dormitory/rooms${buildQuery(params)}`);
      return handleResponse(res);
    },
    async getOne(id: string): Promise<Room> {
      const res = await httpClient(`${API_BASE}/dormitory/rooms/${id}`);
      return handleResponse(res);
    },
    async create(dto: Partial<Room>): Promise<Room> {
      const res = await httpClient(`${API_BASE}/dormitory/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async update(id: string, dto: Partial<Room>): Promise<Room> {
      const res = await httpClient(`${API_BASE}/dormitory/rooms/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async delete(id: string): Promise<Room> {
      const res = await httpClient(`${API_BASE}/dormitory/rooms/${id}`, { method: 'DELETE' });
      return handleResponse(res);
    },
  },

  // ── Beds ──
  beds: {
    async getByRoom(roomId: string): Promise<Bed[]> {
      const res = await httpClient(`${API_BASE}/dormitory/beds/room/${roomId}`);
      return handleResponse(res);
    },
    async create(dto: Partial<Bed>): Promise<Bed> {
      const res = await httpClient(`${API_BASE}/dormitory/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async autoCreate(roomId: string, count: number): Promise<Bed[]> {
      const res = await httpClient(`${API_BASE}/dormitory/beds/auto-create/${roomId}/${count}`, {
        method: 'POST',
      });
      return handleResponse(res);
    },
    async updateStatus(id: string, status: string): Promise<Bed> {
      const res = await httpClient(`${API_BASE}/dormitory/beds/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return handleResponse(res);
    },
    async delete(id: string): Promise<Bed> {
      const res = await httpClient(`${API_BASE}/dormitory/beds/${id}`, { method: 'DELETE' });
      return handleResponse(res);
    },
  },

  // ── Canonical dormitory roster ──
  roster: {
    async getMine(): Promise<SelfDormitoryRosterResponse> {
      const res = await httpClient(`${API_BASE}/dormitory/roster/me`);
      return handleResponse(res);
    },
    async getByStudent(studentId: string): Promise<SelfDormitoryRosterResponse> {
      const res = await httpClient(`${API_BASE}/dormitory/roster/student/${studentId}`);
      return handleResponse(res);
    },
    async updateMine(dto: Pick<UpdateDormitoryRosterEntryInput, 'phone_number' | 'notes' | 'applicant_profile'>): Promise<SelfDormitoryRosterResponse> {
      const res = await httpClient(`${API_BASE}/dormitory/roster/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
      return handleResponse(res);
    },
    async getAll(params?: QueryParams): Promise<PaginatedResponse<DormitoryRosterEntry>> {
      const res = await httpClient(`${API_BASE}/dormitory/roster${buildQuery(params)}`);
      return handleResponse(res);
    },
    async getOne(id: string): Promise<DormitoryRosterEntry> {
      const res = await httpClient(`${API_BASE}/dormitory/roster/${id}`);
      return handleResponse(res);
    },
    async create(dto: CreateDormitoryRosterEntryInput): Promise<DormitoryRosterEntry> {
      const res = await httpClient(`${API_BASE}/dormitory/roster`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
      return handleResponse(res);
    },
    async update(id: string, dto: UpdateDormitoryRosterEntryInput): Promise<DormitoryRosterEntry> {
      const res = await httpClient(`${API_BASE}/dormitory/roster/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
      return handleResponse(res);
    },
    async delete(id: string): Promise<{ success: boolean; id: string }> {
      const res = await httpClient(`${API_BASE}/dormitory/roster/${id}`, { method: 'DELETE' });
      return handleResponse(res);
    },
    async assignRoom(dto: { roster_entry_id: string; room_id: string; bed_id: string }): Promise<{ roster_entry?: DormitoryRosterEntry; room?: Room; bed?: Bed; active_contract_id?: string; message?: string }> {
      const res = await httpClient(`${API_BASE}/dormitory/roster/assign-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
      return handleResponse(res);
    },
    async unassignRoom(roster_entry_id: string): Promise<{ roster_entry?: DormitoryRosterEntry; room?: Room | null; bed?: Bed; message?: string }> {
      const res = await httpClient(`${API_BASE}/dormitory/roster/unassign-room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roster_entry_id }) });
      return handleResponse(res);
    },
    async suggestRooms(id: string): Promise<Room[]> {
      const res = await httpClient(`${API_BASE}/dormitory/roster/${id}/suggest-rooms`);
      return handleResponse(res);
    },
    async getApplicationPdf(id: string, disposition: 'inline' | 'attachment' = 'inline'): Promise<Blob> {
      const res = await httpClient(`${API_BASE}/dormitory/roster/${encodeURIComponent(id)}/application-pdf${buildQuery({ disposition })}`);
      if (!res.ok) return handleResponse(res);
      return res.blob();
    },
  },

  // ── Contracts ──
  contracts: {
    async getAll(params?: QueryParams): Promise<PaginatedResponse<DormContract>> {
      const res = await httpClient(`${API_BASE}/dormitory/contracts${buildQuery(params)}`);
      return handleResponse(res);
    },
    async getOne(id: string): Promise<DormContract> {
      const res = await httpClient(`${API_BASE}/dormitory/contracts/${id}`);
      return handleResponse(res);
    },
    async create(dto: any): Promise<DormContract> {
      const res = await httpClient(`${API_BASE}/dormitory/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async cancel(id: string, cancellation_reason: string): Promise<DormContract> {
      const res = await httpClient(`${API_BASE}/dormitory/contracts/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancellation_reason }),
      });
      return handleResponse(res);
    },
    async extend(id: string, end_date: string): Promise<DormContract> {
      const res = await httpClient(`${API_BASE}/dormitory/contracts/${id}/extend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ end_date }),
      });
      return handleResponse(res);
    },
    async transfer(dto: { contract_id: string; new_room_id: string; new_bed_id: string; ly_do?: string }): Promise<any> {
      const res = await httpClient(`${API_BASE}/dormitory/contracts/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
  },

  // ── Invoices ──
  invoices: {
    async getAll(params?: QueryParams): Promise<PaginatedResponse<DormInvoice>> {
      const res = await httpClient(`${API_BASE}/dormitory/invoices${buildQuery(params)}`);
      return handleResponse(res);
    },
    async getOne(id: string): Promise<DormInvoice> {
      const res = await httpClient(`${API_BASE}/dormitory/invoices/${id}`);
      return handleResponse(res);
    },
    async create(dto: any): Promise<DormInvoice> {
      const res = await httpClient(`${API_BASE}/dormitory/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async bulkCreate(dto: { billing_period: string; due_date: string }): Promise<{ created: number; skipped: number }> {
      const res = await httpClient(`${API_BASE}/dormitory/invoices/bulk-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async pay(id: string, dto: { payment_method: string; notes?: string }): Promise<DormInvoice> {
      const res = await httpClient(`${API_BASE}/dormitory/invoices/${id}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async getOverdueSummary(): Promise<any> {
      const res = await httpClient(`${API_BASE}/dormitory/invoices/overdue-summary`);
      return handleResponse(res);
    },
  },

  // ── Violations ──
  violations: {
    async getAll(params?: QueryParams): Promise<PaginatedResponse<DormViolation>> {
      const res = await httpClient(`${API_BASE}/dormitory/violations${buildQuery(params)}`);
      return handleResponse(res);
    },
    async getOne(id: string): Promise<DormViolation> {
      const res = await httpClient(`${API_BASE}/dormitory/violations/${id}`);
      return handleResponse(res);
    },
    async create(dto: any): Promise<{ violation: DormViolation; threshold_exceeded: boolean }> {
      const res = await httpClient(`${API_BASE}/dormitory/violations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async handle(id: string, dto: { resolution_type: string; resolution_notes?: string }): Promise<DormViolation> {
      const res = await httpClient(`${API_BASE}/dormitory/violations/${id}/handle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async getStudentSummary(studentId: string): Promise<any> {
      const res = await httpClient(`${API_BASE}/dormitory/violations/student/${studentId}/summary`);
      return handleResponse(res);
    },
  },

  // ── Maintenance ──
  maintenance: {
    async getAll(params?: QueryParams): Promise<PaginatedResponse<DormMaintenance>> {
      const res = await httpClient(`${API_BASE}/dormitory/maintenance${buildQuery(params)}`);
      return handleResponse(res);
    },
    async getOne(id: string): Promise<DormMaintenance> {
      const res = await httpClient(`${API_BASE}/dormitory/maintenance/${id}`);
      return handleResponse(res);
    },
    async create(dto: any): Promise<DormMaintenance> {
      const res = await httpClient(`${API_BASE}/dormitory/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async handle(id: string, dto: any): Promise<DormMaintenance> {
      const res = await httpClient(`${API_BASE}/dormitory/maintenance/${id}/handle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
  },

  // ── Reports ──
  reports: {
    async getDashboardStats(): Promise<DormDashboardStats> {
      const res = await httpClient(`${API_BASE}/dormitory/reports/dashboard`);
      return handleResponse(res);
    },
    async getOccupancyReport(): Promise<any> {
      const res = await httpClient(`${API_BASE}/dormitory/reports/occupancy`);
      return handleResponse(res);
    },
    async getRevenueReport(billing_period?: string): Promise<any> {
      const res = await httpClient(`${API_BASE}/dormitory/reports/revenue${buildQuery({ billing_period })}`);
      return handleResponse(res);
    },
    async getViolationMaintenanceReport(): Promise<any> {
      const res = await httpClient(`${API_BASE}/dormitory/reports/violations-maintenance`);
      return handleResponse(res);
    },
  },

  // ── Public (QR) ──
  public: {
    async getActiveSemester(): Promise<PublicDormitorySemester> {
      const res = await httpClient(`${API_BASE}/dormitory/public/semester`);
      return handleResponse(res);
    },
    async register(dto: PublicDormitoryRegistrationInput): Promise<{ success: boolean; roster_entry_code?: string; message: string }> {
      const res = await httpClient(`${API_BASE}/dormitory/public/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async getRoomByQr(qrId: string): Promise<any> {
      const res = await fetch(`${API_BASE}/dormitory/public/room/${qrId}`);
      return handleResponse(res);
    },
  },
};
