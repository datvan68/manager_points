import { httpClient, handleResponse } from './http-client';
import { API_BASE } from './config';

// ── Type Definitions ──

export interface Building {
  _id: string;
  ma_toa_nha: string;
  ten: string;
  dia_chi?: string;
  so_tang: number;
  trang_thai: 'Active' | 'Inactive' | 'Maintenance';
  mo_ta?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Room {
  _id: string;
  ma_phong: string;
  building_id: Building | string;
  tang: number;
  loai_phong: string;
  so_giuong: number;
  so_giuong_trong: number;
  gia_phong: number;
  trang_thai: 'Trống' | 'Đầy' | 'Khóa' | 'Bảo trì';
  tien_ich: string[];
  ma_qr: string;
  url_xem_nhanh: string;
  mo_ta?: string;
  createdAt?: string;
}

export interface Bed {
  _id: string;
  ma_giuong: string;
  room_id: Room | string;
  vi_tri?: string;
  trang_thai: 'Trống' | 'Đang sử dụng' | 'Bảo trì';
}

export interface DormRegistration {
  _id: string;
  ma_dk: string;
  student_id: any;
  ky_hoc: string;
  nam_hoc: string;
  nguyen_vong?: {
    loai_phong?: string;
    building_id?: string;
    ghi_chu?: string;
  };
  doi_tuong_uu_tien: string;
  trang_thai: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';
  ly_do_tu_choi?: string;
  nguoi_duyet_id?: any;
  ngay_duyet?: string;
  createdAt?: string;
  source?: 'FORMAL' | 'PUBLIC';
  classification_status?: 'CLASSIFIED' | 'MISSING_CLASS' | 'UNCLASSIFIED';
  public_registration?: any;
}

export interface CreateDormRegistrationInput {
  student_id: string;
  ky_hoc: string;
  nam_hoc: string;
  nguyen_vong?: {
    loai_phong?: string;
    building_id?: string;
    ghi_chu?: string;
  };
  doi_tuong_uu_tien?: 'Chính sách' | 'Xa nhà' | 'Học lực giỏi' | 'Không';
}

export interface UnclassifiedRegistration {
  _id: string;
  ma_dk_public: string;
  ho_ten: string;
  so_dien_thoai: string;
  email?: string;
  ma_sinh_vien?: string;
  ma_phong?: string;
  ten_toa_nha?: string;
  loai_phong?: string;
  ky_hoc?: string;
  nam_hoc?: string;
  trang_thai: string;
  source: 'PUBLIC';
  classification_status: 'UNCLASSIFIED';
}

export interface DormContract {
  _id: string;
  ma_hd: string;
  student_id: any;
  bed_id: any;
  room_id: any;
  registration_id?: any;
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
  trang_thai: 'Hiệu lực' | 'Hết hạn' | 'Đã hủy';
  ly_do_huy?: string;
  createdAt?: string;
}

export interface DormInvoice {
  _id: string;
  ma_hoa_don: string;
  contract_id: any;
  student_id: any;
  ky_thu: string;
  chi_tiet: { loai: string; mo_ta?: string; so_tien: number }[];
  tong_tien: number;
  trang_thai: 'Chưa thanh toán' | 'Đã thanh toán' | 'Quá hạn';
  han_thanh_toan: string;
  ngay_thanh_toan?: string;
  phuong_thuc?: string;
  nguoi_xac_nhan_id?: any;
  ghi_chu?: string;
  createdAt?: string;
}

export interface DormViolation {
  _id: string;
  ma_vp: string;
  student_id: any;
  room_id?: any;
  loai_vi_pham: string;
  muc_do: 'Nhẹ' | 'Trung bình' | 'Nghiêm trọng';
  diem_tru: number;
  ngay_ghi_nhan: string;
  mo_ta?: string;
  minh_chung?: string[];
  hinh_thuc_xu_ly: string;
  trang_thai: 'Mới' | 'Đã xử lý' | 'Đang xét';
  nguoi_ghi_nhan_id?: any;
  nguoi_xu_ly_id?: any;
  ghi_chu_xu_ly?: string;
  createdAt?: string;
}

export interface DormMaintenance {
  _id: string;
  ma_ycbt: string;
  room_id: any;
  student_id?: any;
  loai_su_co: string;
  mo_ta: string;
  hinh_anh?: string[];
  trang_thai: 'Mới' | 'Đang xử lý' | 'Hoàn tất' | 'Từ chối';
  do_uu_tien: string;
  ky_thuat_vien_id?: any;
  ghi_chu_xu_ly?: string;
  ngay_hoan_tat?: string;
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
    async updateStatus(id: string, trang_thai: string): Promise<Bed> {
      const res = await httpClient(`${API_BASE}/dormitory/beds/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trang_thai }),
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
    async approve(id: string, dto: { trang_thai: string; ly_do_tu_choi?: string }): Promise<DormRegistration> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async bulkApprove(dto: { registration_ids: string[]; trang_thai: string; ly_do_tu_choi?: string }): Promise<{ success: number; failed: number }> {
      const res = await httpClient(`${API_BASE}/dormitory/registrations/bulk-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async assignRoom(dto: { registration_id: string; room_id: string; bed_id: string }): Promise<any> {
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
    async cancel(id: string, ly_do_huy: string): Promise<DormContract> {
      const res = await httpClient(`${API_BASE}/dormitory/contracts/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ly_do_huy }),
      });
      return handleResponse(res);
    },
    async extend(id: string, ngay_ket_thuc: string): Promise<DormContract> {
      const res = await httpClient(`${API_BASE}/dormitory/contracts/${id}/extend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ngay_ket_thuc }),
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
    async bulkCreate(dto: { ky_thu: string; han_thanh_toan: string }): Promise<{ created: number; skipped: number }> {
      const res = await httpClient(`${API_BASE}/dormitory/invoices/bulk-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      return handleResponse(res);
    },
    async pay(id: string, dto: { phuong_thuc: string; ghi_chu?: string }): Promise<DormInvoice> {
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
    async handle(id: string, dto: { hinh_thuc_xu_ly: string; ghi_chu_xu_ly?: string }): Promise<DormViolation> {
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
    async getRevenueReport(ky_thu?: string): Promise<any> {
      const res = await httpClient(`${API_BASE}/dormitory/reports/revenue${buildQuery({ ky_thu })}`);
      return handleResponse(res);
    },
    async getViolationMaintenanceReport(): Promise<any> {
      const res = await httpClient(`${API_BASE}/dormitory/reports/violations-maintenance`);
      return handleResponse(res);
    },
  },

  // ── Public (QR) ──
  public: {
    async getRoomByQr(qrId: string): Promise<any> {
      const res = await fetch(`${API_BASE}/dormitory/public/room/${qrId}`);
      return handleResponse(res);
    },
  },
};
