"use client";

import React, { useState, useEffect } from "react";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { useAuth } from "@/providers/auth-provider";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { systemApi, LoginLog, LoginLogsSummary, SystemRequest, BackupJob, SystemPerformanceSummary, BackupImportPreview, RestoreJob, RestoreMode } from "@/api/system-api";
import { authApi } from "@/api/auth-api";
import { systemPerformance } from "@/lib/performance/system-performance";
import { tokenStorage } from "@/api/auth-api";
import { toast } from "sonner";
import ConfirmModal from "@/components/modals/ConfirmModal";
import ResponsiveDataView, { ResponsiveColumn } from "@/components/ui/ResponsiveDataView";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CustomCalendar } from "@/components/calendar/CustomCalendar";
import { format } from "date-fns";
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
  AlertCircle,
  Activity,
  Database,
  Calendar
} from "lucide-react";

export default function SystemAdminPage() {
  // Start performance monitor when page is loaded
  useEffect(() => {
    systemPerformance.start();
    return () => {
      systemPerformance.stop();
    };
  }, []);

  return (
    <RouteGuard
      anyPermission={[
        "SYSTEM_ADMIN",
        "SYSTEM_PERFORMANCE_READ",
        "LOGIN_LOG_READ",
        "SYSTEM_REQUEST_READ",
        "SYSTEM_REQUEST_MANAGE",
        "DATABASE_BACKUP_READ",
        "DATABASE_BACKUP_CREATE",
        "DATABASE_BACKUP_DOWNLOAD",
        "DATABASE_BACKUP_DELETE",
        "DATABASE_BACKUP_RESTORE",
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
  const canRestoreBackup = hasPermission("DATABASE_BACKUP_RESTORE");
  const canReadPerformance = hasPermission("SYSTEM_PERFORMANCE_READ");

  const [activeTab, setActiveTab] = useState<"logs" | "requests" | "backup" | "performance">("logs");
  
  // Tự động chuyển sang tab có quyền nếu không có quyền xem log
  useEffect(() => {
    if (!canReadLogs) {
      if (canReadPerformance) {
        setActiveTab("performance");
      } else if (canReadRequests) {
        setActiveTab("requests");
      } else if (canReadBackups) {
        setActiveTab("backup");
      }
    }
  }, [canReadLogs, canReadPerformance, canReadRequests, canReadBackups]);
  
  // --- Tab 1: Login Logs States ---
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [logsSummary, setLogsSummary] = useState<LoginLogsSummary | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsFilterAction, setLogsFilterAction] = useState("all");
  const [logsSelectedDate, setLogsSelectedDate] = useState<Date | null>(new Date());
  const [isLogsCalendarOpen, setIsLogsCalendarOpen] = useState(false);
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

  const [restoreJobs, setRestoreJobs] = useState<RestoreJob[]>([]);
  const [restoreJobsLoading, setRestoreJobsLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<BackupImportPreview | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("replace_selected_collections");
  const [confirmText, setConfirmText] = useState("");
  const [restoreChecked, setRestoreChecked] = useState(false);
  const [reloginChecked, setReloginChecked] = useState(false);

  // --- Tab 4: Performance States ---
  const [performanceSummary, setPerformanceSummary] = useState<SystemPerformanceSummary | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // EFFECT: Fetch Login Logs & Summary
  // ---------------------------------------------------------------------------
  const getDayRange = (date: Date | null) => {
    if (!date) return {};

    const from = new Date(date);
    from.setHours(0, 0, 0, 0);

    const to = new Date(date);
    to.setHours(23, 59, 59, 999);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
    };
  };

  const fetchLogs = async (page = 1, showLoading = true) => {
    if (!canReadLogs) return;
    try {
      if (showLoading) setLogsLoading(true);
      const { from, to } = getDayRange(logsSelectedDate);
      const res = await systemPerformance.trackApi('login-logs', () => systemApi.getLoginLogs({
        page,
        limit: 20,
        action: logsFilterAction !== "all" ? logsFilterAction : undefined,
        search: logsSearch || undefined,
        from,
        to,
      }));
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
      const { from, to } = getDayRange(logsSelectedDate);
      const summary = await systemPerformance.trackApi('login-logs/summary', () => systemApi.getLoginLogsSummary({ from, to }));
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
  }, [activeTab, realtimeEnabled, logsPage, logsFilterAction, logsSearch, logsSelectedDate ? format(logsSelectedDate, "yyyy-MM-dd") : "", canReadLogs]);

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
      const res = await systemPerformance.trackApi('requests', () => systemApi.getRequests({
        page,
        limit: 20,
        status: requestsFilterStatus || undefined,
        type: requestsFilterType || undefined,
        search: requestsSearch || undefined,
      }));
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
      const res = await systemPerformance.trackApi('backups', () => systemApi.getBackups({ page, limit: 20 }));
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
      await systemPerformance.trackApi('create-backup', () => systemApi.createBackup());
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
  // ---------------------------------------------------------------------------
  // EFFECT: Fetch Restore Jobs
  // ---------------------------------------------------------------------------
  const fetchRestoreJobs = async () => {
    if (!canRestoreBackup) return;
    try {
      setRestoreJobsLoading(true);
      const res = await systemApi.getRestoreJobs({ page: 1, limit: 10 });
      setRestoreJobs(res.items);
    } catch (err: any) {
      console.error("Lỗi tải danh sách khôi phục:", err);
    } finally {
      setRestoreJobsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "backup" && canRestoreBackup) {
      fetchRestoreJobs();
    }
  }, [activeTab, canRestoreBackup]);

  // Restore Jobs polling when a restore is running
  const isRestoreRunning = restoreJobs.some(job => job.status === 'running' || job.status === 'queued');
  useEffect(() => {
    if (activeTab !== "backup" || !isRestoreRunning || !canRestoreBackup) return;

    const interval = setInterval(async () => {
      try {
        const res = await systemApi.getRestoreJobs({ page: 1, limit: 10 });
        
        // Check status change
        const previousRunningJob = restoreJobs.find(job => job.status === 'running' || job.status === 'queued');
        if (previousRunningJob) {
          const currentJob = res.items.find((j: any) => j._id === previousRunningJob._id);
          if (currentJob && currentJob.status === 'success') {
            toast.success("Khôi phục thành công. Hệ thống sẽ đăng xuất để cập nhật dữ liệu.");
            setTimeout(() => {
              tokenStorage.clearTokens();
              authApi.logout();
              window.location.href = '/login';
            }, 2000);
          } else if (currentJob && currentJob.status === 'failed') {
            toast.error("Khôi phục thất bại: " + currentJob.error_message);
          }
        }
        setRestoreJobs(res.items);
      } catch (err) {
        console.error("Lỗi polling restore job:", err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [activeTab, isRestoreRunning, canRestoreBackup, restoreJobs]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsImportLoading(true);
    setImportPreview(null);
    setSelectedCollections([]);
    setReloginChecked(false);
    
    try {
      const preview = await systemApi.previewBackupImport(file);
      setImportPreview(preview);
      setSelectedCollections(preview.collections.map((c: any) => c.name));
      setIsImportModalOpen(true);
    } catch (err: any) {
      toast.error("Lỗi xem trước file sao lưu: " + err.message);
    } finally {
      setIsImportLoading(false);
      if (e.target) e.target.value = ''; // reset input
    }
  };

  const handleRestore = async () => {
    if (!importPreview || !canRestoreBackup) return;
    if (confirmText !== "RESTORE") {
      toast.error("Vui lòng nhập chính xác chữ RESTORE");
      return;
    }
    if (!reloginChecked) {
      toast.error("Vui lòng xác nhận việc đăng nhập lại sau khi khôi phục.");
      return;
    }
    
    try {
      setIsImportLoading(true);
      await systemApi.restoreBackupImport({
        previewSessionId: importPreview.previewSessionId,
        collections: selectedCollections,
        mode: restoreMode,
        confirmationText: confirmText,
      });
      toast.success("Tiến trình khôi phục dữ liệu đã được khởi chạy.");
      setIsImportModalOpen(false);
      setImportPreview(null);
      setConfirmText("");
      setRestoreChecked(false);
      fetchRestoreJobs();
    } catch (err: any) {
      toast.error("Lỗi khôi phục dữ liệu: " + err.message);
    } finally {
      setIsImportLoading(false);
    }
  };

  // Helpers
  const fetchPerformance = async () => {
    if (!canReadPerformance) return;
    try {
      setPerformanceLoading(true);
      const summary = await systemPerformance.trackApi('performance-summary', () => systemApi.getPerformanceSummary({ route: "/system" }));
      setPerformanceSummary(summary);
    } catch (err: any) {
      toast.error("Lỗi tải thông tin hiệu năng: " + err.message);
    } finally {
      setPerformanceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "performance" && canReadPerformance) {
      fetchPerformance();
    }
  }, [activeTab, canReadPerformance]);

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
      case "critical": return <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-rose-500/10 text-rose-700 border border-rose-500/20">Critical</span>;
      case "high": return <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">High</span>;
      case "medium": return <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-blue-500/10 text-[#1A73E8] border border-blue-500/20">Medium</span>;
      default: return <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-slate-500/10 text-[#64748B] border border-slate-500/20">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-purple-500/10 text-purple-700 border border-purple-500/20">Completed</span>;
      case "approved": return <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-purple-500/10 text-purple-700 border border-purple-500/20">Approved</span>;
      case "in_progress": return <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-blue-500/10 text-[#1A73E8] border border-blue-500/20">In Progress</span>;
      case "rejected": return <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-rose-500/10 text-rose-700 border border-rose-500/20">Rejected</span>;
      case "cancelled": return <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-slate-500/10 text-[#64748B] border border-slate-500/20">Cancelled</span>;
      default: return <span className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">Pending</span>;
    }
  };

  const logsColumns: ResponsiveColumn<LoginLog>[] = [
    {
      key: "login_time",
      header: "Thời gian",
      priority: "secondary",
      render: (_, log) => new Date(log.login_time || log.createdAt).toLocaleString()
    },
    {
      key: "user_name",
      header: "Tài khoản",
      priority: "primary",
      render: (_, log) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[#1E293B]">
            {log.user_id?.user_name ?? "Chưa xác thực"}
          </span>
          <span className="text-[10px] text-[#64748B]">
            {log.user_id?.email ?? "N/A"}
          </span>
        </div>
      )
    },
    {
      key: "ip_address",
      header: "Địa chỉ IP",
      priority: "metadata",
      render: (val) => <span className="font-mono text-[#64748B]">{val}</span>
    },
    {
      key: "action",
      header: "Hành động",
      priority: "metadata",
      render: (val) => {
        if (val === "login_success") return <span className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]">Login Success</span>;
        if (val === "login_failure") return <span className="bg-rose-500/10 text-rose-700 border border-rose-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]">Login Failure</span>;
        if (val === "logout") return <span className="bg-slate-500/10 text-[#64748B] border border-slate-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]">Logout</span>;
        if (val === "password_reset" || val === "password_change" || val === "admin_reset_password") return <span className="bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]">Security Change</span>;
        return <span className="bg-slate-500/10 text-[#64748B] border border-slate-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]">Unknown</span>;
      }
    },
    {
      key: "details",
      header: "Chi tiết",
      priority: "metadata",
      render: (val) => <span className="max-w-xs truncate block text-[#64748B]" title={val}>{val || "-"}</span>
    }
  ];

  const requestsColumns: ResponsiveColumn<SystemRequest>[] = [
    {
      key: "title",
      header: "Yêu cầu",
      priority: "primary",
      render: (_, req) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[#1E293B] hover:text-[#1A73E8] transition-colors">
            {req.title}
          </span>
          <span className="text-[10px] text-[#64748B] truncate max-w-xs">
            {req.description || "Không có mô tả"}
          </span>
        </div>
      )
    },
    {
      key: "type",
      header: "Loại",
      priority: "secondary",
      render: (val) => <span className="capitalize font-semibold text-[#64748B]">{val}</span>
    },
    {
      key: "priority",
      header: "Độ ưu tiên",
      priority: "metadata",
      render: (val) => getPriorityBadge(val)
    },
    {
      key: "status",
      header: "Trạng thái",
      priority: "metadata",
      render: (val) => getStatusBadge(val)
    },
    {
      key: "requester_id",
      header: "Người yêu cầu",
      priority: "metadata",
      render: (_, req) => <span className="text-[#64748B]">{req.requester_id?.user_name ?? "System"}</span>
    },
    {
      key: "assignee_id",
      header: "Người xử lý",
      priority: "metadata",
      render: (_, req) => <span className="text-[#64748B]">{req.assignee_id?.user_name ?? "Chưa phân công"}</span>
    },
    {
      key: "createdAt",
      header: "Ngày tạo",
      priority: "metadata",
      render: (val) => <span className="text-[#64748B]">{new Date(val).toLocaleDateString()}</span>
    }
  ];

  const backupsColumns: ResponsiveColumn<BackupJob>[] = [
    {
      key: "file_name",
      header: "Bản sao lưu",
      priority: "primary",
      render: (_, job) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[#1E293B]">
            {job.file_name ?? "Chờ khởi tạo..."}
          </span>
          <span className="text-[10px] text-[#64748B]">
            {new Date(job.createdAt).toLocaleString()}
          </span>
        </div>
      )
    },
    {
      key: "file_size",
      header: "Dung lượng",
      priority: "secondary",
      render: (val) => <span className="font-medium text-[#64748B]">{val ? formatBytes(val) : "-"}</span>
    },
    {
      key: "requested_by",
      header: "Yêu cầu bởi",
      priority: "metadata",
      render: (_, job) => <span className="text-[#64748B]">{job.requested_by?.user_name ?? "System"}</span>
    },
    {
      key: "status",
      header: "Trạng thái",
      priority: "metadata",
      render: (_, job) => {
        if (job.status === "running") return <span className="bg-blue-500/10 text-[#1A73E8] border border-blue-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px] animate-pulse flex items-center gap-1 w-fit"><RefreshCw size={10} className="animate-spin" /> Running</span>;
        if (job.status === "success") return <span className="bg-purple-500/10 text-purple-700 border border-purple-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]">Success</span>;
        if (job.status === "failed") return <span className="bg-rose-500/10 text-rose-700 border border-rose-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]">Failed</span>;
        return <span className="bg-slate-500/10 text-[#64748B] border border-slate-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]">Queued</span>;
      }
    },
    {
      key: "actions",
      header: "Tác vụ",
      priority: "action",
      render: (_, job) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {canDownloadBackup && (
            <button
              disabled={job.status !== "success"}
              onClick={() => handleDownloadBackup(job)}
              className="p-1.5 text-[#1A73E8] hover:bg-white/50 disabled:opacity-40 disabled:hover:bg-transparent rounded-xl transition-all duration-150 ease-out hover:scale-[1.05]"
              title="Tải xuống"
            >
              <Download size={14} />
            </button>
          )}
          {canDeleteBackup && (
            <button
              onClick={() => requestDeleteBackup(job._id)}
              className="p-1.5 text-rose-600 hover:bg-white/50 rounded-xl transition-all duration-150 ease-out hover:scale-[1.05]"
              title="Xóa"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )
    }
  ];

  const restoreJobsColumns: ResponsiveColumn<RestoreJob>[] = [
    {
      key: "source_file_name",
      header: "Tên file khôi phục",
      priority: "primary",
      render: (_, job) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[#1E293B]">
            {job.source_file_name ?? "Chờ khởi tạo..."}
          </span>
          <span className="text-[10px] text-[#64748B]">
            {new Date(job.createdAt).toLocaleString()}
          </span>
        </div>
      )
    },
    {
      key: "mode",
      header: "Chế độ",
      priority: "secondary",
      render: (val) => <span className="font-semibold text-[#64748B]">{val === 'merge_upsert' ? 'Merge & Upsert' : 'Replace Selected'}</span>
    },
    {
      key: "requested_by",
      header: "Yêu cầu bởi",
      priority: "metadata",
      render: (_, job) => <span className="text-[#64748B]">{job.requested_by?.user_name ?? "System"}</span>
    },
    {
      key: "status",
      header: "Trạng thái",
      priority: "metadata",
      render: (_, job) => {
        if (job.status === "running") return <span className="bg-blue-500/10 text-[#1A73E8] border border-blue-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px] animate-pulse flex items-center gap-1 w-fit"><RefreshCw size={10} className="animate-spin" /> Running</span>;
        if (job.status === "success") return <span className="bg-purple-500/10 text-purple-700 border border-purple-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]">Success</span>;
        if (job.status === "failed") return <span className="bg-rose-500/10 text-rose-700 border border-rose-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]" title={job.error_message}>Failed</span>;
        return <span className="bg-slate-500/10 text-[#64748B] border border-slate-500/20 px-2 py-0.5 rounded-xl font-bold text-[10px]">Queued</span>;
      }
    }
  ];

  const slowApisColumns: ResponsiveColumn<any>[] = [
    {
      key: "name",
      header: "API Endpoint",
      priority: "primary",
      render: (val) => <span className="font-mono text-[11px] text-[#64748B]">{val}</span>
    },
    {
      key: "avg",
      header: "Avg (ms)",
      priority: "secondary",
      render: (val) => Math.round(val)
    },
    {
      key: "p75",
      header: "p75 (ms)",
      priority: "metadata",
      render: (val) => <span className="text-amber-600 font-medium">{Math.round(val)}</span>
    },
    {
      key: "p95",
      header: "p95 (ms)",
      priority: "metadata",
      render: (val) => <span className="text-rose-600 font-bold">{Math.round(val)}</span>
    },
    {
      key: "samples",
      header: "Mẫu",
      priority: "metadata",
      render: (val) => val
    }
  ];

  return (
    <div className="flex min-h-screen h-screen overflow-hidden font-sans" style={{ background: "linear-gradient(135deg, #EBF2FA 0%, #DCE6F1 100%)" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <main className="flex-1 p-5 md:p-6 overflow-y-auto space-y-4 bg-transparent animate-in fade-in duration-300">
          {/* Header Panel */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-5 bg-white/40 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl transition-all duration-150 ease-out hover:scale-[1.01]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/10 text-[#1A73E8] border border-blue-500/20 rounded-xl flex items-center justify-center shadow-sm">
                <Shield size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1E293B]">Quản trị Hệ thống</h1>
                <p className="text-xs text-[#64748B] mt-0.5">Theo dõi lịch sử đăng nhập, phê duyệt các yêu cầu vận hành và sao lưu dữ liệu hệ thống.</p>
              </div>
            </div>
        
        {/* Tab Selector */}
        <div className="flex bg-slate-100/50 backdrop-blur-sm p-1 rounded-xl self-start md:self-center border border-white/40">
          {canReadLogs && (
            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ease-out hover:scale-[1.01] ${
                activeTab === "logs" ? "bg-white/80 backdrop-blur-sm text-[#1E293B] shadow-sm border border-white/60" : "text-[#64748B] hover:text-[#1E293B]"
              }`}
            >
              <History size={14} />
              Lịch sử đăng nhập
            </button>
          )}
          {canReadRequests && (
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ease-out hover:scale-[1.01] ${
                activeTab === "requests" ? "bg-white/80 backdrop-blur-sm text-[#1E293B] shadow-sm border border-white/60" : "text-[#64748B] hover:text-[#1E293B]"
              }`}
            >
              <FileText size={14} />
              Quản lý yêu cầu
            </button>
          )}
          {canReadBackups && (
            <button
              onClick={() => setActiveTab("backup")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ease-out hover:scale-[1.01] ${
                activeTab === "backup" ? "bg-white/80 backdrop-blur-sm text-[#1E293B] shadow-sm border border-white/60" : "text-[#64748B] hover:text-[#1E293B]"
              }`}
            >
              <Server size={14} />
              Sao lưu database
            </button>
          )}
          {canReadPerformance && (
            <button
              onClick={() => setActiveTab("performance")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ease-out hover:scale-[1.01] ${
                activeTab === "performance" ? "bg-white/80 backdrop-blur-sm text-[#1E293B] shadow-sm border border-white/60" : "text-[#64748B] hover:text-[#1E293B]"
              }`}
            >
              <Activity size={14} />
              Hiệu năng
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
                <div className="bg-white/40 backdrop-blur-md border border-white/70 p-5 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col justify-between transition-all duration-150 ease-out hover:scale-[1.01]">
                  <span className="text-xs font-semibold text-[#64748B]">
                    {logsSelectedDate ? format(logsSelectedDate, "dd/MM/yyyy") === format(new Date(), "dd/MM/yyyy") ? "Đăng nhập hôm nay" : `Đăng nhập ngày ${format(logsSelectedDate, "dd/MM/yyyy")}` : "Đăng nhập hôm nay"}
                  </span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-[#1E293B]">
                      {logsSummary?.today.total ?? 0}
                    </span>
                    <span className="text-[10px] text-[#64748B]">lượt</span>
                  </div>
                </div>
                
                <div className="bg-white/40 backdrop-blur-md border border-white/70 p-5 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col justify-between transition-all duration-150 ease-out hover:scale-[1.01]">
                  <span className="text-xs font-semibold text-[#64748B]">Đăng nhập thành công</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-emerald-600">
                      {logsSummary?.today.login_success ?? 0}
                    </span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 rounded-xl font-bold">
                      {logsSummary?.today.total 
                        ? Math.round((logsSummary.today.login_success / logsSummary.today.total) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>

                <div className="bg-white/40 backdrop-blur-md border border-white/70 p-5 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col justify-between transition-all duration-150 ease-out hover:scale-[1.01]">
                  <span className="text-xs font-semibold text-[#64748B]">Đăng nhập thất bại</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-rose-600">
                      {logsSummary?.today.login_failure ?? 0}
                    </span>
                    <span className="text-[10px] bg-rose-500/10 text-rose-700 border border-rose-500/20 px-2 py-0.5 rounded-xl font-bold">
                      {logsSummary?.today.total 
                        ? Math.round((logsSummary.today.login_failure / logsSummary.today.total) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>

                <div className="bg-white/40 backdrop-blur-md border border-white/70 p-5 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col justify-between transition-all duration-150 ease-out hover:scale-[1.01]">
                  <span className="text-xs font-semibold text-[#64748B]">Đổi/Reset mật khẩu</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-indigo-600">
                      {(logsSummary?.today.password_change ?? 0) + (logsSummary?.today.password_reset ?? 0)}
                    </span>
                    <span className="text-[10px] text-[#64748B]">yêu cầu</span>
                  </div>
                </div>
              </div>

              {/* Table list */}
              <div className="bg-white/40 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-2 shrink-0">
                    <h2 className="text-sm font-bold text-[#1E293B]">Nhật ký hoạt động đăng nhập</h2>
                    {/* Realtime Polling Indicator */}
                    <div className="flex items-center gap-1.5 ml-2 bg-slate-200/50 backdrop-blur-sm border border-white/40 px-2 py-0.5 rounded-xl">
                      <span className={`w-2 h-2 rounded-full ${
                        sseStatus === "connected" ? "bg-emerald-500 animate-pulse" : "bg-[#64748B]"
                      }`} />
                      <span className="text-[10px] text-[#64748B] font-bold capitalize">
                        {sseStatus === "connected" ? "Realtime (Polling)" : "Tắt Realtime"}
                      </span>
                    </div>
                  </div>

                  {/* Toolbar */}
                  <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:flex-nowrap xl:justify-end">
                    <form onSubmit={handleLogsSearchSubmit} className="relative flex w-full items-center sm:w-60 xl:w-60">
                      <input
                        type="text"
                        placeholder="Tìm IP, User..."
                        value={logsSearchInput}
                        onChange={(e) => setLogsSearchInput(e.target.value)}
                        className="pl-8 pr-3 py-1.5 w-full h-9 text-xs bg-white/50 backdrop-blur-sm border border-white/80 focus:border-[#1A73E8] rounded-xl focus:outline-none transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30 text-[#1E293B]"
                      />
                      <Search size={14} className="absolute left-2.5 text-[#64748B]" />
                    </form>

                    <Select
                      value={logsFilterAction}
                      onValueChange={(value) => {
                        setLogsFilterAction(value);
                        setLogsPage(1);
                      }}
                    >
                      <SelectTrigger className="h-9 w-full sm:w-[220px] xl:w-[220px] shrink-0 text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl">
                        <SelectValue placeholder="Tất cả hoạt động" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-md border border-slate-100/60 shadow-xl rounded-xl z-[100]">
                        <SelectItem value="all">Tất cả hoạt động</SelectItem>
                        <SelectItem value="login_success">Đăng nhập thành công</SelectItem>
                        <SelectItem value="login_failure">Đăng nhập thất bại</SelectItem>
                        <SelectItem value="logout">Đăng xuất</SelectItem>
                        <SelectItem value="password_change">Đổi mật khẩu</SelectItem>
                        <SelectItem value="password_reset">Reset mật khẩu</SelectItem>
                      </SelectContent>
                    </Select>

                    <Popover open={isLogsCalendarOpen} onOpenChange={setIsLogsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="h-9 w-full min-w-[128px] px-3 sm:w-auto text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl text-[#1E293B] flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-[#64748B]" />
                            <span>{logsSelectedDate ? format(logsSelectedDate, "dd/MM/yyyy") : "Tất cả ngày"}</span>
                          </div>
                          {logsSelectedDate && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setLogsSelectedDate(null);
                                setLogsPage(1);
                              }}
                              className="p-0.5 hover:bg-slate-200/50 rounded-full transition-colors flex items-center justify-center"
                            >
                              <X size={12} className="text-[#64748B]" />
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[100] bg-transparent border-none shadow-none overflow-hidden" align="end">
                        <CustomCalendar
                          startDate={logsSelectedDate}
                          endDate={null}
                          onRangeSelect={(start) => {
                            if (start) {
                              setLogsSelectedDate(start);
                              setLogsPage(1);
                            }
                          }}
                          onCancel={() => setIsLogsCalendarOpen(false)}
                          onConfirm={() => setIsLogsCalendarOpen(false)}
                        />
                      </PopoverContent>
                    </Popover>

                    <button
                      onClick={() => setRealtimeEnabled(!realtimeEnabled)}
                      className={`h-9 shrink-0 whitespace-nowrap flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all duration-150 ease-out hover:scale-[1.01] ${
                        realtimeEnabled 
                          ? "bg-blue-500/10 text-[#1A73E8] border-blue-500/20" 
                          : "bg-white/50 text-[#64748B] border-white/80"
                      }`}
                    >
                      <RefreshCw size={12} className={sseStatus === "connected" ? "animate-spin" : ""} />
                      {realtimeEnabled ? "Tắt Realtime" : "Bật Realtime"}
                    </button>
                  </div>
                </div>

                {/* Responsive Data View */}
                <ResponsiveDataView
                  data={logs}
                  columns={logsColumns}
                  isLoading={logsLoading}
                  emptyState={
                    <div className="text-center py-8 text-[#64748B] text-xs font-semibold">
                      Không tìm thấy bản ghi hoạt động nào.
                    </div>
                  }
                  keyExtractor={(log) => log._id}
                  pagination={
                    logsTotalPages > 1 ? (
                      <div className="flex items-center justify-between pt-4 border-t border-white/20 px-4 pb-2">
                        <span className="text-xs text-[#64748B] font-semibold">
                          Trang {logsPage} / {logsTotalPages}
                        </span>
                        <div className="flex gap-1">
                          <button
                            disabled={logsPage === 1}
                            onClick={() => setLogsPage(prev => prev - 1)}
                            className="px-3 py-1 bg-white/50 hover:bg-white/80 border border-white/60 text-[#1E293B] text-xs font-bold rounded-xl disabled:opacity-50 transition-all duration-150 ease-out hover:scale-[1.01]"
                          >
                            Trước
                          </button>
                          <button
                            disabled={logsPage === logsTotalPages}
                            onClick={() => setLogsPage(prev => prev + 1)}
                            className="px-3 py-1 bg-white/50 hover:bg-white/80 border border-white/60 text-[#1E293B] text-xs font-bold rounded-xl disabled:opacity-50 transition-all duration-150 ease-out hover:scale-[1.01]"
                          >
                            Sau
                          </button>
                        </div>
                      </div>
                    ) : null
                  }
                />
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
            <div className="bg-white/40 backdrop-blur-md border border-red-500/20 p-8 rounded-2xl shadow-sm shadow-slate-300/40 text-center">
              <Lock className="mx-auto text-red-400 mb-2" size={32} />
              <p className="text-sm font-bold text-[#1E293B]">Bạn không có quyền xem yêu cầu hệ thống</p>
            </div>
          ) : (
            <div className="bg-white/40 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <h2 className="text-sm font-bold text-[#1E293B] shrink-0">Danh sách yêu cầu vận hành hệ thống</h2>

                <div className="flex flex-wrap items-center lg:justify-end gap-3 w-full lg:w-auto">
                  <form onSubmit={handleRequestsSearchSubmit} className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Tìm kiếm yêu cầu..."
                      value={requestsSearchInput}
                      onChange={(e) => setRequestsSearchInput(e.target.value)}
                      className="pl-8 pr-3 py-1.5 w-48 text-xs bg-white/50 backdrop-blur-sm border border-white/80 focus:border-[#1A73E8] rounded-xl focus:outline-none transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30 text-[#1E293B]"
                    />
                    <Search size={14} className="absolute left-2.5 text-[#64748B]" />
                  </form>

                  <select
                    value={requestsFilterStatus}
                    onChange={(e) => {
                      setRequestsFilterStatus(e.target.value);
                      setRequestsPage(1);
                    }}
                    className="px-3 py-1.5 text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl focus:outline-none focus:border-[#1A73E8] text-[#1E293B] transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30"
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
                    className="px-3 py-1.5 text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl focus:outline-none focus:border-[#1A73E8] text-[#1E293B] transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30"
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
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#1A73E8] hover:bg-[#1A73E8]/90 text-white rounded-xl shadow-sm transition-all duration-150 ease-out hover:scale-[1.01]"
                    >
                      <Plus size={14} />
                      Tạo yêu cầu
                    </button>
                  )}
                </div>
              </div>

              {/* Requests Table */}
              <ResponsiveDataView
                data={requests}
                columns={requestsColumns}
                isLoading={requestsLoading}
                emptyState={
                  <div className="text-center py-8 text-[#64748B] text-xs font-semibold">
                    Không có yêu cầu hệ thống nào được ghi nhận.
                  </div>
                }
                keyExtractor={(req) => req._id}
                onRowClick={(req) => {
                  setSelectedRequest(req);
                  setUpdateStatusVal(req.status);
                  setIsDetailDrawerOpen(true);
                }}
                pagination={
                  requestsTotalPages > 1 ? (
                    <div className="flex items-center justify-between pt-4 border-t border-white/20 px-4 pb-2">
                      <span className="text-xs text-[#64748B] font-semibold">
                        Trang {requestsPage} / {requestsTotalPages}
                      </span>
                      <div className="flex gap-1">
                        <button
                          disabled={requestsPage === 1}
                          onClick={() => setRequestsPage(prev => prev - 1)}
                          className="px-3 py-1 bg-white/50 hover:bg-white/80 border border-white/60 text-[#1E293B] text-xs font-bold rounded-xl disabled:opacity-50 transition-all duration-150 ease-out hover:scale-[1.01]"
                        >
                          Trước
                        </button>
                        <button
                          disabled={requestsPage === requestsTotalPages}
                          onClick={() => setRequestsPage(prev => prev + 1)}
                          className="px-3 py-1 bg-white/50 hover:bg-white/80 border border-white/60 text-[#1E293B] text-xs font-bold rounded-xl disabled:opacity-50 transition-all duration-150 ease-out hover:scale-[1.01]"
                        >
                          Sau
                        </button>
                      </div>
                    </div>
                  ) : null
                }
              />
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 3: SAO LƯU DATABASE */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "backup" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {!canReadBackups ? (
            <div className="lg:col-span-3 bg-white/40 backdrop-blur-md border border-red-500/20 p-8 rounded-2xl shadow-sm shadow-slate-300/40 text-center">
              <Lock className="mx-auto text-red-400 mb-2" size={32} />
              <p className="text-sm font-bold text-[#1E293B]">Bạn không có quyền xem thông tin sao lưu database</p>
            </div>
          ) : (
            <>
              {/* Action Trigger Card */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white/40 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-5 flex flex-col justify-between h-fit space-y-4 transition-all duration-150 ease-out hover:scale-[1.01]">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[#1E293B]">Thao tác Sao lưu</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Quản trị viên có thể kích hoạt tiến trình sao lưu toàn bộ dữ liệu MongoDB tại thời điểm hiện tại. Bản sao lưu được lưu trữ an toàn trên server dưới dạng nén (.gz).
                    </p>
                  </div>

                  {/* Warning Alert */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-800">
                    <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                    <div className="text-[11px] leading-relaxed">
                      <p className="font-bold">CẢNH BÁO BẢO MẬT</p>
                      <p className="mt-1">Tập tin sao lưu chứa toàn bộ thông tin nhạy cảm của hệ thống (ngoại trừ password được mã hóa). Tuyệt đối bảo mật và không chia sẻ tập tin này.</p>
                    </div>
                  </div>

                  <button
                    disabled={isBackupRunning || !canCreateBackup}
                    onClick={() => setIsConfirmBackupOpen(true)}
                    className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all duration-150 ease-out hover:scale-[1.01] ${
                      isBackupRunning || !canCreateBackup
                        ? "bg-white/20 text-[#64748B] cursor-not-allowed border border-white/40"
                        : "bg-[#1A73E8] hover:bg-[#1A73E8]/90 text-white"
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

                {/* Import Restore Card */}
                <div className="bg-white/40 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-5 flex flex-col justify-between h-fit space-y-4 transition-all duration-150 ease-out hover:scale-[1.01]">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[#1E293B]">Khôi phục dữ liệu (Import)</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Tải lên tập tin sao lưu (.gz hoặc .ndjson) để khôi phục dữ liệu. Hệ thống sẽ phân tích tập tin và yêu cầu xác nhận trước khi tiến hành.
                    </p>
                  </div>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".gz,.ndjson" 
                      onChange={handleFileChange} 
                      disabled={isImportLoading || isBackupRunning || !canRestoreBackup}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <button
                      disabled={isImportLoading || isBackupRunning || !canRestoreBackup}
                      className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all duration-150 ease-out ${
                        isImportLoading || isBackupRunning || !canRestoreBackup
                          ? "bg-white/20 text-[#64748B] border border-white/40"
                          : "bg-white text-[#1A73E8] hover:bg-blue-50 border border-blue-500/30"
                      }`}
                    >
                      {isImportLoading ? (
                        <><RefreshCw size={14} className="animate-spin" /> Đang xử lý file...</>
                      ) : (
                        <><Server size={14} /> Import file sao lưu</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Backup Jobs List */}
              <div className="lg:col-span-2 bg-white/40 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-5 space-y-4 transition-all duration-150 ease-out hover:scale-[1.01]">
                <h2 className="text-sm font-bold text-[#1E293B]">Lịch sử và danh sách các bản sao lưu</h2>

                {/* Backups Table */}
                <ResponsiveDataView
                  data={backups}
                  columns={backupsColumns}
                  isLoading={backupsLoading}
                  emptyState={
                    <div className="text-center py-8 text-[#64748B] text-xs font-semibold">
                      Chưa có bản sao lưu nào được thực hiện.
                    </div>
                  }
                  keyExtractor={(job) => job._id}
                  pagination={
                    backupsTotalPages > 1 ? (
                      <div className="flex items-center justify-between pt-4 border-t border-white/20 px-4 pb-2">
                        <span className="text-xs text-[#64748B] font-semibold">
                          Trang {backupsPage} / {backupsTotalPages}
                        </span>
                        <div className="flex gap-1">
                          <button
                            disabled={backupsPage === 1}
                            onClick={() => setBackupsPage(prev => prev - 1)}
                            className="px-3 py-1 bg-white/50 hover:bg-white/80 border border-white/60 text-[#1E293B] text-xs font-bold rounded-xl disabled:opacity-50 transition-all duration-150 ease-out hover:scale-[1.01]"
                          >
                            Trước
                          </button>
                          <button
                            disabled={backupsPage === backupsTotalPages}
                            onClick={() => setBackupsPage(prev => prev + 1)}
                            className="px-3 py-1 bg-white/50 hover:bg-white/80 border border-white/60 text-[#1E293B] text-xs font-bold rounded-xl disabled:opacity-50 transition-all duration-150 ease-out hover:scale-[1.01]"
                          >
                            Sau
                          </button>
                        </div>
                      </div>
                    ) : null
                  }
                />
              </div>

              {/* Restore Jobs List */}
              <div className="lg:col-span-3 bg-white/40 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-5 space-y-4 transition-all duration-150 ease-out hover:scale-[1.01]">
                <h2 className="text-sm font-bold text-[#1E293B]">Lịch sử khôi phục dữ liệu</h2>

                <ResponsiveDataView
                  data={restoreJobs}
                  columns={restoreJobsColumns}
                  isLoading={restoreJobsLoading}
                  emptyState={
                    <div className="text-center py-8 text-[#64748B] text-xs font-semibold">
                      Chưa có tiến trình khôi phục nào được thực hiện.
                    </div>
                  }
                  keyExtractor={(job) => job._id}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 4: PERFORMANCE (BLOCK 2) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === "performance" && (
        <div className="space-y-6">
          {!canReadPerformance ? (
            <div className="bg-white/40 backdrop-blur-md border border-red-500/20 p-8 rounded-2xl shadow-sm shadow-slate-300/40 text-center">
              <Lock className="mx-auto text-red-400 mb-2" size={32} />
              <p className="text-sm font-bold text-[#1E293B]">Bạn không có quyền xem thông tin hiệu năng</p>
            </div>
          ) : (
            <>
              {/* Header and Refresh */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#1E293B]">Hiệu năng truy cập hệ thống (/system)</h2>
                <button
                  onClick={fetchPerformance}
                  disabled={performanceLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/50 border border-white/80 text-[#64748B] rounded-xl text-xs font-semibold hover:bg-white/80 transition-all duration-150 ease-out hover:scale-[1.01] disabled:opacity-50"
                >
                  <RefreshCw size={14} className={performanceLoading ? "animate-spin" : ""} />
                  Làm mới
                </button>
              </div>

              {performanceLoading && !performanceSummary ? (
                <div className="text-center py-12 text-[#64748B] text-sm">Đang tải dữ liệu hiệu năng...</div>
              ) : !performanceSummary || performanceSummary.total_samples === 0 ? (
                <div className="bg-white/40 backdrop-blur-md border border-white/70 p-12 rounded-2xl shadow-sm shadow-slate-300/40 text-center">
                  <Activity className="mx-auto text-[#64748B] mb-3" size={40} />
                  <p className="text-sm font-bold text-[#1E293B]">Chưa có dữ liệu hiệu năng</p>
                  <p className="text-xs text-[#64748B] mt-1">Hệ thống sẽ ghi nhận khi có lượt truy cập và tải trang thành công.</p>
                </div>
              ) : (
                <>
                  {/* KPI Dashboard */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white/40 backdrop-blur-md border border-white/70 p-5 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col justify-between transition-all duration-150 ease-out hover:scale-[1.01]">
                      <span className="text-xs font-semibold text-[#64748B]">Tải trang (Load p75)</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className={`text-2xl font-bold ${performanceSummary.p75?.load_event_ms > 3000 ? "text-amber-600" : "text-emerald-600"}`}>
                          {performanceSummary.p75?.load_event_ms ? Math.round(performanceSummary.p75.load_event_ms) : 0}
                        </span>
                        <span className="text-[10px] text-[#64748B]">ms</span>
                      </div>
                    </div>
                    
                    <div className="bg-white/40 backdrop-blur-md border border-white/70 p-5 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col justify-between transition-all duration-150 ease-out hover:scale-[1.01]">
                      <span className="text-xs font-semibold text-[#64748B]">Render (LCP p75)</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className={`text-2xl font-bold ${performanceSummary.p75?.lcp_ms > 2500 ? "text-amber-600" : "text-emerald-600"}`}>
                          {performanceSummary.p75?.lcp_ms ? Math.round(performanceSummary.p75.lcp_ms) : 0}
                        </span>
                        <span className="text-[10px] text-[#64748B]">ms</span>
                      </div>
                    </div>

                    <div className="bg-white/40 backdrop-blur-md border border-white/70 p-5 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col justify-between transition-all duration-150 ease-out hover:scale-[1.01]">
                      <span className="text-xs font-semibold text-[#64748B]">API Total (p95)</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className={`text-2xl font-bold ${performanceSummary.p95?.api_total_ms > 2000 ? "text-rose-600" : "text-indigo-600"}`}>
                          {performanceSummary.p95?.api_total_ms ? Math.round(performanceSummary.p95.api_total_ms) : 0}
                        </span>
                        <span className="text-[10px] text-[#64748B]">ms</span>
                      </div>
                    </div>

                    <div className="bg-white/40 backdrop-blur-md border border-white/70 p-5 rounded-2xl shadow-sm shadow-slate-300/40 flex flex-col justify-between transition-all duration-150 ease-out hover:scale-[1.01]">
                      <span className="text-xs font-semibold text-[#64748B]">Tổng mẫu thu thập</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold text-[#1E293B]">
                          {performanceSummary.total_samples}
                        </span>
                        <span className="text-[10px] text-[#64748B]">mẫu</span>
                      </div>
                    </div>
                  </div>

                  {/* Layout cho Recommendations và Slow APIs */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Slow APIs Table */}
                    <div className="lg:col-span-2 bg-white/40 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-5 space-y-4 transition-all duration-150 ease-out hover:scale-[1.01]">
                      <h2 className="text-sm font-bold text-[#1E293B]">Các API chậm nhất (Theo p95)</h2>
                      <ResponsiveDataView
                        data={performanceSummary.slow_apis}
                        columns={slowApisColumns}
                        isLoading={performanceLoading}
                        emptyState={
                          <div className="text-center py-6 text-[#64748B] text-xs font-semibold">
                            Không có dữ liệu API
                          </div>
                        }
                        keyExtractor={(api, idx) => api.name || String(idx)}
                      />
                    </div>

                    {/* Recommendations Panel */}
                    <div className="lg:col-span-1 bg-white/40 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 rounded-2xl p-5 space-y-4 transition-all duration-150 ease-out hover:scale-[1.01]">
                      <h2 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500" />
                        Đề xuất tối ưu
                      </h2>
                      {performanceSummary.recommendations.length === 0 ? (
                        <div className="text-center py-8 text-[#64748B] text-xs">
                          <CheckCircle className="mx-auto text-emerald-400 mb-2" size={24} />
                          Hệ thống đang hoạt động ổn định.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {performanceSummary.recommendations.map((rec, idx) => (
                            <div key={idx} className={`p-3 rounded-xl border text-xs leading-relaxed ${
                              rec.severity === 'critical' ? 'bg-rose-500/10 border-rose-500/20 text-rose-700' :
                              rec.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-700' :
                              'bg-blue-500/10 border-blue-500/20 text-blue-700'
                            }`}>
                              <span className="font-bold block mb-1">{rec.code}</span>
                              {rec.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-all duration-300"
          />
          
          {/* Content */}
          <div className="relative w-full max-w-lg bg-white/85 backdrop-blur-md h-screen border-l border-white/60 shadow-2xl flex flex-col p-5 space-y-4 overflow-y-auto slide-in-from-right duration-300 text-[#1E293B]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/30 pb-4">
              <div>
                <h3 className="text-base font-bold text-[#1E293B]">{selectedRequest.title}</h3>
                <span className="text-[10px] text-[#64748B]">ID: {selectedRequest._id}</span>
              </div>
              <button 
                onClick={() => setIsDetailDrawerOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#1E293B] hover:bg-white/50 rounded-xl transition-all duration-150 ease-out hover:scale-[1.05]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Fields list */}
            <div className="space-y-4 flex-1">
              <div>
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Mô tả</label>
                <p className="text-xs text-[#1E293B] mt-1 bg-white/50 backdrop-blur-sm p-3 rounded-xl border border-white/70 whitespace-pre-wrap">
                  {selectedRequest.description || "Không có mô tả"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Trạng thái</label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Độ ưu tiên</label>
                  <div className="mt-1">{getPriorityBadge(selectedRequest.priority)}</div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Người yêu cầu</label>
                  <p className="text-xs font-semibold text-[#1E293B] mt-1">{selectedRequest.requester_id?.user_name ?? "N/A"}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Ngày tạo</label>
                  <p className="text-xs text-[#64748B] mt-1">{new Date(selectedRequest.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {canManageRequests && (
                <>
                  {/* Assignee Assignment */}
                  <div className="border-t border-white/30 pt-4">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Người xử lý</label>
                    <select
                      value={selectedRequest.assignee_id?._id ?? ""}
                      onChange={(e) => handleAssignRequest(e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl focus:outline-none focus:border-[#1A73E8] text-[#1E293B] transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30"
                    >
                      <option value="">Chưa phân công</option>
                      {systemUsers.map(u => (
                        <option key={u._id} value={u._id}>{u.user_name} ({u.role?.name ?? "N/A"})</option>
                      ))}
                    </select>
                  </div>

                  {/* Update Status Panel */}
                  <form onSubmit={handleUpdateStatus} className="border-t border-white/30 pt-4 space-y-3">
                    <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">Cập nhật trạng thái</label>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={updateStatusVal}
                        onChange={(e) => setUpdateStatusVal(e.target.value)}
                        className="px-3 py-2 text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl focus:outline-none focus:border-[#1A73E8] text-[#1E293B] transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30"
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
                        className="bg-[#1A73E8] hover:bg-[#1A73E8]/90 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-sm transition-all duration-150 ease-out hover:scale-[1.01]"
                      >
                        Lưu trạng thái
                      </button>
                    </div>

                    <textarea
                      placeholder="Nhập ghi chú quyết định cho thay đổi này..."
                      value={updateDecisionNote}
                      onChange={(e) => setUpdateDecisionNote(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl focus:outline-none focus:border-[#1A73E8] transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30 resize-none text-[#1E293B]"
                    />
                  </form>
                </>
              )}

              {/* Request Audit History using status_history */}
              {selectedRequest.status_history && selectedRequest.status_history.length > 0 && (
                <div className="border-t border-white/30 pt-4 space-y-3">
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Lịch sử thay đổi</label>
                  <div className="space-y-3 border-l-2 border-white/40 pl-4 mt-2">
                    {selectedRequest.status_history.map((hist, i) => (
                      <div key={i} className="relative text-xs">
                        {/* Dot marker */}
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#1A73E8] border-2 border-white" />
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold uppercase text-[9px] px-1 bg-white/50 border border-white/70 text-[#1E293B] rounded-xl">
                            {hist.from_status} → {hist.to_status}
                          </span>
                          <span className="text-[10px] text-[#64748B]">
                            {new Date(hist.changed_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[#64748B] mt-1 italic">"{hist.note}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            {canManageRequests && (
              <div className="border-t border-white/30 pt-4 flex gap-2">
                <button
                  onClick={() => handleDeleteRequest(selectedRequest._id)}
                  className="flex items-center gap-1 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-700 text-xs font-semibold rounded-xl transition-all duration-150 ease-out hover:scale-[1.01]"
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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <form 
            onSubmit={handleCreateRequest}
            className="relative w-full max-w-md bg-white/90 backdrop-blur-md border border-white/60 shadow-2xl rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto scale-in duration-200 text-[#1E293B]"
          >
            <div className="flex items-center justify-between border-b border-white/30 pb-3">
              <h3 className="text-sm font-bold text-[#1E293B]">Tạo Yêu Cầu Vận Hành</h3>
              <button 
                type="button" 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#1E293B] hover:bg-white/50 rounded-xl transition-all duration-150 ease-out hover:scale-[1.05]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Tiêu đề</label>
                <input
                  type="text"
                  placeholder="Nhập tiêu đề yêu cầu..."
                  value={newRequestTitle}
                  onChange={(e) => setNewRequestTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl focus:outline-none focus:border-[#1A73E8] text-[#1E293B] transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Mô tả chi tiết</label>
                <textarea
                  placeholder="Mô tả công việc chi tiết..."
                  value={newRequestDesc}
                  onChange={(e) => setNewRequestDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl focus:outline-none focus:border-[#1A73E8] text-[#1E293B] transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Loại yêu cầu</label>
                  <select
                    value={newRequestType}
                    onChange={(e) => setNewRequestType(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl focus:outline-none focus:border-[#1A73E8] text-[#1E293B] transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30"
                  >
                    <option value="support">Support</option>
                    <option value="access">Access</option>
                    <option value="data_change">Data Change</option>
                    <option value="backup">Backup</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Độ ưu tiên</label>
                  <select
                    value={newRequestPriority}
                    onChange={(e) => setNewRequestPriority(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl focus:outline-none focus:border-[#1A73E8] text-[#1E293B] transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">Metadata (JSON - Không bắt buộc)</label>
                <textarea
                  placeholder='{"key": "value"}'
                  value={newRequestMeta}
                  onChange={(e) => setNewRequestMeta(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs font-mono bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl focus:outline-none focus:border-[#1A73E8] text-[#1E293B] transition-all duration-150 ease-out focus:ring-2 focus:ring-[#1A73E8]/30 resize-none"
                />
              </div>
            </div>

            <div className="border-t border-white/30 pt-3 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 hover:bg-white/50 rounded-xl font-semibold text-[#64748B] border border-transparent hover:border-white/80 transition-all duration-150 ease-out hover:scale-[1.01]"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1A73E8] hover:bg-[#1A73E8]/90 text-white rounded-xl font-semibold shadow-sm transition-all duration-150 ease-out hover:scale-[1.01]"
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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm bg-white/90 backdrop-blur-md border border-white/60 shadow-2xl rounded-2xl p-5 space-y-4 scale-in duration-200 text-[#1E293B]">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle size={24} className="shrink-0" />
              <h3 className="text-sm font-bold text-[#1E293B]">Xác Nhận Tạo Sao Lưu</h3>
            </div>
            
            <p className="text-xs text-[#64748B] leading-relaxed">
              Bạn có chắc chắn muốn tiến hành sao lưu toàn bộ cơ sở dữ liệu ngay bây giờ? 
              <br />
              <span className="font-semibold text-[#1E293B]">Lưu ý:</span> Tiến trình này có thể làm tăng nhẹ độ trễ truy vấn database trong chốc lát tùy thuộc vào độ lớn của dữ liệu.
            </p>

            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                onClick={() => setIsConfirmBackupOpen(false)}
                className="px-4 py-2 hover:bg-white/50 rounded-xl font-semibold text-[#64748B] border border-transparent hover:border-white/80 transition-all duration-150 ease-out hover:scale-[1.01]"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateBackup}
                className="px-4 py-2 bg-[#1A73E8] hover:bg-[#1A73E8]/90 text-white rounded-xl font-semibold shadow-sm transition-all duration-150 ease-out hover:scale-[1.01]"
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
      {/* --------------------------------------------------------------------- */}
      {/* MODAL: PREVIEW & RESTORE BACKUP */}
      {/* --------------------------------------------------------------------- */}
      {isImportModalOpen && importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            onClick={() => !isImportLoading && setIsImportModalOpen(false)} 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-md border border-white/60 shadow-2xl rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto scale-in duration-200 text-[#1E293B]">
            <div className="flex items-center justify-between border-b border-white/30 pb-3">
              <div className="flex items-center gap-3 text-indigo-600">
                <Database size={24} className="shrink-0" />
                <h3 className="text-base font-bold text-[#1E293B]">Khôi phục dữ liệu: Xem trước</h3>
              </div>
              <button 
                onClick={() => !isImportLoading && setIsImportModalOpen(false)}
                className="p-1 text-[#64748B] hover:text-[#1E293B] hover:bg-white/50 rounded-xl transition-all duration-150"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* File Info */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div><span className="font-semibold text-slate-500">Tên file:</span> {importPreview.fileName}</div>
              <div><span className="font-semibold text-slate-500">Dung lượng:</span> {formatBytes(importPreview.fileSize)}</div>
              <div><span className="font-semibold text-slate-500">Định dạng:</span> {importPreview.format}</div>
              <div><span className="font-semibold text-slate-500">Bộ sưu tập:</span> {importPreview.collections.length} collection(s)</div>
            </div>

            {/* Warning */}
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 text-rose-800">
              <AlertTriangle size={20} className="shrink-0 text-rose-600 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold uppercase tracking-wider">Cảnh báo: Hành động nguy hiểm</p>
                <p className="mt-1">
                  Việc khôi phục dữ liệu sẽ ghi đè lên dữ liệu hiện tại của hệ thống. 
                  Hệ thống sẽ tự động tạo một bản sao lưu toàn bộ trước khi bắt đầu để đảm bảo an toàn.
                </p>
              </div>
            </div>

            {/* Mode selection */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Chế độ khôi phục</label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="restoreMode" value="replace_selected_collections" checked={restoreMode === 'replace_selected_collections'} onChange={(e) => setRestoreMode(e.target.value as RestoreMode)} className="accent-indigo-600" />
                  Ghi đè (Replace)
                </label>
                <label className={`flex items-center gap-2 ${importPreview.format === 'mongodump_archive' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input 
                    type="radio" 
                    name="restoreMode" 
                    value="merge_upsert" 
                    checked={restoreMode === 'merge_upsert'} 
                    onChange={(e) => setRestoreMode(e.target.value as RestoreMode)} 
                    disabled={importPreview.format === 'mongodump_archive'}
                    className="accent-indigo-600" 
                  />
                  Hợp nhất (Merge & Upsert)
                </label>
              </div>
              {importPreview.format === 'mongodump_archive' && (
                <p className="text-[10px] text-amber-600 italic mt-1">
                  * Chế độ Hợp nhất không khả dụng với định dạng mongodump_archive.
                </p>
              )}
              {restoreMode === 'replace_selected_collections' && (
                <p className="text-[11px] text-rose-600 font-medium mt-1 bg-rose-50 p-2 rounded-lg border border-rose-100">
                  <AlertCircle size={12} className="inline mr-1 relative -top-[1px]" />
                  Các collection được chọn sẽ bị <b>xóa hoàn toàn</b> trước khi nạp backup.
                </p>
              )}
            </div>

            {/* Collections list */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">Các collections tìm thấy trong bản sao lưu</label>
              <div className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                {importPreview.collections.map((col: any) => (
                  <div key={col.name} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input 
                        type="checkbox" 
                        checked={selectedCollections.includes(col.name)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedCollections(prev => [...prev, col.name]);
                          else setSelectedCollections(prev => prev.filter(c => c !== col.name));
                        }}
                        className="accent-indigo-600 rounded"
                      />
                      <span className="font-medium text-sm text-slate-700">{col.name}</span>
                    </label>
                    <div className="text-xs text-slate-500 flex gap-4 text-right">
                      <span>Trong backup: <b className="text-slate-700">{col.document_count_in_backup}</b> docs</span>
                      <span>Trong DB hiện tại: <b className="text-slate-700">{col.document_count_in_db}</b> docs</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">* Chỉ những collection được chọn mới được khôi phục.</p>
            </div>

            {/* Confirmation */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={restoreChecked} 
                  onChange={(e) => setRestoreChecked(e.target.checked)}
                  className="accent-rose-600"
                />
                <span className="font-medium text-rose-700">Tôi hiểu rủi ro và xác nhận khôi phục các collection đã chọn.</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
                <input 
                  type="checkbox" 
                  checked={reloginChecked} 
                  onChange={(e) => setReloginChecked(e.target.checked)}
                  className="accent-rose-600"
                />
                <span className="font-medium text-rose-700">Tôi hiểu sau khi khôi phục thành công, tất cả tài khoản cần đăng nhập lại.</span>
              </label>
              
              {(restoreChecked && reloginChecked) && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs text-slate-600 block mb-1">
                    Vui lòng gõ chữ <b className="text-rose-600">RESTORE</b> để xác nhận.
                  </label>
                  <input 
                    type="text" 
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="RESTORE"
                    className="w-full px-3 py-2 text-sm border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                disabled={isImportLoading}
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                disabled={isImportLoading || !restoreChecked || !reloginChecked || confirmText !== "RESTORE" || selectedCollections.length === 0}
                onClick={handleRestore}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl font-bold shadow-sm transition-all flex items-center gap-2"
              >
                {isImportLoading ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                Tiến hành khôi phục
              </button>
            </div>
          </div>
        </div>
      )}

        </main>
      </div>
    </div>
  );
}

