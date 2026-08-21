'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  CheckCircle,
  SlidersHorizontal,
  FileText,
  X,
  Upload,
  Eye,
  Calendar as CalendarIcon,
  DollarSign,
  Plus,
  User,
  Home,
  Check,
  AlertCircle,
  QrCode,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  ListFilter,
  ChevronDown,
  ChevronUp,
  Trash2,
  XCircle,
  Send,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDormitoryInvoicesRealtime } from '@/hooks/useDormitoryInvoicesRealtime';
import {
  dormitoryApi,
  RoomFeeInvoice,
  RoomFeeConfig,
  UpdateRoomFeeConfigInput,
  PreviewRoomFeePeriodResponse,
  PreviewIndividualRoomFeeResponse,
  DormitoryRosterEntry,
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
import {
  getImageUrl,
  formatMoney,
  formatBillingMonth,
  formatDate,
  toDateValue,
  getDisplayStatus,
} from '@/app/(dashboard)/dormitory/invoices/page';

export interface RoomFeeCollectionProps {
  subViewSwitcher?: React.ReactNode;
}

export default function RoomFeeCollection({ subViewSwitcher }: RoomFeeCollectionProps = {}) {
  const { hasPermission } = useAuth();
  const canReadInvoice =
    hasPermission('DORM_INVOICE_READ') ||
    hasPermission('admin') ||
    hasPermission('ADMIN_FULL');
  const canCreateInvoice =
    hasPermission('DORM_INVOICE_CREATE') ||
    hasPermission('admin') ||
    hasPermission('ADMIN_FULL');
  const canConfirmInvoice =
    hasPermission('DORM_INVOICE_CONFIRM') ||
    hasPermission('admin') ||
    hasPermission('ADMIN_FULL');
  const canDeleteInvoice =
    hasPermission('DORM_INVOICE_DELETE') ||
    hasPermission('admin') ||
    hasPermission('ADMIN_FULL');
  const canBulkAction = canConfirmInvoice || canDeleteInvoice;

  // Data & Filtering state
  const [invoices, setInvoices] = useState<RoomFeeInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'Tất cả' | 'Chưa thu' | 'Đã thu'>('Tất cả');
  const [filterMonth, setFilterMonth] = useState('');
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState<any>(null);

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
  const rosterSearchRequestRef = useRef(0);

  // Selection state
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkReviewing, setBulkReviewing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Calendar popovers & status filter
  const [calendarFilterOpen, setCalendarFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [periodStartCalendarOpen, setPeriodStartCalendarOpen] = useState(false);
  const [periodDueDateCalendarOpen, setPeriodDueDateCalendarOpen] = useState(false);

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

  // Config modal state
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSubmitting, setConfigSubmitting] = useState(false);
  const [configQrFile, setConfigQrFile] = useState<File | null>(null);
  const [configQrPreview, setConfigQrPreview] = useState<string | null>(null);
  const [configData, setConfigData] = useState<RoomFeeConfig | null>(null);
  const [configForm, setConfigForm] = useState<UpdateRoomFeeConfigInput>({
    standard_monthly_rate: 500000,
    air_conditioned_monthly_rate: 700000,
    months_to_collect: 5,
  });

  // Create Period Modal state
  const [createPeriodModalOpen, setCreatePeriodModalOpen] = useState(false);
  const [periodStartMonth, setPeriodStartMonth] = useState('');
  const [periodMonthsCount, setPeriodMonthsCount] = useState(5);
  const [periodDueDate, setPeriodDueDate] = useState('');
  const [periodNotes, setPeriodNotes] = useState('');
  const [previewData, setPreviewData] = useState<PreviewRoomFeePeriodResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [periodSubmitting, setPeriodSubmitting] = useState(false);

  // Individual Issuance Modal state
  const [individualModalOpen, setIndividualModalOpen] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterOptions, setRosterOptions] = useState<DormitoryRosterEntry[]>([]);
  const [rosterSearching, setRosterSearching] = useState(false);
  const [selectedRosterEntry, setSelectedRosterEntry] = useState<DormitoryRosterEntry | null>(null);
  const [individualStartMonth, setIndividualStartMonth] = useState('');
  const [individualMonthsCount, setIndividualMonthsCount] = useState(5);
  const [individualMonthlyRate, setIndividualMonthlyRate] = useState(500000);
  const [individualDueDate, setIndividualDueDate] = useState('');
  const [individualNotes, setIndividualNotes] = useState('');
  const [individualPreview, setIndividualPreview] = useState<PreviewIndividualRoomFeeResponse | null>(null);
  const [individualPreviewLoading, setIndividualPreviewLoading] = useState(false);
  const [individualSubmitting, setIndividualSubmitting] = useState(false);
  const [individualStartCalendarOpen, setIndividualStartCalendarOpen] = useState(false);
  const [individualDueDateCalendarOpen, setIndividualDueDateCalendarOpen] = useState(false);

  // Modal Hóa đơn thanh toán & Kiểm tra / Duyệt chứng từ (Dùng chung 1 modal giống Thu điện nước)
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<RoomFeeInvoice | null>(null);
  const [payProofFile, setPayProofFile] = useState<File | null>(null);
  const [payProofPreview, setPayProofPreview] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [proofImageFailed, setProofImageFailed] = useState(false);
  const [transferQrImageFailed, setTransferQrImageFailed] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [deleteProofConfirmOpen, setDeleteProofConfirmOpen] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const reviewRequestIdsRef = useRef<Partial<Record<'approved' | 'rejected' | 'revoked', string>>>({});

  const handleDownloadQr = async (url?: string) => {
    if (!url) return;
    try {
      const fullUrl = getImageUrl(url);
      const res = await fetch(fullUrl);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'ma-qr-thanh-toan.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Đang tải mã QR về máy');
    } catch {
      window.open(getImageUrl(url), '_blank');
    }
  };

  useEffect(() => {
    setProofImageFailed(false);
  }, [payingInvoice?._id, payingInvoice?.payment_proof?.url]);

  // Debounced search for assigned roster members
  useEffect(() => {
    const requestId = ++rosterSearchRequestRef.current;
    if (!individualModalOpen || !rosterSearch.trim() || selectedRosterEntry) {
      setRosterOptions([]);
      setRosterSearching(false);
      return;
    }
    setRosterSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await dormitoryApi.roster.getAll({ search: rosterSearch.trim(), limit: 10 });
        if (rosterSearchRequestRef.current === requestId) {
          const list = (res.data || []).filter(item => Boolean(item.room_id));
          setRosterOptions(list);
        }
      } catch {
        if (rosterSearchRequestRef.current === requestId) {
          setRosterOptions([]);
        }
      } finally {
        if (rosterSearchRequestRef.current === requestId) {
          setRosterSearching(false);
        }
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [individualModalOpen, rosterSearch, selectedRosterEntry]);

  // Load Invoices
  const loadInvoices = useCallback(async (isRefresh = false, requestedPage = page) => {
    if (!canReadInvoice) return;
    const requestId = ++invoiceRequestRef.current;
    const requested = isCompact ? 1 : requestedPage;
    try {
      if (!isRefresh) setLoading(true);

      const params: any = {
        page: requested,
        limit: pageSize,
      };

      if (search.trim()) params.search = search.trim();
      if (filterStatus !== 'Tất cả') params.status = filterStatus;
      if (filterMonth) params.start_month = filterMonth;

      const res = await dormitoryApi.roomFeeInvoices.getAll(params);
      if (invoiceRequestRef.current !== requestId) return;
      setInvoices(res.data || []);
      setMeta(res.meta || null);
      mobilePageRef.current = requested;
      const hasMore = isCompact && requested < (res.meta?.totalPages || 1);
      mobileHasMoreRef.current = hasMore;
      setMobileHasMore(hasMore);
      setMobileLoadError(false);
    } catch (err: any) {
      if (invoiceRequestRef.current === requestId) {
        if (!isRefresh) {
          toast.error(err?.message || 'Lỗi tải danh sách phí phòng');
        }
      }
    } finally {
      if (invoiceRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [canReadInvoice, isCompact, page, pageSize, search, filterStatus, filterMonth]);

  // Realtime updates
  useDormitoryInvoicesRealtime({
    kind: 'room_fee',
    enabled: canReadInvoice,
    onInvalidate: () => {
      void loadInvoices(true);
    },
  });

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
      const params: any = {
        page: nextPage,
        limit: pageSize,
      };
      if (search.trim()) params.search = search.trim();
      if (filterStatus !== 'Tất cả') params.status = filterStatus;
      if (filterMonth) params.start_month = filterMonth;

      const res = await dormitoryApi.roomFeeInvoices.getAll(params);
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

  // Load Config
  const loadConfig = useCallback(async () => {
    try {
      const cfg = await dormitoryApi.roomFeeInvoices.getConfig();
      if (cfg) {
        setConfigData(cfg);
        setConfigForm({
          standard_monthly_rate: cfg.standard_monthly_rate ?? 500000,
          air_conditioned_monthly_rate: cfg.air_conditioned_monthly_rate ?? 700000,
          months_to_collect: cfg.months_to_collect ?? 5,
          transfer_qr_image: cfg.transfer_qr_image,
        });
        if (cfg.months_to_collect) {
          setPeriodMonthsCount(cfg.months_to_collect);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  // Default month for calendar
  const defaultMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Selection eligibility
  const isDeleteEligible = useCallback((inv: RoomFeeInvoice) => {
    return inv.status !== 'Đã thu' && inv.status !== 'Đã thanh toán';
  }, []);

  const isApproveEligible = useCallback((inv: RoomFeeInvoice) => {
    return inv.payment_review?.status === 'pending' && Boolean(inv.payment_proof?.url);
  }, []);

  const isRowSelectable = useCallback(
    (inv: RoomFeeInvoice) => {
      if (!canBulkAction) return false;
      if (canDeleteInvoice && isDeleteEligible(inv)) return true;
      if (canConfirmInvoice && isApproveEligible(inv)) return true;
      return false;
    },
    [canBulkAction, canDeleteInvoice, canConfirmInvoice, isDeleteEligible, isApproveEligible],
  );

  // Open Config Modal
  async function openConfigModal() {
    try {
      setConfigLoading(true);
      setConfigModalOpen(true);
      const cfg = await dormitoryApi.roomFeeInvoices.getConfig();
      if (cfg) {
        setConfigData(cfg);
        setConfigForm({
          standard_monthly_rate: cfg.standard_monthly_rate ?? 500000,
          air_conditioned_monthly_rate: cfg.air_conditioned_monthly_rate ?? 700000,
          months_to_collect: cfg.months_to_collect ?? 5,
          transfer_qr_image: cfg.transfer_qr_image,
        });
        setConfigQrFile(null);
        setConfigQrPreview(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải cấu hình');
    } finally {
      setConfigLoading(false);
    }
  }

  // Save Config
  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (configForm.standard_monthly_rate < 0 || configForm.air_conditioned_monthly_rate < 0) {
      toast.error('Đơn giá không được là số âm');
      return;
    }
    if (configForm.months_to_collect < 1) {
      toast.error('Số tháng thu tối thiểu là 1 tháng');
      return;
    }

    try {
      setConfigSubmitting(true);
      let transferQr = configForm.transfer_qr_image;
      if (configQrFile) {
        transferQr = await dormitoryApi.roomFeeInvoices.uploadTransferQr(configQrFile);
      }

      const updated = await dormitoryApi.roomFeeInvoices.updateConfig({
        ...configForm,
        transfer_qr_image: transferQr,
      });

      setConfigData(updated);
      toast.success('Đã lưu cấu hình thu phí phòng');
      setConfigModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi lưu cấu hình');
    } finally {
      setConfigSubmitting(false);
    }
  }

  // Open Create Period Modal
  async function openCreatePeriodModal() {
    const currentYm = defaultMonth;
    setPeriodStartMonth(currentYm);
    setPeriodMonthsCount(configData?.months_to_collect || 5);
    setPeriodDueDate('');
    setPeriodNotes('');
    setCreatePeriodModalOpen(true);
    await fetchPeriodPreview(currentYm, configData?.months_to_collect || 5);
  }

  // Fetch Preview
  async function fetchPeriodPreview(startMonth: string, monthsCount: number) {
    if (!startMonth || !/^\d{4}-\d{2}$/.test(startMonth)) return;
    try {
      setPreviewLoading(true);
      const res = await dormitoryApi.roomFeeInvoices.previewPeriod({
        start_month: startMonth,
        months_count: monthsCount,
      });
      setPreviewData(res);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tính toán xem trước đợt thu');
    } finally {
      setPreviewLoading(false);
    }
  }

  // Submit Create Period
  async function handleCreatePeriodSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodStartMonth) {
      toast.error('Vui lòng chọn kỳ bắt đầu');
      return;
    }

    try {
      setPeriodSubmitting(true);
      const res = await dormitoryApi.roomFeeInvoices.createPeriod({
        start_month: periodStartMonth,
        months_count: periodMonthsCount,
        due_date: periodDueDate || undefined,
        notes: periodNotes || undefined,
      });

      toast.success(
        `Lập đợt thu thành công! Đã tạo ${res.created_count} hóa đơn (${res.skipped_count} đã tồn tại, ${res.invalid_count} không hợp lệ).`,
      );
      setCreatePeriodModalOpen(false);
      void loadInvoices(true);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi lập đợt thu');
    } finally {
      setPeriodSubmitting(false);
    }
  }

  // Open Individual Issuance Modal
  function openIndividualModal() {
    setSelectedRosterEntry(null);
    setRosterSearch('');
    setRosterOptions([]);
    setIndividualStartMonth(defaultMonth);
    const months = configData?.months_to_collect || 5;
    setIndividualMonthsCount(months);
    setIndividualMonthlyRate(configData?.standard_monthly_rate || 500000);
    setIndividualDueDate('');
    setIndividualNotes('');
    setIndividualPreview(null);
    setIndividualModalOpen(true);
  }

  // Select a roster entry
  function selectRosterEntry(entry: DormitoryRosterEntry) {
    setSelectedRosterEntry(entry);
    setRosterSearch('');
    setRosterOptions([]);
    const room = entry.room_id as any;
    const isAc = room?.room_type === 'Máy lạnh' || entry.room_type === 'Máy lạnh';
    const rate = isAc
      ? configData?.air_conditioned_monthly_rate || 700000
      : configData?.standard_monthly_rate || 500000;
    setIndividualMonthlyRate(rate);
    void fetchIndividualPreview(entry._id, individualStartMonth, individualMonthsCount, rate);
  }

  // Fetch Individual Preview
  async function fetchIndividualPreview(
    rosterEntryId: string,
    startMonth: string,
    monthsCount: number,
    rate: number,
  ) {
    if (!rosterEntryId || !startMonth || !/^\d{4}-\d{2}$/.test(startMonth)) {
      setIndividualPreview(null);
      return;
    }
    try {
      setIndividualPreviewLoading(true);
      const res = await dormitoryApi.roomFeeInvoices.previewIndividual({
        roster_entry_id: rosterEntryId,
        start_month: startMonth,
        months_count: monthsCount,
        monthly_rate: rate,
        due_date: individualDueDate || undefined,
        notes: individualNotes || undefined,
      });
      setIndividualPreview(res);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tính toán xem trước');
      setIndividualPreview(null);
    } finally {
      setIndividualPreviewLoading(false);
    }
  }

  function handleIndividualMonthsChange(count: number) {
    setIndividualMonthsCount(count);
    setIndividualPreview(null);
    if (selectedRosterEntry) {
      void fetchIndividualPreview(selectedRosterEntry._id, individualStartMonth, count, individualMonthlyRate);
    }
  }

  function handleIndividualRateChange(rate: number) {
    setIndividualMonthlyRate(rate);
    setIndividualPreview(null);
    if (selectedRosterEntry) {
      void fetchIndividualPreview(selectedRosterEntry._id, individualStartMonth, individualMonthsCount, rate);
    }
  }

  function handleIndividualStartMonthChange(ym: string) {
    setIndividualStartMonth(ym);
    setIndividualPreview(null);
    if (selectedRosterEntry) {
      void fetchIndividualPreview(selectedRosterEntry._id, ym, individualMonthsCount, individualMonthlyRate);
    }
  }

  // Submit Individual Issuance
  async function handleCreateIndividualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRosterEntry) {
      toast.error('Vui lòng chọn thành viên KTX');
      return;
    }
    if (!individualStartMonth) {
      toast.error('Vui lòng chọn kỳ bắt đầu');
      return;
    }
    if (individualMonthlyRate < 0) {
      toast.error('Đơn giá không được là số âm');
      return;
    }
    if (individualMonthsCount < 1 || individualMonthsCount > 36) {
      toast.error('Số tháng thu phải từ 1 đến 36');
      return;
    }

    try {
      setIndividualSubmitting(true);
      const invoice = await dormitoryApi.roomFeeInvoices.createIndividual({
        roster_entry_id: selectedRosterEntry._id,
        start_month: individualStartMonth,
        months_count: individualMonthsCount,
        monthly_rate: individualMonthlyRate,
        due_date: individualDueDate || undefined,
        notes: individualNotes || undefined,
      });

      toast.success(
        `Lập hóa đơn phí phòng thành công cho ${invoice.member_name} (${invoice.invoice_code})`,
      );
      setIndividualModalOpen(false);
      void loadInvoices(true);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi lập hóa đơn phí phòng cá nhân');
    } finally {
      setIndividualSubmitting(false);
    }
  }

  // Open Payment / Review Modal (Dùng chung 1 modal)
  function openPayModal(inv: RoomFeeInvoice) {
    setPayingInvoice(inv);
    setPayProofFile(null);
    setPayProofPreview(null);
    setProofImageFailed(false);
    setTransferQrImageFailed(false);
    setShowQrCode(false);
    setPayModalOpen(true);
  }

  // Handle Proof File Change
  function handleProofFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.type)) {
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
      const proofMeta = await dormitoryApi.roomFeeInvoices.uploadProof(payProofFile);
      const updated = await dormitoryApi.roomFeeInvoices.pay(payingInvoice._id, {
        payment_method: 'Chuyển khoản',
        payment_proof: proofMeta,
      });
      toast.success('Đã gửi chứng từ, chờ duyệt');
      setPayingInvoice(updated);
      setPayProofFile(null);
      setPayProofPreview(null);
      setPayModalOpen(false);
      void loadInvoices(true);
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
      const proofMeta = await dormitoryApi.roomFeeInvoices.uploadProof(payProofFile);
      const updated = await dormitoryApi.roomFeeInvoices.updateProof(payingInvoice._id, {
        payment_method: 'Chuyển khoản',
        payment_proof: proofMeta,
      });
      toast.success('Cập nhật chứng từ thanh toán thành công');
      setPayingInvoice(updated);
      setPayProofFile(null);
      setPayProofPreview(null);
      void loadInvoices(true);
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
      const requestId =
        reviewRequestIdsRef.current[decision] ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${decision}-${payingInvoice._id}-${Date.now()}`);
      reviewRequestIdsRef.current[decision] = requestId;
      const updated = await dormitoryApi.roomFeeInvoices.reviewProof(payingInvoice._id, decision, requestId);
      delete reviewRequestIdsRef.current[decision];
      setPayingInvoice(updated);
      await loadInvoices(true);
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

  // Bulk Approve
  async function handleBulkApprove() {
    const pendingIds = invoices
      .filter((inv) => selected.includes(inv._id) && isApproveEligible(inv))
      .map((inv) => inv._id);

    if (!pendingIds.length) {
      toast.error('Không có chứng từ nào ở trạng thái Chờ duyệt');
      return;
    }

    try {
      setBulkReviewing(true);
      const requestId = `bulk-approve-${Date.now()}`;
      const res = await dormitoryApi.roomFeeInvoices.bulkReviewProof(pendingIds, 'approved', requestId);
      const successCount = res.results.filter((r) => r.outcome === 'approved').length;
      toast.success(`Đã duyệt thành công ${successCount}/${pendingIds.length} chứng từ`);
      setSelected([]);
      void loadInvoices(true);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi duyệt hàng loạt');
    } finally {
      setBulkReviewing(false);
    }
  }

  // Bulk Delete
  async function handleConfirmDelete() {
    const deleteIds = invoices
      .filter((inv) => selected.includes(inv._id) && isDeleteEligible(inv))
      .map((inv) => inv._id);

    if (!deleteIds.length) {
      toast.error('Không có hóa đơn nào có thể xóa');
      setDeleteConfirmOpen(false);
      return;
    }

    try {
      setBulkDeleting(true);
      const res = await dormitoryApi.roomFeeInvoices.bulkDelete(deleteIds);
      toast.success(`Đã xóa ${res.deleted.length} hóa đơn`);
      setDeleteConfirmOpen(false);
      setSelected([]);
      void loadInvoices(true);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xóa hóa đơn');
    } finally {
      setBulkDeleting(false);
    }
  }

  // Responsive Table Columns
  const columns: ResponsiveColumn<RoomFeeInvoice>[] = useMemo(
    () => [
      {
        key: 'member_name',
        header: 'Họ tên',
        priority: 'primary',
        className: 'w-[180px] min-w-[180px] text-left',
        render: (_, inv) => (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1A73E8]/10 text-[#1A73E8] font-bold text-xs">
              {inv.member_name ? inv.member_name.charAt(0).toUpperCase() : <User size={14} />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-xs truncate">{inv.member_name}</p>
              {inv.member_code && (
                <p className="text-[11px] text-slate-500 font-mono">{inv.member_code}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'room',
        header: 'Phòng',
        priority: 'secondary',
        className: 'w-[140px] min-w-[140px] text-left',
        render: (_, inv) => (
          <div>
            <div className="flex items-center gap-1 font-semibold text-slate-800 text-xs">
              <Home size={13} className="text-slate-400 shrink-0" />
              <span>{inv.room_name || inv.room_code}</span>
            </div>
            <span
              className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                inv.room_type === 'Máy lạnh'
                  ? 'bg-sky-100 text-sky-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {inv.room_type}
            </span>
          </div>
        ),
      },
      {
        key: 'period',
        header: 'Kỳ thu',
        className: 'w-[160px] min-w-[160px] text-left',
        render: (_, inv) => (
          <div>
            <p className="font-medium text-slate-800 text-xs">
              {formatBillingMonth(inv.start_month)} - {formatBillingMonth(inv.end_month)}
            </p>
            <p className="text-[11px] text-slate-500">{inv.months_count} tháng</p>
          </div>
        ),
      },
      {
        key: 'total_amount',
        header: 'Khoản thu',
        className: 'w-[160px] min-w-[160px] text-left',
        render: (_, inv) => (
          <div>
            <p className="font-bold text-[#1A73E8] text-xs">
              {formatMoney(inv.total_amount)}
            </p>
            <p className="text-[11px] text-slate-500">
              {formatMoney(inv.monthly_rate)}/tháng
            </p>
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
              {canConfirmInvoice && (
                <button
                  type="button"
                  aria-label="Kiểm tra"
                  onClick={() => openPayModal(inv)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/70 border border-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold hover:bg-white hover:text-[#1A73E8] hover:scale-[1.01] transition-all duration-150 shadow-2xs cursor-pointer"
                  title="Kiểm tra hóa đơn & chứng từ thanh toán"
                >
                  <Eye size={14} /> Kiểm tra
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [canConfirmInvoice],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Header & Toolbar: mobile (2 hàng, 2 tab con full width, toolbar ưu tiên icon), desktop (chung 1 hàng) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-start gap-2 w-full shrink-0">
        {subViewSwitcher}

        {/* Mobile search bar when expanded full width */}
        {mobileSearchOpen ? (
          <div className="flex w-full items-center gap-1.5 py-0.5 sm:hidden">
            <Research
              ref={searchRef}
              aria-label="Tìm kiếm thành viên, phòng..."
              placeholder="Tìm tên SV, mã SV, phòng..."
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
          /* Toolbar */
          <div className="flex flex-1 items-center justify-start gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-0.5 w-full flex-nowrap min-w-0">
            {/* Desktop search */}
            <Research
              aria-label="Tìm kiếm thành viên, phòng..."
              placeholder="Tìm tên SV, mã SV, phòng..."
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
                  title="Lọc theo kỳ bắt đầu"
                  aria-label="Lọc theo kỳ bắt đầu"
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
                  onCancel={() => setCalendarFilterOpen(false)}
                  onConfirm={() => setCalendarFilterOpen(false)}
                />
              </PopoverContent>
            </Popover>

            {/* Lọc trạng thái (Icon trên mobile, dropdown đầy đủ trên desktop) */}
            <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  aria-label="Lọc theo trạng thái phí phòng"
                  title="Lọc theo trạng thái phí phòng"
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

          {/* Nút hành động bên phải */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Nút Cấu hình đợt thu */}
            {canCreateInvoice && (
              <Button
                variant="outline"
                aria-label="Cấu hình đơn giá thu phí phòng"
                title="Cấu hình đơn giá & QR thu phí phòng"
                onClick={openConfigModal}
                className="h-9 w-9 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700 hover:bg-white/80 shrink-0 cursor-pointer"
              >
                <SlidersHorizontal size={15} />
              </Button>
            )}

            {/* Nút Lập đợt thu cá nhân */}
            {canCreateInvoice && (
              <Button
                variant="outline"
                aria-label="Lập đợt thu cá nhân"
                title="Lập đợt thu cá nhân"
                onClick={openIndividualModal}
                className="h-9 w-9 sm:w-auto rounded-xl border border-white/80 bg-white/50 p-0 sm:px-3 text-xs font-semibold text-slate-700 hover:bg-white/80 shrink-0 gap-1.5 cursor-pointer"
              >
                <User size={14} />
                <span className="hidden sm:inline">Thu cá nhân</span>
              </Button>
            )}

            {/* Nút Lập đợt thu */}
            {canCreateInvoice && (
              <Button
                variant="outline"
                aria-label="Lập đợt thu phí phòng"
                title="Lập đợt thu hàng loạt"
                onClick={openCreatePeriodModal}
                className="h-9 w-9 sm:w-auto rounded-xl border border-white/80 bg-white/50 p-0 sm:px-3 text-xs font-semibold text-slate-700 hover:bg-white/80 shrink-0 gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Lập đợt thu</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>

      {/* Floating Action Bar */}
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
                  aria-label="Xóa hóa đơn phí phòng đã chọn"
                  disabled={bulkDeleting || bulkReviewing}
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
                >
                  Xóa
                </button>
              )}
              {canConfirmInvoice && (
                <button
                  type="button"
                  aria-label="Duyệt chứng từ phí phòng đã chọn"
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

      {/* Table & Cards View */}
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
              Không có hóa đơn phí phòng nào phù hợp
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

      {/* ========================================================================= */}
      {/* MODAL LẬP ĐỢT THU PHÍ PHÒNG CÁ NHÂN */}
      {/* ========================================================================= */}
      <Dialog open={individualModalOpen} onOpenChange={setIndividualModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl">
          <DialogHeader className="border-b border-white/50 pb-3">
            <DialogTitle className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
              <User size={20} className="text-[#1A73E8]" />
              Lập đợt thu phí phòng cá nhân
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateIndividualSubmit} className="space-y-4 pt-2">
            {/* Chọn thành viên */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Chọn thành viên KTX <span className="text-red-500">*</span>
              </label>

              {selectedRosterEntry ? (
                <div className="flex items-center justify-between p-3 bg-white/80 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A73E8]/10 text-[#1A73E8] font-bold text-xs">
                      {selectedRosterEntry.full_name?.charAt(0).toUpperCase() || <User size={16} />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-xs">
                        {selectedRosterEntry.full_name}{' '}
                        {selectedRosterEntry.student_code && (
                          <span className="font-mono text-slate-500 font-normal">({selectedRosterEntry.student_code})</span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {typeof selectedRosterEntry.room_id === 'object' && selectedRosterEntry.room_id
                          ? `${selectedRosterEntry.room_id.room_name || selectedRosterEntry.room_id.room_code} · ${selectedRosterEntry.room_id.room_type || 'Thường'}`
                          : selectedRosterEntry.assigned_room_name || 'Đã xếp phòng'}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedRosterEntry(null);
                      setIndividualPreview(null);
                    }}
                    className="h-7 px-2 text-xs rounded-lg border-slate-300 text-slate-600 cursor-pointer"
                  >
                    Đổi thành viên
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tìm theo tên SV, mã SV..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 focus:ring-2 focus:ring-[#1A73E8]/30"
                  />
                  {rosterSearching && (
                    <div className="absolute right-3 top-2.5 text-xs text-slate-400">Đang tìm...</div>
                  )}
                  {rosterOptions.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-white/80 bg-white shadow-xl">
                      {rosterOptions.map((entry) => {
                        const room = entry.room_id as any;
                        const roomName = room ? room.room_name || room.room_code : 'Phòng';
                        const roomType = room?.room_type || entry.room_type || 'Thường';
                        return (
                          <button
                            key={entry._id}
                            type="button"
                            onClick={() => selectRosterEntry(entry)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-blue-50 border-b border-slate-100 last:border-b-0 cursor-pointer"
                          >
                            <div>
                              <span className="font-bold text-slate-800">{entry.full_name}</span>
                              {entry.student_code && (
                                <span className="ml-1.5 font-mono text-slate-500">({entry.student_code})</span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {roomName} ({roomType})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {!rosterSearching && rosterSearch.trim() && rosterOptions.length === 0 && (
                    <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/80 bg-white p-3 text-center text-xs text-slate-500 shadow-xl">
                      Không tìm thấy thành viên có phòng phù hợp.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Kỳ bắt đầu & Số tháng thu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Kỳ bắt đầu (Tháng/Năm) <span className="text-red-500">*</span>
                </label>
                <Popover open={individualStartCalendarOpen} onOpenChange={setIndividualStartCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 flex items-center justify-between text-left focus:ring-2 focus:ring-[#1A73E8]/30 cursor-pointer"
                    >
                      <span>{individualStartMonth ? formatBillingMonth(individualStartMonth) : 'Chọn kỳ'}</span>
                      <CalendarIcon size={14} className="text-[#1A73E8]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
                    <CustomCalendar
                      monthOnly
                      monthValue={individualStartMonth || defaultMonth}
                      startDate={individualStartMonth ? new Date(`${individualStartMonth}-01T00:00:00`) : null}
                      endDate={null}
                      onRangeSelect={() => {}}
                      onRangeConfirm={(start) => {
                        const y = start.getFullYear();
                        const m = String(start.getMonth() + 1).padStart(2, '0');
                        const ym = `${y}-${m}`;
                        setIndividualStartCalendarOpen(false);
                        handleIndividualStartMonthChange(ym);
                      }}
                      onCancel={() => setIndividualStartCalendarOpen(false)}
                      onConfirm={() => setIndividualStartCalendarOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Số tháng thu <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  required
                  value={individualMonthsCount}
                  onChange={(e) => {
                    const count = Math.max(1, parseInt(e.target.value, 10) || 1);
                    handleIndividualMonthsChange(count);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 focus:ring-2 focus:ring-[#1A73E8]/30"
                />
              </div>
            </div>

            {/* Đơn giá / tháng */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Đơn giá / tháng (VNĐ) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="10000"
                required
                value={individualMonthlyRate}
                onChange={(e) => {
                  const rate = Math.max(0, parseInt(e.target.value, 10) || 0);
                  handleIndividualRateChange(rate);
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-[#1A73E8]/30"
              />
            </div>

            {/* Hạn đóng */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Hạn thanh toán (Tùy chọn)
              </label>
              <Popover open={individualDueDateCalendarOpen} onOpenChange={setIndividualDueDateCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 flex items-center justify-between text-left focus:ring-2 focus:ring-[#1A73E8]/30 cursor-pointer"
                  >
                    <span>{individualDueDate ? formatDate(individualDueDate) : 'Chọn hạn thanh toán'}</span>
                    <CalendarIcon size={14} className="text-slate-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
                  <CustomCalendar
                    startDate={individualDueDate ? new Date(`${individualDueDate}T00:00:00`) : null}
                    endDate={null}
                    onRangeSelect={(start) => setIndividualDueDate(toDateValue(start))}
                    onRangeConfirm={(start) => {
                      setIndividualDueDate(toDateValue(start));
                      setIndividualDueDateCalendarOpen(false);
                    }}
                    onCancel={() => setIndividualDueDateCalendarOpen(false)}
                    onConfirm={() => setIndividualDueDateCalendarOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Ghi chú */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Ghi chú</label>
              <input
                type="text"
                placeholder="Ví dụ: Đợt thu bổ sung, miễn giảm theo thỏa thuận..."
                value={individualNotes}
                onChange={(e) => setIndividualNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 focus:ring-2 focus:ring-[#1A73E8]/30"
              />
            </div>

            {/* Xem trước kết quả */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-2 text-xs">
              <p className="font-bold text-blue-900 flex items-center justify-between">
                <span>Xem trước kết quả thu cá nhân</span>
                {individualPreview && (
                  <span className="text-blue-700">
                    {formatBillingMonth(individualPreview.start_month)} - {formatBillingMonth(individualPreview.end_month)} ({individualPreview.months_count} tháng)
                  </span>
                )}
              </p>

              {individualPreviewLoading ? (
                <p className="text-slate-500 py-2 text-center">Đang tính toán xem trước...</p>
              ) : individualPreview ? (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                      <span className="text-slate-500 text-[11px]">Thành viên</span>
                      <p className="font-semibold text-slate-800 text-xs truncate">
                        {individualPreview.member_name} ({individualPreview.member_code || '—'})
                      </p>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                      <span className="text-slate-500 text-[11px]">Phòng</span>
                      <p className="font-semibold text-slate-800 text-xs">
                        {individualPreview.room_code} ({individualPreview.room_type})
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/80 p-2.5 rounded-lg border border-blue-100 flex justify-between items-center">
                    <div>
                      <span className="text-slate-500 text-[11px]">Đơn giá: {formatMoney(individualPreview.monthly_rate)} / tháng</span>
                      <p className="text-xs font-bold text-slate-700">{individualPreview.months_count} tháng</p>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 text-[11px]">Tổng tiền</span>
                      <p className="text-base font-bold text-[#1A73E8]">{formatMoney(individualPreview.total_amount)}</p>
                    </div>
                  </div>

                  {individualPreview.already_exists && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-1.5 font-medium">
                      <AlertCircle size={14} className="text-amber-600 shrink-0" />
                      <span>Hóa đơn cho thành viên trong khoảng thời gian này đã tồn tại ({individualPreview.existing_invoice_code}).</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-1">Vui lòng chọn thành viên để xem trước.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIndividualModalOpen(false)}
                disabled={individualSubmitting}
                className="rounded-xl border-slate-300 text-xs cursor-pointer"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={
                  individualSubmitting ||
                  individualPreviewLoading ||
                  !selectedRosterEntry ||
                  !individualStartMonth ||
                  !individualPreview ||
                  individualPreview.already_exists
                }
                className="rounded-xl bg-[#1A73E8] px-4 text-xs font-semibold text-white hover:bg-[#1557B0] cursor-pointer shadow-sm disabled:opacity-50"
              >
                {individualSubmitting ? 'Đang tạo...' : 'Xác nhận tạo hóa đơn'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL CẤU HÌNH ĐƠN GIÁ & QR THU PHÍ PHÒNG */}
      {/* ========================================================================= */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl">
          <DialogHeader className="border-b border-white/50 pb-3">
            <DialogTitle className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
              <SlidersHorizontal size={20} className="text-[#1A73E8]" />
              Cấu hình đợt thu phí phòng
            </DialogTitle>
          </DialogHeader>

          {configLoading ? (
            <div className="py-12 text-center text-slate-500">Đang tải cấu hình...</div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="config-standard-rate" className="block text-xs font-semibold text-slate-700">
                    Giá phòng thường / tháng (VNĐ) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="config-standard-rate"
                    type="number"
                    min="0"
                    step="10000"
                    required
                    value={configForm.standard_monthly_rate}
                    onChange={(e) =>
                      setConfigForm((f) => ({
                        ...f,
                        standard_monthly_rate: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-[#1A73E8]/30"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="config-ac-rate" className="block text-xs font-semibold text-slate-700">
                    Giá phòng máy lạnh / tháng (VNĐ) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="config-ac-rate"
                    type="number"
                    min="0"
                    step="10000"
                    required
                    value={configForm.air_conditioned_monthly_rate}
                    onChange={(e) =>
                      setConfigForm((f) => ({
                        ...f,
                        air_conditioned_monthly_rate: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 font-semibold focus:ring-2 focus:ring-[#1A73E8]/30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="config-months-count" className="block text-xs font-semibold text-slate-700">
                  Số tháng thu mặc định cho mỗi đợt <span className="text-red-500">*</span>
                </label>
                <input
                  id="config-months-count"
                  type="number"
                  min="1"
                  max="36"
                  required
                  value={configForm.months_to_collect}
                  onChange={(e) =>
                    setConfigForm((f) => ({
                      ...f,
                      months_to_collect: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 focus:ring-2 focus:ring-[#1A73E8]/30"
                />
              </div>

              {/* QR Image Upload */}
              <div className="space-y-2 rounded-xl border border-white/60 bg-white/40 p-3">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <QrCode size={16} className="text-[#1A73E8]" />
                  Mã QR chuyển khoản mặc định (Tùy chọn)
                </label>
                {(configQrPreview || configForm.transfer_qr_image?.url) && (
                  <div className="flex justify-center p-2 bg-white rounded-lg border border-slate-200 max-w-[180px] mx-auto">
                    <img
                      src={configQrPreview || getImageUrl(configForm.transfer_qr_image?.url)}
                      alt="QR Code"
                      className="max-h-36 object-contain rounded"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('Dung lượng ảnh không được vượt quá 5MB');
                        return;
                      }
                      setConfigQrFile(file);
                      setConfigQrPreview(URL.createObjectURL(file));
                    }
                  }}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1A73E8]/10 file:text-[#1A73E8] hover:file:bg-[#1A73E8]/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfigModalOpen(false)}
                  disabled={configSubmitting}
                  className="rounded-xl border-slate-300 text-xs cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={configSubmitting}
                  className="rounded-xl bg-[#1A73E8] px-4 text-xs font-semibold text-white hover:bg-[#1557B0] cursor-pointer"
                >
                  {configSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL LẬP ĐỢT THU PHÍ PHÒNG KÈM XEM TRƯỚC */}
      {/* ========================================================================= */}
      <Dialog open={createPeriodModalOpen} onOpenChange={setCreatePeriodModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl">
          <DialogHeader className="border-b border-white/50 pb-3">
            <DialogTitle className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
              <Plus size={20} className="text-[#1A73E8]" />
              Lập đợt thu tiền phòng
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreatePeriodSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Kỳ bắt đầu */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Kỳ bắt đầu (Tháng/Năm) <span className="text-red-500">*</span>
                </label>
                <Popover open={periodStartCalendarOpen} onOpenChange={setPeriodStartCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 flex items-center justify-between text-left focus:ring-2 focus:ring-[#1A73E8]/30 cursor-pointer"
                    >
                      <span>{periodStartMonth ? formatBillingMonth(periodStartMonth) : 'Chọn kỳ'}</span>
                      <CalendarIcon size={14} className="text-[#1A73E8]" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
                    <CustomCalendar
                      monthOnly
                      monthValue={periodStartMonth || defaultMonth}
                      startDate={periodStartMonth ? new Date(`${periodStartMonth}-01T00:00:00`) : null}
                      endDate={null}
                      onRangeSelect={() => {}}
                      onRangeConfirm={(start) => {
                        const y = start.getFullYear();
                        const m = String(start.getMonth() + 1).padStart(2, '0');
                        const ym = `${y}-${m}`;
                        setPeriodStartMonth(ym);
                        setPeriodStartCalendarOpen(false);
                        void fetchPeriodPreview(ym, periodMonthsCount);
                      }}
                      onCancel={() => setPeriodStartCalendarOpen(false)}
                      onConfirm={() => setPeriodStartCalendarOpen(false)}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Số tháng thu */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Số tháng thu <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  required
                  value={periodMonthsCount}
                  onChange={(e) => {
                    const count = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setPeriodMonthsCount(count);
                    void fetchPeriodPreview(periodStartMonth, count);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 focus:ring-2 focus:ring-[#1A73E8]/30"
                />
              </div>
            </div>

            {/* Hạn đóng */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Hạn thanh toán (Tùy chọn)
              </label>
              <Popover open={periodDueDateCalendarOpen} onOpenChange={setPeriodDueDateCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 flex items-center justify-between text-left focus:ring-2 focus:ring-[#1A73E8]/30 cursor-pointer"
                  >
                    <span>{periodDueDate ? formatDate(periodDueDate) : 'Chọn hạn thanh toán'}</span>
                    <CalendarIcon size={14} className="text-slate-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
                  <CustomCalendar
                    startDate={periodDueDate ? new Date(`${periodDueDate}T00:00:00`) : null}
                    endDate={null}
                    onRangeSelect={(start) => setPeriodDueDate(toDateValue(start))}
                    onRangeConfirm={(start) => {
                      setPeriodDueDate(toDateValue(start));
                      setPeriodDueDateCalendarOpen(false);
                    }}
                    onCancel={() => setPeriodDueDateCalendarOpen(false)}
                    onConfirm={() => setPeriodDueDateCalendarOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Ghi chú */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Ghi chú đợt thu</label>
              <input
                type="text"
                placeholder="Ví dụ: Thu phí phòng kỳ 1 năm học 2026-2027"
                value={periodNotes}
                onChange={(e) => setPeriodNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 focus:ring-2 focus:ring-[#1A73E8]/30"
              />
            </div>

            {/* Xem trước đợt thu */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-2 text-xs">
              <p className="font-bold text-blue-900 flex items-center justify-between">
                <span>Xem trước kết quả lập đợt thu</span>
                {previewData && (
                  <span className="text-blue-700">
                    Khoảng thu: {formatBillingMonth(previewData.start_month)} - {formatBillingMonth(previewData.end_month)} ({previewData.months_count} tháng)
                  </span>
                )}
              </p>

              {previewLoading ? (
                <p className="text-slate-500 py-2 text-center">Đang tính toán...</p>
              ) : previewData ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-slate-500 text-[11px]">Số SV đủ điều kiện</span>
                    <p className="text-sm font-bold text-emerald-700">{previewData.eligible_count} SV</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-slate-500 text-[11px]">Phòng thường / Lạnh</span>
                    <p className="text-xs font-semibold text-slate-800">
                      {previewData.eligible_standard_count} / {previewData.eligible_ac_count}
                    </p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-slate-500 text-[11px]">Đã tạo trước đó</span>
                    <p className="text-sm font-semibold text-slate-600">{previewData.skipped_existing_count}</p>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100 col-span-2 sm:col-span-3">
                    <span className="text-slate-500 text-[11px]">Dự kiến tổng thu</span>
                    <p className="text-base font-bold text-[#1A73E8]">
                      {formatMoney(previewData.expected_total_amount)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-center">Chưa có dữ liệu</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreatePeriodModalOpen(false)}
                disabled={periodSubmitting}
                className="rounded-xl border-slate-300 text-xs cursor-pointer"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={periodSubmitting || previewLoading || !previewData || previewData.eligible_count === 0}
                className="rounded-xl bg-[#1A73E8] px-4 text-xs font-semibold text-white hover:bg-[#1557B0] cursor-pointer shadow-sm"
              >
                {periodSubmitting ? 'Đang tạo...' : `Xác nhận lập đợt thu (${previewData?.eligible_count || 0} SV)`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL HÓA ĐƠN THANH TOÁN (Dùng chung cho Nộp chứng từ & Kiểm tra / Duyệt) */}
      {/* ========================================================================= */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#F8FAFC] to-[#EEF4FB] p-6 shadow-2xl">
          {payingInvoice && (() => {
            const isApproved =
              payingInvoice.status === 'Đã thu' ||
              payingInvoice.status === 'Đã thanh toán' ||
              payingInvoice.payment_review?.status === 'approved';
            const isPendingReview = payingInvoice.payment_review?.status === 'pending';
            const isRejected = payingInvoice.payment_review?.status === 'rejected';
            const hasExistingProof = !!payingInvoice.payment_proof?.url;

            return (
              <div className="space-y-4">
                {/* 1. Header: Chỉ để "Hóa đơn" + badge trạng thái, bỏ mô tả */}
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-xl font-bold text-[#1E293B]">
                      Hóa đơn
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
                </div>

                {/* 2. Thông tin: Chỉ cần để Kỳ thu và Tổng tiền */}
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 backdrop-blur-sm p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">Kỳ thu</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {formatBillingMonth(payingInvoice.start_month)} - {formatBillingMonth(payingInvoice.end_month)} ({payingInvoice.months_count} tháng)
                    </span>
                  </div>
                  <div className="border-t border-slate-200/60 pt-2.5 flex items-center justify-between">
                    <span className="font-bold text-slate-700 text-xs">Tổng tiền</span>
                    <span className="text-xl font-black text-[#1A73E8]">
                      {formatMoney(payingInvoice.total_amount)}
                    </span>
                  </div>
                </div>

                {/* 3. Nút mở QR đóng tiền mặc định ẩn (click mở ra & tải về máy) */}
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setShowQrCode((prev) => !prev)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-white transition-all cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <QrCode size={16} className="text-[#1A73E8]" />
                      Mã QR đóng tiền
                    </span>
                    <span className="text-slate-400">
                      {showQrCode ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  {showQrCode && (
                    <div className="p-4 border-t border-slate-200/60 bg-white flex flex-col items-center gap-3">
                      <div className="w-48 h-48 flex items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                        {configData?.transfer_qr_image?.url && !transferQrImageFailed ? (
                          <img
                            src={getImageUrl(configData.transfer_qr_image.url)}
                            alt="Mã QR chuyển khoản"
                            onError={() => setTransferQrImageFailed(true)}
                            className="w-full h-full object-contain rounded-lg"
                          />
                        ) : (
                          <div className="text-center px-4 text-xs text-slate-500">
                            {transferQrImageFailed ? 'Không thể tải mã QR chuyển khoản' : 'Chưa cấu hình mã QR chuyển khoản'}
                          </div>
                        )}
                      </div>

                      {configData?.transfer_qr_image?.url && !transferQrImageFailed && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadQr(configData?.transfer_qr_image?.url)}
                          className="h-8 px-3 text-xs font-semibold text-[#1A73E8] border-[#1A73E8]/30 hover:bg-blue-50 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download size={14} />
                          <span>Tải về máy</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* 2 (tiếp). Ảnh xác nhận chuyển khoản */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[#1E293B]">
                    Ảnh xác nhận chuyển khoản
                  </label>

                  {hasExistingProof ? (
                    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-medium">Ảnh chứng từ hiện tại</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteProofConfirmOpen(true)}
                          className="h-6 px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border-rose-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                          title="Xóa ảnh chứng từ hiện tại"
                        >
                          <Trash2 size={12} />
                          <span>Xóa ảnh</span>
                        </Button>
                      </div>

                      <div className="border border-slate-200/60 rounded-xl overflow-hidden bg-slate-900/5 flex items-center justify-center p-2">
                        {proofImageFailed ? (
                          <a
                            className="inline-flex items-center justify-center p-4 text-xs text-blue-600 hover:underline font-medium"
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
                            className="max-h-44 w-auto object-contain rounded-lg shadow-sm"
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
                  ) : (
                    <div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={handleProofFileChange}
                        className="hidden"
                        id="room-fee-pay-proof-upload"
                      />
                      {!payProofFile ? (
                        <label
                          htmlFor="room-fee-pay-proof-upload"
                          className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-2xl bg-white/50 hover:bg-white/80 transition-all duration-150 cursor-pointer text-center"
                        >
                          <Upload size={20} className="text-[#1A73E8] mb-1" />
                          <span className="text-xs font-medium text-[#1E293B]">Bấm để chọn ảnh chuyển khoản</span>
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

                {/* 4. Hàng nút hành động: Gửi, Duyệt, Không duyệt, Đóng */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                  {/* Nút gửi (khi upload chứng từ) */}
                  {!hasExistingProof && (
                    <Button
                      type="button"
                      disabled={paySubmitting || reviewSubmitting || !payProofFile}
                      onClick={handleConfirmPay}
                      className="rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-xs h-9 px-4 cursor-pointer transition-all hover:scale-[1.01]"
                    >
                      <Upload size={14} />
                      <span>{paySubmitting ? 'Đang gửi...' : 'Gửi'}</span>
                    </Button>
                  )}

                  {hasExistingProof && payProofFile && (
                    <Button
                      type="button"
                      disabled={paySubmitting || reviewSubmitting}
                      onClick={handleSaveUpdatedProof}
                      className="rounded-xl bg-[#1A73E8] hover:bg-[#1557B0] text-white font-semibold text-xs h-9 px-4 cursor-pointer transition-all hover:scale-[1.01]"
                    >
                      <Upload size={14} />
                      <span>{paySubmitting ? 'Đang lưu...' : 'Lưu'}</span>
                    </Button>
                  )}

                  {/* Nút Duyệt / Không duyệt (khi chờ duyệt) */}
                  {isPendingReview && canConfirmInvoice && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={reviewSubmitting || paySubmitting}
                        onClick={() => handleReviewProof('rejected')}
                        className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs h-9 px-3.5 cursor-pointer transition-all hover:scale-[1.01]"
                      >
                        <XCircle size={14} />
                        <span>Không duyệt</span>
                      </Button>
                      <Button
                        type="button"
                        disabled={reviewSubmitting || paySubmitting}
                        onClick={() => handleReviewProof('approved')}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 cursor-pointer transition-all hover:scale-[1.01]"
                      >
                        <CheckCircle size={14} />
                        <span>{reviewSubmitting ? 'Đang xử lý...' : 'Duyệt'}</span>
                      </Button>
                    </>
                  )}

                  {/* Nút Bỏ duyệt (khi đã thu) */}
                  {isApproved && canConfirmInvoice && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={reviewSubmitting || paySubmitting}
                      onClick={() => handleReviewProof('revoked')}
                      className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 font-semibold text-xs h-9 px-3.5 cursor-pointer transition-all hover:scale-[1.01]"
                    >
                      <RotateCcw size={14} />
                      <span>{reviewSubmitting ? 'Đang xử lý...' : 'Bỏ duyệt'}</span>
                    </Button>
                  )}

                  {/* Nút Đóng */}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={paySubmitting || reviewSubmitting}
                    onClick={() => setPayModalOpen(false)}
                    className="rounded-xl border-slate-200/80 bg-white/70 text-slate-700 hover:bg-white font-semibold text-xs h-9 px-4 cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    <X size={14} />
                    <span>Đóng</span>
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Confirmation Modals */}
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
          setRevokeConfirmOpen(false);
          await submitReviewProof('revoked');
        }}
        title="Bỏ duyệt chứng từ phí phòng"
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
    </div>
  );
}
