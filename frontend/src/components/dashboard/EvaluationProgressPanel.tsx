import React from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, ArrowRight, Hourglass, ShieldAlert } from 'lucide-react';
import { DashboardMetrics } from './dashboard-helpers';

interface EvaluationProgressPanelProps {
  metrics: DashboardMetrics;
}

export default function EvaluationProgressPanel({ metrics }: EvaluationProgressPanelProps) {
  const { roleScope, activePeriod, distributions } = metrics;
  const router = useRouter();

  if (!activePeriod) {
    return (
      <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40">
        <h2 className="font-bold text-[#1E293B] text-sm mb-4">Tiến độ đánh giá học kỳ</h2>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <ShieldAlert className="w-10 h-10 text-[#64748B] mb-2 opacity-60" />
          <p className="text-sm font-semibold text-[#1E293B]">Không có đợt đánh giá nào đang mở</p>
          <p className="text-xs text-[#64748B] mt-1">Vui lòng liên hệ Admin để tạo đợt đánh giá mới.</p>
        </div>
      </div>
    );
  }

  // Calculate distributions total and percentages
  const { draft = 0, sv_submitted = 0, gv_reviewed = 0, locked = 0 } = distributions.evaluationStatus;
  const total = draft + sv_submitted + gv_reviewed + locked;
  
  const getPercent = (val: number) => {
    if (total === 0) return 0;
    return Math.round((val / total) * 100);
  };

  // Determine current deadline and label based on status
  let currentDeadline = '';
  let phaseName = '';
  switch (activePeriod.status) {
    case 'sv_phase':
      currentDeadline = activePeriod.sv_deadline;
      phaseName = 'Hạn chót sinh viên tự đánh giá';
      break;
    case 'gv_phase':
      currentDeadline = activePeriod.gv_deadline;
      phaseName = 'Hạn chót giảng viên duyệt điểm';
      break;
    case 'admin_phase':
      currentDeadline = activePeriod.admin_deadline;
      phaseName = 'Hạn chót admin khóa điểm';
      break;
    default:
      currentDeadline = '';
      phaseName = 'Không có thời hạn khẩn cấp';
  }

  const getDaysRemaining = (deadlineStr: string) => {
    if (!deadlineStr) return null;
    const diffTime = new Date(deadlineStr).getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysRemaining(currentDeadline);

  const getCta = () => {
    switch (roleScope) {
      case 'student':
        if (metrics.kpis.myEvaluationStatus === 'draft') {
          return {
            text: 'Tự đánh giá ngay',
            url: '/grading/score',
            subText: 'Bạn chưa nộp bài tự đánh giá.'
          };
        }
        return {
          text: 'Xem phiếu điểm',
          url: '/grading/score',
          subText: 'Bạn đã nộp bài tự đánh giá thành công.'
        };
      case 'teacher':
        return {
          text: 'Duyệt điểm lớp',
          url: '/grading/score',
          subText: `Có ${metrics.kpis.pendingMyReviewCount} hồ sơ đang chờ bạn phê duyệt.`
        };
      case 'admin':
        return {
          text: 'Quản lý đợt đánh giá',
          url: '/grading',
          subText: 'Xem và điều phối tiến trình đánh giá toàn trường.'
        };
      default:
        return null;
    }
  };

  const cta = getCta();

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 flex flex-col justify-between h-full transition-all duration-150 ease-out">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-[#1E293B] text-sm">Tiến độ đợt đánh giá</h2>
          {daysRemaining !== null && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold border ${daysRemaining <= 3 ? 'bg-rose-500/10 text-rose-700 border-rose-500/20 animate-pulse' : 'bg-amber-500/10 text-amber-700 border-amber-500/20'}`}>
              <Hourglass size={11} />
              {daysRemaining > 0 ? `Còn ${daysRemaining} ngày` : daysRemaining === 0 ? 'Hôm nay hết hạn' : `Trễ hạn ${Math.abs(daysRemaining)} ngày`}
            </span>
          )}
        </div>

        {/* Phase deadline display */}
        {currentDeadline && (
          <div className="bg-white/50 border border-white/70 rounded-xl p-3 mb-4 flex items-start gap-2.5 shadow-sm">
            <Calendar size={16} className="text-[#1A73E8] mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">{phaseName}</p>
              <p className="text-xs font-bold text-[#1E293B] mt-0.5">
                {new Date(currentDeadline).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        )}

        {/* Progress bars (for Admin & Teacher) */}
        {roleScope !== 'student' && total > 0 && (
          <div className="space-y-3 mt-4">
            <div>
              <div className="flex justify-between text-[11px] font-semibold text-[#1E293B] mb-1.5">
                <span>Trạng thái hồ sơ ({total} học sinh)</span>
                <span>{getPercent(locked + gv_reviewed)}% Hoàn thành</span>
              </div>
              <div className="h-2.5 w-full bg-slate-200/60 rounded-full flex overflow-hidden shadow-inner border border-white/30">
                <div style={{ width: `${getPercent(draft)}%` }} className="bg-slate-400/80 transition-all duration-300" title={`Bản nháp: ${draft}`} />
                <div style={{ width: `${getPercent(sv_submitted)}%` }} className="bg-blue-500/80 transition-all duration-300" title={`SV đã nộp: ${sv_submitted}`} />
                <div style={{ width: `${getPercent(gv_reviewed)}%` }} className="bg-purple-500/80 transition-all duration-300" title={`GV đã duyệt: ${gv_reviewed}`} />
                <div style={{ width: `${getPercent(locked)}%` }} className="bg-emerald-500/80 transition-all duration-300" title={`Đã khóa: ${locked}`} />
              </div>
            </div>

            {/* Labels/Legend */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                <span>Bản nháp: {draft} ({getPercent(draft)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>SV nộp: {sv_submitted} ({getPercent(sv_submitted)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                <span>GV duyệt: {gv_reviewed} ({getPercent(gv_reviewed)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Đã khóa: {locked} ({getPercent(locked)}%)</span>
              </div>
            </div>
          </div>
        )}

        {/* Progress representation for student */}
        {roleScope === 'student' && (
          <div className="space-y-4 mt-2">
            <p className="text-xs text-[#64748B] leading-relaxed">
              Hãy hoàn thành phiếu tự đánh giá điểm rèn luyện trước ngày hạn chót. Bạn có thể thay đổi câu trả lời khi còn ở trạng thái <strong>Bản nháp</strong>.
            </p>
            <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {[
                { label: 'Sinh viên tự đánh giá', active: true, done: ['sv_submitted', 'gv_reviewed', 'locked'].includes(metrics.kpis.myEvaluationStatus || '') },
                { label: 'Giảng viên duyệt điểm', active: ['sv_submitted', 'gv_reviewed', 'locked'].includes(metrics.kpis.myEvaluationStatus || ''), done: ['gv_reviewed', 'locked'].includes(metrics.kpis.myEvaluationStatus || '') },
                { label: 'Khoa/Trường khóa điểm', active: ['gv_reviewed', 'locked'].includes(metrics.kpis.myEvaluationStatus || ''), done: metrics.kpis.myEvaluationStatus === 'locked' }
              ].map((step, idx) => (
                <div key={idx} className="relative flex items-center gap-2">
                  <div className={`absolute -left-6 w-4.5 h-4.5 rounded-full border flex items-center justify-center text-[9px] font-bold z-10 transition-all ${
                    step.done ? 'bg-emerald-500 text-white border-emerald-500' : step.active ? 'bg-blue-500 text-white border-blue-500 animate-pulse' : 'bg-white text-slate-400 border-slate-200'
                  }`}>
                    {idx + 1}
                  </div>
                  <span className={`text-[11px] font-bold ${step.done ? 'text-emerald-600' : step.active ? 'text-blue-600' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {cta && (
        <div className="mt-5 pt-4 border-t border-white/50 flex flex-col gap-2">
          {cta.subText && (
            <p className="text-[10px] text-[#64748B] font-semibold">{cta.subText}</p>
          )}
          <button
            onClick={() => router.push(cta.url)}
            className="w-full rounded-xl border border-white/70 bg-white/40 px-4 py-2 text-xs font-bold text-[#1A73E8] hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out cursor-pointer flex items-center justify-center gap-1 shadow-sm"
          >
            <span>{cta.text}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
