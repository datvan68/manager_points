"use client";

import React, { useState, useEffect } from "react";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { useAuth } from "@/providers/auth-provider";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { systemApi, LoginLog, LoginLogsSummary, SystemRequest, BackupJob } from "@/api/system-api";
import { authApi } from "@/api/auth-api";
import { tokenStorage } from "@/api/auth-api";
import { toast } from "sonner";
import ConfirmModal from "@/components/modals/ConfirmModal";
import {
  Shield,
  History,
  Server,
  FileText,
  AlertTriangle,
  Download,
  Trash2,
  Play,
  CheckCircle,
  Clock,
  Plus,
  Filter,
  RefreshCw,
  Search,
  Check,
  X,
  User,
  ArrowRight,
  ExternalLink,
  Lock,
  Unlock,
  AlertCircle
} from "lucide-react";

export default function SystemAdminPage() {
  return (
    <RouteGuard
      anyPermission={[
        "SYSTEM_ADMIN",
        "LOGIN_LOG_READ",
        "SYSTEM_REQUEST_READ",
        "SYSTEM_REQUEST_MANAGE",
        "DATABASE_BACKUP_READ",
        "DATABASE_BACKUP_CREATE",
        "DATABASE_BACKUP_DOWNLOAD",
        "DATABASE_BACKUP_DELETE",
      ]}
      useDynamicMapping={true}
      failClosed={true}
    >
      <SystemAdminDashboard />
    </RouteGuard>
  );
}

