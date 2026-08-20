'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  CheckCircle,
  SlidersHorizontal,
  FileText,
  X,
  Upload,
  Eye,
  Zap,
  Droplets,
  Calendar as CalendarIcon,
  DollarSign,
  Download,
  RefreshCw,
} from 'lucide-react';
import QRCode from 'qrcode';
import {
  dormitoryApi,
  DormInvoice,
  Room,
  CreateMonthlyInvoiceInput,
  UpdateMonthlyInvoiceInput,
  UpdateUtilityConfigInput,
} from '@/api/dormitory-api';
import { API_ORIGIN } from '@/api/config';
import { toast } from 'sonner';
import { CustomPagination } from '@/components/ui/pagination';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Research } from '@/components/ui/Research';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';

// Helper tạo URL ảnh đầy đủ cho frontend
export function getImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Helper format tiền tệ
export function formatMoney(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0đ';
  return `${Number(amount).toLocaleString('vi-VN')}đ`;
}

// Helper format kỳ thu
export function formatBillingMonth(billingMonth?: string, billingPeriod?: string): string {
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

// Helper format khoảng thời gian kỳ thu
export function getMonthPeriodRange(billingMonth?: string, billingPeriod?: string): string {
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;
  if (billingMonth && /^\d{4}-\d{2}$/.test(billingMonth)) {
    const parts = billingMonth.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else if (billingPeriod) {
    const match = /^T(\d{2})\/(\d{4})$/.exec(billingPeriod);
    if (match) {
      month = parseInt(match[1], 10);
      year = parseInt(match[2], 10);
    }
  }
  const lastDay = new Date(year, month, 0).getDate();
  const mStr = String(month).padStart(2, '0');
  return `01/${mStr} - ${lastDay}/${mStr}/${year}`;
}

// Helper format ngày
export function formatDate(dateStr?: string | Date): string {
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
export function toDateValue(date: Date | null | string): string {
  if (!date) return '';
  if (typeof date === 'string') return date;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Chuẩn hóa trạng thái hiển thị (chỉ có Chưa thu hoặc Đã thu)
export function getDisplayStatus(status?: string): 'Chưa thu' | 'Đã thu' {
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

  // QR Code Data URL cho modal thanh toán/kiểm tra
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Load danh sách phòng
  useEffect(() => {
    dormitoryApi.rooms
      .getAll({ limit: 200 })
      .then((res) => setRooms(res.data || []))
      .catch(() => {});
  }, []);

  // Load danh sách hóa đơn
  const load = useCallback(
    async (background = false) => {
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
    },
    [filterStatus, filterMonth, search, page, pageSize],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Tạo QR Code cho modal active
  useEffect(() => {
    const activeInvoice = payingInvoice || viewingInvoice;
    if (!activeInvoice) {
      setQrCodeDataUrl('');
      return;
    }
    const roomName =
      typeof activeInvoice.room_id === 'object' && activeInvoice.room_id
        ? activeInvoice.room_id.room_name || activeInvoice.room_id.room_code
        : 'KTX';
    const amount = activeInvoice.total_amount || 0;
    const month = formatBillingMonth(activeInvoice.billing_month, activeInvoice.billing_period);
    const invoiceCode = activeInvoice.invoice_code || activeInvoice._id;

    const qrPayload = `STK: 1234567890 | Ngan hang: MBBank | ND: KTX ${roomName} T${month.replace('/', '')} ${invoiceCode} | So tien: ${amount}`;
    QRCode.toDataURL(qrPayload, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('QR render error:', err));
  }, [payingInvoice, viewingInvoice]);

  const handleDownloadQr = (invoice: DormInvoice) => {
    if (!qrCodeDataUrl) return;
    const roomName =
      typeof invoice.room_id === 'object' && invoice.room_id
        ? invoice.room_id.room_name || invoice.room_id.room_code
        : 'KTX';
    const month = formatBillingMonth(invoice.billing_month, invoice.billing_period).replace('/', '-');
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `Hoa_don_${roomName}_${month}.png`;
    a.click();
    toast.success('Đã tải mã QR hóa đơn');
  };

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

  // Khai báo các cột cho ResponsiveDataView (đồng bộ theo phong cách trang Phòng)
  const columns: ResponsiveColumn<DormInvoice>[] = useMemo(
    () => [
      {
        key: 'room_id',
        header: 'Phòng',
        priority: 'primary',
        render: (_, inv) => {
          const roomName =
            typeof inv.room_id === 'object' && inv.room_id
              ? inv.room_id.room_name || inv.room_id.room_code || 'Phòng'
              : '—';
          return <span className="font-semibold text-[#1E293B]">{roomName}</span>;
        },
      },
      {
        key: 'billing_month',
        header: 'Kỳ thu',
        priority: 'secondary',
        render: (_, inv) => (
          <span className="text-[#1E293B] font-medium">
            {formatBillingMonth(inv.billing_month, inv.billing_period)}
          </span>
        ),
      },
      {
        key: 'electricity',
        header: 'Tiền điện',
        className: 'text-right',
        render: (_, inv) => (
          <span className="text-right text-[#1E293B] font-medium block">
            {formatMoney(inv.electricity?.amount)}
          </span>
        ),
      },
      {
        key: 'water',
        header: 'Tiền nước',
        className: 'text-right',
        render: (_, inv) => (
          <span className="text-right text-[#1E293B] font-medium block">
            {formatMoney(inv.water?.amount)}
          </span>
        ),
      },
      {
        key: 'total_amount',
        header: 'Tổng tiền',
        className: 'text-right',
        render: (_, inv) => (
          <div className="text-right">
            <div className="font-bold text-[#1A73E8]">{formatMoney(inv.total_amount)}</div>
            {inv.is_exempt && (
              <div className="text-[10px] text-amber-700 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-lg inline-block mt-0.5 border border-amber-500/20">
                Miễn thu
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        className: 'text-center',
        render: (_, inv) => {
          const displayStatus = getDisplayStatus(inv.status);
          return displayStatus === 'Đã thu' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 shadow-2xs">
              <CheckCircle size={13} />
              Đã thu
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20 shadow-2xs">
              Chưa thu
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Thao tác',
        priority: 'action',
        className: 'text-right',
        render: (_, inv) => {
          const displayStatus = getDisplayStatus(inv.status);
          return (
            <div className="flex items-center justify-end gap-1.5">
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
          );
        },
      },
    ],
    [],
  );

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

      {/* Responsive Data View kiểu Table của Phòng */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-sm shadow-slate-300/40 backdrop-blur-md [&_table]:text-xs [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-2.5">
        <ResponsiveDataView
          data={invoices}
          columns={columns}
          isLoading={loading}
          keyExtractor={(inv) => inv._id}
          emptyState={
            <div className="p-8 text-center text-sm text-slate-500">
              <FileText size={36} className="mx-auto mb-2 opacity-40" />
              Không có hóa đơn nào phù hợp
            </div>
          }
          pagination={
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
          }
        />
      </div>

      {/* ========================================================================= */}
      {/* MODAL NÂNG CAO (Lập đợt thu / Chỉnh sửa thông số) */}
      {/* ========================================================================= */}
      <Dialog open={advancedModalOpen} onOpenChange={setAdvancedModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl">
          <DialogHeader className="border-b border-white/50 pb-3">
            <DialogTitle className="text-lg font-bold text-[#1E293B]">
              {editingInvoice ? 'Chỉnh sửa thông số hóa đơn' : 'Lập đợt thu tiền phòng'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveAdvanced} className="space-y-4 pt-2">
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] flex items-center justify-between text-left focus:ring-2 focus:ring-[#1A73E8]/30"
                    >
                      <span>{advancedForm.reading_date ? formatDate(advancedForm.reading_date) : 'Chọn ngày'}</span>
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
                <label className="block text-xs font-semibold text-[#1E293B]">Số người ở thực tế</label>
                <input
                  type="number"
                  min="0"
                  value={advancedForm.occupant_count}
                  onChange={(e) =>
                    setAdvancedForm((f) => ({
                      ...f,
                      occupant_count: Math.max(0, parseInt(e.target.value, 10) || 0),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150"
                />
              </div>
            </div>

            {/* Chỉ số điện */}
            <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-800 text-xs flex items-center gap-1">
                  <Zap size={14} className="text-amber-600" /> Chỉ số Điện (kWh)
                </span>
                <span className="text-xs text-amber-700 font-medium">
                  Tiêu thụ: <b>{previewCalc.electricity.consumption} kWh</b> | Vượt: <b>{previewCalc.electricity.excess} kWh</b>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] text-[#64748B]">Số cũ</label>
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
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#64748B]">Số mới</label>
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
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#64748B]">Định mức/người</label>
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
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#64748B]">Đơn giá (đ)</label>
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
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Chỉ số nước */}
            <div className="border border-sky-500/20 bg-sky-500/5 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-800 text-xs flex items-center gap-1">
                  <Droplets size={14} className="text-sky-600" /> Chỉ số Nước (m³)
                </span>
                <span className="text-xs text-sky-700 font-medium">
                  Tiêu thụ: <b>{previewCalc.water.consumption} m³</b> | Vượt: <b>{previewCalc.water.excess} m³</b>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] text-[#64748B]">Số cũ</label>
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
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#64748B]">Số mới</label>
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
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#64748B]">Định mức/người</label>
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
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#64748B]">Đơn giá (đ)</label>
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
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Thời hạn thu */}
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
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] flex items-center justify-between text-left focus:ring-2 focus:ring-[#1A73E8]/30"
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
                  Hạn kết thúc thu
                </label>
                <Popover open={dueDateCalendarOpen} onOpenChange={setDueDateCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-[#1E293B] flex items-center justify-between text-left focus:ring-2 focus:ring-[#1A73E8]/30"
                    >
                      <span>{advancedForm.due_date ? formatDate(advancedForm.due_date) : 'Chọn hạn thanh toán'}</span>
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

            {/* Checkbox Miễn thu */}
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
              <Button
                type="button"
                variant="outline"
                disabled={advancedSubmitting}
                onClick={() => setAdvancedModalOpen(false)}
                className="flex-1 rounded-xl"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={advancedSubmitting}
                className="flex-1 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0]"
              >
                {advancedSubmitting ? 'Đang lưu...' : editingInvoice ? 'Cập nhật' : 'Tạo đợt thu'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL THU TIỀN (Theo kiểu UI Mockup 2 cột kèm QR và Timeline) */}
      {/* ========================================================================= */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-3xl border border-white/80 bg-gradient-to-br from-[#F8FAFC] to-[#EEF4FB] p-6 shadow-2xl">
          {payingInvoice && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-200/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-xl font-bold text-[#1E293B]">
                      Hóa đơn thanh toán
                    </DialogTitle>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle size={13} className="shrink-0" />
                      Sẵn sàng
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {typeof payingInvoice.room_id === 'object' && payingInvoice.room_id
                      ? payingInvoice.room_id.room_name || payingInvoice.room_id.room_code
                      : 'Phòng'}{' '}
                    - Tháng {formatBillingMonth(payingInvoice.billing_month, payingInvoice.billing_period)}
                  </p>
                </div>
              </div>

              {/* 2-Column Content */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-1">
                {/* Cột trái: Chi tiết chi phí, timeline & form xác nhận */}
                <div className="md:col-span-7 space-y-4">
                  {/* Bảng kê chi phí */}
                  <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-sm p-4 space-y-2.5 text-xs shadow-2xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Tiền điện</span>
                      <span className="font-semibold text-slate-800">
                        {formatMoney(payingInvoice.electricity?.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Tiền nước</span>
                      <span className="font-semibold text-slate-800">
                        {formatMoney(payingInvoice.water?.amount)}
                      </span>
                    </div>
                    <div className="border-t border-slate-200/80 pt-2.5 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-700">Tổng cộng</span>
                      <div className="text-right">
                        <span className="text-xl sm:text-2xl font-black text-[#1A73E8]">
                          {formatMoney(payingInvoice.total_amount)}
                        </span>
                        {payingInvoice.is_exempt && (
                          <div className="text-[10px] text-amber-700 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-lg border border-amber-500/20 inline-block ml-2">
                            Miễn thu
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timeline Kỳ thu & Hạn thanh toán */}
                  <div className="relative pl-5 space-y-3 text-xs">
                    <div className="absolute left-1.5 top-1.5 bottom-1.5 w-0.5 bg-slate-200" />

                    <div className="relative flex items-start gap-2.5">
                      <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-[#F8FAFC]" />
                      <div>
                        <p className="text-[11px] text-slate-400 font-medium">Kỳ thanh toán</p>
                        <p className="font-semibold text-slate-700">
                          {getMonthPeriodRange(payingInvoice.billing_month, payingInvoice.billing_period)}
                        </p>
                      </div>
                    </div>

                    <div className="relative flex items-start gap-2.5">
                      <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-[#F8FAFC]" />
                      <div>
                        <p className="text-[11px] text-slate-400 font-medium">Hạn thanh toán</p>
                        <p className="font-bold text-amber-600">{formatDate(payingInvoice.due_date)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Form xác nhận đóng tiền */}
                  <form onSubmit={handleConfirmPay} className="space-y-3 pt-2">
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
                            className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${
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

                    {/* Upload ảnh chứng từ */}
                    <div>
                      <label className="block text-xs font-semibold text-[#1E293B] mb-1 flex items-center justify-between">
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
                            className="flex flex-col items-center justify-center p-3.5 border border-dashed border-slate-300 rounded-xl bg-white/50 hover:bg-white/80 transition-all duration-150 cursor-pointer text-center"
                          >
                            <Upload size={20} className="text-[#1A73E8] mb-1" />
                            <span className="text-xs font-medium text-[#1E293B]">Bấm để chọn file ảnh bill/chứng từ</span>
                            <span className="text-[11px] text-[#64748B] mt-0.5">PNG, JPG, WebP tối đa 5MB</span>
                          </label>
                        ) : (
                          <div className="flex items-center justify-between p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <CheckCircle size={15} className="text-emerald-700 shrink-0" />
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
                              className="max-h-36 w-auto object-contain rounded-lg shadow-2xs"
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
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white/70 text-xs text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150"
                      />
                    </div>

                    {/* Submit Actions */}
                    <div className="flex gap-2.5 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={paySubmitting}
                        onClick={() => setPayModalOpen(false)}
                        className="flex-1 rounded-xl"
                      >
                        Hủy
                      </Button>
                      <Button
                        type="submit"
                        disabled={paySubmitting}
                        className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {paySubmitting ? 'Đang xử lý...' : 'Xác nhận thu'}
                      </Button>
                    </div>
                  </form>
                </div>

                {/* Cột phải: Thẻ Quét mã QR thanh toán & Tải hóa đơn */}
                <div className="md:col-span-5 flex flex-col items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-4 shadow-2xs text-center gap-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Quét mã để thanh toán
                  </p>

                  <div className="w-full aspect-square max-w-[200px] flex items-center justify-center p-2 rounded-xl bg-slate-50/60 border border-slate-100">
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt="Mã QR thanh toán"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        Đang tạo mã QR...
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDownloadQr(payingInvoice)}
                    className="w-full h-9 rounded-xl border border-slate-200/80 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 gap-1.5 cursor-pointer"
                  >
                    <Download size={14} className="text-[#1A73E8]" />
                    <span>Tải hóa đơn</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL KIỂM TRA & CẬP NHẬT CHỨNG TỪ (Theo kiểu UI Mockup 2 cột) */}
      {/* ========================================================================= */}
      <Dialog open={proofModalOpen} onOpenChange={setProofModalOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-3xl border border-white/80 bg-gradient-to-br from-[#F8FAFC] to-[#EEF4FB] p-6 shadow-2xl">
          {viewingInvoice && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-200/60 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-xl font-bold text-[#1E293B]">
                      Kiểm tra chứng từ thanh toán
                    </DialogTitle>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      <CheckCircle size={13} className="shrink-0" />
                      Đã thu
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {typeof viewingInvoice.room_id === 'object' && viewingInvoice.room_id
                      ? viewingInvoice.room_id.room_name || viewingInvoice.room_id.room_code
                      : 'Phòng'}{' '}
                    - Tháng {formatBillingMonth(viewingInvoice.billing_month, viewingInvoice.billing_period)}
                  </p>
                </div>
              </div>

              {/* 2-Column Content */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-1">
                {/* Cột trái: Chi tiết chi phí, thông tin thu & ảnh chứng từ */}
                <div className="md:col-span-7 space-y-4">
                  {/* Bảng kê chi phí */}
                  <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur-sm p-4 space-y-2.5 text-xs shadow-2xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Tiền điện</span>
                      <span className="font-semibold text-slate-800">
                        {formatMoney(viewingInvoice.electricity?.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Tiền nước</span>
                      <span className="font-semibold text-slate-800">
                        {formatMoney(viewingInvoice.water?.amount)}
                      </span>
                    </div>
                    <div className="border-t border-slate-200/80 pt-2.5 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-700">Tổng cộng</span>
                      <div className="text-right">
                        <span className="text-xl sm:text-2xl font-black text-[#1A73E8]">
                          {formatMoney(viewingInvoice.total_amount)}
                        </span>
                        {viewingInvoice.is_exempt && (
                          <div className="text-[10px] text-amber-700 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-lg border border-amber-500/20 inline-block ml-2">
                            Miễn thu
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thông tin thanh toán */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs bg-white/60 p-3 rounded-xl border border-slate-200/70">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Phương thức</span>
                      <span className="font-semibold text-slate-800">
                        {viewingInvoice.payment_method || 'Chuyển khoản'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Ngày thu</span>
                      <span className="font-semibold text-slate-800">
                        {formatDate(viewingInvoice.paid_at)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[11px]">Người xác nhận</span>
                      <span className="font-semibold text-slate-800">
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
                            className="max-h-52 w-auto object-contain rounded-lg shadow-sm"
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
                      <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-[#64748B] bg-slate-500/5">
                        <FileText size={24} className="mx-auto mb-1 opacity-30" />
                        <p className="text-xs font-medium">Chưa có ảnh chứng từ thanh toán cho hóa đơn này</p>
                      </div>
                    )}
                  </div>

                  {/* Cập nhật ảnh mới nếu up sai */}
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
                        className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 rounded-xl bg-white/50 hover:bg-white/80 transition-all duration-150 cursor-pointer text-center"
                      >
                        <Upload size={18} className="text-[#1A73E8] mb-1" />
                        <span className="text-xs font-medium text-[#1E293B]">
                          Bấm để chọn ảnh mới thay thế
                        </span>
                        <span className="text-[11px] text-[#64748B] mt-0.5">PNG, JPG, WebP tối đa 5MB</span>
                      </label>
                    ) : (
                      <div className="space-y-2 p-2.5 bg-blue-50/50 rounded-xl border border-blue-500/20">
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
                              className="max-h-40 w-auto object-contain rounded-md"
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
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white/70 text-xs text-[#1E293B] focus:ring-2 focus:ring-[#1A73E8]/30 focus:border-[#1A73E8] focus:outline-none transition-all duration-150"
                      />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2.5 pt-2 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={updateProofSubmitting}
                      onClick={() => setProofModalOpen(false)}
                      className="flex-1 rounded-xl"
                    >
                      Đóng
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        updateProofSubmitting ||
                        (!updateProofFile && updateProofNotes === (viewingInvoice.notes || ''))
                      }
                      onClick={handleSaveUpdatedProof}
                      className="flex-1 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0]"
                    >
                      {updateProofSubmitting ? 'Đang lưu...' : 'Lưu cập nhật'}
                    </Button>
                  </div>
                </div>

                {/* Cột phải: Thẻ Quét mã QR & Tải hóa đơn */}
                <div className="md:col-span-5 flex flex-col items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-4 shadow-2xs text-center gap-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Quét mã để thanh toán
                  </p>

                  <div className="w-full aspect-square max-w-[200px] flex items-center justify-center p-2 rounded-xl bg-slate-50/60 border border-slate-100">
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt="Mã QR thanh toán"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        Đang tạo mã QR...
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDownloadQr(viewingInvoice)}
                    className="w-full h-9 rounded-xl border border-slate-200/80 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 gap-1.5 cursor-pointer"
                  >
                    <Download size={14} className="text-[#1A73E8]" />
                    <span>Tải hóa đơn</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL CẤU HÌNH DÙNG CHUNG (Định mức, đơn giá, số ngày thu tự động) */}
      {/* ========================================================================= */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl">
          <DialogHeader className="border-b border-white/50 pb-3">
            <DialogTitle className="flex items-center gap-2 text-[#1A73E8] font-bold text-lg">
              <SlidersHorizontal size={20} />
              Cấu hình định mức & đơn giá điện - nước
            </DialogTitle>
          </DialogHeader>

          {configLoading ? (
            <div className="py-8 text-center text-sm text-[#64748B]">Đang tải cấu hình...</div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-4 pt-2">
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
                <Button
                  type="button"
                  variant="outline"
                  disabled={configSubmitting}
                  onClick={() => setConfigModalOpen(false)}
                  className="flex-1 rounded-xl"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={configSubmitting}
                  className="flex-1 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0]"
                >
                  {configSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
