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
  const [restoringAssetId, setRestoringAssetId] = useState<string | null>(null);
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
      loadSummary();
      loadInventory(currentPage);
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
      loadSummary();
      loadInventory(1);
    } catch (err: any) {
      toast.error('Lỗi khi thực thi cách ly: ' + (err.message || 'Thao tác thất bại'));
    } finally {
      setIsReconciling(false);
    }
  };

  const handleRestoreAsset = async (assetId: string) => {
    try {
      setRestoringAssetId(assetId);
      await systemApi.restoreStorageAsset(assetId);
      toast.success('Đã khôi phục tệp tin về vị trí ban đầu thành công.');
      loadSummary();
      loadInventory(currentPage);
    } catch (err: any) {
      toast.error('Lỗi khi khôi phục tệp tin: ' + (err.message || 'Thao tác thất bại'));
    } finally {
      setRestoringAssetId(null);
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
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/30">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-600 dark:text-red-400" />
          <h2 className="text-xl font-bold text-red-900 dark:text-red-200">Truy cập bị từ chối</h2>
          <p className="mt-2 text-sm text-red-700 dark:text-red-400">
            Chức năng quản trị và đối soát lưu trữ chỉ dành riêng cho Quản trị viên hệ thống (SYSTEM_ADMIN).
          </p>
        </div>
      </div>
    );
  }

  const capacity = summary?.capacity;
  const usagePercent = capacity?.usagePercent || 0;
  let usageColor = 'bg-emerald-500';
  if (usagePercent >= 95 || capacity?.status === 'critical') usageColor = 'bg-red-600';
  else if (usagePercent >= 85 || capacity?.status === 'warning') usageColor = 'bg-amber-500';

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <HardDrive className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            Quản trị & Đối soát Lưu trữ
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Theo dõi dung lượng, vòng đời tệp tin, quét đối soát tham chiếu và cách ly tệp tin rác
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleViewAuditLogs}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <History className="h-4 w-4 text-slate-500" />
            Nhật ký kiểm tra
          </button>
          <button
            onClick={() => {
              loadSummary();
              loadInventory(currentPage);
            }}
            disabled={isLoadingSummary || isLoadingInventory || isReconciling}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoadingSummary || isLoadingInventory ? 'animate-spin' : ''}`}
            />
            Làm mới
          </button>
        </div>
      </div>

      {/* Capacity & Health Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Dung lượng Ổ đĩa Lưu trữ
              </h2>
              {capacity?.degraded ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> Suy giảm (Degraded Telemetry)
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    capacity?.status === 'healthy'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : capacity?.status === 'warning'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
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
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Lưu ý: Môi trường hiện tại không hỗ trợ truy xuất statfs thực tế. Số liệu dung lượng ổ đĩa khả dụng tạm thời bị suy giảm.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Đã sử dụng {formatBytes(capacity?.usedBytes || 0)} / {formatBytes(capacity?.totalBytes || 0)} (Trống: {formatBytes(capacity?.freeBytes || 0)})
              </p>
            )}
          </div>
          <div className="text-right">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {usagePercent}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full transition-all duration-500 ${usageColor}`}
            style={{ width: `${Math.min(100, Math.max(0, usagePercent))}%` }}
          />
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Live files */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Tệp tin Hoạt động (Live)
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary?.live_files_count ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Tổng kích thước: {formatBytes(summary?.live_bytes ?? 0)}
            </div>
          </div>
        </div>

        {/* Quarantined files */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Vùng Cách ly (Quarantine)
            </span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <FolderArchive className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {summary?.quarantined_files_count ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Dung lượng cách ly: {formatBytes(summary?.quarantined_bytes ?? 0)}
            </div>
          </div>
        </div>

        {/* Orphan Candidates */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Tệp tin Rác (Orphan)
            </span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary?.orphan_candidates_count ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Không có tham chiếu DB (&gt;24h)
            </div>
          </div>
        </div>

        {/* Missing References */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Tham chiếu Thiếu (Missing)
            </span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {summary?.missing_references_count ?? 0}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Có trong DB nhưng thiếu trên đĩa
            </div>
          </div>
        </div>
      </div>

      {/* Reconciliation Actions & Last Scan Report */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Tiến trình Đối soát & Cách ly Tệp tin Rác
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Đối soát toàn diện giữa 5 bộ sưu tập MongoDB và hệ thống tệp tin vật lý. Áp dụng thời gian ân hạn 24 giờ cho tệp mới tải lên.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePreviewReconciliation}
              disabled={isReconciling}
              className="flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
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
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-purple-700 disabled:opacity-50 dark:bg-purple-700 dark:hover:bg-purple-600"
            >
              <FolderArchive className="h-4 w-4" />
              Cách ly tệp rác (Execute)
            </button>
          </div>
        </div>

        {reconcileResult && (
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div className="flex-1 text-xs">
                <div className="font-semibold text-blue-900 dark:text-blue-200">
                  Kết quả đợt đối soát gần nhất ({reconcileResult.mode === 'preview' ? 'Chế độ xem trước - Không di chuyển file' : 'Đã thực thi cách ly'})
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-slate-600 sm:grid-cols-4 dark:text-slate-300">
                  <div>Tệp đã quét: <span className="font-medium">{reconcileResult.scanned_files_count}</span></div>
                  <div>Hợp lệ (Active): <span className="font-medium">{reconcileResult.referenced_files_count}</span></div>
                  <div>Tệp rác phát hiện: <span className="font-medium text-amber-600">{reconcileResult.orphan_files_count}</span></div>
                  <div>Đã chuyển cách ly: <span className="font-medium text-purple-600">{reconcileResult.quarantined_count} ({formatBytes(reconcileResult.quarantined_bytes)})</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inventory Management Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Danh mục Tệp tin & Trạng thái Vòng đời
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Tổng cộng {totalItems} tệp tin được quản lý
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm file, token, id..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              aria-label="Lọc theo trạng thái"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">Tất cả nghiệp vụ</option>
              <option value="activities">Hoạt động</option>
              <option value="dormitory">Ký túc xá</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
            <thead className="bg-slate-50 font-semibold text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
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
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {isLoadingInventory ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                    <span className="mt-2 block text-xs">Đang tải danh mục tệp tin...</span>
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Không tìm thấy tệp tin nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => {
                  let statusBadge = (
                    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Hoạt động
                    </span>
                  );
                  if (item.status === 'staged') {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
                        Ân hạn (&lt;24h)
                      </span>
                    );
                  } else if (item.status === 'orphan_candidate') {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        Tệp rác
                      </span>
                    );
                  } else if (item.status === 'quarantined') {
                    statusBadge = (
                      <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800 dark:bg-purple-950/50 dark:text-purple-300">
                        Đã cách ly
                      </span>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-slate-500 dark:text-slate-400">
                        {item.id.slice(0, 10)}...
                      </td>
                      <td className="max-w-[180px] truncate px-3.5 py-2.5 font-medium text-slate-900 dark:text-white" title={item.filename}>
                        {item.filename}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {item.namespace}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-300">
                        {item.domain_ref ? (
                          <div>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {item.domain_ref.display_title || item.domain_ref.owner_id}
                            </span>
                            <span className="ml-1 text-[11px] text-slate-400">
                              ({item.domain_ref.field})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Không có tham chiếu</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-slate-600 dark:text-slate-400">
                        {formatBytes(item.size)}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5">
                        {statusBadge}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-slate-500 dark:text-slate-400">
                        {new Date(item.modified_at).toLocaleDateString('vi-VN')} {new Date(item.modified_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2.5 text-right">
                        {item.status === 'quarantined' ? (
                          <button
                            onClick={() => handleRestoreAsset(item.id)}
                            disabled={
                              restoringAssetId === item.id ||
                              summary?.capabilities?.canRestore === false
                            }
                            title={
                              summary?.capabilities?.canRestore === false
                                ? 'Chức năng khôi phục bị vô hiệu hóa bởi cấu hình hệ thống'
                                : 'Khôi phục tệp tin'
                            }
                            className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/40 dark:text-blue-300"
                          >
                            <RotateCcw className={`h-3.5 w-3.5 ${restoringAssetId === item.id ? 'animate-spin' : ''}`} />
                            Khôi phục
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Được bảo vệ</span>
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
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <div>
            Trang {currentPage} / {totalPages} (Tổng {totalItems} mục)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadInventory(currentPage - 1)}
              disabled={currentPage <= 1 || isLoadingInventory}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Trang trước
            </button>
            <button
              onClick={() => loadInventory(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoadingInventory}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Trang sau
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Execute Reconciliation */}
      {showExecuteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Xác nhận Cách ly Tệp tin Rác
              </h3>
            </div>
            <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Hệ thống sẽ tiến hành di chuyển toàn bộ các tệp tin không còn được tham chiếu vào vùng cách ly an toàn (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">.quarantine</code>) kèm mã checksum SHA-256.
              </p>
              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                <div className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Chính sách Ân hạn 24 giờ
                </div>
                <p className="mt-1">
                  Các tệp tin vừa tải lên trong vòng 24 giờ qua sẽ được bảo vệ an toàn và không bị cách ly ngay cả khi chưa gắn vào bản ghi nào.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowExecuteModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleExecuteReconciliation}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                Bắt đầu Cách ly
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Logs Modal */}
      {showAuditLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <History className="h-5 w-5 text-blue-600" />
                Nhật ký Kiểm tra & Đối soát Lưu trữ
              </h3>
              <button
                onClick={() => setShowAuditLogsModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 max-h-[450px] overflow-y-auto">
              {isLoadingLogs ? (
                <div className="py-8 text-center text-slate-500">
                  <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                  <span className="mt-2 block text-xs">Đang tải nhật ký...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Chưa có nhật ký đối soát nào được ghi nhận.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log._id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] ${
                            log.action === 'quarantine'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : log.action === 'restore'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : log.action === 'purge'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {log.action.toUpperCase()} ({log.mode})
                        </span>
                        <span className="text-slate-400">
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-600 dark:text-slate-300">
                        Thực hiện bởi: <span className="font-medium">{log.actor}</span> | Trạng thái: <span className="font-medium text-emerald-600">{log.status}</span>
                      </div>
                      {log.details && (
                        <div className="mt-2 rounded bg-white p-2 font-mono text-[11px] text-slate-700 dark:bg-slate-900 dark:text-slate-300">
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
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
