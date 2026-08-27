import React from 'react';
import { RefreshCw, Calendar, Shield } from 'lucide-react';
import { Semester } from '@/api/semester-api';

interface DashboardHeaderProps {
  userName: string;
  roleName: string;
  roleScope: 'admin' | 'teacher' | 'student' | 'system' | 'unknown';
  activeSemester: Semester | null;
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
