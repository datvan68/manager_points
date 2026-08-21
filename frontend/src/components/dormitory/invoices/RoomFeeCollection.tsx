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
  RefreshCw,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [refreshing, setRefreshing] = useState(false);
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

  // Payment modal state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<RoomFeeInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Tiền mặt' | 'Chuyển khoản'>('Tiền mặt');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  // Proof Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewInvoice, setReviewInvoice] = useState<RoomFeeInvoice | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);

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
    const requestId = ++invoiceRequestRef.current;
    const requested = isCompact ? 1 : requestedPage;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

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
        toast.error(err?.message || 'Lỗi tải danh sách phí phòng');
      }
    } finally {
      if (invoiceRequestRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isCompact, page, pageSize, search, filterStatus, filterMonth]);

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

  // Open Payment Modal
  function openPayModal(inv: RoomFeeInvoice) {
    setSelectedInvoice(inv);
    setPaymentMethod('Tiền mặt');
    setPaymentNotes('');
    setProofFile(null);
    setProofPreview(null);
    setPayModalOpen(true);
  }

  // Submit Payment
  async function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) return;

    if (paymentMethod === 'Chuyển khoản' && !proofFile) {
      toast.error('Vui lòng tải lên ảnh chứng từ chuyển khoản');
      return;
    }

    try {
      setPaying(true);
      let proofPayload;
      if (proofFile) {
        proofPayload = await dormitoryApi.roomFeeInvoices.uploadProof(proofFile);
      }

      await dormitoryApi.roomFeeInvoices.pay(selectedInvoice._id, {
        payment_method: paymentMethod,
        notes: paymentNotes || undefined,
        payment_proof: proofPayload,
      });

      toast.success(
        paymentMethod === 'Tiền mặt'
          ? 'Đã xác nhận thu tiền mặt thành công'
          : 'Đã gửi chứng từ thanh toán chờ duyệt',
      );
      setPayModalOpen(false);
      void loadInvoices(true);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi thanh toán');
    } finally {
      setPaying(false);
    }
  }

  // Open Review / Check Proof Modal
  function openReviewModal(inv: RoomFeeInvoice) {
    setReviewInvoice(inv);
    setReviewModalOpen(true);
  }

  // Submit Review decision
  async function submitReviewDecision(decision: 'approved' | 'rejected' | 'revoked') {
    if (!reviewInvoice) return;
    try {
      setReviewSubmitting(true);
      const requestId = `${decision}-${reviewInvoice._id}-${Date.now()}`;
      await dormitoryApi.roomFeeInvoices.reviewProof(reviewInvoice._id, decision, requestId);

      toast.success(
        decision === 'approved'
          ? 'Đã duyệt chứng từ thanh toán'
          : decision === 'rejected'
            ? 'Đã từ chối chứng từ thanh toán'
            : 'Đã hủy duyệt chứng từ',
      );
      setReviewModalOpen(false);
      setRevokeConfirmOpen(false);
      void loadInvoices(true);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xử lý chứng từ');
    } finally {
      setReviewSubmitting(false);
    }
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
        className: 'w-[130px] min-w-[130px] text-left',
        render: (_, inv) => {
          const displayStatus = getDisplayStatus(inv.status, inv.payment_review?.status);
          if (displayStatus === 'Đã thu') {
            return (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <Check size={11} /> Đã thu
              </span>
            );
          }
          if (displayStatus === 'Chờ duyệt') {
            return (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 animate-pulse">
                <Eye size={11} /> Chờ duyệt
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              <AlertCircle size={11} /> Chưa thu
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Thao tác',
        priority: 'action',
        className: 'w-[160px] min-w-[160px] text-left',
        render: (_, inv) => {
          const displayStatus = getDisplayStatus(inv.status, inv.payment_review?.status);
          return (
            <div className="flex items-center gap-1.5">
              {displayStatus === 'Chưa thu' && canConfirmInvoice && (
                <button
                  type="button"
                  aria-label="Đóng ngay"
                  onClick={() => openPayModal(inv)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-all shadow-xs cursor-pointer"
                  title="Thanh toán ngay"
                >
                  <CheckCircle size={13} /> Đóng ngay
                </button>
              )}
              {displayStatus === 'Chờ duyệt' && canConfirmInvoice && (
                <button
                  type="button"
                  aria-label="Duyệt"
                  onClick={() => openReviewModal(inv)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-all shadow-xs cursor-pointer"
                  title="Duyệt chứng từ"
                >
                  <Eye size={13} /> Duyệt
                </button>
              )}
              {(displayStatus === 'Đã thu' || inv.payment_proof?.url) && (
                <button
                  type="button"
                  aria-label="Kiểm tra"
                  onClick={() => openReviewModal(inv)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
                  title="Xem chứng từ & thông tin"
                >
                  <Eye size={13} /> Kiểm tra
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
            <Button
              variant="outline"
              aria-label="Cấu hình đơn giá thu phí phòng"
              title="Cấu hình đơn giá & QR thu phí phòng"
              onClick={openConfigModal}
              className="h-9 w-9 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700 hover:bg-white/80 shrink-0 cursor-pointer"
            >
              <SlidersHorizontal size={15} />
            </Button>

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

            {/* Nút Tải lại */}
            <Button
              variant="outline"
              aria-label="Tải lại danh sách phí phòng"
              title="Tải lại"
              onClick={() => void loadInvoices(true)}
              className="h-9 w-9 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700 hover:bg-white/80 shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </Button>
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
      {/* MODAL THANH TOÁN (Tiền mặt / Chuyển khoản) */}
      {/* ========================================================================= */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl">
          <DialogHeader className="border-b border-white/50 pb-3">
            <DialogTitle className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
              <DollarSign size={20} className="text-emerald-600" />
              Thanh toán phí phòng
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <form onSubmit={handlePaySubmit} className="space-y-4 pt-2">
              {/* Thông tin hóa đơn */}
              <div className="rounded-xl bg-white/70 border border-slate-200/80 p-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Thành viên:</span>
                  <span className="font-bold text-slate-800">{selectedInvoice.member_name} ({selectedInvoice.member_code || '—'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phòng:</span>
                  <span className="font-semibold text-slate-800">{selectedInvoice.room_name || selectedInvoice.room_code} ({selectedInvoice.room_type})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kỳ thu:</span>
                  <span className="font-semibold text-slate-800">{formatBillingMonth(selectedInvoice.start_month)} - {formatBillingMonth(selectedInvoice.end_month)} ({selectedInvoice.months_count} tháng)</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-600 font-bold">Số tiền cần đóng:</span>
                  <span className="text-sm font-bold text-[#1A73E8]">{formatMoney(selectedInvoice.total_amount)}</span>
                </div>
              </div>

              {/* Phương thức thanh toán */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Phương thức thanh toán</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Tiền mặt')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'Tiền mặt'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white/60 text-slate-700 hover:bg-white'
                    }`}
                  >
                    Tiền mặt tại quầy
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Chuyển khoản')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      paymentMethod === 'Chuyển khoản'
                        ? 'border-[#1A73E8] bg-blue-50 text-[#1A73E8] ring-2 ring-[#1A73E8]/20'
                        : 'border-slate-200 bg-white/60 text-slate-700 hover:bg-white'
                    }`}
                  >
                    Chuyển khoản kèm QR
                  </button>
                </div>
              </div>

              {/* Nếu là Chuyển khoản, hiển thị QR và ô upload */}
              {paymentMethod === 'Chuyển khoản' && (
                <div className="space-y-3 rounded-xl border border-blue-200/80 bg-blue-50/50 p-3">
                  {configData?.transfer_qr_image?.url && (
                    <div className="text-center space-y-1">
                      <p className="text-[11px] font-semibold text-slate-600">Quét mã QR để chuyển khoản:</p>
                      <img
                        src={getImageUrl(configData.transfer_qr_image.url)}
                        alt="QR chuyển khoản"
                        className="max-h-40 mx-auto rounded-lg border border-slate-200 bg-white p-1"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Tải lên ảnh chứng từ chuyển khoản <span className="text-red-500">*</span>
                    </label>
                    {proofPreview && (
                      <div className="flex justify-center p-1 bg-white rounded border border-slate-200">
                        <img src={proofPreview} alt="Chứng từ preview" className="max-h-32 object-contain" />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      required
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error('Dung lượng ảnh không được quá 5MB');
                            return;
                          }
                          setProofFile(file);
                          setProofPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1A73E8]/10 file:text-[#1A73E8] hover:file:bg-[#1A73E8]/20"
                    />
                  </div>
                </div>
              )}

              {/* Ghi chú */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Ghi chú thanh toán</label>
                <input
                  type="text"
                  placeholder="Ghi chú thêm (nếu có)"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/70 text-sm text-slate-800 focus:ring-2 focus:ring-[#1A73E8]/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPayModalOpen(false)}
                  disabled={paying}
                  className="rounded-xl border-slate-300 text-xs cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={paying}
                  className="rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer shadow-sm"
                >
                  {paying
                    ? 'Đang xử lý...'
                    : paymentMethod === 'Tiền mặt'
                      ? 'Xác nhận Đã thu tiền mặt'
                      : 'Gửi chứng từ thanh toán'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL KIỂM TRA & DUYỆT CHỨNG TỪ */}
      {/* ========================================================================= */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl">
          <DialogHeader className="border-b border-white/50 pb-3">
            <DialogTitle className="text-lg font-bold text-[#1E293B] flex items-center gap-2">
              <Eye size={20} className="text-[#1A73E8]" />
              Chứng từ & Thông tin hóa đơn
            </DialogTitle>
          </DialogHeader>

          {reviewInvoice && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Thông tin */}
              <div className="rounded-xl bg-white/80 border border-slate-200 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã hóa đơn:</span>
                  <span className="font-mono font-bold text-slate-800">{reviewInvoice.invoice_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Họ tên thành viên:</span>
                  <span className="font-bold text-slate-800">{reviewInvoice.member_name} ({reviewInvoice.member_code || '—'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phòng:</span>
                  <span className="font-semibold text-slate-800">{reviewInvoice.room_name || reviewInvoice.room_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Khoản thu:</span>
                  <span className="font-bold text-[#1A73E8]">{formatMoney(reviewInvoice.total_amount)} ({reviewInvoice.months_count} tháng)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phương thức:</span>
                  <span className="font-semibold text-slate-700">{reviewInvoice.payment_method || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Trạng thái:</span>
                  <span className="font-bold text-slate-800">{getDisplayStatus(reviewInvoice.status, reviewInvoice.payment_review?.status)}</span>
                </div>
              </div>

              {/* Ảnh chứng từ */}
              {reviewInvoice.payment_proof?.url ? (
                <div className="space-y-1.5">
                  <span className="font-semibold text-slate-700">Ảnh chứng từ thanh toán:</span>
                  <div className="flex justify-center p-2 bg-white rounded-xl border border-slate-200">
                    <img
                      src={getImageUrl(reviewInvoice.payment_proof.url)}
                      alt="Chứng từ"
                      className="max-h-64 object-contain rounded"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 italic text-center py-2">Hóa đơn này chưa có ảnh chứng từ.</p>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-white/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviewModalOpen(false)}
                  disabled={reviewSubmitting}
                  className="rounded-xl border-slate-300 text-xs cursor-pointer"
                >
                  Đóng
                </Button>

                {canConfirmInvoice && reviewInvoice.payment_review?.status === 'pending' && (
                  <>
                    <Button
                      type="button"
                      onClick={() => void submitReviewDecision('rejected')}
                      disabled={reviewSubmitting}
                      className="rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                    >
                      {reviewSubmitting ? 'Đang xử lý...' : 'Không duyệt'}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void submitReviewDecision('approved')}
                      disabled={reviewSubmitting}
                      className="rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      {reviewSubmitting ? 'Đang xử lý...' : 'Duyệt chứng từ'}
                    </Button>
                  </>
                )}

                {canConfirmInvoice && reviewInvoice.payment_review?.status === 'approved' && (
                  <Button
                    type="button"
                    onClick={() => setRevokeConfirmOpen(true)}
                    disabled={reviewSubmitting}
                    className="rounded-xl bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700 cursor-pointer"
                  >
                    Bỏ duyệt chứng từ
                  </Button>
                )}
              </div>
            </div>
          )}
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
          await submitReviewDecision('revoked');
        }}
        title="Bỏ duyệt chứng từ phí phòng"
        message="Hóa đơn sẽ trở về trạng thái Chưa thu và thành viên có thể đăng tải lại chứng từ. Bạn có chắc chắn muốn tiếp tục?"
        confirmLabel="Bỏ duyệt"
        variant="warning"
      />
    </div>
  );
}
