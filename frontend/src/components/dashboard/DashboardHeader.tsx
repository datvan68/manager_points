import React from 'react';
import { RefreshCw, Calendar, Shield, Award } from 'lucide-react';
import { Semester } from '@/api/semester-api';
import { EvaluationPeriod } from '@/api/evaluation-period-api';

interface DashboardHeaderProps {
  userName: string;
  roleName: string;
  roleScope: 'admin' | 'teacher' | 'student' | 'system' | 'unknown';
  activeSemester: Semester | null;
  activePeriod: EvaluationPeriod | null;
  lastUpdated: Date;
  onRefresh: () => void;
  isRefreshing: boolean;
  semesters: Semester[];
  selectedSemesterId: string | null;
  onSemesterChange: (semesterId: string) => void;
}

export default function DashboardHeader({
  userName,
  roleName,
  roleScope,
  activeSemester,
  activePeriod,
  lastUpdated,
  onRefresh,
  isRefreshing,
  semesters,
  selectedSemesterId,
  onSemesterChange,
}: DashboardHeaderProps) {
  
  const getRoleDisplayName = () => {
    switch (roleScope) {
      case 'admin':
        return 'Quản trị viên';
      case 'teacher':
        return 'Giảng viên / Cố vấn';
      case 'student':
        return 'Học sinh / Sinh viên';
      case 'system':
        return 'Vận hành hệ thống';
      default:
        return roleName || 'Người dùng';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getPeriodStatusText = (status?: string) => {
    switch (status) {
      case 'pending': return 'Chuẩn bị';
      case 'sv_phase': return 'SV tự đánh giá';
      case 'gv_phase': return 'GV phê duyệt';
      case 'admin_phase': return 'Admin phê duyệt';
      case 'closed': return 'Đã đóng';
      default: return 'Không hoạt động';
    }
  };

  const getPeriodStatusColor = (status?: string) => {
    switch (status) {
      case 'sv_phase': return 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20';
      case 'gv_phase': return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'admin_phase': return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
      case 'closed': return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
      default: return 'bg-slate-500/10 text-[#64748B] border-slate-500/20';
    }
  };

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-150 ease-out">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-[#1E293B] tracking-tight">
            Xin chào, {userName}
          </h1>
          <span className="inline-flex items-center gap-1.5 bg-white/50 backdrop-blur-sm border border-white/80 rounded-xl px-2.5 py-1 shadow-sm text-xs font-semibold text-[#1E293B] tracking-wide">
            <Shield size={12} className="text-[#1A73E8]" />
            {getRoleDisplayName()}
          </span>
        </div>
        <p className="text-[#64748B] text-xs mt-1">
          Hệ thống quản lý điểm rèn luyện & công việc sinh viên.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Semester Selector */}
        {semesters.length > 0 && (
          <div className="flex items-center gap-2 bg-white/50 border border-white/70 rounded-xl px-3 py-1 shadow-sm text-xs font-semibold text-[#1E293B]">
            <Calendar size={14} className="text-[#64748B]" />
            <select
              value={selectedSemesterId || ''}
              onChange={(e) => onSemesterChange(e.target.value)}
              className="bg-transparent border-none py-1.5 focus:ring-0 outline-none text-[#1E293B] font-bold cursor-pointer"
            >
              {semesters.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.semester_name} {s.status === 'active' ? '(Hiện tại)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {activePeriod && (
          <div className={`flex items-center gap-1.5 border rounded-xl px-3 py-1.5 shadow-sm text-xs font-bold ${getPeriodStatusColor(activePeriod.status)}`}>
            <Award size={14} />
            <span>Đợt: {getPeriodStatusText(activePeriod.status)}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/40 border border-white/70 hover:bg-white/70 hover:scale-[1.03] transition-all duration-150 ease-out cursor-pointer shadow-sm text-[#64748B] hover:text-[#1E293B]"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={15} className={`${isRefreshing ? 'animate-spin text-[#1A73E8]' : ''}`} />
          </button>
          <span className="text-[10px] font-semibold text-[#64748B] hidden sm:inline">
            Cập nhật lúc: {formatTime(lastUpdated)}
          </span>
        </div>
      </div>
    </div>
  );
}
