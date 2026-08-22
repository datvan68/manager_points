'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Trash2,
  RotateCcw,
  Search,
  Filter,
  Layers,
  Clock,
  Database,
  Info,
  ShieldCheck,
  AlertCircle,
  FolderArchive,
  History,
} from 'lucide-react';
import {
  systemApi,
  StorageSummaryMetrics,
  StorageInventoryItem,
  StorageLifecycleState,
  StorageNamespace,
  StorageReconciliationResult,
  StorageAuditLogEntry,
} from '@/api/system-api';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { toast } from 'sonner';

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function StorageManagementPage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = isAdminUser(user);

  // States
  const [summary, setSummary] = useState<StorageSummaryMetrics | null>(null);
  const [inventory, setInventory] = useState<StorageInventoryItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 15;

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StorageLifecycleState | 'all'>('all');
  const [selectedNamespace, setSelectedNamespace] = useState<StorageNamespace | 'all'>('all');
  const [selectedDomain, setSelectedDomain] = useState<'activities' | 'dormitory' | 'all'>('all');

  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<StorageReconciliationResult | null>(null);

  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [restoreTargetItem, setRestoreTargetItem] = useState<StorageInventoryItem | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [purgeTargetItem, setPurgeTargetItem] = useState<StorageInventoryItem | null>(null);
  const [purgePhrase, setPurgePhrase] = useState('');
  const [purgeReason, setPurgeReason] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [showAuditLogsModal, setShowAuditLogsModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<StorageAuditLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Load summary metrics
  const loadSummary = useCallback(async () => {
    try {
      setIsLoadingSummary(true);
      const data = await systemApi.getStorageSummary();
      setSummary(data);
    } catch (err: any) {
      toast.error('Lỗi khi tải thông số dung lượng lưu trữ: ' + (err.message || 'Không xác định'));
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  // Load inventory
  const loadInventory = useCallback(
    async (page = 1) => {
      try {
        setIsLoadingInventory(true);
        const res = await systemApi.getStorageInventory({
          page,
          limit: pageSize,
          search: search || undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          namespace: selectedNamespace !== 'all' ? selectedNamespace : undefined,
          domain: selectedDomain !== 'all' ? selectedDomain : undefined,
        });
        setInventory(res.items || []);
        setTotalItems(res.total || 0);
        setCurrentPage(res.page || 1);
        setTotalPages(res.totalPages || 1);
      } catch (err: any) {
        toast.error('Lỗi khi tải danh sách tệp tin: ' + (err.message || 'Không xác định'));
      } finally {
        setIsLoadingInventory(false);
      }
    },
    [search, selectedStatus, selectedNamespace, selectedDomain],
  );

  useEffect(() => {
    if (isAdmin) {
      loadSummary();
    }
  }, [isAdmin, loadSummary]);

  useEffect(() => {
    if (isAdmin) {
      loadInventory(1);
    }
  }, [isAdmin, loadInventory]);

  // Actions
  const handlePreviewReconciliation = async () => {
    try {
      setIsReconciling(true);
      toast.info('Đang thực hiện quét đối soát lưu trữ (chỉ đọc)...');
      const res = await systemApi.previewStorageReconciliation();
      setReconcileResult(res);
      toast.success(
        `Quét kiểm tra hoàn tất: phát hiện ${res.orphan_files_count} tệp tin orphan candidate, ${res.missing_references_count} tham chiếu thiếu.`,
      );
      await Promise.all([loadSummary(), loadInventory(currentPage)]);
    } catch (err: any) {
      toast.error('Lỗi khi quét đối soát lưu trữ: ' + (err.message || 'Thao tác thất bại'));
    } finally {
      setIsReconciling(false);
    }
  };

  const handleExecuteReconciliation = async () => {
    try {
      setIsReconciling(true);
      setShowExecuteModal(false);
      toast.info('Đang thực thi đối soát và cách ly các tệp tin rác...');
      const res = await systemApi.executeStorageReconciliation();
      setReconcileResult(res);
      toast.success(
        `Thực thi thành công: Đã cách ly an toàn ${res.quarantined_count} tệp tin (${formatBytes(res.quarantined_bytes)}).`,
      );
      await Promise.all([loadSummary(), loadInventory(1)]);
    } catch (err: any) {
      toast.error('Lỗi khi thực thi cách ly: ' + (err.message || 'Thao tác thất bại'));
    } finally {
      setIsReconciling(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreTargetItem) return;
    try {
      setIsRestoring(true);
      await systemApi.restoreStorageAsset(restoreTargetItem.id);
      toast.success('Đã khôi phục tệp tin về vị trí ban đầu thành công.');
      setRestoreTargetItem(null);
      await Promise.all([loadSummary(), loadInventory(currentPage)]);
    } catch (err: any) {
      toast.error('Lỗi khi khôi phục tệp tin: ' + (err.message || 'Thao tác thất bại'));
    } finally {
      setIsRestoring(false);
    }
  };

  const handleConfirmPurge = async () => {
    if (!purgeTargetItem) return;
    const phrase = purgePhrase.trim().toUpperCase();
    if (phrase !== 'XÓA VĨNH VIỄN' && phrase !== 'PURGE') {
      toast.error('Vui lòng nhập đúng cụm từ xác nhận: XÓA VĨNH VIỄN');
      return;
    }
    const token = purgeTargetItem.quarantine_manifest?.purge_confirmation_token;
    if (!token) {
      toast.error('Tệp tin không có mã xác nhận xóa hợp lệ từ máy chủ.');
      return;
    }
    try {
      setIsPurging(true);
      const res = await systemApi.purgeStorageAsset(purgeTargetItem.id, {
        confirmationToken: token,
        confirmationPhrase: purgePhrase.trim(),
        reason: purgeReason.trim() || undefined,
      });
      toast.success(
        `Đã xóa vĩnh viễn tệp tin và giải phóng ${formatBytes(res.reclaimed_bytes || purgeTargetItem.size)}.`,
      );
      setPurgeTargetItem(null);
      setPurgePhrase('');
      setPurgeReason('');
      await Promise.all([loadSummary(), loadInventory(currentPage)]);
    } catch (err: any) {
      toast.error('Lỗi khi xóa vĩnh viễn: ' + (err.message || 'Thao tác thất bại'));
      await loadInventory(currentPage);
    } finally {
      setIsPurging(false);
    }
  };

  const handleViewAuditLogs = async () => {
    setShowAuditLogsModal(true);
    setIsLoadingLogs(true);
    try {
      const logs = await systemApi.getStorageAuditLogs(50);
      setAuditLogs(logs || []);
    } catch (err: any) {
      toast.error('Lỗi tải nhật ký lưu trữ: ' + err.message);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-[#1A73E8]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-transparent custom-scrollbar animate-in fade-in duration-300">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8 text-center backdrop-blur-md shadow-sm shadow-slate-300/40">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 shadow-sm">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-rose-900">Truy cập bị từ chối</h2>
          <p className="mt-2 text-xs font-medium text-rose-700">
            Chức năng quản trị và đối soát lưu trữ chỉ dành riêng cho Quản trị viên hệ thống (SYSTEM_ADMIN).
          </p>
        </div>
      </main>
    );
  }

  const capacity = summary?.capacity;
  const usagePercent = capacity?.usagePercent || 0;
  let usageColor = 'bg-emerald-500';
  if (usagePercent >= 95 || capacity?.status === 'critical') usageColor = 'bg-rose-600';
  else if (usagePercent >= 85 || capacity?.status === 'warning') usageColor = 'bg-amber-500';

  return (
    <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 lg:p-6 space-y-4 bg-transparent custom-scrollbar animate-in fade-in duration-300">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white/40 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl transition-all duration-150 ease-out">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 bg-blue-500/10 text-[#1A73E8] border border-blue-500/20 rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <HardDrive className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1E293B] tracking-tight">
              Quản trị & Đối soát Lưu trữ
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Theo dõi dung lượng, vòng đời tệp tin, quét đối soát tham chiếu và cách ly tệp tin rác
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleViewAuditLogs}
            className="flex items-center gap-1.5 rounded-xl border border-white/70 bg-white/40 px-3.5 py-2 text-xs font-semibold text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out hover:bg-white/70 hover:scale-[1.01]"
          >
            <History className="h-4 w-4 text-[#64748B]" />
            Nhật ký kiểm tra
          </button>
          <button
            onClick={() => {
              loadSummary();
              loadInventory(currentPage);
            }}
            disabled={isLoadingSummary || isLoadingInventory || isReconciling}
            className="flex items-center gap-1.5 rounded-xl border border-white/70 bg-white/40 px-3.5 py-2 text-xs font-semibold text-[#1E293B] shadow-sm backdrop-blur-sm transition-all duration-150 ease-out hover:bg-white/70 hover:scale-[1.01] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoadingSummary || isLoadingInventory ? 'animate-spin' : ''}`}
            />
            Làm mới
          </button>
        </div>
      </div>

      {/* Capacity & Health Banner */}
      <div className="rounded-2xl border border-white/70 bg-white/40 p-5 shadow-sm shadow-slate-300/40 backdrop-blur-md transition-all duration-150 ease-out">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-[#1E293B]">
                Dung lượng Volume Chứa Media
              </h2>
              {capacity?.degraded ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 backdrop-blur-sm">
                  <AlertTriangle className="h-3.5 w-3.5" /> Suy giảm (Degraded Telemetry)
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm ${
                    capacity?.status === 'healthy'
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                      : capacity?.status === 'warning'
                        ? 'border-amber-500/20 bg-amber-500/10 text-amber-700'
                        : 'border-rose-500/20 bg-rose-500/10 text-rose-700'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {capacity?.status === 'healthy'
                    ? 'Bình thường'
                    : capacity?.status === 'warning'
                      ? 'Cảnh báo (>85%)'
                      : 'Báo động (>95%)'}
                </span>
              )}
            </div>
            {capacity?.degraded ? (
              <p className="mt-1.5 text-xs text-amber-700">
                Lưu ý: Môi trường hiện tại không hỗ trợ truy xuất statfs thực tế. Số liệu dung lượng ổ đĩa khả dụng tạm thời bị suy giảm.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-[#64748B]">
                Nguồn: <span className="font-semibold text-[#1E293B]">filesystem_containing_media_root</span> | Đã sử dụng {formatBytes(capacity?.usedBytes || 0)} / {formatBytes(capacity?.totalBytes || 0)} (Trống: {formatBytes(capacity?.freeBytes || 0)}) | Đo lúc: {capacity?.measuredAt ? new Date(capacity.measuredAt).toLocaleString('vi-VN') : 'Mới cập nhật'}
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-3xl font-extrabold text-[#1E293B] tracking-tight">
              {usagePercent}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3.5 h-2.5 w-full overflow-hidden rounded-xl bg-slate-200/50 backdrop-blur-xs">
          <div
            className={`h-full rounded-xl transition-all duration-500 ${usageColor}`}
            style={{ width: `${Math.min(100, Math.max(0, usagePercent))}%` }}
          />
        </div>
      </div>

      {/* Summary Metric Bento Grid Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Live files */}
        <div className="rounded-2xl border border-white/70 bg-white/40 p-4 shadow-sm shadow-slate-300/40 backdrop-blur-md transition-all duration-150 ease-out hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">
              Tệp tin Hoạt động (Live)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-[#1A73E8] shadow-sm">
              <FileText className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-[#1E293B]">
              {summary?.live_files_count ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">
              Tổng kích thước: {formatBytes(summary?.live_bytes ?? 0)}
            </div>
          </div>
        </div>

        {/* Quarantined files */}
        <div className="rounded-2xl border border-white/70 bg-white/40 p-4 shadow-sm shadow-slate-300/40 backdrop-blur-md transition-all duration-150 ease-out hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">
              Vùng Cách ly (Quarantine)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-700 shadow-sm">
              <FolderArchive className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-purple-700">
              {summary?.quarantined_files_count ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">
              Dung lượng cách ly: {formatBytes(summary?.quarantined_bytes ?? 0)}
            </div>
          </div>
        </div>

        {/* Reclaimable files */}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 shadow-sm shadow-slate-300/40 backdrop-blur-md transition-all duration-150 ease-out hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800">
              Có thể Xóa Vĩnh viễn
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/20 text-rose-700 shadow-sm">
              <Trash2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-rose-700">
              {summary?.reclaimable_files_count ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-rose-700">
              Giải phóng: {formatBytes(summary?.reclaimable_bytes ?? 0)}
            </div>
          </div>
        </div>

        {/* Orphan Candidates */}
        <div className="rounded-2xl border border-white/70 bg-white/40 p-4 shadow-sm shadow-slate-300/40 backdrop-blur-md transition-all duration-150 ease-out hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">
              Tệp tin Rác (Orphan)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-700 shadow-sm">
              <AlertCircle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-amber-700">
              {summary?.orphan_candidates_count ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">
              Không có tham chiếu DB (&gt;24h)
            </div>
          </div>
        </div>

        {/* Missing References */}
        <div className="rounded-2xl border border-white/70 bg-white/40 p-4 shadow-sm shadow-slate-300/40 backdrop-blur-md transition-all duration-150 ease-out hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">
              Tham chiếu Thiếu (Missing)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-700 shadow-sm">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-rose-700">
              {summary?.missing_references_count ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-[#64748B]">
              Có trong DB nhưng thiếu trên đĩa
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation Actions & Last Scan Report */}
      <div className="rounded-2xl border border-white/70 bg-white/40 p-5 shadow-sm shadow-slate-300/40 backdrop-blur-md transition-all duration-150 ease-out">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-[#1E293B]">
              Tiến trình Đối soát & Cách ly Tệp tin Rác
            </h3>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Đối soát toàn diện giữa 5 bộ sưu tập MongoDB và hệ thống tệp tin vật lý. Áp dụng thời gian ân hạn 24 giờ cho tệp mới tải lên.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handlePreviewReconciliation}
              disabled={isReconciling}
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-2 text-xs font-semibold text-[#1A73E8] transition-all duration-150 ease-out hover:bg-blue-500/20 hover:scale-[1.01] disabled:opacity-50 shadow-sm"
            >
              <Search className="h-4 w-4" />
              Quét kiểm tra (Preview)
            </button>
            <button
              onClick={() => setShowExecuteModal(true)}
              disabled={isReconciling || summary?.capabilities?.canExecuteReconciliation === false}
              title={
                summary?.capabilities?.canExecuteReconciliation === false
                  ? 'Chức năng thực thi cách ly bị vô hiệu hóa bởi cấu hình hệ thống'
                  : 'Cách ly tệp rác'
              }
              className="flex items-center gap-1.5 rounded-xl border border-purple-600/30 bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 ease-out hover:bg-purple-700 hover:scale-[1.01] disabled:opacity-50"
            >
              <FolderArchive className="h-4 w-4" />
              Cách ly tệp rác (Execute)
            </button>
          </div>
        </div>

        {reconcileResult && (
          <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 backdrop-blur-sm p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 text-[#1A73E8] shrink-0" />
              <div className="flex-1 text-xs">
                <div className="font-semibold text-blue-950">
                  Kết quả đợt đối soát gần nhất ({reconcileResult.mode === 'preview' ? 'Chế độ xem trước - Không di chuyển file' : 'Đã thực thi cách ly'})
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2 text-slate-700 sm:grid-cols-4 font-medium">
                  <div>Tệp đã quét: <span className="font-bold text-[#1E293B]">{reconcileResult.scanned_files_count}</span></div>
                  <div>Hợp lệ (Active): <span className="font-bold text-[#1A73E8]">{reconcileResult.referenced_files_count}</span></div>
                  <div>Tệp rác phát hiện: <span className="font-bold text-amber-700">{reconcileResult.orphan_files_count}</span></div>
                  <div>Đã chuyển cách ly: <span className="font-bold text-purple-700">{reconcileResult.quarantined_count} ({formatBytes(reconcileResult.quarantined_bytes)})</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inventory Management Table */}
      <div className="rounded-2xl border border-white/70 bg-white/40 p-5 shadow-sm shadow-slate-300/40 backdrop-blur-md transition-all duration-150 ease-out space-y-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h3 className="text-base font-semibold text-[#1E293B]">
              Danh mục Tệp tin & Trạng thái Vòng đời
            </h3>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Tổng cộng {totalItems} tệp tin được quản lý
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm file, token, id..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/70 bg-white/50 py-1.5 pl-8.5 pr-3 text-xs text-[#1E293B] placeholder-slate-400 backdrop-blur-sm transition-all duration-150 focus:border-white/90 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30"
              />
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              aria-label="Lọc theo trạng thái"
              className="rounded-xl border border-white/70 bg-white/50 px-3 py-1.5 text-xs font-medium text-[#1E293B] backdrop-blur-sm transition-all duration-150 focus:border-white/90 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Hoạt động (Active)</option>
              <option value="staged">Ân hạn (Staged &lt;24h)</option>
              <option value="orphan_candidate">Tệp rác (Orphan)</option>
              <option value="quarantined">Đã cách ly (Quarantine)</option>
            </select>

            {/* Namespace Filter */}
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value as any)}
              aria-label="Lọc theo phân vùng"
              className="rounded-xl border border-white/70 bg-white/50 px-3 py-1.5 text-xs font-medium text-[#1E293B] backdrop-blur-sm transition-all duration-150 focus:border-white/90 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 cursor-pointer"
            >
              <option value="all">Tất cả phân vùng</option>
              <option value="activities">Hoạt động (activities)</option>
              <option value="dormitory-qr">QR KTX (dormitory-qr)</option>
              <option value="invoices">Điện nước (invoices)</option>
              <option value="room-fee-invoices">Phí phòng (room-fee-invoices)</option>
            </select>

            {/* Domain Filter */}
            <select
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value as any)}
              aria-label="Lọc theo nghiệp vụ"
              className="rounded-xl border border-white/70 bg-white/50 px-3 py-1.5 text-xs font-medium text-[#1E293B] backdrop-blur-sm transition-all duration-150 focus:border-white/90 focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 cursor-pointer"
            >
              <option value="all">Tất cả nghiệp vụ</option>
              <option value="activities">Hoạt động</option>
              <option value="dormitory">Ký túc xá</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-white/70 bg-white/30 backdrop-blur-sm">
          <table className="min-w-full divide-y divide-white/60 text-left text-xs">
            <thead className="bg-white/50 font-semibold text-[#64748B] backdrop-blur-sm">
              <tr>
                <th className="px-3.5 py-3">Token / Opaque ID</th>
                <th className="px-3.5 py-3">Tên tệp</th>
                <th className="px-3.5 py-3">Phân vùng</th>
                <th className="px-3.5 py-3">Tham chiếu Nghiệp vụ</th>
                <th className="px-3.5 py-3">Kích thước</th>
                <th className="px-3.5 py-3">Trạng thái</th>
                <th className="px-3.5 py-3">Thời gian</th>
                <th className="px-3.5 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40 bg-transparent">
              {isLoadingInventory ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#64748B]">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1A73E8]" />
                    <span className="mt-2 block text-xs font-medium">Đang tải danh mục tệp tin...</span>
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs font-medium text-[#64748B]">
                    Không tìm thấy tệp tin nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => {
                  let statusBadge = (
                    <span className="inline-flex items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      Hoạt động
                    </span>
                  );
                  if (item.status === 'staged') {
                    statusBadge = (
                      <span className="inline-flex items-center rounded-xl border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-[#1A73E8]">
                        Ân hạn (&lt;24h)
                      </span>
                    );
                  } else if (item.status === 'orphan_candidate') {
                    statusBadge = (
                      <span className="inline-flex items-center rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                        Tệp rác
                      </span>
                    );
                  } else if (item.status === 'quarantined') {
                    statusBadge = (
                      <span className="inline-flex items-center rounded-xl border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-700">
                        Đã cách ly
                      </span>
                    );
                  }

                  return (
                    <tr key={item.id} className="transition-colors duration-150 hover:bg-white/40">
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-[#64748B]">
                        {item.id.slice(0, 10)}...
                      </td>
                      <td className="max-w-[180px] truncate px-3.5 py-2.5 font-semibold text-[#1E293B]" title={item.filename}>
                        {item.filename}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        <span className="rounded-xl border border-white/70 bg-white/60 px-2 py-0.5 text-[11px] font-medium text-[#1E293B] shadow-xs">
                          {item.namespace}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700">
                        {item.domain_ref ? (
                          <div>
                            <span className="font-semibold text-[#1E293B]">
                              {item.domain_ref.display_title || item.domain_ref.owner_id}
                            </span>
                            <span className="ml-1 text-[11px] text-[#64748B]">
                              ({item.domain_ref.field})
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#64748B] italic">Không có tham chiếu</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-medium text-slate-700">
                        {formatBytes(item.size)}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        {statusBadge}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-[#64748B]">
                        {new Date(item.modified_at).toLocaleDateString('vi-VN')} {new Date(item.modified_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                        {item.status === 'quarantined' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setRestoreTargetItem(item)}
                              disabled={summary?.capabilities?.canRestore === false}
                              title={
                                summary?.capabilities?.canRestore === false
                                  ? 'Chức năng khôi phục bị vô hiệu hóa bởi cấu hình hệ thống'
                                  : 'Khôi phục tệp tin'
                              }
                              className="inline-flex items-center gap-1 rounded-xl border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-[#1A73E8] transition-all duration-150 hover:bg-blue-500/20 hover:scale-[1.01] disabled:opacity-50 cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Khôi phục
                            </button>

                            {item.quarantine_manifest?.is_purge_eligible ? (
                              <button
                                onClick={() => {
                                  setPurgeTargetItem(item);
                                  setPurgePhrase('');
                                  setPurgeReason('');
                                }}
                                disabled={summary?.capabilities?.canPurge === false}
                                title={
                                  summary?.capabilities?.canPurge === false
                                    ? 'Chức năng xóa vĩnh viễn bị vô hiệu hóa bởi cấu hình hệ thống'
                                    : 'Xóa vĩnh viễn khỏi hệ thống'
                                }
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 transition-all duration-150 hover:bg-rose-500/20 hover:scale-[1.01] disabled:opacity-50 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Xóa vĩnh viễn
                              </button>
                            ) : (
                              <span
                                className="rounded-xl border border-slate-200/80 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                                title={`Hạn lưu trữ: ${item.quarantine_manifest?.expires_at ? new Date(item.quarantine_manifest.expires_at).toLocaleDateString('vi-VN') : '30 ngày'}`}
                              >
                                Còn {item.quarantine_manifest?.retention_remaining_days || 1} ngày
                              </span>
                            )}
                          </div>
                        ) : item.status === 'orphan_candidate' ? (
                          <span className="text-amber-700 text-[11px] font-medium">Chờ cách ly</span>
                        ) : item.status === 'staged' ? (
                          <span className="text-[#1A73E8] text-[11px] font-medium">Đang ân hạn</span>
                        ) : (
                          <span className="text-[#64748B] text-[11px] font-medium">Được bảo vệ</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
          <div>
            Trang {currentPage} / {totalPages} (Tổng {totalItems} mục)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadInventory(currentPage - 1)}
              disabled={currentPage <= 1 || isLoadingInventory}
              className="rounded-xl border border-white/70 bg-white/50 backdrop-blur-sm px-3 py-1.5 font-semibold text-[#1E293B] shadow-xs transition-all duration-150 hover:bg-white/80 disabled:opacity-50 cursor-pointer"
            >
              Trang trước
            </button>
            <button
              onClick={() => loadInventory(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoadingInventory}
              className="rounded-xl border border-white/70 bg-white/50 backdrop-blur-sm px-3 py-1.5 font-semibold text-[#1E293B] shadow-xs transition-all duration-150 hover:bg-white/80 disabled:opacity-50 cursor-pointer"
            >
              Trang sau
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Execute Reconciliation */}
      {showExecuteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white/95 backdrop-blur-md border border-white/80 p-6 shadow-xl shadow-slate-400/20 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[#1E293B]">
                Xác nhận Cách ly Tệp tin Rác
              </h3>
            </div>
            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <p>
                Hệ thống sẽ tiến hành di chuyển toàn bộ các tệp tin không còn được tham chiếu vào vùng cách ly an toàn (<code className="rounded-md bg-slate-100 px-1 py-0.5 text-xs font-mono">.quarantine</code>) kèm mã checksum SHA-256.
              </p>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 backdrop-blur-sm p-3 text-blue-950">
                <div className="font-semibold flex items-center gap-1.5 text-xs text-[#1A73E8]">
                  <ShieldCheck className="h-4 w-4" /> Chính sách Ân hạn 24 giờ
                </div>
                <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                  Các tệp tin vừa tải lên trong vòng 24 giờ qua sẽ được bảo vệ an toàn và không bị cách ly ngay cả khi chưa gắn vào bản ghi nào.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setShowExecuteModal(false)}
                className="rounded-xl border border-white/70 bg-white/60 backdrop-blur-sm px-4 py-2 text-xs font-semibold text-[#1E293B] shadow-xs transition-all duration-150 hover:bg-white/90 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleExecuteReconciliation}
                className="rounded-xl border border-purple-600/30 bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-purple-700 cursor-pointer"
              >
                Bắt đầu Cách ly
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Restore Asset */}
      {restoreTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white/95 backdrop-blur-md border border-white/80 p-6 shadow-xl shadow-slate-400/20 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-[#1A73E8]">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
                <RotateCcw className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[#1E293B]">
                Xác nhận Khôi phục Tệp tin
              </h3>
            </div>
            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <p>
                Tệp tin sẽ được khôi phục từ vùng cách ly về vị trí ban đầu trong hệ thống lưu trữ (<code className="rounded-md bg-slate-100 px-1 py-0.5 text-xs font-mono">{restoreTargetItem.relative_key}</code>).
              </p>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-slate-700 space-y-1">
                <div>Tên tệp: <span className="font-semibold text-[#1E293B]">{restoreTargetItem.filename}</span></div>
                <div>Kích thước: <span className="font-semibold text-[#1E293B]">{formatBytes(restoreTargetItem.size)}</span></div>
                <div>Phân vùng: <span className="font-semibold text-[#1E293B]">{restoreTargetItem.namespace}</span></div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setRestoreTargetItem(null)}
                disabled={isRestoring}
                className="rounded-xl border border-white/70 bg-white/60 backdrop-blur-sm px-4 py-2 text-xs font-semibold text-[#1E293B] shadow-xs transition-all duration-150 hover:bg-white/90 disabled:opacity-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="flex items-center gap-1.5 rounded-xl border border-blue-600/30 bg-[#1A73E8] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                Khôi phục ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Permanent Purge */}
      {purgeTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white/95 backdrop-blur-md border border-rose-500/30 p-6 shadow-2xl shadow-rose-900/20 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-rose-900">
                  Xác nhận Xóa Vĩnh Viễn Tệp Tin
                </h3>
                <span className="text-xs font-medium text-rose-700">
                  Thao tác không thể hoàn tác
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-700">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-900 font-medium">
                <div className="font-bold flex items-center gap-1.5 text-rose-700">
                  <AlertTriangle className="h-4 w-4" /> CẢNH BÁO NGUY HIỂM
                </div>
                <p className="mt-1 text-[11px] text-rose-800 leading-relaxed">
                  Tệp tin sẽ bị xóa hoàn toàn khỏi ổ đĩa máy chủ và không thể khôi phục nếu không có bản sao lưu cơ sở dữ liệu và lưu trữ độc lập.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-slate-700 space-y-1.5 font-mono text-[11px]">
                <div>Dung lượng giải phóng: <span className="font-bold text-rose-700">{formatBytes(purgeTargetItem.size)}</span></div>
                <div>Hậu tố Checksum SHA-256: <span className="font-bold text-[#1E293B]">...{purgeTargetItem.quarantine_manifest?.sha256_suffix || purgeTargetItem.quarantine_manifest?.sha256?.slice(-8) || 'N/A'}</span></div>
                <div>Server Token: <span className="font-bold text-[#1A73E8]">{purgeTargetItem.quarantine_manifest?.purge_confirmation_token?.slice(0, 16)}...</span></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                  Nhập chính xác cụm từ <span className="font-bold text-rose-600">XÓA VĨNH VIỄN</span> để xác nhận:
                </label>
                <input
                  type="text"
                  placeholder="XÓA VĨNH VIỄN"
                  value={purgePhrase}
                  onChange={(e) => setPurgePhrase(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#1E293B] placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E293B] mb-1">
                  Lý do xóa vĩnh viễn (tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="Nhập lý do xóa (tùy chọn)..."
                  value={purgeReason}
                  onChange={(e) => setPurgeReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setPurgeTargetItem(null);
                  setPurgePhrase('');
                  setPurgeReason('');
                }}
                disabled={isPurging}
                className="rounded-xl border border-white/70 bg-white/60 backdrop-blur-sm px-4 py-2 text-xs font-semibold text-[#1E293B] shadow-xs transition-all duration-150 hover:bg-white/90 disabled:opacity-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmPurge}
                disabled={
                  isPurging ||
                  (purgePhrase.trim().toUpperCase() !== 'XÓA VĨNH VIỄN' &&
                    purgePhrase.trim().toUpperCase() !== 'PURGE')
                }
                className="flex items-center gap-1.5 rounded-xl border border-rose-600/30 bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Trash2 className={`h-3.5 w-3.5 ${isPurging ? 'animate-spin' : ''}`} />
                Xác nhận Xóa Vĩnh Viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {showAuditLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl rounded-2xl bg-white/95 backdrop-blur-md border border-white/80 p-6 shadow-xl shadow-slate-400/20 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-white/80 pb-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-[#1E293B]">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-[#1A73E8]">
                  <History className="h-4 w-4" />
                </div>
                Nhật ký Kiểm tra & Đối soát Lưu trữ
              </h3>
              <button
                onClick={() => setShowAuditLogsModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748B] hover:bg-slate-100 hover:text-[#1E293B] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 max-h-[450px] overflow-y-auto custom-scrollbar pr-1">
              {isLoadingLogs ? (
                <div className="py-8 text-center text-[#64748B]">
                  <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#1A73E8]" />
                  <span className="mt-2 block text-xs font-medium">Đang tải nhật ký...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs font-medium text-[#64748B]">
                  Chưa có nhật ký đối soát nào được ghi nhận.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {auditLogs.map((log) => (
                    <div
                      key={log._id}
                      className="rounded-xl border border-white/70 bg-white/60 backdrop-blur-sm p-3 text-xs shadow-xs"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span
                          className={`rounded-xl border px-2.5 py-0.5 text-[11px] font-semibold ${
                            log.action === 'quarantine'
                              ? 'border-purple-500/20 bg-purple-500/10 text-purple-700'
                              : log.action === 'restore'
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                                : log.action === 'purge'
                                  ? 'border-rose-500/20 bg-rose-500/10 text-rose-700'
                                  : 'border-blue-500/20 bg-blue-500/10 text-[#1A73E8]'
                          }`}
                        >
                          {log.action.toUpperCase()} ({log.mode})
                        </span>
                        <span className="text-[#64748B]">
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="mt-1.5 text-slate-700 font-medium">
                        Thực hiện bởi: <span className="font-bold text-[#1E293B]">{log.actor}</span> | Trạng thái: <span className="font-bold text-emerald-700">{log.status}</span>
                      </div>
                      {log.details && (
                        <div className="mt-2 rounded-xl border border-slate-200/60 bg-slate-50/80 p-2 font-mono text-[11px] text-slate-800">
                          {JSON.stringify(log.details, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 text-right">
              <button
                onClick={() => setShowAuditLogsModal(false)}
                className="rounded-xl border border-white/70 bg-white/60 backdrop-blur-sm px-4 py-2 text-xs font-semibold text-[#1E293B] shadow-xs transition-all duration-150 hover:bg-white/90 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