function SystemAdminDashboard() {
  const { user, hasPermission } = useAuth();
  const token = tokenStorage.getAccessToken() || "";
  // Permissions checks
  const canReadLogs = hasPermission("LOGIN_LOG_READ");
  const canReadRequests = hasPermission("SYSTEM_REQUEST_READ");
  const canManageRequests = hasPermission("SYSTEM_REQUEST_MANAGE");
  const canReadBackups = hasPermission("DATABASE_BACKUP_READ");
  const canCreateBackup = hasPermission("DATABASE_BACKUP_CREATE");
  const canDownloadBackup = hasPermission("DATABASE_BACKUP_DOWNLOAD");
  const canDeleteBackup = hasPermission("DATABASE_BACKUP_DELETE");

  const [activeTab, setActiveTab] = useState<"logs" | "requests" | "backup">("logs");
  
  // Tự động chuyển sang tab có quyền nếu không có quyền xem log
  useEffect(() => {
    if (!canReadLogs) {
      if (canReadRequests) {
        setActiveTab("requests");
      } else if (canReadBackups) {
        setActiveTab("backup");
      }
    }
  }, [canReadLogs, canReadRequests, canReadBackups]);
  
  // --- Tab 1: Login Logs States ---
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [logsSummary, setLogsSummary] = useState<LoginLogsSummary | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsFilterAction, setLogsFilterAction] = useState("");
  const [logsSearch, setLogsSearch] = useState("");
  const [logsSearchInput, setLogsSearchInput] = useState("");
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [sseStatus, setSseStatus] = useState<"connected" | "disconnected" | "error">("disconnected");

  // --- Tab 2: Requests States ---
  const [requests, setRequests] = useState<SystemRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsTotalPages, setRequestsTotalPages] = useState(1);
  const [requestsFilterStatus, setRequestsFilterStatus] = useState("");
  const [requestsFilterType, setRequestsFilterType] = useState("");
  const [requestsSearch, setRequestsSearch] = useState("");
  const [requestsSearchInput, setRequestsSearchInput] = useState("");
  
  const [selectedRequest, setSelectedRequest] = useState<SystemRequest | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  
  // Create Request Form State
  const [newRequestTitle, setNewRequestTitle] = useState("");
  const [newRequestDesc, setNewRequestDesc] = useState("");
  const [newRequestType, setNewRequestType] = useState("support");
  const [newRequestPriority, setNewRequestPriority] = useState("medium");
  const [newRequestMeta, setNewRequestMeta] = useState("");

  // Update Status Form State
  const [updateStatusVal, setUpdateStatusVal] = useState("");
  const [updateDecisionNote, setUpdateDecisionNote] = useState("");

  // --- Tab 3: Backups States ---
  const [backups, setBackups] = useState<BackupJob[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [backupsPage, setBackupsPage] = useState(1);
  const [backupsTotalPages, setBackupsTotalPages] = useState(1);
  const [isBackupRunning, setIsBackupRunning] = useState(false);
  const [isConfirmBackupOpen, setIsConfirmBackupOpen] = useState(false);
  const [isConfirmDeleteBackupOpen, setIsConfirmDeleteBackupOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // EFFECT: Fetch Login Logs & Summary
  // ---------------------------------------------------------------------------
  const fetchLogs = async (page = 1, showLoading = true) => {
    if (!canReadLogs) return;
    try {
      if (showLoading) setLogsLoading(true);
      const res = await systemApi.getLoginLogs({
        page,
        limit: 20,
        action: logsFilterAction || undefined,
        search: logsSearch || undefined,
      });
      setLogs(res.items);
      setLogsTotalPages(res.totalPages);
      setLogsPage(res.page);
    } catch (err: any) {
      toast.error("Lỗi tải lịch sử đăng nhập: " + err.message);
    } finally {
      if (showLoading) setLogsLoading(false);
    }
  };

  const fetchLogsSummary = async () => {
    if (!canReadLogs) return;
    try {
      const summary = await systemApi.getLoginLogsSummary();
      setLogsSummary(summary);
    } catch (err: any) {
      console.error("Failed to load logs summary", err);
    }
  };

  // Debounce search logs
  useEffect(() => {
    const handler = setTimeout(() => {
      setLogsSearch(logsSearchInput);
      setLogsPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [logsSearchInput]);

  // Debounce search requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setRequestsSearch(requestsSearchInput);
      setRequestsPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [requestsSearchInput]);

  // Setup Polling instead of SSE to prevent token leakage in URL
  useEffect(() => {
    if (activeTab !== "logs" || !canReadLogs) return;
    
    // Initial fetch
    fetchLogs(logsPage, true);
    fetchLogsSummary();

    if (!realtimeEnabled) {
      setSseStatus("disconnected");
      return;
    }

    setSseStatus("connected"); // Represent "Active Polling"

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      fetchLogs(logsPage, false);
      fetchLogsSummary();
    }, 5000); // Polling every 5 seconds

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchLogs(logsPage, false);
        fetchLogsSummary();
        setSseStatus("connected");
      } else {
        setSseStatus("disconnected");
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      setSseStatus("disconnected");
    };
  }, [activeTab, realtimeEnabled, logsPage, logsFilterAction, logsSearch, canReadLogs]);

  // Handle Search for logs with debounce or click
  const handleLogsSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLogsSearch(logsSearchInput);
    setLogsPage(1);
    fetchLogs(1, true);
  };

  // ---------------------------------------------------------------------------
  // EFFECT: Fetch Requests & Users
  // ---------------------------------------------------------------------------
  const fetchRequests = async (page = 1) => {
    if (!canReadRequests) return;
    try {
      setRequestsLoading(true);
      const res = await systemApi.getRequests({
        page,
        limit: 20,
        status: requestsFilterStatus || undefined,
        type: requestsFilterType || undefined,
        search: requestsSearch || undefined,
      });
      setRequests(res.items);
      setRequestsTotalPages(res.totalPages);
      setRequestsPage(res.page);
    } catch (err: any) {
      toast.error("Lỗi tải danh sách yêu cầu: " + err.message);
    } finally {
      setRequestsLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!canManageRequests) return;
    try {
      const users = await authApi.getUsers(token);
      setSystemUsers(users);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  useEffect(() => {
    if (activeTab === "requests") {
      if (canReadRequests) fetchRequests(requestsPage);
      if (canManageRequests) fetchUsers();
    }
  }, [activeTab, requestsPage, requestsFilterStatus, requestsFilterType, requestsSearch, canReadRequests, canManageRequests]);

  const handleRequestsSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRequestsSearch(requestsSearchInput);
    setRequestsPage(1);
    fetchRequests(1);
  };

  // Create Request Action
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageRequests) return;
    if (!newRequestTitle.trim()) {
      toast.error("Tiêu đề không được bỏ trống");
      return;
    }

    let metaObject = {};
    if (newRequestMeta.trim()) {
      try {
        metaObject = JSON.parse(newRequestMeta);
      } catch (err) {
        toast.error("Metadata phải là định dạng JSON hợp lệ");
        return;
      }
    }

    try {
      await systemApi.createRequest({
        title: newRequestTitle,
        description: newRequestDesc || undefined,
        type: newRequestType,
        priority: newRequestPriority,
        metadata: metaObject,
      });
      toast.success("Tạo yêu cầu thành công");
      setIsCreateModalOpen(false);
      // Reset form
      setNewRequestTitle("");
      setNewRequestDesc("");
      setNewRequestType("support");
      setNewRequestPriority("medium");
      setNewRequestMeta("");
      // Refresh
      fetchRequests(1);
    } catch (err: any) {
      toast.error("Lỗi tạo yêu cầu: " + err.message);
    }
  };

  // Assign Request Action
  const handleAssignRequest = async (userId: string) => {
    if (!canManageRequests || !selectedRequest) return;
    try {
      const updated = await systemApi.updateRequest(selectedRequest._id, {
        assignee_id: userId || undefined,
      });
      setSelectedRequest(updated);
      toast.success("Phân công người xử lý thành công");
      fetchRequests(requestsPage);
    } catch (err: any) {
      toast.error("Lỗi phân công: " + err.message);
    }
  };

  // Update Request Status Action
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageRequests || !selectedRequest) return;
    if (!updateStatusVal) {
      toast.error("Vui lòng chọn trạng thái");
      return;
    }
    if (!updateDecisionNote.trim()) {
      toast.error("Vui lòng nhập ghi chú quyết định");
      return;
    }

    try {
      const updated = await systemApi.updateRequestStatus(selectedRequest._id, {
        status: updateStatusVal,
        decision_note: updateDecisionNote,
      });
      setSelectedRequest(updated);
      toast.success("Cập nhật trạng thái thành công");
      setUpdateDecisionNote("");
      fetchRequests(requestsPage);
    } catch (err: any) {
      toast.error("Lỗi cập nhật trạng thái: " + err.message);
    }
  };

  // Delete Request Action
  const handleDeleteRequest = async (id: string) => {
    if (!canManageRequests) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa yêu cầu này?")) return;
    try {
      await systemApi.deleteRequest(id);
      toast.success("Xóa yêu cầu thành công");
      setIsDetailDrawerOpen(false);
      fetchRequests(requestsPage);
    } catch (err: any) {
      toast.error("Xóa yêu cầu thất bại: " + err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // EFFECT: Fetch Backups & Jobs list
  // ---------------------------------------------------------------------------
  const fetchBackups = async (page = 1) => {
    if (!canReadBackups) return;
    try {
      setBackupsLoading(true);
      const res = await systemApi.getBackups({ page, limit: 20 });
      setBackups(res.items);
      setBackupsTotalPages(res.totalPages);
      setBackupsPage(res.page);

      // Check if any job is currently running or queued
      const running = res.items.some(job => job.status === 'running' || job.status === 'queued');
      setIsBackupRunning(running);
    } catch (err: any) {
      toast.error("Lỗi tải danh sách sao lưu: " + err.message);
    } finally {
      setBackupsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "backup" && canReadBackups) {
      fetchBackups(backupsPage);
    }
  }, [activeTab, backupsPage, canReadBackups]);

  // Backup polling when a backup is running
  useEffect(() => {
    if (activeTab !== "backup" || !isBackupRunning || !canReadBackups) return;

    const interval = setInterval(() => {
      fetchBackups(backupsPage);
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [activeTab, isBackupRunning, backupsPage, canReadBackups]);

  // Create Backup Action
  const handleCreateBackup = async () => {
    if (!canCreateBackup) return;
    try {
      setIsConfirmBackupOpen(false);
      await systemApi.createBackup();
      toast.success("Tiến trình sao lưu đã được lập lịch khởi chạy.");
      fetchBackups(1);
    } catch (err: any) {
      toast.error("Tạo sao lưu thất bại: " + err.message);
    }
  };

  // Delete Backup Action
  const handleDeleteBackup = async (id: string) => {
    if (!canDeleteBackup) return;
    try {
      await systemApi.deleteBackup(id);
      toast.success("Xóa bản sao lưu thành công");
      fetchBackups(backupsPage);
    } catch (err: any) {
      toast.error("Xóa bản sao lưu thất bại: " + err.message);
    }
  };

  const requestDeleteBackup = (id: string) => {
    setBackupToDelete(id);
    setIsConfirmDeleteBackupOpen(true);
  };

  // Download Backup Action
  const handleDownloadBackup = async (job: BackupJob) => {
    if (!canDownloadBackup || !job.file_name) return;
    try {
      toast.info("Đang chuẩn bị file tải xuống...");
      await systemApi.downloadBackup(job._id, job.file_name, token);
      toast.success("Tải xuống thành công!");
    } catch (err: any) {
      toast.error("Tải file sao lưu thất bại: " + err.message);
    }
  };

  // Helpers
  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical": return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">Critical</span>;
      case "high": return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800 border border-orange-200">High</span>;
      case "medium": return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">Medium</span>;
      default: return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800 border border-green-200">Completed</span>;
      case "approved": return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Approved</span>;
      case "in_progress": return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">In Progress</span>;
      case "rejected": return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Rejected</span>;
      case "cancelled": return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">Cancelled</span>;
      default: return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Pending</span>;
    }
  };

  return (
    <div className="flex bg-slate-50 h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 bg-slate-50/50 animate-in fade-in duration-300">
          {/* Header Panel */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Quản trị Hệ thống</h1>
            <p className="text-xs text-slate-500 mt-0.5">Theo dõi lịch sử đăng nhập, phê duyệt các yêu cầu vận hành và sao lưu dữ liệu hệ thống.</p>
          </div>
        </div>
        
        {/* Tab Selector */}
        <div className="flex bg-slate-100/80 p-1 rounded-xl self-start md:self-center">
          {canReadLogs && (
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "logs" ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <History size={14} />
              Lịch sử đăng nhập
            </button>
          )}
          {canReadRequests && (
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "requests" ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText size={14} />
              Quản lý yêu cầu
            </button>
          )}
          {canReadBackups && (
            <button
              onClick={() => setActiveTab("backup")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "backup" ? "bg-white text-slate-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Server size={14} />
              Sao lưu database
            </button>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: LOGIN HISTORY */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          {!canReadLogs ? (
            <div className="bg-white/70 backdrop-blur-md border border-red-100 p-8 rounded-2xl shadow-sm text-center">
              <Lock className="mx-auto text-red-400 mb-2" size={32} />
              <p className="text-sm font-bold text-slate-700">Bạn không có quyền xem lịch sử đăng nhập</p>
            </div>
          ) : (
            <>
              {/* KPI Dashboard */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/70 backdrop-blur-md border border-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-500">Đăng nhập hôm nay</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-slate-800">
                      {logsSummary?.today.total ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400">lượt</span>
                  </div>
                </div>
                
                <div className="bg-white/70 backdrop-blur-md border border-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-500">Đăng nhập thành công</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-emerald-600">
                      {logsSummary?.today.login_success ?? 0}
                    </span>
                    <span className="text-[10px] text-emerald-500 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                      {logsSummary?.today.total 
                        ? Math.round((logsSummary.today.login_success / logsSummary.today.total) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>

                <div className="bg-white/70 backdrop-blur-md border border-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-500">Đăng nhập thất bại</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-rose-600">
                      {logsSummary?.today.login_failure ?? 0}
                    </span>
                    <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                      {logsSummary?.today.total 
                        ? Math.round((logsSummary.today.login_failure / logsSummary.today.total) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>

                <div className="bg-white/70 backdrop-blur-md border border-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                  <span className="text-xs font-semibold text-slate-500">Đổi/Reset mật khẩu</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-indigo-600">
                      {(logsSummary?.today.password_change ?? 0) + (logsSummary?.today.password_reset ?? 0)}
                    </span>
                    <span className="text-[10px] text-slate-400">yêu cầu</span>
                  </div>
                </div>
              </div>

              {/* Table list */}
              <div className="bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-800">Nhật ký hoạt động đăng nhập</h2>
                    {/* Realtime Polling Indicator */}
                    <div className="flex items-center gap-1.5 ml-2 bg-slate-100 px-2 py-0.5 rounded-full">
                      <span className={`w-2 h-2 rounded-full ${
                        sseStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                      }`} />
                      <span className="text-[10px] text-slate-500 font-bold capitalize">
                        {sseStatus === "connected" ? "Realtime (Polling)" : "Tắt Realtime"}
                      </span>
                    </div>
                  </div>

                  {/* Toolbar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <form onSubmit={handleLogsSearchSubmit} className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Tìm IP, User..."
                        value={logsSearchInput}
                        onChange={(e) => setLogsSearchInput(e.target.value)}
                        className="pl-8 pr-3 py-1.5 w-48 text-xs bg-slate-100 hover:bg-slate-150 focus:bg-white border border-transparent focus:border-slate-200 rounded-xl focus:outline-none transition-all"
                      />
                      <Search size={14} className="absolute left-2.5 text-slate-400" />
                    </form>

                    <select
                      value={logsFilterAction}
                      onChange={(e) => {
                        setLogsFilterAction(e.target.value);
                        setLogsPage(1);
                      }}
                      className="px-3 py-1.5 text-xs bg-slate-100 border border-transparent rounded-xl focus:outline-none focus:border-slate-200"
                    >
                      <option value="">Tất cả hoạt động</option>
                      <option value="login_success">Đăng nhập thành công</option>
                      <option value="login_failure">Đăng nhập thất bại</option>
                      <option value="logout">Đăng xuất</option>
                      <option value="password_change">Đổi mật khẩu</option>
                      <option value="password_reset">Reset mật khẩu</option>
                    </select>

                    <button
                      onClick={() => setRealtimeEnabled(!realtimeEnabled)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                        realtimeEnabled 
                          ? "bg-blue-50 text-blue-600 border-blue-200" 
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      <RefreshCw size={12} className={sseStatus === "connected" ? "animate-spin" : ""} />
                      {realtimeEnabled ? "Tắt Realtime" : "Bật Realtime"}
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                        <th className="px-4 py-3">Thời gian</th>
                        <th className="px-4 py-3">Tài khoản</th>
                        <th className="px-4 py-3">Địa chỉ IP</th>
                        <th className="px-4 py-3">Hành động</th>
                        <th className="px-4 py-3">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {logsLoading && logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400">
                            Đang tải nhật ký...
                          </td>
                        </tr>
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400">
                            Không tìm thấy bản ghi hoạt động nào.
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => {
                          let actionBadge = <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium text-[10px]">Unknown</span>;
                          if (log.action === "login_success") actionBadge = <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded font-bold text-[10px]">Login Success</span>;
                          else if (log.action === "login_failure") actionBadge = <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded font-bold text-[10px]">Login Failure</span>;
                          else if (log.action === "logout") actionBadge = <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-bold text-[10px]">Logout</span>;
                          else if (log.action === "password_reset" || log.action === "password_change" || log.action === "admin_reset_password") actionBadge = <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded font-bold text-[10px]">Security Change</span>;

                          return (
                            <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                                {new Date(log.login_time || log.createdAt).toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-800">
                                    {log.user_id?.user_name ?? "Chưa xác thực"}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {log.user_id?.email ?? "N/A"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-slate-600">
                                {log.ip_address}
                              </td>
                              <td className="px-4 py-3">
                                {actionBadge}
                              </td>
                              <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={log.details}>
                                {log.details || "-"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {logsTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <span className="text-xs text-slate-500">
                      Trang {logsPage} / {logsTotalPages}
                    </span>
                    <div className="flex gap-1">
                      <button
                        disabled={logsPage === 1}
                        onClick={() => setLogsPage(prev => prev - 1)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-250 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                      >
                        Trước
                      </button>
                      <button
                        disabled={logsPage === logsTotalPages}
                        onClick={() => setLogsPage(prev => prev + 1)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-250 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: SYSTEM REQUESTS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "requests" && (
        <div className="space-y-6">
          {!canReadRequests ? (
            <div className="bg-white/70 backdrop-blur-md border border-red-100 p-8 rounded-2xl shadow-sm text-center">
              <Lock className="mx-auto text-red-400 mb-2" size={32} />
              <p className="text-sm font-bold text-slate-700">Bạn không có quyền xem yêu cầu hệ thống</p>
            </div>
          ) : (
            <div className="bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-sm font-bold text-slate-800">Danh sách yêu cầu vận hành hệ thống</h2>

                <div className="flex items-center gap-2 flex-wrap">
                  <form onSubmit={handleRequestsSearchSubmit} className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Tìm kiếm yêu cầu..."
                      value={requestsSearchInput}
                      onChange={(e) => setRequestsSearchInput(e.target.value)}
                      className="pl-8 pr-3 py-1.5 w-48 text-xs bg-slate-100 hover:bg-slate-150 focus:bg-white border border-transparent focus:border-slate-200 rounded-xl focus:outline-none transition-all"
                    />
                    <Search size={14} className="absolute left-2.5 text-slate-400" />
                  </form>

                  <select
                    value={requestsFilterStatus}
                    onChange={(e) => {
                      setRequestsFilterStatus(e.target.value);
                      setRequestsPage(1);
                    }}
                    className="px-3 py-1.5 text-xs bg-slate-100 border border-transparent rounded-xl focus:outline-none focus:border-slate-200"
                  >
                    <option value="">Mọi trạng thái</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <select
                    value={requestsFilterType}
                    onChange={(e) => {
                      setRequestsFilterType(e.target.value);
                      setRequestsPage(1);
                    }}
                    className="px-3 py-1.5 text-xs bg-slate-100 border border-transparent rounded-xl focus:outline-none focus:border-slate-200"
                  >
                    <option value="">Mọi thể loại</option>
                    <option value="access">Access</option>
                    <option value="data_change">Data Change</option>
                    <option value="support">Support</option>
                    <option value="backup">Backup</option>
                    <option value="other">Other</option>
                  </select>

                  {canManageRequests && (
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all"
                    >
                      <Plus size={14} />
                      Tạo yêu cầu
                    </button>
                  )}
                </div>
              </div>

              {/* Requests Table */}
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="px-4 py-3">Yêu cầu</th>
                      <th className="px-4 py-3">Loại</th>
                      <th className="px-4 py-3">Độ ưu tiên</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Người yêu cầu</th>
                      <th className="px-4 py-3">Người xử lý</th>
                      <th className="px-4 py-3">Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {requestsLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400">
                          Đang tải danh sách yêu cầu...
                        </td>
                      </tr>
                    ) : requests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400">
                          Không có yêu cầu hệ thống nào được ghi nhận.
                        </td>
                      </tr>
                    ) : (
                      requests.map((req) => (
                        <tr
                          key={req._id}
                          onClick={() => {
                            setSelectedRequest(req);
                            setUpdateStatusVal(req.status);
                            setIsDetailDrawerOpen(true);
                          }}
                          className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 hover:text-blue-600">
                                {req.title}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate max-w-xs">
                                {req.description || "Không có mô tả"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 capitalize font-semibold text-slate-600">
                            {req.type}
                          </td>
                          <td className="px-4 py-3">
                            {getPriorityBadge(req.priority)}
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(req.status)}
                          </td>
                          <td className="px-4 py-3">
                            {req.requester_id?.user_name ?? "System"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {req.assignee_id?.user_name ?? "Chưa phân công"}
                          </td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {requestsTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <span className="text-xs text-slate-500">
                    Trang {requestsPage} / {requestsTotalPages}
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={requestsPage === 1}
                      onClick={() => setRequestsPage(prev => prev - 1)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-250 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                    >
                      Trước
                    </button>
                    <button
                      disabled={requestsPage === requestsTotalPages}
                      onClick={() => setRequestsPage(prev => prev + 1)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-250 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: SAO LƯU DATABASE */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "backup" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {!canReadBackups ? (
            <div className="lg:col-span-3 bg-white/70 backdrop-blur-md border border-red-100 p-8 rounded-2xl shadow-sm text-center">
              <Lock className="mx-auto text-red-400 mb-2" size={32} />
              <p className="text-sm font-bold text-slate-700">Bạn không có quyền xem thông tin sao lưu database</p>
            </div>
          ) : (
            <>
              {/* Action Trigger Card */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl p-6 flex flex-col justify-between h-fit space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-800">Thao tác Sao lưu</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Quản trị viên có thể kích hoạt tiến trình sao lưu toàn bộ dữ liệu MongoDB tại thời điểm hiện tại. Bản sao lưu được lưu trữ an toàn trên server dưới dạng nén (.gz).
                    </p>
                  </div>

                  {/* Warning Alert */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800">
                    <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <p className="font-bold">CẢNH BÁO BẢO MẬT</p>
                      <p className="mt-1">Tập tin sao lưu chứa toàn bộ thông tin nhạy cảm của hệ thống (ngoại trừ password được mã hóa). Tuyệt đối bảo mật và không chia sẻ tập tin này.</p>
                    </div>
                  </div>

                  <button
                    disabled={isBackupRunning || !canCreateBackup}
                    onClick={() => setIsConfirmBackupOpen(true)}
                    className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                      isBackupRunning || !canCreateBackup
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isBackupRunning ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Đang chạy tiến trình sao lưu...
                      </>
                    ) : (
                      <>
                        <Play size={14} />
                        Tạo sao lưu ngay
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Backup Jobs List */}
              <div className="lg:col-span-2 bg-white/70 backdrop-blur-md border border-white/80 shadow-sm rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-800">Lịch sử và danh sách các bản sao lưu</h2>

                {/* Backups Table */}
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                        <th className="px-4 py-3">Bản sao lưu</th>
                        <th className="px-4 py-3">Dung lượng</th>
                        <th className="px-4 py-3">Yêu cầu bởi</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Tải về / Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {backupsLoading && backups.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400">
                            Đang tải danh sách bản sao lưu...
                          </td>
                        </tr>
                      ) : backups.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400">
                            Chưa có bản sao lưu nào được thực hiện.
                          </td>
                        </tr>
                      ) : (
                        backups.map((job) => {
                          let statusBadge = <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold text-[10px]">Queued</span>;
                          if (job.status === "running") statusBadge = <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold text-[10px] animate-pulse flex items-center gap-1 w-fit"><RefreshCw size={10} className="animate-spin" /> Running</span>;
                          else if (job.status === "success") statusBadge = <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold text-[10px]">Success</span>;
                          else if (job.status === "failed") statusBadge = <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold text-[10px]">Failed</span>;

                          return (
                            <tr key={job._id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-800">
                                    {job.file_name ?? "Chờ khởi tạo..."}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(job.createdAt).toLocaleString()}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-600">
                                {job.file_size ? formatBytes(job.file_size) : "-"}
                              </td>
                              <td className="px-4 py-3">
                                {job.requested_by?.user_name ?? "System"}
                              </td>
                              <td className="px-4 py-3">
                                {statusBadge}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-1.5">
                                  {canDownloadBackup && (
                                    <button
                                      disabled={job.status !== "success"}
                                      onClick={() => handleDownloadBackup(job)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg transition-colors"
                                      title="Tải xuống"
                                    >
                                      <Download size={14} />
                                    </button>
                                  )}
                                  {canDeleteBackup && (
                                    <button
                                      onClick={() => requestDeleteBackup(job._id)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Xóa"
                                    >
                                      <Trash2 size={14} />
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

                {/* Pagination */}
                {backupsTotalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <span className="text-xs text-slate-500">
                      Trang {backupsPage} / {backupsTotalPages}
                    </span>
                    <div className="flex gap-1">
                      <button
                        disabled={backupsPage === 1}
                        onClick={() => setBackupsPage(prev => prev - 1)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-250 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                      >
                        Trước
                      </button>
                      <button
                        disabled={backupsPage === backupsTotalPages}
                        onClick={() => setBackupsPage(prev => prev + 1)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-250 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* DRAWER: REQUEST DETAILS */}
      {/* --------------------------------------------------------------------- */}
      {isDetailDrawerOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
          {/* Overlay */}
          <div 
            onClick={() => setIsDetailDrawerOpen(false)} 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          
          {/* Content */}
          <div className="relative w-full max-w-lg bg-white h-screen shadow-2xl flex flex-col p-6 space-y-6 overflow-y-auto slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">{selectedRequest.title}</h3>
                <span className="text-[10px] text-slate-400">ID: {selectedRequest._id}</span>
              </div>
              <button 
                onClick={() => setIsDetailDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Fields list */}
            <div className="space-y-4 flex-1">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mô tả</label>
                <p className="text-xs text-slate-700 mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                  {selectedRequest.description || "Không có mô tả"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái</label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Độ ưu tiên</label>
                  <div className="mt-1">{getPriorityBadge(selectedRequest.priority)}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Người yêu cầu</label>
                  <p className="text-xs font-semibold text-slate-700 mt-1">{selectedRequest.requester_id?.user_name ?? "N/A"}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ngày tạo</label>
                  <p className="text-xs text-slate-500 mt-1">{new Date(selectedRequest.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {canManageRequests && (
                <>
                  {/* Assignee Assignment */}
                  <div className="border-t pt-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Người xử lý</label>
                    <select
                      value={selectedRequest.assignee_id?._id ?? ""}
                      onChange={(e) => handleAssignRequest(e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:border-slate-300"
                    >
                      <option value="">Chưa phân công</option>
                      {systemUsers.map(u => (
                        <option key={u._id} value={u._id}>{u.user_name} ({u.role?.name ?? "N/A"})</option>
                      ))}
                    </select>
                  </div>

                  {/* Update Status Panel */}
                  <form onSubmit={handleUpdateStatus} className="border-t pt-4 space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cập nhật trạng thái</label>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={updateStatusVal}
                        onChange={(e) => setUpdateStatusVal(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:border-slate-300"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-sm transition-colors"
                      >
                        Lưu trạng thái
                      </button>
                    </div>

                    <textarea
                      placeholder="Nhập ghi chú quyết định cho thay đổi này..."
                      value={updateDecisionNote}
                      onChange={(e) => setUpdateDecisionNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:border-slate-300 resize-none"
                    />
                  </form>
                </>
              )}

              {/* Request Audit History using status_history */}
              {selectedRequest.status_history && selectedRequest.status_history.length > 0 && (
                <div className="border-t pt-4 space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lịch sử thay đổi</label>
                  <div className="space-y-3 border-l-2 border-slate-100 pl-4 mt-2">
                    {selectedRequest.status_history.map((hist, i) => (
                      <div key={i} className="relative text-xs">
                        {/* Dot marker */}
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-200 border-2 border-white" />
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold uppercase text-[9px] px-1 bg-slate-100 text-slate-600 rounded">
                            {hist.from_status} → {hist.to_status}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(hist.changed_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-1 italic">"{hist.note}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            {canManageRequests && (
              <div className="border-t pt-4 flex gap-2">
                <button
                  onClick={() => handleDeleteRequest(selectedRequest._id)}
                  className="flex items-center gap-1 px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  <Trash2 size={14} />
                  Xóa Yêu cầu
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CREATE REQUEST */}
      {/* --------------------------------------------------------------------- */}
      {isCreateModalOpen && canManageRequests && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            onClick={() => setIsCreateModalOpen(false)} 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <form 
            onSubmit={handleCreateRequest}
            className="relative w-full max-w-md bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto scale-in duration-200"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-slate-800">Tạo Yêu Cầu Vận Hành</h3>
              <button 
                type="button" 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tiêu đề</label>
                <input
                  type="text"
                  placeholder="Nhập tiêu đề yêu cầu..."
                  value={newRequestTitle}
                  onChange={(e) => setNewRequestTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:border-slate-300"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Mô tả chi tiết</label>
                <textarea
                  placeholder="Mô tả công việc chi tiết..."
                  value={newRequestDesc}
                  onChange={(e) => setNewRequestDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:border-slate-300 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Loại yêu cầu</label>
                  <select
                    value={newRequestType}
                    onChange={(e) => setNewRequestType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:border-slate-300"
                  >
                    <option value="support">Support</option>
                    <option value="access">Access</option>
                    <option value="data_change">Data Change</option>
                    <option value="backup">Backup</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Độ ưu tiên</label>
                  <select
                    value={newRequestPriority}
                    onChange={(e) => setNewRequestPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:border-slate-300"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Metadata (JSON - Không bắt buộc)</label>
                <textarea
                  placeholder='{"key": "value"}'
                  value={newRequestMeta}
                  onChange={(e) => setNewRequestMeta(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border rounded-xl focus:outline-none focus:border-slate-300 resize-none"
                />
              </div>
            </div>

            <div className="border-t pt-3 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition-colors"
              >
                Tạo mới
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CONFIRM BACKUP */}
      {/* --------------------------------------------------------------------- */}
      {isConfirmBackupOpen && canCreateBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            onClick={() => setIsConfirmBackupOpen(false)} 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 space-y-4 scale-in duration-200">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle size={24} className="shrink-0" />
              <h3 className="text-sm font-bold text-slate-800">Xác Nhận Tạo Sao Lưu</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn tiến hành sao lưu toàn bộ cơ sở dữ liệu ngay bây giờ? 
              <br />
              <span className="font-semibold text-slate-800">Lưu ý:</span> Tiến trình này có thể làm tăng nhẹ độ trễ truy vấn database trong chốc lát tùy thuộc vào độ lớn của dữ liệu.
            </p>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                onClick={() => setIsConfirmBackupOpen(false)}
                className="px-4 py-2 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateBackup}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition-colors"
              >
                Tiến hành sao lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: CONFIRM DELETE BACKUP */}
      {/* --------------------------------------------------------------------- */}
      <ConfirmModal
        isOpen={isConfirmDeleteBackupOpen}
        onClose={() => {
          setIsConfirmDeleteBackupOpen(false);
          setBackupToDelete(null);
        }}
        onConfirm={() => {
          if (backupToDelete) {
            handleDeleteBackup(backupToDelete);
          }
        }}
        title="Xác nhận xóa bản sao lưu"
        message="Bạn có chắc chắn muốn xóa bản sao lưu này? Tập tin sao lưu trên server cũng sẽ bị xóa vĩnh viễn!"
        confirmLabel="Xóa vĩnh viễn"
        cancelLabel="Hủy bỏ"
        variant="danger"
      />
        </main>
      </div>
    </div>
  );
}
