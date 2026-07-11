import React from 'react';
import { useRouter } from 'next/navigation';
import { Users, GraduationCap, Building2, ArrowUpRight } from 'lucide-react';
import { DashboardMetrics } from './dashboard-helpers';

interface AcademicOverviewPanelProps {
  metrics: DashboardMetrics;
}

export default function AcademicOverviewPanel({ metrics }: AcademicOverviewPanelProps) {
  const { roleScope, distributions, kpis } = metrics;
  const router = useRouter();

  // Student statuses
  const statusLabels: Record<string, { label: string; color: string }> = {
    Studying: { label: 'Đang học', color: 'bg-blue-500' },
    Reserved: { label: 'Bảo lưu', color: 'bg-amber-500' },
    Dropped: { label: 'Thôi học', color: 'bg-red-500' },
    Graduated: { label: 'Đã tốt nghiệp', color: 'bg-emerald-500' },
    Suspended: { label: 'Đình chỉ', color: 'bg-rose-500' },
  };

  const getStatusTotal = () => {
    return Object.values(distributions.studentStatus).reduce((a, b) => a + b, 0);
  };

  const totalStudents = getStatusTotal() || kpis.totalStudents;

  const handleNav = (path: string) => {
    router.push(path);
  };

  // Skip showing student distribution to students to maintain focus on their details,
  // or display a different layout. Wait, for students, we can show their class details
  // and department details instead of full student roster distributions.
  if (roleScope === 'student') {
    return (
      <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 h-full flex flex-col justify-between transition-all duration-150 ease-out">
        <div>
          <h2 className="font-bold text-[#1E293B] text-sm mb-4">Thông tin lớp & Khoa</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-white/50 border border-white/70 rounded-xl shadow-sm">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-700 border border-purple-500/20">
                <Building2 size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#64748B] font-semibold">Khoa / Bộ môn</p>
                <p className="text-xs font-bold text-[#1E293B] mt-0.5 truncate">
                  {Object.keys(distributions.classDistributionByDept)[0] || 'Đang cập nhật'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white/50 border border-white/70 rounded-xl shadow-sm">
              <div className="p-2 rounded-xl bg-blue-500/10 text-[#1A73E8] border border-blue-500/20">
                <GraduationCap size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#64748B] font-semibold">Lớp hành chính</p>
                <p className="text-xs font-bold text-[#1E293B] mt-0.5 truncate">
                  {kpis.totalClasses > 0 ? "Lớp của tôi" : "Chưa phân lớp"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => handleNav('/grading/score')}
          className="w-full mt-4 rounded-xl border border-white/70 bg-white/40 px-4 py-2 text-xs font-bold text-[#1A73E8] hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out cursor-pointer flex items-center justify-center gap-1 shadow-sm"
        >
          <span>Xem chi tiết rèn luyện</span>
          <ArrowUpRight size={14} />
        </button>
      </div>
    );
  }

  // Admin/Teacher Roster status distribution
  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 h-full flex flex-col justify-between transition-all duration-150 ease-out">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-[#1E293B] text-sm">Phân bổ học vụ</h2>
          <button 
            onClick={() => handleNav('/students')}
            className="text-[#1A73E8] text-xs font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>Chi tiết</span>
            <ArrowUpRight size={12} />
          </button>
        </div>

        {/* Student Status distribution */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Trạng thái sinh viên</h3>
          
          {totalStudents === 0 ? (
            <p className="text-xs text-[#64748B] text-center py-4">Không có dữ liệu sinh viên</p>
          ) : (
            Object.entries(statusLabels).map(([statusKey, cfg]) => {
              const count = distributions.studentStatus[statusKey] || 0;
              const pct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0;
              if (count === 0) return null; // Hide statuses with 0 counts for compactness

              return (
                <div key={statusKey} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-[#1E293B]">
                    <span>{cfg.label}</span>
                    <span>{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden border border-white/20">
                    <div 
                      className={`h-full ${cfg.color} rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Classes per Department distribution */}
        {Object.keys(distributions.classDistributionByDept).length > 0 && (
          <div className="mt-5 space-y-2.5">
            <h3 className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Phân bổ lớp theo Khoa</h3>
            <div className="space-y-2 max-h-[120px] overflow-y-auto scrollbar-hover pr-1">
              {Object.entries(distributions.classDistributionByDept).map(([deptName, classCount]) => (
                <div key={deptName} className="flex items-center justify-between text-xs font-semibold p-2 bg-white/40 border border-white/50 rounded-xl shadow-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span className="text-[#1E293B] truncate">{deptName}</span>
                  </div>
                  <span className="text-[#64748B] font-bold shrink-0">{classCount} lớp</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
