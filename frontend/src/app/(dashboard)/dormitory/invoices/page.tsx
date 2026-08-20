'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  CheckCircle,
  Plus,
  SlidersHorizontal,
  FileText,
  X,
  Upload,
  AlertCircle,
  Eye,
  Zap,
  Droplets,
  Calendar as CalendarIcon,
  Users,
  DollarSign,
  Settings,
  LayoutGrid,
  LayoutList,
  RefreshCw,
} from 'lucide-react';
import {
  dormitoryApi,
  DormInvoice,
  Room,
  CreateMonthlyInvoiceInput,
  UpdateMonthlyInvoiceInput,
  UtilityConfig,
  UpdateUtilityConfigInput,
} from '@/api/dormitory-api';
import { toast } from 'sonner';
import { CustomPagination } from '@/components/ui/pagination';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Research } from '@/components/ui/Research';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Helper format tiền tệ
function formatMoney(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0đ';
  return `${Number(amount).toLocaleString('vi-VN')}đ`;
}

// Helper format kỳ thu
function formatBillingMonth(billingMonth?: string, billingPeriod?: string): string {
  if (billingMonth && /^\d{4}-\d{2}$/.test(billingMonth)) {
    const [year, month] = billingMonth.split('-');
    return `${month}/${year}`;
  }
  if (billingPeriod) {
    const match = /^T(\d{2})\/(\d{4})$/.exec(billingPeriod);
    if (match) return `${match[1]}/${match[2]}`;
    return billingPeriod;
  }
  return '—';
}

// Helper format ngày
function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN');
  } catch {
    return '—';
  }
}

