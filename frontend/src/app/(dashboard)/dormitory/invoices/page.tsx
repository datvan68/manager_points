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
  RefreshCw,
  Home,
  ListFilter,
  Check,
  ChevronDown,
  Trash2,
  RotateCcw,
  AlertCircle,
  XCircle,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import RoomFeeCollection from '@/components/dormitory/invoices/RoomFeeCollection';
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
import { useAuth } from '@/providers/auth-provider';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import ConfirmModal from '@/components/modals/ConfirmModal';
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
export function getDisplayStatus(status?: string, reviewStatus?: string): 'Chưa thu' | 'Đã thu' | 'Chờ duyệt' {
  if (reviewStatus === 'pending') return 'Chờ duyệt';
  if (status === 'Đã thu' || status === 'Đã thanh toán') return 'Đã thu';
  return 'Chưa thu';
}

export default function InvoicesPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canConfirmInvoice =
    hasPermission('DORM_INVOICE_CONFIRM') ||
    hasPermission('admin') ||
    hasPermission('ADMIN_FULL');
  const canDeleteInvoice =
    hasPermission('DORM_INVOICE_DELETE') ||
    hasPermission('admin') ||
    hasPermission('ADMIN_FULL');
  const canBulkAction = canConfirmInvoice || canDeleteInvoice;

  const isDeleteEligible = useCallback((inv: DormInvoice) => {
    return inv.status !== 'Đã thu' && inv.status !== 'Đã thanh toán';
  }, []);

  const isApproveEligible = useCallback((inv: DormInvoice) => {
    return inv.payment_review?.status === 'pending' && Boolean(inv.payment_proof?.url);
  }, []);

  const isRowSelectable = useCallback(
    (inv: DormInvoice) => {
      if (!canBulkAction) return false;
      if (canDeleteInvoice && isDeleteEligible(inv)) return true;
      if (canConfirmInvoice && isApproveEligible(inv)) return true;
      return false;
    },
    [canBulkAction, canDeleteInvoice, canConfirmInvoice, isDeleteEligible, isApproveEligible],
  );

  const [invoices, setInvoices] = useState<DormInvoice[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'Tất cả' | 'Chưa thu' | 'Đã thu'>('Tất cả');
  const [filterMonth, setFilterMonth] = useState('');
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState<any>(null);

  // Selection & bulk review / delete state
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkReviewing, setBulkReviewing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Pagination & Compact Infinite Scroll state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isCompact, setIsCompact] = useState(false);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false);
  const [mobileLoadError, setMobileLoadError] = useState(false);
  const [mobileHasMore, setMobileHasMore] = useState(true);
  const mobilePageRef = useRef(1);
  const mobileHasMoreRef = useRef(true);
  const queryGenerationRef = useRef(0);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const invoiceRequestRef = useRef(0);

  // View mode: 'table' hoặc 'cards'
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Sub-view: 'utility' (Thu điện nước) hoặc 'room_fee' (Thu phí phòng)
  const [activeSubView, setActiveSubView] = useState<'utility' | 'room_fee'>('utility');

  // Mobile search expand state
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileSearchOpen) {
      searchRef.current?.focus();
    }
  }, [mobileSearchOpen]);

  // Responsive breakpoint listener (max-width: 1023px)
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  // Popover calendar & status filter cho bộ lọc toolbar
  const [calendarFilterOpen, setCalendarFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  // Popover calendar cho Modal Nâng cao
  const [readingDateCalendarOpen, setReadingDateCalendarOpen] = useState(false);
  const [startDateCalendarOpen, setStartDateCalendarOpen] = useState(false);
  const [dueDateCalendarOpen, setDueDateCalendarOpen] = useState(false);

  // Modal Cấu hình dùng chung (Định mức, đơn giá, số ngày thu)
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configDeadlineCalendarOpen, setConfigDeadlineCalendarOpen] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSubmitting, setConfigSubmitting] = useState(false);
  const [configQrFile, setConfigQrFile] = useState<File | null>(null);
  const [configQrPreview, setConfigQrPreview] = useState<string | null>(null);
  const [transferQrImage, setTransferQrImage] = useState<UpdateUtilityConfigInput['transfer_qr_image']>();
  const [transferQrImageFailed, setTransferQrImageFailed] = useState(false);
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
    payment_deadline: '',
  });

  async function openConfigModal() {
    try {
      setConfigLoading(true);
      setConfigDeadlineCalendarOpen(false);
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
          payment_deadline: cfg.payment_deadline ? new Date(cfg.payment_deadline).toISOString().slice(0, 10) : '',
          transfer_qr_image: cfg.transfer_qr_image,
        });
        setTransferQrImage(cfg.transfer_qr_image);
        setConfigQrFile(null);
        setConfigQrPreview(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải cấu hình');
    } finally {
      setConfigLoading(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!configForm.payment_deadline) {
      toast.error('Vui lòng chọn Hạn thanh toán');
      return;
    }
    try {
      setConfigSubmitting(true);
      let nextConfig: UpdateUtilityConfigInput = {
        ...configForm,
        transfer_qr_image: configForm.transfer_qr_image
          ? (({ url, file_name, mime_type, size }) => ({ url, file_name, mime_type, size }))(configForm.transfer_qr_image)
          : undefined,
      };
      if (configQrFile) {
        const uploadedQr = await dormitoryApi.invoices.uploadTransferQr(configQrFile);
        nextConfig = { ...configForm, transfer_qr_image: uploadedQr };
      }
      const saved = await dormitoryApi.invoices.updateConfig(nextConfig);
      setTransferQrImage(saved.transfer_qr_image);
      setTransferQrImageFailed(false);
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

  // Modal Hóa đơn thanh toán & Kiểm tra chứng từ (Dùng chung 1 modal)
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<DormInvoice | null>(null);
  const [payProofFile, setPayProofFile] = useState<File | null>(null);
  const [payProofPreview, setPayProofPreview] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [deleteProofConfirmOpen, setDeleteProofConfirmOpen] = useState(false);
  const [proofImageFailed, setProofImageFailed] = useState(false);
  const reviewRequestIdsRef = useRef<Partial<Record<'approved' | 'rejected' | 'revoked', string>>>({});

  useEffect(() => {
    setProofImageFailed(false);
  }, [payingInvoice?._id, payingInvoice?.payment_proof?.url]);

  // Load danh sách phòng
  useEffect(() => {
    dormitoryApi.rooms
      .getAll({ limit: 200 })
      .then((res) => setRooms(res.data || []))
      .catch(() => {});
  }, []);

  // Load danh sách hóa đơn
  const load = useCallback(
    async (background = false, requestedPage = page) => {
      const requestId = ++invoiceRequestRef.current;
      const requested = isCompact ? 1 : requestedPage;
      try {
        if (background) setRefreshing(true);
        else setLoading(true);
        const params: any = { page: requested, limit: pageSize };
        if (filterStatus === 'Chưa thu') params.status = 'Chưa thu';
        else if (filterStatus === 'Đã thu') params.status = 'Đã thu';
        if (filterMonth) params.billing_month = filterMonth;
        if (search) params.search = search;

        const res = await dormitoryApi.invoices.getAll(params);
        if (invoiceRequestRef.current !== requestId) return;
        setInvoices(res.data || []);
        setMeta(res.meta);
        mobilePageRef.current = requested;
        const hasMore = isCompact && requested < (res.meta?.totalPages || 1);
        mobileHasMoreRef.current = hasMore;
        setMobileHasMore(hasMore);
        setMobileLoadError(false);
      } catch (err: any) {
        if (invoiceRequestRef.current === requestId) {
          toast.error(err?.message || 'Lỗi tải danh sách hóa đơn');
        }
      } finally {
        if (invoiceRequestRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [isCompact, filterStatus, filterMonth, search, page, pageSize],
  );

  // Reset pagination on filter or breakpoint changes
  useEffect(() => {
    queryGenerationRef.current += 1;
    mobilePageRef.current = 1;
    mobileHasMoreRef.current = true;
    setMobileHasMore(true);
    setMobileLoadError(false);
    if (isCompact) {
      setPage(1);
      setSelected([]);
    }
  }, [isCompact, pageSize, search, filterStatus, filterMonth]);

  // Mobile Infinite Scroll loader
  const loadMoreMobile = useCallback(async () => {
    if (!isCompact || loading || mobileLoadingMore || !mobileHasMoreRef.current) return;
    setMobileLoadingMore(true);
    const nextPage = mobilePageRef.current + 1;
    const generation = queryGenerationRef.current;
    const requestId = ++invoiceRequestRef.current;
    try {
      const params: any = { page: nextPage, limit: pageSize };
      if (filterStatus === 'Chưa thu') params.status = 'Chưa thu';
      else if (filterStatus === 'Đã thu') params.status = 'Đã thu';
      if (filterMonth) params.billing_month = filterMonth;
      if (search) params.search = search;

      const res = await dormitoryApi.invoices.getAll(params);
      const next = res.data || [];
      if (invoiceRequestRef.current !== requestId || queryGenerationRef.current !== generation) return;
      setInvoices(current => [...current, ...next.filter(item => !current.some(row => row._id === item._id))]);
      mobilePageRef.current = nextPage;
      const hasMore = nextPage < (res.meta?.totalPages || 1);
      mobileHasMoreRef.current = hasMore;
      setMobileHasMore(hasMore);
      setMobileLoadError(false);
    } catch {
      if (queryGenerationRef.current === generation) {
        setMobileLoadError(true);
      }
    } finally {
      setMobileLoadingMore(false);
    }
  }, [isCompact, loading, mobileLoadingMore, search, filterStatus, filterMonth, pageSize]);

  // IntersectionObserver for Mobile Sentinel
  useEffect(() => {
    const target = mobileSentinelRef.current;
    if (!target || !isCompact || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !mobileLoadError) {
        void loadMoreMobile();
      }
    }, { root: mobileScrollRef.current, rootMargin: '160px', threshold: 0.1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [isCompact, loadMoreMobile, mobileLoadError]);

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

  // Mở modal Hóa đơn thanh toán / Xem & duyệt chứng từ
  async function openPayModal(inv: DormInvoice) {
    setPayingInvoice(inv);
    setPayProofFile(null);
    setPayProofPreview(null);
    setProofImageFailed(false);
    reviewRequestIdsRef.current = {};
    setPayModalOpen(true);
    try {
      const cfg = await dormitoryApi.invoices.getConfig();
      setTransferQrImage(cfg.transfer_qr_image);
      setTransferQrImageFailed(false);
    } catch {
      setTransferQrImage(undefined);
    }
  }

  function handleConfigQrChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    setConfigQrFile(file);
    setConfigQrPreview(
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : 'blob:preview',
    );
  }

  // Handle chọn file ảnh chứng từ (dùng chung cho tạo mới và thay thế)
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

  // Gửi chứng từ thanh toán (cho cả lần đầu và sau khi xóa ảnh để tải lại)
  async function handleConfirmPay(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!payingInvoice) return;
    if (!payProofFile) {
      toast.error('Vui lòng tải ảnh chứng từ thanh toán');
      return;
    }
    try {
      setPaySubmitting(true);
      const proofMeta = await dormitoryApi.invoices.uploadProof(payProofFile);
      const updated = await dormitoryApi.invoices.pay(payingInvoice._id, {
        payment_method: 'Chuyển khoản',
        payment_proof: proofMeta,
      });
      toast.success('Đã gửi chứng từ, chờ duyệt');
      setPayingInvoice(updated);
      setPayProofFile(null);
      setPayProofPreview(null);
      setPayModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi gửi chứng từ thanh toán');
    } finally {
      setPaySubmitting(false);
    }
  }

  // Xác nhận xóa ảnh chứng từ hiện tại
  function handleConfirmDeleteProof() {
    setPayingInvoice((prev) => (prev ? { ...prev, payment_proof: undefined } : null));
    setPayProofFile(null);
    setPayProofPreview(null);
    setDeleteProofConfirmOpen(false);
    toast.info('Đã xóa ảnh chứng từ. Bạn có thể chọn ảnh mới để tải lên.');
  }

  // Cập nhật / thay thế ảnh chứng từ mới (backward compatibility)
  async function handleSaveUpdatedProof() {
    if (!payingInvoice || !payProofFile) return;
    try {
      setPaySubmitting(true);
      const proofMeta = await dormitoryApi.invoices.uploadProof(payProofFile);
      const updated = await dormitoryApi.invoices.updateProof(payingInvoice._id, {
        payment_method: 'Chuyển khoản',
        payment_proof: proofMeta,
      });
      toast.success('Cập nhật chứng từ thanh toán thành công');
      setPayingInvoice(updated);
      setPayProofFile(null);
      setPayProofPreview(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi cập nhật chứng từ');
    } finally {
      setPaySubmitting(false);
    }
  }

  async function submitReviewProof(decision: 'approved' | 'rejected' | 'revoked') {
    if (!payingInvoice || reviewSubmitting) return;
    try {
      setReviewSubmitting(true);
      const requestId = reviewRequestIdsRef.current[decision] || crypto.randomUUID();
      reviewRequestIdsRef.current[decision] = requestId;
      const updated = await dormitoryApi.invoices.reviewProof(payingInvoice._id, decision, requestId);
      delete reviewRequestIdsRef.current[decision];
      setPayingInvoice(updated);
      await load();
      toast.success(
        decision === 'approved'
          ? 'Đã duyệt chứng từ'
          : decision === 'revoked'
          ? 'Đã bỏ duyệt chứng từ'
          : 'Đã từ chối chứng từ',
      );
    } catch (err: any) {
      toast.error(err?.message || 'Không thể cập nhật duyệt chứng từ');
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handleReviewProof(decision: 'approved' | 'rejected' | 'revoked') {
    if (decision === 'revoked') {
      setRevokeConfirmOpen(true);
      return;
    }
    await submitReviewProof(decision);
  }

  async function handleBulkApprove() {
    if (bulkReviewing || bulkDeleting || selected.length === 0) return;
    const selectedInvoices = invoices.filter((inv) => selected.includes(inv._id));
    const eligibleIds = selectedInvoices.filter(isApproveEligible).map((inv) => inv._id);

    if (eligibleIds.length === 0) {
      toast.info('Không có hóa đơn nào đủ điều kiện duyệt chứng từ.');
      return;
    }

    try {
      setBulkReviewing(true);
      const res = await dormitoryApi.invoices.bulkReviewProof(eligibleIds, 'approved', crypto.randomUUID());
      const failed = res.results.filter((item) => item.outcome !== 'approved');
      const failedIds = failed.map((item) => item.id);
      const remainingSelected = selected.filter((id) => !eligibleIds.includes(id) || failedIds.includes(id));
      await load(true);
      setSelected(remainingSelected);
      if (failed.length) {
        toast.warning(`Đã xử lý ${res.results.length - failed.length}/${res.results.length}; còn ${failed.length} hóa đơn cần kiểm tra.`);
      } else {
        toast.success(`Đã duyệt ${res.results.length} chứng từ.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi xử lý chứng từ.');
    } finally {
      setBulkReviewing(false);
    }
  }

  function handleOpenDeleteConfirm() {
    if (bulkDeleting || bulkReviewing || selected.length === 0) return;
    const selectedInvoices = invoices.filter((inv) => selected.includes(inv._id));
    const eligibleIds = selectedInvoices.filter(isDeleteEligible).map((inv) => inv._id);

    if (eligibleIds.length === 0) {
      toast.info('Không có hóa đơn nào đủ điều kiện xóa (chỉ xóa được hóa đơn chưa thanh toán).');
      return;
    }
    setDeleteConfirmOpen(true);
  }

  async function handleConfirmDelete() {
    if (bulkDeleting || selected.length === 0) return;
    const selectedInvoices = invoices.filter((inv) => selected.includes(inv._id));
    const eligibleIds = selectedInvoices.filter(isDeleteEligible).map((inv) => inv._id);
    if (eligibleIds.length === 0) return;

    try {
      setBulkDeleting(true);
      const res = await dormitoryApi.invoices.bulkDelete(eligibleIds);
      const deletedSet = new Set(res.deleted || []);
      const remainingSelected = selected.filter((id) => !deletedSet.has(id));
      await load(true);
      setSelected(remainingSelected);
      setDeleteConfirmOpen(false);

      const deletedCount = res.deleted?.length || 0;
      const rejectedCount = (res.rejected?.length || 0) + (res.not_found?.length || 0);

      if (rejectedCount > 0) {
        toast.warning(`Đã xóa ${deletedCount}/${res.requested} hóa đơn; ${rejectedCount} hóa đơn không thể xóa.`);
      } else {
        toast.success(`Đã xóa thành công ${deletedCount} hóa đơn.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi xóa hóa đơn.');
    } finally {
      setBulkDeleting(false);
    }
  }

  // Khai báo các cột cho ResponsiveDataView (đồng bộ theo phong cách trang Phòng)
  const columns: ResponsiveColumn<DormInvoice>[] = useMemo(
    () => [
      {
        key: 'room_id',
        header: 'Phòng',
        priority: 'primary',
        className: 'w-[150px] min-w-[150px] text-left',
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
        className: 'w-[125px] min-w-[125px] text-left',
        render: (_, inv) => (
          <span className="text-[#1E293B] font-medium">
            {formatBillingMonth(inv.billing_month, inv.billing_period)}
          </span>
        ),
      },
      {
        key: 'electricity',
        header: 'Tiền điện',
        className: 'w-[150px] min-w-[150px] text-right',
        render: (_, inv) => (
          <span className="text-right text-[#1E293B] font-medium block">
            {formatMoney(inv.electricity?.amount)}
          </span>
        ),
      },
      {
        key: 'water',
        header: 'Tiền nước',
        className: 'w-[150px] min-w-[150px] text-right',
        render: (_, inv) => (
          <span className="text-right text-[#1E293B] font-medium block">
            {formatMoney(inv.water?.amount)}
          </span>
        ),
      },
      {
        key: 'total_amount',
        header: 'Tổng tiền',
        className: 'w-[165px] min-w-[165px] text-right',
        render: (_, inv) => (
          <div className="text-right flex flex-col items-end justify-center">
            <span className="font-bold text-[#1A73E8] block">{formatMoney(inv.total_amount)}</span>
            {inv.is_exempt && (
              <span className="text-[10px] text-amber-700 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-lg inline-block mt-0.5 border border-amber-500/20">
                Miễn thu
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        className: 'w-[140px] min-w-[140px] text-center',
        render: (_, inv) => {
          const displayStatus = getDisplayStatus(inv.status, inv.payment_review?.status);
          return (
            <div className="flex items-center justify-center">
              {displayStatus === 'Đã thu' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 shadow-2xs">
                  <CheckCircle size={13} />
                  Đã thu
                </span>
              ) : displayStatus === 'Chờ duyệt' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-700 border border-blue-500/20 shadow-2xs">
                  <Eye size={13} />
                  Chờ duyệt
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20 shadow-2xs">
                  <AlertCircle size={13} />
                  Chưa thu
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'actions',
        header: 'Thao tác',
        priority: 'action',
        className: 'w-[140px] min-w-[140px] pr-5 text-right whitespace-nowrap',
        render: (_, inv) => {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                aria-label="Kiểm tra"
                onClick={() => openPayModal(inv)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/70 border border-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold hover:bg-white hover:text-[#1A73E8] hover:scale-[1.01] transition-all duration-150 shadow-2xs cursor-pointer"
                title="Kiểm tra hóa đơn & chứng từ thanh toán"
              >
                <Eye size={14} /> Kiểm tra
              </button>
            </div>
          );
        },
      },
    ],
    [],
  );

  const subViewSwitcher = (
    <div className="w-full sm:w-auto flex items-center gap-1 p-0.5 bg-white/60 backdrop-blur-md rounded-xl border border-white/80 shrink-0 shadow-2xs h-9">
      <button
        type="button"
        aria-label="Thu điện nước"
        onClick={() => setActiveSubView('utility')}
        className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          activeSubView === 'utility'
            ? 'bg-[#1A73E8] text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
        }`}
      >
        <Zap size={14} />
        <span>Thu điện nước</span>
      </button>
      <button
        type="button"
        aria-label="Thu phí phòng"
        onClick={() => setActiveSubView('room_fee')}
        className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          activeSubView === 'room_fee'
            ? 'bg-[#1A73E8] text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
        }`}
      >
        <Home size={14} />
        <span>Thu phí phòng</span>
      </button>
    </div>
  );

  return (
    <main className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6">
      {activeSubView === 'room_fee' ? (
        <RoomFeeCollection subViewSwitcher={subViewSwitcher} />
      ) : (
        <>
          {/* Header & Toolbar: mobile (2 hàng, 2 tab con full width, toolbar ưu tiên icon), desktop (chung 1 hàng) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-start gap-2 w-full shrink-0">
            {subViewSwitcher}

            {/* Mobile search bar when expanded full width */}
            {mobileSearchOpen ? (
              <div className="flex w-full items-center gap-1.5 py-0.5 sm:hidden">
                <Research
                  ref={searchRef}
                  aria-label="Tìm kiếm hóa đơn"
                  placeholder="Tìm mã HĐ, tên phòng..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                    setSelected([]);
                  }}
                  containerClassName="flex-1 w-full max-w-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Đóng tìm kiếm"
                  title="Đóng tìm kiếm"
                  onClick={() => setMobileSearchOpen(false)}
                  className="h-9 w-9 shrink-0 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700 cursor-pointer"
                >
                  <X size={16} />
                </Button>
              </div>
            ) : (
              /* Toolbar theo phong cách của trang Phòng */
              <div className="flex flex-1 items-center justify-start gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-0.5 w-full flex-nowrap min-w-0">
                {/* Search box (Desktop) */}
                <Research
                  aria-label="Tìm kiếm hóa đơn"
                  placeholder="Tìm mã HĐ, tên phòng..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                    setSelected([]);
                  }}
                  containerClassName="hidden sm:flex w-[240px] shrink-0"
                />

                {/* Mobile search toggle button */}
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Mở tìm kiếm"
                  title="Tìm kiếm"
                  onClick={() => setMobileSearchOpen(true)}
                  className="flex sm:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700 cursor-pointer"
                >
                  <Search size={15} />
                </Button>

                {/* Lọc kỳ thu (Icon trên mobile, text đầy đủ trên desktop) */}
                <Popover open={calendarFilterOpen} onOpenChange={setCalendarFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 w-9 sm:w-auto rounded-xl border border-white/80 bg-white/50 p-0 sm:px-3 text-xs font-semibold text-slate-700 hover:bg-white/80 shrink-0 gap-1.5 cursor-pointer relative"
                      title="Lọc theo kỳ thu"
                      aria-label="Lọc theo kỳ thu"
                    >
                      <CalendarIcon size={14} className="text-[#1A73E8]" />
                      <span className="hidden sm:inline">{filterMonth ? `Kỳ: ${formatBillingMonth(filterMonth)}` : 'Tất cả kỳ thu'}</span>
                      {filterMonth && (
                        <>
                          <span className="sm:hidden absolute top-1 right-1 w-2 h-2 rounded-full bg-[#1A73E8]" />
                          <X
                            size={13}
                            className="hidden sm:inline text-slate-400 hover:text-rose-600 transition-colors ml-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterMonth('');
                              setPage(1);
                              setSelected([]);
                            }}
                          />
                        </>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
                    <CustomCalendar
                      monthOnly
                      monthValue={filterMonth || defaultMonth}
                      startDate={filterMonth ? new Date(`${filterMonth}-01T00:00:00`) : null}
                      endDate={null}
                      onRangeSelect={() => {}}
                      onRangeConfirm={(start) => {
                        const y = start.getFullYear();
                        const m = String(start.getMonth() + 1).padStart(2, '0');
                        setFilterMonth(`${y}-${m}`);
                        setPage(1);
                        setSelected([]);
                        setCalendarFilterOpen(false);
                      }}
                      onCancel={() => {
                        setCalendarFilterOpen(false);
                      }}
                      onConfirm={() => setCalendarFilterOpen(false)}
                    />
                  </PopoverContent>
                </Popover>

                {/* Lọc trạng thái (Icon trên mobile, dropdown đầy đủ trên desktop) */}
                <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      aria-label="Lọc theo trạng thái"
                      title="Lọc theo trạng thái"
                      className="h-9 w-9 sm:w-auto rounded-xl border border-white/80 bg-white/50 p-0 sm:px-3 text-xs font-semibold text-slate-700 hover:bg-white/80 shrink-0 gap-1.5 cursor-pointer relative"
                    >
                      <ListFilter size={15} className={filterStatus !== 'Tất cả' ? 'text-[#1A73E8]' : 'text-slate-600'} />
                      <span className="hidden sm:inline">{filterStatus === 'Tất cả' ? 'Tất cả trạng thái' : filterStatus}</span>
                      <ChevronDown className="hidden sm:inline h-3.5 w-3.5 opacity-50 ml-0.5 text-[#64748B]" />
                      {filterStatus !== 'Tất cả' && (
                        <span className="sm:hidden absolute top-1 right-1 w-2 h-2 rounded-full bg-[#1A73E8]" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[100] w-[160px] p-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-white/80 shadow-md">
                    <div className="space-y-1">
                      {['Tất cả', 'Chưa thu', 'Đã thu'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            setFilterStatus(st as any);
                            setPage(1);
                            setSelected([]);
                            setStatusFilterOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs rounded-lg transition-all flex items-center justify-between cursor-pointer",
                            filterStatus === st ? "bg-blue-50/80 text-[#1A73E8] font-bold" : "text-slate-700 hover:bg-white/60 font-medium"
                          )}
                        >
                          <span>{st === 'Tất cả' ? 'Tất cả trạng thái' : st}</span>
                          {filterStatus === st && <Check size={14} className="text-[#1A73E8]" />}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

              {/* Cụm nút thao tác bên phải */}
              <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
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
                  className="h-9 w-9 sm:w-auto rounded-xl border border-white/80 bg-white/50 p-0 sm:px-3 text-xs font-semibold text-slate-700 hover:bg-white/80 shrink-0 gap-1.5 cursor-pointer"
                >
                  <Zap size={14} />
                  <span className="hidden sm:inline">Ghi điện nước</span>
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
          )}
        </div>

      {/* Floating Action Bar cho thao tác hàng loạt */}
      {canBulkAction && (
        <FloatingActionBar
          selectedCount={selected.length}
          onClear={() => setSelected([])}
          itemLabel="hóa đơn"
          actions={
            <>
              {canDeleteInvoice && (
                <button
                  type="button"
                  aria-label="Xóa hóa đơn đã chọn"
                  disabled={bulkDeleting || bulkReviewing}
                  onClick={handleOpenDeleteConfirm}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                >
                  Xóa
                </button>
              )}
              {canConfirmInvoice && (
                <button
                  type="button"
                  aria-label="Duyệt chứng từ đã chọn"
                  disabled={bulkReviewing || bulkDeleting}
                  onClick={() => void handleBulkApprove()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  Duyệt
                </button>
              )}
            </>
          }
        />
      )}

      {/* Responsive Data View kiểu Table của Phòng */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-sm shadow-slate-300/40 backdrop-blur-md [&_table]:text-xs [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-2.5">
        <ResponsiveDataView
          data={invoices}
          columns={columns}
          isLoading={loading}
          breakpoint="lg"
          keyExtractor={(inv) => inv._id}
          mobileScrollRef={mobileScrollRef}
          mobileVirtualization
          hidePaginationOnMobile
          mobileFooter={
            <div ref={mobileSentinelRef} className="flex min-h-12 items-center justify-center py-3 text-center text-xs text-slate-500">
              {mobileLoadingMore ? (
                'Đang tải thêm...'
              ) : mobileLoadError ? (
                <button type="button" className="text-blue-600 underline cursor-pointer" onClick={() => void loadMoreMobile()}>
                  Thử lại
                </button>
              ) : !mobileHasMore && invoices.length ? (
                'Đã hiển thị tất cả bản ghi.'
              ) : null}
            </div>
          }
          selection={
            canBulkAction
              ? {
                  selectedKeys: selected,
                  onSelectRow: (key, checked) => {
                    const invoice = invoices.find((inv) => inv._id === key);
                    if (!invoice || !isRowSelectable(invoice)) return;
                    setSelected((ids) =>
                      checked ? [...new Set([...ids, key])] : ids.filter((id) => id !== key),
                    );
                  },
                  onSelectAll: (checked) =>
                    setSelected(
                      checked
                        ? invoices.filter(isRowSelectable).map((inv) => inv._id)
                        : [],
                    ),
                  allSelected:
                    invoices.filter(isRowSelectable).length > 0 &&
                    invoices.filter(isRowSelectable).every((inv) => selected.includes(inv._id)),
                }
              : undefined
          }
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
              onPageChange={(next) => {
                setPage(next);
                setSelected([]);
              }}
              onPageSizeChange={(size) => {
                setPage(1);
                setPageSize(size);
                setSelected([]);
              }}
              pageSizeOptions={[10, 20, 50, 100]}
              isLoading={loading}
              label="hóa đơn"
            />
          }
        />
      </div>

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => !bulkDeleting && setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Xóa hóa đơn đã chọn"
        message={`Bạn có chắc chắn muốn xóa ${invoices.filter((inv) => selected.includes(inv._id) && isDeleteEligible(inv)).length} hóa đơn chưa thanh toán đã chọn? Thao tác này không thể hoàn tác.`}
        confirmLabel="Xóa hóa đơn"
        variant="danger"
      />

      <ConfirmModal
        isOpen={revokeConfirmOpen}
        onClose={() => !reviewSubmitting && setRevokeConfirmOpen(false)}
        onConfirm={async () => {
          await submitReviewProof('revoked');
          setRevokeConfirmOpen(false);
        }}
        title="Bỏ duyệt chứng từ"
        message="Hóa đơn sẽ trở về trạng thái Chưa thu và thành viên có thể đăng tải lại chứng từ. Bạn có chắc chắn muốn tiếp tục?"
        confirmLabel="Bỏ duyệt"
        variant="warning"
      />

      <ConfirmModal
        isOpen={deleteProofConfirmOpen}
        onClose={() => setDeleteProofConfirmOpen(false)}
        onConfirm={handleConfirmDeleteProof}
        title="Xác nhận xóa ảnh chứng từ"
        message="Bạn có chắc chắn muốn xóa ảnh chứng từ này không? Sau khi xóa, bạn có thể chọn và tải lên ảnh chứng từ mới."
        confirmLabel="Xóa ảnh"
        variant="danger"
      />

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
      {/* MODAL HÓA ĐƠN THANH TOÁN (Dùng chung cho Nộp chứng từ & Kiểm tra / Duyệt) */}
      {/* ========================================================================= */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#F8FAFC] to-[#EEF4FB] p-6 shadow-2xl">
          {payingInvoice && (() => {
            const isApproved =
              payingInvoice.payment_review?.status === 'approved' &&
              (payingInvoice.status === 'Đã thu' || payingInvoice.status === 'Đã thanh toán');
            const isPendingReview = payingInvoice.payment_review?.status === 'pending';
            const isRejected = payingInvoice.payment_review?.status === 'rejected';
            const hasExistingProof = !!payingInvoice.payment_proof?.url;

            return (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-200/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-xl font-bold text-[#1E293B]">
                        Hóa đơn thanh toán
                      </DialogTitle>
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={13} className="shrink-0" />
                          Đã thu
                        </span>
                      ) : isPendingReview ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <Eye size={13} className="shrink-0" />
                          Chờ duyệt
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <X size={13} className="shrink-0" />
                          Từ chối / Bỏ duyệt
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={13} className="shrink-0" />
                          Sẵn sàng
                        </span>
                      )}
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
                  {/* Cột trái: Chi tiết chi phí, timeline / thông tin thu & upload chứng từ */}
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

                    {/* Thông tin thanh toán (khi đã thu hoặc có xác nhận) */}
                    {(isApproved || payingInvoice.paid_at || payingInvoice.confirmed_by_id) && (
                      <div className="grid grid-cols-2 gap-2.5 text-xs bg-white/60 p-3 rounded-xl border border-slate-200/70">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Phương thức</span>
                          <span className="font-semibold text-slate-800">
                            {payingInvoice.payment_method || 'Chuyển khoản'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Ngày thu</span>
                          <span className="font-semibold text-slate-800">
                            {formatDate(payingInvoice.paid_at)}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 block text-[11px]">Người xác nhận</span>
                          <span className="font-semibold text-slate-800">
                            {payingInvoice.confirmed_by_id?.full_name ||
                              payingInvoice.confirmed_by_id?.user_name ||
                              'Quản lý KTX'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Timeline Kỳ thu & Hạn thanh toán (khi chưa thu) */}
                    {!isApproved && (
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
                    )}

                    {/* Phần ảnh chứng từ */}
                    {hasExistingProof ? (
                      <div className="space-y-3">
                        {/* Ảnh chứng từ hiện tại */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold text-[#1E293B]">
                              Ảnh chứng từ hiện tại
                            </label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteProofConfirmOpen(true)}
                              className="h-7 px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border-rose-200 rounded-xl inline-flex items-center gap-1 cursor-pointer transition-all hover:scale-[1.01]"
                              title="Xóa ảnh chứng từ hiện tại"
                            >
                              <Trash2 size={13} />
                              <span>Xóa ảnh</span>
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <div className="border border-slate-200/60 rounded-xl overflow-hidden bg-slate-900/5 flex items-center justify-center p-2">
                              {proofImageFailed ? (
                                <a
                                  className="inline-flex items-center justify-center p-6 text-xs text-blue-600 hover:underline font-medium"
                                  href={getImageUrl(payingInvoice.payment_proof?.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Mở ảnh gốc
                                </a>
                              ) : (
                                <img
                                  src={getImageUrl(payingInvoice.payment_proof?.url)}
                                  alt="Chứng từ thanh toán"
                                  onError={() => setProofImageFailed(true)}
                                  className="max-h-48 w-auto object-contain rounded-lg shadow-sm"
                                />
                              )}
                            </div>
                            <div className="text-right">
                              <a
                                href={getImageUrl(payingInvoice.payment_proof?.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-[#1A73E8] hover:underline inline-flex items-center gap-1 font-medium"
                              >
                                <Eye size={12} /> Xem ảnh kích thước đầy đủ
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Upload ảnh chứng từ */
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[#1E293B] mb-1 flex items-center justify-between">
                          <span>Ảnh chứng từ thanh toán</span>
                          <span className="text-[11px] text-[#1A73E8] font-normal">Bắt buộc để gửi duyệt</span>
                        </label>
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
                          <div className="space-y-2">
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
                        )}
                      </div>
                    )}

                  </div>

                  {/* Cột phải: Thẻ Quét mã QR thanh toán & Tải hóa đơn */}
                  <div className="md:col-span-5 md:sticky md:top-0 md:self-start flex flex-col items-center rounded-2xl border border-slate-200/70 bg-white p-4 shadow-2xs text-center gap-3">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Quét mã để thanh toán
                    </p>

                    <div className="w-full h-44 max-w-[220px] flex items-center justify-center p-2 rounded-xl bg-slate-50/60 border border-slate-100">
                      {transferQrImage?.url && !transferQrImageFailed ? (
                        <img
                          src={getImageUrl(transferQrImage.url)}
                          alt="Mã QR chuyển khoản"
                          onError={() => setTransferQrImageFailed(true)}
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center px-4 text-xs text-slate-500">
                          {transferQrImageFailed ? 'Không thể tải mã QR chuyển khoản' : 'Chưa cấu hình mã QR chuyển khoản'}
                        </div>
                      )}
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2 border-t border-slate-200/60 pt-3">
                      {isPendingReview && canConfirmInvoice && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={reviewSubmitting || paySubmitting}
                            onClick={() => handleReviewProof('rejected')}
                            className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-1.5 font-semibold text-xs h-9 cursor-pointer transition-all hover:scale-[1.01]"
                          >
                            <XCircle size={14} />
                            <span>Không duyệt</span>
                          </Button>
                          <Button
                            type="button"
                            disabled={reviewSubmitting || paySubmitting}
                            onClick={() => handleReviewProof('approved')}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1.5 font-semibold text-xs h-9 cursor-pointer transition-all hover:scale-[1.01]"
                          >
                            <CheckCircle size={14} />
                            <span>{reviewSubmitting ? 'Đang xử lý...' : 'Duyệt'}</span>
                          </Button>
                        </>
                      )}
                      {isApproved && canConfirmInvoice && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={reviewSubmitting || paySubmitting}
                          onClick={() => handleReviewProof('revoked')}
                          className="col-span-2 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 flex items-center justify-center gap-1.5 font-semibold text-xs h-9 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          <RotateCcw size={14} />
                          <span>{reviewSubmitting ? 'Đang xử lý...' : 'Bỏ duyệt'}</span>
                        </Button>
                      )}
                      {hasExistingProof && payProofFile && (
                        <Button
                          type="button"
                          disabled={paySubmitting || reviewSubmitting}
                          onClick={handleSaveUpdatedProof}
                          className="col-span-2 rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white shadow-xs flex items-center justify-center gap-1.5 font-semibold text-xs h-9 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          <Upload size={14} />
                          <span>{paySubmitting ? 'Đang lưu...' : 'Lưu cập nhật'}</span>
                        </Button>
                      )}
                      {!hasExistingProof && (
                        <Button
                          type="button"
                          disabled={paySubmitting || reviewSubmitting || !payProofFile}
                          onClick={handleConfirmPay}
                          className="col-span-2 rounded-xl bg-[#1A73E8] hover:bg-blue-600 text-white shadow-xs flex items-center justify-center gap-1.5 font-semibold text-xs h-9 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          <Upload size={14} />
                          <span>{paySubmitting ? 'Đang xử lý...' : 'Gửi duyệt'}</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        disabled={paySubmitting || reviewSubmitting}
                        onClick={() => setPayModalOpen(false)}
                        className="col-span-2 rounded-xl border-slate-200/80 bg-white/70 text-slate-700 hover:bg-white flex items-center justify-center gap-1.5 font-semibold text-xs h-9 cursor-pointer transition-all hover:scale-[1.01]"
                      >
                        <X size={14} />
                        <span>Đóng</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
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
                  Hạn thanh toán <span className="text-red-500">*</span>
                </label>
                <Popover open={configDeadlineCalendarOpen} onOpenChange={setConfigDeadlineCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label="Chọn ngày thanh toán" className="flex w-full items-center justify-between rounded-xl border border-slate-200/80 bg-white/80 px-3 py-1.5 text-left text-sm text-[#1E293B]">
                      <span>{configForm.payment_deadline ? formatDate(configForm.payment_deadline) : 'Chọn ngày'}</span><CalendarIcon size={14} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
                    <CustomCalendar
                      startDate={configForm.payment_deadline ? new Date(`${configForm.payment_deadline}T00:00:00`) : null}
                      endDate={null}
                      minDate={new Date()}
                      onRangeSelect={(start) => setConfigForm((f) => ({ ...f, payment_deadline: toDateValue(start) }))}
                      onRangeConfirm={(start) => {
                        setConfigForm((f) => ({ ...f, payment_deadline: toDateValue(start) }));
                        setConfigDeadlineCalendarOpen(false);
                      }}
                      onCancel={() => setConfigDeadlineCalendarOpen(false)}
                      onConfirm={() => setConfigDeadlineCalendarOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
                <input aria-label="Hạn thanh toán" value={configForm.payment_deadline || ''} onChange={(e) => setConfigForm((f) => ({ ...f, payment_deadline: e.target.value }))} className="sr-only" />
              </div>

              <div className="space-y-3 rounded-xl border border-blue-500/15 bg-blue-500/5 p-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#1E293B]">Mã QR chuyển khoản mặc định</label>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">PNG, JPG hoặc WebP, tối đa 5MB.</p>
                </div>
                <input id="config-transfer-qr-upload" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleConfigQrChange} className="hidden" />
                <div className="flex items-center gap-3">
                  {(configQrPreview || configForm.transfer_qr_image?.url) ? (
                    <img src={configQrPreview || getImageUrl(configForm.transfer_qr_image?.url)} alt="Xem trước mã QR chuyển khoản" className="h-24 w-24 rounded-lg border border-slate-200 bg-white object-contain p-1" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/70 px-2 text-center text-[11px] text-slate-500">Chưa có mã QR</div>
                  )}
                  <label htmlFor="config-transfer-qr-upload" className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Upload size={14} /> {configForm.transfer_qr_image?.url || configQrFile ? 'Thay ảnh QR' : 'Chọn ảnh QR'}
                  </label>
                </div>
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
        </>
      )}
    </main>
  );
}
