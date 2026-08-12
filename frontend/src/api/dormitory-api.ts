import { httpClient, handleResponse } from './http-client';
import { API_BASE } from './config';

// ── Type Definitions ──

export interface Building {
  _id: string;
  building_code: string;
  name: string;
  address?: string;
  status: 'Active' | 'Inactive' | 'Maintenance';
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
  status: 'Trống' | 'Đang sử dụng' | 'Bảo trì';
}

export interface DormRegistration {
  _id: string;
  registration_code: string;
  student_id: any;
  room_id?: Room | string;
  bed_id?: Bed | string;
  semester: string;
  academic_year: string;
  preference?: {
    room_type?: string;
    building_id?: string;
    notes?: string;
  };
  priority_group: string;
  status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';
  rejection_reason?: string;
  reviewed_by_id?: any;
  reviewed_at?: string;
  createdAt?: string;
  source?: 'FORMAL' | 'PUBLIC' | 'ADMIN_TEMPORARY';
  classification_status?: 'CLASSIFIED' | 'MISSING_CLASS' | 'UNCLASSIFIED';
  public_registration?: any;
  date_of_birth?: string;
  gender?: 'Male' | 'Female' | 'Other';
  phone_number?: string;
  assigned_room_name?: string;
  active_contract_id?: string;
}

export type DormRegistrationSource = 'FORMAL' | 'PUBLIC' | 'ADMIN_TEMPORARY';

export interface UpdateDormRegistrationInput {
  semester?: string;
  academic_year?: string;
  date_of_birth?: string;
  gender?: 'Male' | 'Female' | 'Other';
  phone_number?: string;
  preference?: {
    room_type?: string;
    building_id?: string;
    notes?: string;
  };
  priority_group?: 'Chính sách' | 'Xa nhà' | 'Học lực giỏi' | 'Khó khăn' | 'Không';
  full_name?: string;
  student_code?: string;
  room_type?: 'Thường' | 'Máy lạnh';
  notes?: string;
}

export interface CreateDormRegistrationInput {
  student_id: string;
  semester: string;
  academic_year: string;
  date_of_birth: string;
  gender: 'Male' | 'Female' | 'Other';
  phone_number: string;
  preference?: {
    room_type?: string;
    building_id?: string;
    notes?: string;
  };
  priority_group?: 'Chính sách' | 'Xa nhà' | 'Học lực giỏi' | 'Khó khăn' | 'Không';
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
}

export interface UnclassifiedRegistration {
  _id: string;
  public_registration_code: string;
  full_name: string;
  phone_number: string;
  email?: string;
  student_code?: string;
  room_code?: string;
  building_name?: string;
  room_type?: string;
  semester?: string;
  academic_year?: string;
  status: string;
  source: 'PUBLIC' | 'ADMIN_TEMPORARY';
  classification_status: 'UNCLASSIFIED';
}

export interface DormContract {
  _id: string;
  contract_code: string;
  student_id: any;
  bed_id: any;
  room_id: any;
  registration_id?: any;
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

export interface DormDashboardStats {
  total_rooms: number;
  available_rooms: number;
  active_contracts: number;
  pending_registrations: number;
  unpaid_invoices: number;
  pending_maintenance: number;
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

  // ── Registrations ──
  registrations: {
    async getAll(params?: QueryParams): Promise<PaginatedResponse<DormRegistration>> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations${buildQuery(params)}`);
      return handleResponse(res);
    },
    async getUnclassified(params?: QueryParams): Promise<PaginatedResponse<UnclassifiedRegistration>> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/unclassified${buildQuery(params)}`);
      return handleResponse(res);
    },
    async getOne(id: string): Promise<DormRegistration> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/${id}`);
      return handleResponse(res);
    },
    async create(dto: CreateDormRegistrationInput): Promise<DormRegistration> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async createTemporary(dto: { full_name: string; date_of_birth: string; gender: 'Male' | 'Female' | 'Other'; phone_number: string; room_type?: 'Thường' | 'Máy lạnh'; notes?: string }): Promise<any> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/temporary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dto) });
      return handleResponse(res);
    },
    async update(id: string, source: DormRegistrationSource, dto: UpdateDormRegistrationInput): Promise<DormRegistration> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/${id}${buildQuery({ source })}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async delete(id: string, source: DormRegistrationSource): Promise<{ success: boolean; id: string; source: DormRegistrationSource }> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/${id}${buildQuery({ source })}`, { method: 'DELETE' });
      return handleResponse(res);
    },
    async approve(id: string, dto: { status: string; rejection_reason?: string }): Promise<DormRegistration> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async bulkApprove(dto: { registration_ids: string[]; status: string; rejection_reason?: string }): Promise<{ success: number; failed: number }> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/bulk-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async assignRoom(dto: { registration_id: string; room_id: string; bed_id: string }): Promise<{ registration?: DormRegistration; room?: Room; bed?: Bed; active_contract_id?: string; message?: string }> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/assign-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async suggestRooms(registrationId: string): Promise<Room[]> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/${registrationId}/suggest-rooms`);
      return handleResponse(res);
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
    async register(dto: PublicDormitoryRegistrationInput): Promise<{ success: boolean; registration_code?: string; code?: string; message: string }> {
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
