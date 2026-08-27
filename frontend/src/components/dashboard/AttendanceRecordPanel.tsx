import React from 'react';
import { useRouter } from 'next/navigation';
import { Award, ArrowUpRight } from 'lucide-react';
import { DashboardMetrics } from './dashboard-helpers';

interface AttendanceRecordPanelProps {
  metrics: DashboardMetrics;
}

export default function AttendanceRecordPanel({ metrics }: AttendanceRecordPanelProps) {
  const { recentAcademicRecords } = metrics;
  const router = useRouter();

  const handleNav = (path: string) => {
    router.push(path);
  };

  const getRecordTitle = (record: any) => {
    const optionLabel = typeof record.selected_option_label === 'string'
      ? record.selected_option_label.trim()
      : '';
    if (optionLabel) return optionLabel;
    const technicalTitle = record.record_title || '';
    if (/^Lựa chọn option\s+.+$/i.test(technicalTitle)) {
      return record.criterion_id?.criterion_name || 'Ghi nhận học vụ';
    }
    return technicalTitle || record.criterion_id?.criterion_name || 'Ghi nhận học vụ';
  };

  const getRecordStyle = (title?: string) => {
    const text = (title || '').toLowerCase();
    if (text.includes('khen') || text.includes('tuyên dương') || text.includes('cộng điểm')) {
      return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    }
    if (text.includes('kỷ luật') || text.includes('phạt') || text.includes('trừ điểm') || text.includes('vắng')) {
      return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
    }
    return 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20';
  };

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 h-full flex flex-col justify-between transition-all duration-150 ease-out">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-[#1E293B] text-sm">Ghi nhận học vụ gần đây</h2>
          <button 
            onClick={() => handleNav('/students/record')}
            className="text-[#1A73E8] text-xs font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>Tất cả</span>
            <ArrowUpRight size={12} />
          </button>
        </div>

        {/* Tab content showing recent academic records */}
        <div className="space-y-4">
          <div>
            {recentAcademicRecords.length === 0 ? (
              <p className="text-xs text-[#64748B] italic text-center py-8">Không có ghi nhận học vụ mới nào</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-hover pr-1">
                {recentAcademicRecords.map((rec, i) => {
                  const studentName = typeof rec.student_id === 'object' ? rec.student_id?.full_name : 'Sinh viên';
                  return (
                    <div key={rec._id || i} className="p-2.5 bg-white/40 border border-white/50 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:bg-white/60 transition-colors duration-100">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#1E293B] truncate">{getRecordTitle(rec)}</p>
                        <p className="text-[10px] text-[#64748B] mt-0.5 font-medium truncate">
                          {studentName} • {rec.recorded_at ? new Date(rec.recorded_at).toLocaleDateString('vi-VN') : 'Mới ghi nhận'}
                        </p>
                      </div>
                      <span className={`text-[9px] font-extrabold border rounded-lg px-2 py-0.5 shrink-0 ${getRecordStyle(getRecordTitle(rec))}`}>
                        {rec.points_effect && rec.points_effect > 0 ? `+${rec.points_effect}đ` : rec.points_effect ? `${rec.points_effect}đ` : 'Học vụ'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => handleNav('/students/record')}
        className="w-full mt-4 rounded-xl border border-white/70 bg-white/40 px-4 py-2 text-xs font-bold text-[#1A73E8] hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
      >
        <Award size={14} />
        <span>Xem tất cả ghi nhận rèn luyện</span>
      </button>
    </div>
  );
}