// Helper chuyển Date sang YYYY-MM-DD
function toDateValue(date: Date | null | string): string {
  if (!date) return '';
  if (typeof date === 'string') return date;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Chuẩn hóa trạng thái hiển thị (chỉ có Chưa thu hoặc Đã thu)
function getDisplayStatus(status?: string): 'Chưa thu' | 'Đã thu' {
  if (status === 'Đã thu' || status === 'Đã thanh toán') return 'Đã thu';
  return 'Chưa thu';
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<DormInvoice[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'Tất cả' | 'Chưa thu' | 'Đã thu'>('Tất cả');
  const [filterMonth, setFilterMonth] = useState('');
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState<any>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // View mode: 'table' hoặc 'cards'
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Popover calendar cho bộ lọc toolbar
  const [calendarFilterOpen, setCalendarFilterOpen] = useState(false);

  // Popover calendar cho Modal Nâng cao
  const [readingDateCalendarOpen, setReadingDateCalendarOpen] = useState(false);
  const [startDateCalendarOpen, setStartDateCalendarOpen] = useState(false);
  const [dueDateCalendarOpen, setDueDateCalendarOpen] = useState(false);

  // Modal Cấu hình dùng chung (Định mức, đơn giá, số ngày thu)
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSubmitting, setConfigSubmitting] = useState(false);
  const [configForm, setConfigForm] = useState<UpdateUtilityConfigInput>({
    electricity: {
      quota_per_person: 15,
      unit_price: 2500,
      unit: 'kWh',
    },
    water: {
      quota_per_person: 4,
      unit_price: 10000,
      unit: 'm³',
    },
    configured_collection_days: 10,
  });

  async function openConfigModal() {
    try {
      setConfigLoading(true);
      setConfigModalOpen(true);
      const cfg = await dormitoryApi.invoices.getConfig();
      if (cfg) {
        setConfigForm({
          electricity: {
            quota_per_person: cfg.electricity?.quota_per_person ?? 15,
            unit_price: cfg.electricity?.unit_price ?? 2500,
            unit: cfg.electricity?.unit || 'kWh',
          },
          water: {
            quota_per_person: cfg.water?.quota_per_person ?? 4,
            unit_price: cfg.water?.unit_price ?? 10000,
            unit: cfg.water?.unit || 'm³',
          },
          configured_collection_days: cfg.configured_collection_days ?? 10,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải cấu hình');
    } finally {
      setConfigLoading(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (configForm.configured_collection_days < 1) {
      toast.error('Số ngày thu tự động phải lớn hơn hoặc bằng 1');
      return;
    }
    try {
      setConfigSubmitting(true);
      await dormitoryApi.invoices.updateConfig(configForm);
      toast.success('Cập nhật cấu hình định mức & đơn giá thành công');
      setConfigModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi lưu cấu hình');
    } finally {
      setConfigSubmitting(false);
    }
  }

  // Modal Nâng cao (Tạo / Sửa đợt thu phòng)
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<DormInvoice | null>(null);
  const [roomLoading, setRoomLoading] = useState(false);
  const [advancedSubmitting, setAdvancedSubmitting] = useState(false);

  const defaultMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const defaultReadingDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  }, []);

  const [advancedForm, setAdvancedForm] = useState({
    room_id: '',
    billing_month: defaultMonth,
    reading_date: defaultReadingDate,
    occupant_count: 0,
    electricity: {
      previous_reading: 0,
      current_reading: 0,
      quota_per_person: 15,
      unit_price: 2500,
    },
    water: {
      previous_reading: 0,
      current_reading: 0,
      quota_per_person: 4,
      unit_price: 10000,
    },
    payment_start_date: defaultReadingDate,
    due_date: defaultDueDate,
    is_exempt: false,
    notes: '',
  });

  // Modal Thu tiền (Xác nhận thanh toán kèm upload chứng từ)
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<DormInvoice | null>(null);
  const [payMethod, setPayMethod] = useState<'Tiền mặt' | 'Chuyển khoản' | 'Cổng thanh toán'>('Chuyển khoản');
  const [payNotes, setPayNotes] = useState('');
  const [payProofFile, setPayProofFile] = useState<File | null>(null);
  const [payProofPreview, setPayProofPreview] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Modal Xem & Cập nhật chứng từ thanh toán (Kiểm tra)
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<DormInvoice | null>(null);
  const [updateProofFile, setUpdateProofFile] = useState<File | null>(null);
  const [updateProofPreview, setUpdateProofPreview] = useState<string | null>(null);
  const [updateProofNotes, setUpdateProofNotes] = useState('');
  const [updateProofMethod, setUpdateProofMethod] = useState<'Tiền mặt' | 'Chuyển khoản' | 'Cổng thanh toán'>('Chuyển khoản');
  const [updateProofSubmitting, setUpdateProofSubmitting] = useState(false);
  const updateProofInputRef = useRef<HTMLInputElement>(null);

  // Load danh sách phòng
  useEffect(() => {
    dormitoryApi.rooms
      .getAll({ limit: 200 })
      .then((res) => setRooms(res.data || []))
      .catch(() => {});
  }, []);

  // Load danh sách hóa đơn
  const load = useCallback(async (background = false) => {
    try {
      if (background) setRefreshing(true);
      else setLoading(true);
      const params: any = { page, limit: pageSize };
      if (filterStatus === 'Chưa thu') params.status = 'Chưa thu';
      else if (filterStatus === 'Đã thu') params.status = 'Đã thu';
      if (filterMonth) params.billing_month = filterMonth;
      if (search) params.search = search;

      const res = await dormitoryApi.invoices.getAll(params);
      setInvoices(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải danh sách hóa đơn');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus, filterMonth, search, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  // Tính toán xem trước ở client cho Modal Nâng cao
  const previewCalc = useMemo(() => {
    const occ = Number(advancedForm.occupant_count) || 0;
    const isExempt = advancedForm.is_exempt;

    // Điện
    const elecPrev = Number(advancedForm.electricity.previous_reading) || 0;
    const elecCurr = Number(advancedForm.electricity.current_reading) || 0;
    const elecQuotaPer = Number(advancedForm.electricity.quota_per_person) || 0;
    const elecPrice = Number(advancedForm.electricity.unit_price) || 0;

    const elecConsumption = Math.max(elecCurr - elecPrev, 0);
    const elecQuotaTotal = occ * elecQuotaPer;
    const elecExcess = Math.max(elecConsumption - elecQuotaTotal, 0);
    const elecAmount = isExempt ? 0 : elecExcess * elecPrice;

    // Nước
    const waterPrev = Number(advancedForm.water.previous_reading) || 0;
    const waterCurr = Number(advancedForm.water.current_reading) || 0;
    const waterQuotaPer = Number(advancedForm.water.quota_per_person) || 0;
    const waterPrice = Number(advancedForm.water.unit_price) || 0;

    const waterConsumption = Math.max(waterCurr - waterPrev, 0);
    const waterQuotaTotal = occ * waterQuotaPer;
    const waterExcess = Math.max(waterConsumption - waterQuotaTotal, 0);
    const waterAmount = isExempt ? 0 : waterExcess * waterPrice;

    const totalAmount = isExempt ? 0 : elecAmount + waterAmount;

    return {
      electricity: {
        consumption: elecConsumption,
        quota_total: elecQuotaTotal,
        excess: elecExcess,
        amount: elecAmount,
        invalid: elecCurr < elecPrev,
      },
      water: {
        consumption: waterConsumption,
        quota_total: waterQuotaTotal,
        excess: waterExcess,
        amount: waterAmount,
        invalid: waterCurr < waterPrev,
      },
      totalAmount,
    };
  }, [advancedForm]);

  // Khi chọn phòng trong Modal Nâng cao, tự động lấy thông tin người ở và chỉ số cũ
  async function handleSelectRoom(roomId: string) {
    setAdvancedForm((prev) => ({ ...prev, room_id: roomId }));
    if (!roomId) return;
    try {
      setRoomLoading(true);
      const info = await dormitoryApi.invoices.getRoomInfo(roomId, advancedForm.billing_month);
      setAdvancedForm((prev) => ({
        ...prev,
        occupant_count: info.occupant_count || 0,
        electricity: {
          ...prev.electricity,
          previous_reading: info.last_readings?.electricity || 0,
          current_reading: Math.max(prev.electricity.current_reading, info.last_readings?.electricity || 0),
        },
        water: {
          ...prev.water,
          previous_reading: info.last_readings?.water || 0,
          current_reading: Math.max(prev.water.current_reading, info.last_readings?.water || 0),
        },
      }));
    } catch {
      // Ignored
    } finally {
      setRoomLoading(false);
    }
  }

  // Mở modal tạo mới đợt thu
  function openCreateModal() {
    setEditingInvoice(null);
    setAdvancedForm({
      room_id: rooms[0]?._id || '',
      billing_month: defaultMonth,
      reading_date: defaultReadingDate,
      occupant_count: 0,
      electricity: {
        previous_reading: 0,
        current_reading: 0,
        quota_per_person: 15,
        unit_price: 2500,
      },
      water: {
        previous_reading: 0,
        current_reading: 0,
        quota_per_person: 4,
        unit_price: 10000,
      },
      payment_start_date: defaultReadingDate,
      due_date: defaultDueDate,
      is_exempt: false,
      notes: '',
    });
    if (rooms[0]?._id) {
      handleSelectRoom(rooms[0]._id);
    }
    setAdvancedModalOpen(true);
  }

  // Mở modal chỉnh sửa thông số Nâng cao
  function openEditModal(inv: DormInvoice) {
    setEditingInvoice(inv);
    const roomId = typeof inv.room_id === 'object' ? inv.room_id?._id : inv.room_id;
    setAdvancedForm({
      room_id: roomId || '',
      billing_month: inv.billing_month || defaultMonth,
      reading_date: inv.reading_date ? new Date(inv.reading_date).toISOString().split('T')[0] : defaultReadingDate,
      occupant_count: inv.occupant_count || 0,
      electricity: {
        previous_reading: inv.electricity?.previous_reading || 0,
        current_reading: inv.electricity?.current_reading || 0,
        quota_per_person: inv.electricity?.quota_per_person || 15,
        unit_price: inv.electricity?.unit_price || 2500,
      },
      water: {
        previous_reading: inv.water?.previous_reading || 0,
        current_reading: inv.water?.current_reading || 0,
        quota_per_person: inv.water?.quota_per_person || 4,
        unit_price: inv.water?.unit_price || 10000,
      },
      payment_start_date: inv.payment_start_date ? new Date(inv.payment_start_date).toISOString().split('T')[0] : defaultReadingDate,
      due_date: inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : defaultDueDate,
      is_exempt: Boolean(inv.is_exempt),
      notes: inv.notes || '',
    });
    setAdvancedModalOpen(true);
  }

  // Lưu form Nâng cao
  async function handleSaveAdvanced(e: React.FormEvent) {
    e.preventDefault();
    if (!advancedForm.room_id) {
      toast.error('Vui lòng chọn phòng');
      return;
    }
    if (previewCalc.electricity.invalid) {
      toast.error('Chỉ số điện mới không được nhỏ hơn chỉ số cũ');
      return;
    }
    if (previewCalc.water.invalid) {
      toast.error('Chỉ số nước mới không được nhỏ hơn chỉ số cũ');
      return;
    }
    if (advancedForm.payment_start_date && advancedForm.due_date && advancedForm.due_date < advancedForm.payment_start_date) {
      toast.error('Hạn kết thúc thu phải sau hoặc bằng ngày bắt đầu thu');
      return;
    }

    try {
      setAdvancedSubmitting(true);
      if (editingInvoice) {
        const dto: UpdateMonthlyInvoiceInput = {
          reading_date: advancedForm.reading_date,
          occupant_count: Number(advancedForm.occupant_count),
          electricity: advancedForm.electricity,
          water: advancedForm.water,
          is_exempt: advancedForm.is_exempt,
          payment_start_date: advancedForm.payment_start_date,
          due_date: advancedForm.due_date,
          notes: advancedForm.notes,
        };
        await dormitoryApi.invoices.updateMonthly(editingInvoice._id, dto);
        toast.success('Cập nhật thông số hóa đơn thành công');
      } else {
        const dto: CreateMonthlyInvoiceInput = {
          room_id: advancedForm.room_id,
          billing_month: advancedForm.billing_month,
          reading_date: advancedForm.reading_date,
          occupant_count: Number(advancedForm.occupant_count),
          electricity: advancedForm.electricity,
          water: advancedForm.water,
          is_exempt: advancedForm.is_exempt,
          payment_start_date: advancedForm.payment_start_date,
          due_date: advancedForm.due_date,
          notes: advancedForm.notes,
        };
        await dormitoryApi.invoices.createMonthly(dto);
        toast.success('Lập đợt thu điện - nước thành công');
      }
      setAdvancedModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi lưu hóa đơn');
    } finally {
      setAdvancedSubmitting(false);
    }
  }

  // Mở modal Thu tiền
  function openPayModal(inv: DormInvoice) {
    setPayingInvoice(inv);
    setPayMethod('Chuyển khoản');
    setPayNotes('');
    setPayProofFile(null);
    setPayProofPreview(null);
    setPayModalOpen(true);
  }

  // Handle chọn file ảnh chứng từ
  function handleProofFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error('Chỉ chấp nhận file ảnh JPEG, PNG hoặc WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dung lượng file tối đa là 5MB');
      return;
    }
    setPayProofFile(file);
    const url =
      typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function'
        ? window.URL.createObjectURL(file)
        : 'blob:preview';
    setPayProofPreview(url);
  }

  // Xác nhận thu tiền
  async function handleConfirmPay(e: React.FormEvent) {
    e.preventDefault();
    if (!payingInvoice) return;
    try {
      setPaySubmitting(true);
      let proofMeta: any = undefined;
      if (payProofFile) {
        proofMeta = await dormitoryApi.invoices.uploadProof(payProofFile);
      }
      await dormitoryApi.invoices.pay(payingInvoice._id, {
        payment_method: payMethod,
        notes: payNotes || undefined,
        payment_proof: proofMeta,
      });
      toast.success('Xác nhận thu tiền thành công');
      setPayModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xác nhận thu tiền');
    } finally {
      setPaySubmitting(false);
    }
  }

  // Mở modal kiểm tra / xem chứng từ
  function openProofModal(inv: DormInvoice) {
    setViewingInvoice(inv);
    setUpdateProofFile(null);
    setUpdateProofPreview(null);
    setUpdateProofNotes(inv.notes || '');
    setUpdateProofMethod((inv.payment_method as any) || 'Chuyển khoản');
    setProofModalOpen(true);
  }

  function handleUpdateProofFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error('File ảnh không được vượt quá 5MB');
      return;
    }
    setUpdateProofFile(f);
    const url =
      typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function'
        ? window.URL.createObjectURL(f)
        : 'blob:preview';
    setUpdateProofPreview(url);
  }

  async function handleSaveUpdatedProof() {
    if (!viewingInvoice) return;
    try {
      setUpdateProofSubmitting(true);
      let proofMeta = viewingInvoice.payment_proof;
      if (updateProofFile) {
        proofMeta = await dormitoryApi.invoices.uploadProof(updateProofFile);
      }
      const updated = await dormitoryApi.invoices.updateProof(viewingInvoice._id, {
        payment_method: updateProofMethod,
        notes: updateProofNotes || undefined,
        payment_proof: proofMeta,
      });
      toast.success('Cập nhật chứng từ thanh toán thành công');
      setViewingInvoice(updated);
      setUpdateProofFile(null);
      setUpdateProofPreview(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi cập nhật chứng từ');
    } finally {
      setUpdateProofSubmitting(false);
    }
  }

  return (
    <main className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6">
      {/* Toolbar theo phong cách của trang Phòng */}
      <div className="flex shrink-0 items-center justify-start gap-2 overflow-x-auto scrollbar-none py-0.5 w-full flex-nowrap">
        {/* Search box */}
        <Research
          aria-label="Tìm kiếm hóa đơn"
          placeholder="Tìm mã HĐ, tên phòng..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          containerClassName="hidden sm:flex w-[240px] shrink-0"
        />

        {/* Lọc kỳ thu (Sử dụng CustomCalendar qua Popover) */}
        <Popover open={calendarFilterOpen} onOpenChange={setCalendarFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-9 rounded-xl border border-white/80 bg-white/50 px-3 text-xs font-semibold text-slate-700 hover:bg-white/80 shrink-0 gap-1.5 cursor-pointer"
              title="Lọc theo kỳ thu"
              aria-label="Lọc theo kỳ thu"
            >
              <CalendarIcon size={14} className="text-[#1A73E8]" />
              <span>{filterMonth ? `Kỳ: ${formatBillingMonth(filterMonth)}` : 'Tất cả kỳ thu'}</span>
              {filterMonth && (
                <X
                  size={13}
                  className="text-slate-400 hover:text-rose-600 transition-colors ml-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFilterMonth('');
                    setPage(1);
                  }}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
            <CustomCalendar
              startDate={filterMonth ? new Date(`${filterMonth}-01T00:00:00`) : null}
              endDate={null}
              onRangeSelect={(start) => {
                const y = start.getFullYear();
                const m = String(start.getMonth() + 1).padStart(2, '0');
                setFilterMonth(`${y}-${m}`);
                setPage(1);
              }}
              onRangeConfirm={(start) => {
                const y = start.getFullYear();
                const m = String(start.getMonth() + 1).padStart(2, '0');
                setFilterMonth(`${y}-${m}`);
                setPage(1);
                setCalendarFilterOpen(false);
              }}
              onCancel={() => {
                setFilterMonth('');
                setPage(1);
                setCalendarFilterOpen(false);
              }}
              onConfirm={() => setCalendarFilterOpen(false)}
            />
          </PopoverContent>
        </Popover>

        {/* Lọc trạng thái (Sử dụng component Select) */}
        <div className="w-[160px] shrink-0">
          <Select
            value={filterStatus}
            onValueChange={(val: any) => {
              setFilterStatus(val);
              setPage(1);
            }}
          >
            <SelectTrigger
              aria-label="Lọc theo trạng thái"
              className="h-9 rounded-xl border border-white/80 bg-white/50 text-xs font-semibold text-slate-700 hover:bg-white/80"
            >
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tất cả">Tất cả trạng thái</SelectItem>
              <SelectItem value="Chưa thu">Chưa thu</SelectItem>
              <SelectItem value="Đã thu">Đã thu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Toggle Chế độ xem Table / Cards */}
        <div className="flex items-center h-9 p-0.5 rounded-xl border border-white/80 bg-white/50 shadow-2xs shrink-0">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1 rounded-lg transition-all duration-150 cursor-pointer ${
              viewMode === 'table'
                ? 'bg-[#1A73E8] text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Xem dạng bảng"
            aria-label="Xem dạng bảng"
          >
            <LayoutList size={15} />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1 rounded-lg transition-all duration-150 cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-[#1A73E8] text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Xem dạng thẻ"
            aria-label="Xem dạng thẻ"
          >
            <LayoutGrid size={15} />
          </button>
        </div>

        {/* Cụm nút thao tác bên phải */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {/* Nút Cấu hình định mức & đơn giá */}
          <Button
            variant="outline"
            aria-label="Cấu hình định mức & đơn giá"
            title="Cấu hình định mức & đơn giá"
            onClick={openConfigModal}
            className="h-9 w-9 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700 hover:bg-white/80 shrink-0 cursor-pointer"
          >
            <SlidersHorizontal size={15} />
          </Button>

          {/* Nút Ghi điện nước */}
          <Button
            variant="outline"
            aria-label="Ghi điện nước"
            title="Ghi chỉ số điện - nước"
            onClick={() => router.push('/dormitory/invoices/meter-readings')}
            className="h-9 rounded-xl border border-white/80 bg-white/50 px-3 text-xs font-semibold text-slate-700 hover:bg-white/80 shrink-0 gap-1.5 cursor-pointer"
          >
            <Zap size={14} />
            <span>Ghi điện nước</span>
          </Button>

          {/* Nút Tải lại */}
          <Button
            variant="outline"
            aria-label="Tải lại danh sách"
            title="Tải lại"
            onClick={() => void load(true)}
            className="h-9 w-9 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700 hover:bg-white/80 shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Hiển thị Dạng Bảng hoặc Dạng Thẻ */}
      {viewMode === 'cards' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/75 bg-white/45 p-5 shadow-sm shadow-slate-300/30 backdrop-blur-md animate-pulse space-y-3"
                >
                  <div className="h-5 bg-slate-200/60 rounded-xl w-1/3" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-16 bg-slate-100/70 rounded-xl" />
                    <div className="h-16 bg-slate-100/70 rounded-xl" />
                  </div>
                  <div className="h-8 bg-slate-200/50 rounded-xl" />
                </div>
              ))
            ) : invoices.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-white/75 bg-white/45 p-12 text-center text-[#64748B] shadow-sm shadow-slate-300/30 backdrop-blur-md">
                <FileText size={36} className="mx-auto mb-2 opacity-40" />
                Không có hóa đơn nào phù hợp
              </div>
            ) : (
              invoices.map((inv) => {
                const displayStatus = getDisplayStatus(inv.status);
                const roomName =
                  typeof inv.room_id === 'object' && inv.room_id
                    ? inv.room_id.room_name || inv.room_id.room_code || 'Phòng'
                    : '—';

                const elecAmount = inv.electricity?.amount ?? 0;
                const waterAmount = inv.water?.amount ?? 0;

                return (
                  <div
                    key={inv._id}
                    className="rounded-2xl border border-white/75 bg-white/50 backdrop-blur-md p-4 sm:p-5 shadow-sm shadow-slate-300/30 flex flex-col justify-between gap-3.5 transition-all duration-150 hover:bg-white/65 hover:scale-[1.01]"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/60">
                      <div>
                        <div className="font-bold text-base text-[#1E293B]">{roomName}</div>
                      </div>
                      <div>
                        {displayStatus === 'Đã thu' ? (
                          <button
                            onClick={() => openProofModal(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-150 cursor-pointer shadow-2xs"
                            title="Bấm để xem ảnh chứng từ chuyển khoản"
                          >
                            <CheckCircle size={13} />
                            Đã thu
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20 shadow-2xs">
                            Chưa thu
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-[#64748B] font-medium bg-slate-500/5 px-2.5 py-1.5 rounded-xl border border-slate-500/10">
                        <span className="flex items-center gap-1.5">
                          <CalendarIcon size={14} className="text-[#1A73E8]" /> Kỳ thu:
                        </span>
                        <span className="font-semibold text-[#1E293B]">
                          {formatBillingMonth(inv.billing_month, inv.billing_period)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Điện */}
                        <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-2.5 space-y-1">
                          <div className="flex items-center gap-1 font-semibold text-amber-800 text-[11px]">
                            <Zap size={13} className="text-amber-600" /> Tiền điện
                          </div>
                          <div className="font-bold text-[#1E293B] text-sm">
                            {formatMoney(elecAmount)}
                          </div>
                        </div>

                        {/* Nước */}
                        <div className="border border-sky-500/20 bg-sky-500/5 rounded-xl p-2.5 space-y-1">
                          <div className="flex items-center gap-1 font-semibold text-sky-800 text-[11px]">
                            <Droplets size={13} className="text-sky-600" /> Tiền nước
                          </div>
                          <div className="font-bold text-[#1E293B] text-sm">
                            {formatMoney(waterAmount)}
                          </div>
                        </div>
                      </div>

                      {/* Tổng tiền */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-semibold text-[#64748B]">Tổng tiền:</span>
                        <div className="text-right">
                          <div className="text-base font-extrabold text-[#1A73E8]">
                            {formatMoney(inv.total_amount)}
                          </div>
                          {inv.is_exempt && (
                            <span className="text-[10px] text-amber-700 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-lg border border-amber-500/20 inline-block">
                              Miễn thu
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-white/60">
                      {displayStatus === 'Chưa thu' ? (
                        <button
                          onClick={() => openPayModal(inv)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 hover:scale-[1.01] transition-all duration-150 shadow-sm shadow-emerald-600/20 cursor-pointer"
                          title="Đóng tiền ngay"
                        >
                          <CheckCircle size={14} /> Đóng ngay
                        </button>
                      ) : (
                        <button
                          onClick={() => openProofModal(inv)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/70 border border-slate-200/80 text-slate-700 rounded-xl text-xs font-medium hover:bg-white hover:text-[#1A73E8] hover:scale-[1.01] transition-all duration-150 shadow-2xs cursor-pointer"
                          title="Kiểm tra chứng từ thanh toán"
                        >
                          <Eye size={14} /> Kiểm tra
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination cho Card View */}
          <div className="rounded-2xl border border-white/75 bg-white/45 backdrop-blur-md shadow-sm shadow-slate-300/30 overflow-hidden">
            <CustomPagination
              totalItems={meta?.total ?? invoices.length}
              pageSize={pageSize}
              currentPage={page}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPage(1);
                setPageSize(size);
              }}
              pageSizeOptions={[10, 20, 50, 100]}
              isLoading={loading}
              label="hóa đơn"
            />
          </div>
        </div>
      ) : (
        /* Bảng hiển thị 7 cột chuẩn kèm CustomPagination */
        <div className="rounded-2xl border border-white/75 bg-white/45 backdrop-blur-md shadow-sm shadow-slate-300/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/60 border-b border-white/80">
                  <th className="p-3 text-left font-semibold text-[#64748B] text-xs uppercase tracking-wider">Phòng</th>
                  <th className="p-3 text-left font-semibold text-[#64748B] text-xs uppercase tracking-wider">Kỳ thu</th>
                  <th className="p-3 text-right font-semibold text-[#64748B] text-xs uppercase tracking-wider">Tiền điện</th>
                  <th className="p-3 text-right font-semibold text-[#64748B] text-xs uppercase tracking-wider">Tiền nước</th>
                  <th className="p-3 text-right font-semibold text-[#64748B] text-xs uppercase tracking-wider pr-8">Tổng tiền</th>
                  <th className="p-3 text-center font-semibold text-[#64748B] text-xs uppercase tracking-wider px-8 min-w-[140px]">Trạng thái</th>
                  <th className="p-3 text-center font-semibold text-[#64748B] text-xs uppercase tracking-wider">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/40">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="p-3">
                          <div className="h-4 bg-slate-200/50 rounded-xl animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-[#64748B]">
                      <FileText size={36} className="mx-auto mb-2 opacity-40" />
                      Không có hóa đơn nào phù hợp
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const displayStatus = getDisplayStatus(inv.status);
                    const roomName =
                      typeof inv.room_id === 'object' && inv.room_id
                        ? inv.room_id.room_name || inv.room_id.room_code || 'Phòng'
                        : '—';

                    const elecAmount = inv.electricity?.amount ?? 0;
                    const waterAmount = inv.water?.amount ?? 0;

                    return (
                      <tr key={inv._id} className="border-b border-white/40 hover:bg-white/50 transition-all duration-150">
                        {/* 1. Phòng */}
                        <td className="p-3 font-semibold text-[#1E293B]">
                          {roomName}
                        </td>

                        {/* 2. Kỳ thu */}
                        <td className="p-3 text-[#1E293B] font-medium">
                          {formatBillingMonth(inv.billing_month, inv.billing_period)}
                        </td>

                        {/* 3. Tiền điện */}
                        <td className="p-3 text-right text-[#1E293B] font-medium">
                          {formatMoney(elecAmount)}
                        </td>

                        {/* 4. Tiền nước */}
                        <td className="p-3 text-right text-[#1E293B] font-medium">
                          {formatMoney(waterAmount)}
                        </td>

                        {/* 5. Tổng tiền (giãn cách với cột Trạng thái nhờ pr-8) */}
                        <td className="p-3 text-right font-bold text-[#1A73E8] pr-8 whitespace-nowrap">
                          {formatMoney(inv.total_amount)}
                          {inv.is_exempt && (
                            <div className="text-[10px] text-amber-700 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-lg inline-block mt-0.5 border border-amber-500/20">
                              Miễn thu
                            </div>
                          )}
                        </td>

                        {/* 6. Trạng thái (giãn cách với cột Tổng tiền nhờ px-8 và min-w-[140px]) */}
                        <td className="p-3 text-center px-8 min-w-[140px] whitespace-nowrap">
                          {displayStatus === 'Đã thu' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 shadow-2xs">
                              <CheckCircle size={13} />
                              Đã thu
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20 shadow-2xs">
                              Chưa thu
                            </span>
                          )}
                        </td>

                        {/* 7. Thao tác */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {displayStatus === 'Chưa thu' ? (
                              <button
                                onClick={() => openPayModal(inv)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 hover:scale-[1.01] transition-all duration-150 shadow-sm shadow-emerald-600/20 cursor-pointer"
                                title="Đóng tiền ngay"
                              >
                                <CheckCircle size={14} /> Đóng ngay
                              </button>
                            ) : (
                              <button
                                onClick={() => openProofModal(inv)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/70 border border-slate-200/80 text-slate-700 rounded-xl text-xs font-medium hover:bg-white hover:text-[#1A73E8] hover:scale-[1.01] transition-all duration-150 shadow-2xs cursor-pointer"
                                title="Kiểm tra chứng từ thanh toán"
                              >
                                <Eye size={14} /> Kiểm tra
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* CustomPagination cho Table View */}
          <CustomPagination
            totalItems={meta?.total ?? invoices.length}
            pageSize={pageSize}
            currentPage={page}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPage(1);
              setPageSize(size);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            isLoading={loading}
            label="hóa đơn"
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL NÂNG CAO (Lập đợt thu / Chỉnh sửa thông số) */}
      {/* ========================================================================= */}
      {advancedModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => !advancedSubmitting && setAdvancedModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-xl rounded-2xl border border-white/80 p-6 w-full max-w-2xl shadow-xl space-y-5 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-[#1E293B]">
                  {editingInvoice ? 'Chỉnh sửa thông số hóa đơn' : 'Lập đợt thu tiền phòng'}
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Tùy chỉnh định mức, số người, đơn giá và tính toán số tiền theo phòng
                </p>
              </div>
              <button
                onClick={() => setAdvancedModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] hover:text-[#1E293B] hover:bg-white/80 border border-transparent hover:border-white/70 transition-all duration-150 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdvanced} className="space-y-4">
              {/* Chọn phòng & kỳ thu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#1E293B]">
                    Phòng <span className="text-red-500">*</span>
                  </label>
                  <select
                    disabled={!!editingInvoice}
                    value={advancedForm.room_id}
                    onChange={(e) => handleSelectRoom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150 disabled:opacity-60"
                  >
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.room_name || r.room_code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#1E293B]">
                    Kỳ thu (Tháng/Năm) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    disabled={!!editingInvoice}
                    value={advancedForm.billing_month}
                    onChange={(e) => setAdvancedForm((f) => ({ ...f, billing_month: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Ngày ghi số & Số người ở */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#1E293B] flex items-center gap-1">
                    <CalendarIcon size={14} className="text-[#64748B]" />
                    Ngày ghi chỉ số <span className="text-red-500">*</span>
                  </label>
                  <Popover open={readingDateCalendarOpen} onOpenChange={setReadingDateCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150 cursor-pointer"
                      >
                        <span>{advancedForm.reading_date ? formatDate(advancedForm.reading_date) : 'Chọn ngày ghi'}</span>
                        <CalendarIcon size={14} className="text-[#64748B]" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
                      <CustomCalendar
                        startDate={advancedForm.reading_date ? new Date(`${advancedForm.reading_date}T00:00:00`) : null}
                        endDate={null}
                        onRangeSelect={(start) => setAdvancedForm((f) => ({ ...f, reading_date: toDateValue(start) }))}
                        onRangeConfirm={(start) => {
                          setAdvancedForm((f) => ({ ...f, reading_date: toDateValue(start) }));
                          setReadingDateCalendarOpen(false);
                        }}
                        onCancel={() => setReadingDateCalendarOpen(false)}
                        onConfirm={() => setReadingDateCalendarOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#1E293B] flex items-center gap-1">
                    <Users size={14} className="text-[#64748B]" />
                    Số người ở thực tế (để tính định mức) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={advancedForm.occupant_count}
                    onChange={(e) => setAdvancedForm((f) => ({ ...f, occupant_count: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150"
                  />
                </div>
              </div>

              {/* Thông số điện */}
              <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-800 text-xs flex items-center gap-1">
                    <Zap size={14} className="text-amber-600" /> Chỉ số điện (kWh)
                  </span>
                  <span className="text-[11px] font-semibold text-amber-700">
                    Tiêu thụ: {previewCalc.electricity.consumption} kWh | Vượt:{' '}
                    {previewCalc.electricity.excess} kWh | Thành tiền:{' '}
                    {formatMoney(previewCalc.electricity.amount)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[#64748B] block mb-1">Chỉ số cũ</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.electricity.previous_reading}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          electricity: { ...f.electricity, previous_reading: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#1E293B] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Chỉ số mới</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.electricity.current_reading}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          electricity: { ...f.electricity, current_reading: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#1E293B] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Định mức/người</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.electricity.quota_per_person}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          electricity: { ...f.electricity, quota_per_person: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#1E293B] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Đơn giá (đ/kWh)</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.electricity.unit_price}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          electricity: { ...f.electricity, unit_price: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#1E293B] font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Thông số nước */}
              <div className="border border-sky-500/20 bg-sky-500/5 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-800 text-xs flex items-center gap-1">
                    <Droplets size={14} className="text-sky-600" /> Chỉ số nước (m³)
                  </span>
                  <span className="text-[11px] font-semibold text-sky-700">
                    Tiêu thụ: {previewCalc.water.consumption} m³ | Vượt:{' '}
                    {previewCalc.water.excess} m³ | Thành tiền:{' '}
                    {formatMoney(previewCalc.water.amount)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-[#64748B] block mb-1">Chỉ số cũ</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.water.previous_reading}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          water: { ...f.water, previous_reading: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#1E293B] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Chỉ số mới</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.water.current_reading}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          water: { ...f.water, current_reading: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#1E293B] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Định mức/người</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.water.quota_per_person}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          water: { ...f.water, quota_per_person: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#1E293B] font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] block mb-1">Đơn giá (đ/m³)</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.water.unit_price}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          water: { ...f.water, unit_price: parseFloat(e.target.value) || 0 },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[#1E293B] font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Ngày bắt đầu thu & Hạn nộp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#1E293B] flex items-center gap-1">
                    <CalendarIcon size={14} className="text-[#64748B]" />
                    Ngày bắt đầu thu
                  </label>
                  <Popover open={startDateCalendarOpen} onOpenChange={setStartDateCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150 cursor-pointer"
                      >
                        <span>{advancedForm.payment_start_date ? formatDate(advancedForm.payment_start_date) : 'Chọn ngày bắt đầu'}</span>
                        <CalendarIcon size={14} className="text-[#64748B]" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
                      <CustomCalendar
                        startDate={advancedForm.payment_start_date ? new Date(`${advancedForm.payment_start_date}T00:00:00`) : null}
                        endDate={null}
                        onRangeSelect={(start) => setAdvancedForm((f) => ({ ...f, payment_start_date: toDateValue(start) }))}
                        onRangeConfirm={(start) => {
                          setAdvancedForm((f) => ({ ...f, payment_start_date: toDateValue(start) }));
                          setStartDateCalendarOpen(false);
                        }}
                        onCancel={() => setStartDateCalendarOpen(false)}
                        onConfirm={() => setStartDateCalendarOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#1E293B] flex items-center gap-1">
                    <CalendarIcon size={14} className="text-[#64748B]" />
                    Hạn kết thúc thu <span className="text-red-500">*</span>
                  </label>
                  <Popover open={dueDateCalendarOpen} onOpenChange={setDueDateCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150 cursor-pointer"
                      >
                        <span>{advancedForm.due_date ? formatDate(advancedForm.due_date) : 'Chọn hạn thu'}</span>
                        <CalendarIcon size={14} className="text-[#64748B]" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
                      <CustomCalendar
                        startDate={advancedForm.due_date ? new Date(`${advancedForm.due_date}T00:00:00`) : null}
                        endDate={null}
                        onRangeSelect={(start) => setAdvancedForm((f) => ({ ...f, due_date: toDateValue(start) }))}
                        onRangeConfirm={(start) => {
                          setAdvancedForm((f) => ({ ...f, due_date: toDateValue(start) }));
                          setDueDateCalendarOpen(false);
                        }}
                        onCancel={() => setDueDateCalendarOpen(false)}
                        onConfirm={() => setDueDateCalendarOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Checkbox Miễn thu / Không thu */}
              <div className="flex items-center gap-2 p-2.5 bg-slate-500/5 rounded-xl border border-slate-500/10">
                <input
                  type="checkbox"
                  id="is_exempt"
                  checked={advancedForm.is_exempt}
                  onChange={(e) => setAdvancedForm((f) => ({ ...f, is_exempt: e.target.checked }))}
                  className="w-4 h-4 text-[#1A73E8] rounded-xl focus:ring-[#1A73E8]"
                />
                <label htmlFor="is_exempt" className="text-xs font-medium text-[#1E293B] cursor-pointer">
                  <b>Không thu đợt này</b> (Vẫn lưu chỉ số công-tơ, tổng tiền phải thu = 0đ)
                </label>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={advancedForm.notes}
                  onChange={(e) => setAdvancedForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Ghi chú về đợt thu, sự cố công tơ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150"
                />
              </div>

              {/* Hộp tổng kết tiền xem trước */}
              <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#1A73E8] font-semibold">Tổng tiền phải thu dự tính</div>
                  <div className="text-xl font-black text-[#1E293B] mt-0.5">
                    {formatMoney(previewCalc.totalAmount)}
                  </div>
                </div>
                <div className="text-right text-[11px] text-[#64748B] space-y-0.5 font-medium">
                  <div>Điện: {formatMoney(previewCalc.electricity.amount)}</div>
                  <div>Nước: {formatMoney(previewCalc.water.amount)}</div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={advancedSubmitting}
                  onClick={() => setAdvancedModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200/80 rounded-xl text-sm font-medium text-[#1E293B] bg-white/70 hover:bg-white transition-all duration-150 hover:scale-[1.01] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={advancedSubmitting}
                  className="flex-1 px-4 py-2.5 bg-[#1A73E8] text-white rounded-xl text-sm font-medium hover:bg-[#1557B0] transition-all duration-150 hover:scale-[1.01] shadow-sm shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {advancedSubmitting ? 'Đang lưu...' : editingInvoice ? 'Cập nhật' : 'Tạo đợt thu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL THU TIỀN (Xác nhận thanh toán & upload chứng từ) */}
      {/* ========================================================================= */}
      {payModalOpen && payingInvoice && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => !paySubmitting && setPayModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-xl rounded-2xl border border-white/80 p-6 w-full max-w-md shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h2 className="text-lg font-bold text-[#1E293B]">Xác nhận thu tiền</h2>
              <button
                onClick={() => setPayModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] hover:text-[#1E293B] hover:bg-white/80 border border-transparent hover:border-white/70 transition-all duration-150 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-slate-500/5 rounded-xl border border-slate-500/10 space-y-1 text-xs text-[#64748B]">
              <div>
                Phòng:{' '}
                <b className="text-[#1E293B]">
                  {typeof payingInvoice.room_id === 'object'
                    ? payingInvoice.room_id?.room_name || payingInvoice.room_id?.room_code
                    : '—'}
                </b>
              </div>
              <div>
                Kỳ thu: <b className="text-[#1E293B]">{formatBillingMonth(payingInvoice.billing_month, payingInvoice.billing_period)}</b>
              </div>
              <div>
                Số tiền: <b className="text-emerald-700 text-sm font-bold">{formatMoney(payingInvoice.total_amount)}</b>
              </div>
            </div>

            <form onSubmit={handleConfirmPay} className="space-y-4">
              {/* Phương thức */}
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
                  Phương thức thanh toán <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Chuyển khoản', 'Tiền mặt'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPayMethod(method)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${
                        payMethod === method
                          ? 'border-[#1A73E8] bg-blue-50/80 text-[#1A73E8] shadow-xs'
                          : 'border-slate-200/80 bg-white/70 text-[#1E293B] hover:bg-white'
                      }`}
                    >
                      {method === 'Chuyển khoản' ? <DollarSign size={14} /> : <CheckCircle size={14} />}
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload ảnh chứng từ (Khuyến khích/bắt buộc khi Chuyển khoản) */}
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1.5 flex items-center justify-between">
                  <span>Ảnh chứng từ thanh toán</span>
                  {payMethod === 'Chuyển khoản' && (
                    <span className="text-[11px] text-[#1A73E8] font-normal">Khuyến nghị đính kèm bill</span>
                  )}
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleProofFileChange}
                    className="hidden"
                    id="pay-proof-upload"
                  />
                  {!payProofFile ? (
                    <label
                      htmlFor="pay-proof-upload"
                      className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-xl bg-white/50 hover:bg-white/80 transition-all duration-150 cursor-pointer text-center"
                    >
                      <Upload size={22} className="text-[#1A73E8] mb-1" />
                      <span className="text-xs font-medium text-[#1E293B]">Bấm để chọn file ảnh bill/chứng từ</span>
                      <span className="text-[11px] text-[#64748B] mt-0.5">PNG, JPG, WebP tối đa 5MB</span>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle size={16} className="text-emerald-700 shrink-0" />
                        <span className="font-medium text-emerald-800 truncate">{payProofFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPayProofFile(null);
                          setPayProofPreview(null);
                        }}
                        className="text-xs text-rose-600 hover:underline shrink-0 ml-2 cursor-pointer font-medium"
                      >
                        Hủy
                      </button>
                    </div>
                  )}

                  {payProofPreview && (
                    <div className="p-2 border border-slate-200 rounded-xl bg-slate-900/5 flex items-center justify-center">
                      <img
                        src={payProofPreview}
                        alt="Xem trước chứng từ"
                        className="max-h-40 w-auto object-contain rounded-lg shadow-2xs"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Ghi chú xác nhận</label>
                <textarea
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Ghi chú người nộp, số tài khoản, mã giao dịch..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={paySubmitting}
                  onClick={() => setPayModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200/80 rounded-xl text-sm font-medium text-[#1E293B] bg-white/70 hover:bg-white transition-all duration-150 hover:scale-[1.01] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all duration-150 hover:scale-[1.01] shadow-sm shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {paySubmitting ? 'Đang xử lý...' : 'Xác nhận thu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL KIỂM TRA & CẬP NHẬT CHỨNG TỪ (Khi click Đã thu hoặc nút Kiểm tra) */}
      {/* ========================================================================= */}
      {proofModalOpen && viewingInvoice && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => !updateProofSubmitting && setProofModalOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && !updateProofSubmitting && setProofModalOpen(false)}
          tabIndex={-1}
        >
          <div
            className="bg-white/95 backdrop-blur-xl rounded-2xl border border-white/80 p-6 w-full max-w-lg shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-[#1E293B]">Kiểm tra chứng từ thanh toán</h2>
                <span className="text-xs text-emerald-700 font-medium">Trạng thái: Đã thu</span>
              </div>
              <button
                onClick={() => setProofModalOpen(false)}
                disabled={updateProofSubmitting}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] hover:text-[#1E293B] hover:bg-white/80 border border-transparent hover:border-white/70 transition-all duration-150 cursor-pointer disabled:opacity-50"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* Thông tin thanh toán */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-500/5 p-3.5 rounded-xl border border-slate-500/10">
              <div>
                <span className="text-[#64748B] block">Phòng</span>
                <span className="font-semibold text-[#1E293B]">
                  {typeof viewingInvoice.room_id === 'object'
                    ? viewingInvoice.room_id?.room_name || viewingInvoice.room_id?.room_code
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Kỳ thu</span>
                <span className="font-semibold text-[#1E293B]">
                  {formatBillingMonth(viewingInvoice.billing_month, viewingInvoice.billing_period)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Tổng tiền</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {formatMoney(viewingInvoice.total_amount)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Phương thức</span>
                <span className="font-semibold text-[#1E293B]">
                  {viewingInvoice.payment_method || 'Chuyển khoản'}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Ngày thu</span>
                <span className="font-semibold text-[#1E293B]">
                  {formatDate(viewingInvoice.paid_at)}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block">Người xác nhận</span>
                <span className="font-semibold text-[#1E293B]">
                  {viewingInvoice.confirmed_by_id?.full_name ||
                    viewingInvoice.confirmed_by_id?.user_name ||
                    'Quản lý KTX'}
                </span>
              </div>
            </div>

            {/* Ảnh chứng từ hiện tại */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#1E293B]">
                Ảnh chứng từ hiện tại
              </label>
              {viewingInvoice.payment_proof?.url ? (
                <div className="space-y-2">
                  <div className="border border-slate-200/60 rounded-xl overflow-hidden bg-slate-900/5 flex items-center justify-center p-2">
                    <img
                      src={viewingInvoice.payment_proof.url}
                      alt="Chứng từ thanh toán"
                      className="max-h-60 w-auto object-contain rounded-xl shadow-sm"
                    />
                  </div>
                  <div className="text-right">
                    <a
                      href={viewingInvoice.payment_proof.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#1A73E8] hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <Eye size={12} /> Xem ảnh kích thước đầy đủ
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-[#64748B] bg-slate-500/5">
                  <FileText size={28} className="mx-auto mb-1 opacity-30" />
                  <p className="text-xs font-medium">Chưa có ảnh chứng từ thanh toán cho hóa đơn này</p>
                </div>
              )}
            </div>

            {/* Cập nhật lại ảnh nếu up sai */}
            <div className="border-t border-slate-200/60 pt-3 space-y-3">
              <label className="block text-xs font-semibold text-[#1E293B]">
                Cập nhật ảnh mới (nếu tải lên sai)
              </label>

              <input
                ref={updateProofInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleUpdateProofFileChange}
                className="hidden"
                id="update-proof-upload"
              />

              {!updateProofFile ? (
                <label
                  htmlFor="update-proof-upload"
                  className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-xl bg-white/50 hover:bg-white/80 transition-all duration-150 cursor-pointer text-center"
                >
                  <Upload size={22} className="text-[#1A73E8] mb-1" />
                  <span className="text-xs font-medium text-[#1E293B]">
                    Bấm để chọn ảnh mới thay thế
                  </span>
                  <span className="text-[11px] text-[#64748B] mt-0.5">PNG, JPG, WebP tối đa 5MB</span>
                </label>
              ) : (
                <div className="space-y-2 p-3 bg-blue-50/50 rounded-xl border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1A73E8]">Ảnh mới đã chọn:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setUpdateProofFile(null);
                        setUpdateProofPreview(null);
                      }}
                      className="text-xs text-rose-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer font-medium"
                    >
                      <X size={13} /> Hủy chọn
                    </button>
                  </div>
                  {updateProofPreview && (
                    <div className="flex items-center justify-center p-1 bg-white rounded-lg border border-slate-200">
                      <img
                        src={updateProofPreview}
                        alt="Ảnh mới"
                        className="max-h-48 w-auto object-contain rounded-md"
                      />
                    </div>
                  )}
                  <div className="text-[11px] text-[#64748B] truncate">
                    {updateProofFile.name} ({(updateProofFile.size / 1024).toFixed(1)} KB)
                  </div>
                </div>
              )}

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={updateProofNotes}
                  onChange={(e) => setUpdateProofNotes(e.target.value)}
                  placeholder="Ghi chú thêm về chứng từ..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={updateProofSubmitting}
                onClick={() => setProofModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 text-[#1E293B] rounded-xl text-sm font-medium hover:bg-slate-200 transition-all duration-150 hover:scale-[1.01] cursor-pointer disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={updateProofSubmitting || (!updateProofFile && updateProofNotes === (viewingInvoice.notes || ''))}
                onClick={handleSaveUpdatedProof}
                className="flex-1 px-4 py-2.5 bg-[#1A73E8] text-white rounded-xl text-sm font-medium hover:bg-[#1557B0] transition-all duration-150 hover:scale-[1.01] shadow-sm shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
              >
                {updateProofSubmitting ? 'Đang lưu...' : 'Lưu cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CẤU HÌNH DÙNG CHUNG (Định mức, đơn giá, số ngày thu tự động - AC-01) */}
      {/* ========================================================================= */}
      {configModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => !configSubmitting && setConfigModalOpen(false)}
        >
          <div
            className="bg-white/95 backdrop-blur-xl rounded-2xl border border-white/80 p-6 w-full max-w-lg shadow-xl space-y-5 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2 text-[#1A73E8] font-bold text-lg">
                <SlidersHorizontal size={20} />
                <h2>Cấu hình định mức & đơn giá điện - nước</h2>
              </div>
              <button
                onClick={() => setConfigModalOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#64748B] hover:text-[#1E293B] hover:bg-white/80 border border-transparent hover:border-white/70 transition-all duration-150 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {configLoading ? (
              <div className="py-8 text-center text-sm text-[#64748B]">Đang tải cấu hình...</div>
            ) : (
              <form onSubmit={handleSaveConfig} className="space-y-4">
                {/* Thông số điện */}
                <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 text-sm">
                    <Zap size={16} className="text-amber-600" />
                    Thông số Điện
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                        Định mức/người (kWh) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={configForm.electricity.quota_per_person}
                        onChange={(e) =>
                          setConfigForm((f) => ({
                            ...f,
                            electricity: {
                              ...f.electricity,
                              quota_per_person: Math.max(0, parseFloat(e.target.value) || 0),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white/80 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:outline-none transition-all duration-150"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                        Đơn giá (đ/kWh) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={configForm.electricity.unit_price}
                        onChange={(e) =>
                          setConfigForm((f) => ({
                            ...f,
                            electricity: {
                              ...f.electricity,
                              unit_price: Math.max(0, parseFloat(e.target.value) || 0),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white/80 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:outline-none transition-all duration-150"
                      />
                    </div>
                  </div>
                </div>

                {/* Thông số nước */}
                <div className="border border-sky-500/20 bg-sky-500/5 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-sky-800 text-sm">
                    <Droplets size={16} className="text-sky-600" />
                    Thông số Nước
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                        Định mức/người (m³) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={configForm.water.quota_per_person}
                        onChange={(e) =>
                          setConfigForm((f) => ({
                            ...f,
                            water: {
                              ...f.water,
                              quota_per_person: Math.max(0, parseFloat(e.target.value) || 0),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white/80 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:outline-none transition-all duration-150"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                        Đơn giá (đ/m³) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={configForm.water.unit_price}
                        onChange={(e) =>
                          setConfigForm((f) => ({
                            ...f,
                            water: {
                              ...f.water,
                              unit_price: Math.max(0, parseFloat(e.target.value) || 0),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white/80 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:outline-none transition-all duration-150"
                      />
                    </div>
                  </div>
                </div>

                {/* Thời hạn thu tự động */}
                <div className="bg-slate-500/5 p-3.5 rounded-xl border border-slate-500/10 space-y-1.5">
                  <label className="block text-xs font-semibold text-[#1E293B] flex items-center gap-1.5">
                    <CalendarIcon size={14} className="text-[#64748B]" />
                    Số ngày thu tự động (ngày) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={configForm.configured_collection_days}
                    onChange={(e) =>
                      setConfigForm((f) => ({
                        ...f,
                        configured_collection_days: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white/80 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:outline-none transition-all duration-150"
                  />
                  <p className="text-[11px] text-[#64748B]">
                    Hạn kết thúc thu (due date) của mỗi phòng sẽ tự động bằng ngày ghi chỉ số cộng thêm số ngày này.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={configSubmitting}
                    onClick={() => setConfigModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200/80 rounded-xl text-sm font-medium text-[#1E293B] bg-white/70 hover:bg-white transition-all duration-150 hover:scale-[1.01] cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={configSubmitting}
                    className="flex-1 px-4 py-2.5 bg-[#1A73E8] text-white rounded-xl text-sm font-medium hover:bg-[#1557B0] transition-all duration-150 hover:scale-[1.01] shadow-sm shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {configSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
