import React from 'react';
import { useRouter } from 'next/navigation';
import { Database, FileText, Activity, ShieldAlert, ArrowUpRight, ArrowDown } from 'lucide-react';
import { DashboardMetrics } from './dashboard-helpers';
import { useAuth } from '@/providers/auth-provider';

interface SystemOperationsPanelProps {
  metrics: DashboardMetrics;
  systemRequests: any[];
  backups: any[];
}

export default function SystemOperationsPanel({ metrics, systemRequests, backups }: SystemOperationsPanelProps) {
  const { kpis } = metrics;
  const { user } = useAuth();
  const router = useRouter();

  const role = (user?.roleCode || user?.roleName || user?.role || '').toUpperCase();
  const isSysAdmin = role === 'ADMIN' || (user?.permissions || []).includes('ADMIN_FULL');

  const canReadLoginLogs = isSysAdmin || (user?.permissions || []).includes('LOGIN_LOG_READ');
  const canReadRequests = isSysAdmin || (user?.permissions || []).includes('SYSTEM_REQUEST_READ');
  const canReadBackups = isSysAdmin || (user?.permissions || []).includes('DATABASE_BACKUP_READ');

  const visibleColumnsCount = [canReadLoginLogs, canReadRequests, canReadBackups].filter(Boolean).length;

  if (visibleColumnsCount === 0) return null;

  const handleNav = (path: string) => {
    router.push(path);
  };

  const getBackupStatusBadge = (status?: string) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
      case 'failed':
        return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
      case 'running':
        return 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-[#64748B] border-slate-500/20';
    }
  };

  const getBackupStatusText = (status?: string) => {
    switch (status) {
      case 'success': return 'Thành công';
      case 'failed': return 'Thất bại';
      case 'running': return 'Đang chạy';
      default: return 'Chờ xử lý';
    }
  };

  const getRequestPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      default:
        return 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20';
    }
  };

  const getRequestPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical': return 'Khẩn cấp';
      case 'high': return 'Cao';
      case 'medium': return 'Vừa';
      default: return 'Thấp';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    const mb = kb / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
  };

  let gridColsClass = 'grid-cols-1';
  if (visibleColumnsCount === 3) {
    gridColsClass = 'grid-cols-1 md:grid-cols-3 gap-6';
  } else if (visibleColumnsCount === 2) {
    gridColsClass = 'grid-cols-1 md:grid-cols-2 gap-6';
  } else {
    gridColsClass = 'grid-cols-1 max-w-2xl';
  }

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 transition-all duration-150 ease-out scroll-mt-20 relative z-10">
      <div className="flex justify-between items-center mb-5">
        <h2 className="font-bold text-[#1E293B] text-sm flex items-center gap-1.5">
          <Activity size={16} className="text-[#1A73E8]" />
          <span>Vận hành & Giám sát hệ thống</span>
        </h2>
        <button 
          onClick={() => handleNav('/system')}
          className="text-[#1A73E8] text-xs font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          <span>Bảng điều khiển hệ thống</span>
          <ArrowUpRight size={12} />
        </button>
      </div>

      <div className={`grid ${gridColsClass}`}>
        {/* Login Logs Summary */}
        {canReadLoginLogs && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Đăng nhập hôm nay</h3>
            
            <div className="bg-white/50 border border-white/70 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1">Thành công</span>
                <span className="text-2xl font-black text-emerald-600">{kpis.todayLoginSuccess}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <ArrowDown className="w-5 h-5 rotate-180" />
              </div>
            </div>

            <div className="bg-white/50 border border-white/70 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1">Thất bại</span>
                <span className="text-2xl font-black text-rose-600">{kpis.todayLoginFailure}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-700 border border-rose-500/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* System Requests */}
        {canReadRequests && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider flex justify-between items-center mb-2">
              <span>Yêu cầu hệ thống</span>
              {kpis.pendingSystemRequests > 0 && (
                <span className="text-[9px] font-extrabold bg-rose-500 text-white rounded-lg px-1.5 py-0.5 animate-pulse">
                  {kpis.pendingSystemRequests} chờ
                </span>
              )}
            </h3>

            {systemRequests.length === 0 ? (
              <p className="text-xs text-[#64748B] italic text-center py-6">Không có yêu cầu hệ thống nào</p>
            ) : (
              <div className="space-y-2 max-h-[170px] overflow-y-auto scrollbar-hover pr-1">
                {systemRequests.slice(0, 3).map((req, i) => {
                  const requesterName = req.requester_id?.user_name || req.requester_id?.email || 'N/A';
                  return (
                    <div key={req._id || i} className="p-2.5 bg-white/40 border border-white/50 rounded-xl flex items-start justify-between gap-2.5 shadow-xs">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#1E293B] truncate">{req.title}</p>
                        <p className="text-[9px] text-[#64748B] font-medium mt-0.5 truncate">
                          Người yêu cầu: {requesterName}
                        </p>
                      </div>
                      <span className={`text-[8px] font-extrabold border rounded-lg px-1.5 py-0.5 shrink-0 uppercase ${getRequestPriorityStyle(req.priority)}`}>
                        {getRequestPriorityLabel(req.priority)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Database Backups */}
        {canReadBackups && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Sao lưu dữ liệu</h3>
            
            {backups.length === 0 ? (
              <p className="text-xs text-[#64748B] italic text-center py-6">Không có dữ liệu sao lưu</p>
            ) : (
              <div className="space-y-2 max-h-[170px] overflow-y-auto scrollbar-hover pr-1">
                {backups.slice(0, 3).map((backup, i) => (
                  <div key={backup._id || i} className="p-2.5 bg-white/40 border border-white/50 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1E293B] truncate">{backup.file_name || 'Backup_Database'}</p>
                      <p className="text-[9px] text-[#64748B] font-semibold mt-0.5">
                        {formatFileSize(backup.file_size)} • {new Date(backup.createdAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <span className={`text-[8px] font-extrabold border rounded-lg px-1.5 py-0.5 shrink-0 ${getBackupStatusBadge(backup.status)}`}>
                      {getBackupStatusText(backup.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
