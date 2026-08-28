import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Award, 
  PlusCircle, 
  AlertTriangle, 
  GraduationCap, 
  ArrowUpRight, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { DashboardMetrics, StudentHighlightItem } from './dashboard-helpers';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface StudentSpotlightPanelProps {
  metrics: DashboardMetrics;
}

export default function StudentSpotlightPanel({ metrics }: StudentSpotlightPanelProps) {
  const { roleScope, studentHighlights } = metrics;
  const router = useRouter();

  // Handle navigation
  const handleNav = (path: string) => {
    router.push(path);
  };

  // Helper to generate initials avatar background
  const getAvatarBg = (name: string, type: 'rewards' | 'bonus' | 'discipline') => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = {
      rewards: ['from-amber-400 to-amber-600', 'from-yellow-400 to-amber-500'],
      bonus: ['from-emerald-400 to-teal-600', 'from-green-400 to-emerald-500'],
      discipline: ['from-rose-400 to-red-600', 'from-pink-400 to-rose-500'],
    };
    const palette = colors[type];
    return palette[hash % palette.length];
  };

  const getInitials = (name: string) => {
    if (!name) return 'SV';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Render Student Personal Spotlight
  if (roleScope === 'student') {
    const spotlight = studentHighlights.mySpotlight;
    if (!spotlight) {
      return (
        <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 text-center py-8">
          <GraduationCap className="mx-auto w-10 h-10 text-slate-400 mb-2" />
          <h3 className="font-bold text-[#1E293B] text-sm">Chưa có thông tin rèn luyện</h3>
          <p className="text-xs text-[#64748B] mt-1">Vui lòng liên hệ cố vấn hoặc phòng quản lý sinh viên để biết thêm chi tiết.</p>
        </div>
      );
    }

    const { currentScore, grading, evaluationStatus, positiveRecords, warningRecords, totalPositiveCount, totalWarningCount, nextAction } = spotlight;

    const getStatusText = (status: string | null) => {
      switch (status) {
        case 'draft': return 'Bản nháp';
        case 'sv_submitted': return 'Đã nộp tự đánh giá';
        case 'gv_reviewed': return 'Giảng viên đã duyệt';
        case 'locked': return 'Đã khóa điểm';
        default: return 'Chưa tạo';
      }
    };

    const getStatusBg = (status: string | null) => {
      switch (status) {
        case 'draft': return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
        case 'sv_submitted': return 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20';
        case 'gv_reviewed': return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
        case 'locked': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
        default: return 'bg-slate-500/10 text-[#64748B] border-slate-500/20';
      }
    };

    return (
      <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-3 sm:p-6 shadow-sm shadow-slate-300/40 transition-all duration-150 ease-out hover:shadow-md">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 md:items-center justify-between">
          
          {/* Main Info Card */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#1A73E8] to-[#63B3ED] flex items-center justify-center text-white shadow-md border border-white/20">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#1E293B] tracking-tight flex items-center gap-2">
                Ghi nhận học sinh sinh viên
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${getStatusBg(evaluationStatus)}`}>
                  {getStatusText(evaluationStatus)}
                </span>
              </h2>
            </div>
          </div>

          {/* Scores Overview */}
          <div className="flex items-center gap-6 bg-white/45 border border-white/60 rounded-2xl p-3.5 shadow-inner">
            <div className="text-center px-2">
              <span className="text-[#64748B] text-[10px] font-bold block mb-0.5">Điểm rèn luyện</span>
              <span className="text-xl font-black text-[#1E293B]">
                {currentScore !== null ? `${currentScore}` : '--'} <span className="text-xs font-semibold text-[#64748B]">/ 100</span>
              </span>
            </div>
            <div className="h-8 w-px bg-slate-300/60" />
            <div className="text-center px-2">
              <span className="text-[#64748B] text-[10px] font-bold block mb-0.5">Xếp loại</span>
              <span className={`text-sm font-black px-2.5 py-0.5 rounded-lg border ${
                grading === 'Xuất sắc' ? 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20' :
                grading === 'Tốt' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' :
                grading === 'Khá' ? 'bg-amber-500/10 text-amber-700 border-amber-500/20' :
                grading === 'Trung bình' ? 'bg-orange-500/10 text-orange-700 border-orange-500/20' :
                'bg-rose-500/10 text-rose-700 border-rose-500/20'
              }`}>
                {grading || 'Chưa xếp loại'}
              </span>
            </div>
            {nextAction && (
              <>
                <div className="h-8 w-px bg-slate-300/60" />
                <button
                  onClick={() => handleNav(nextAction.href)}
                  className="rounded-xl bg-[#1A73E8] text-white hover:bg-[#1557B0] text-xs font-bold py-2.5 px-4 shadow-sm transition-all duration-150 ease-out cursor-pointer flex items-center gap-1.5 border border-[#1A73E8]"
                >
                  <span>{nextAction.label}</span>
                  <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Records Lists */}
        {((totalPositiveCount ?? positiveRecords.length) > 0 || (totalWarningCount ?? warningRecords.length) > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-5 border-t border-slate-200/50">
            
            {/* Positive / Bonus Records */}
            <div>
              <h3 className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mb-3">
                <CheckCircle2 size={15} />
                <span>Ghi nhận tích cực & điểm cộng ({totalPositiveCount ?? positiveRecords.length})</span>
              </h3>
              {(totalPositiveCount ?? positiveRecords.length) === 0 ? (
                <p className="text-xs text-[#64748B] italic py-2">Chưa có ghi nhận tích cực nào trong học kỳ này.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-hover">
                  {positiveRecords.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-start gap-2.5 text-xs shadow-xs"
                    >
                      <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 shrink-0 flex items-center justify-center text-[10px] font-bold">
                        +{item.impactScore}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#1E293B] truncate">{item.latestRecordTitle}</p>
                        {item.dominantCriterionName && (
                          <p className="text-[10px] text-[#64748B] mt-0.5 truncate">Tiêu chí: {item.dominantCriterionName}</p>
                        )}
                      </div>
                      <span className="text-[9px] text-[#64748B] shrink-0 font-medium">
                        {item.latestRecordAt ? new Date(item.latestRecordAt).toLocaleDateString('vi-VN') : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
 
            {/* Warnings / Discipline Records */}
            <div>
              <h3 className="text-xs font-bold text-rose-700 flex items-center gap-1.5 mb-3">
                <AlertCircle size={15} />
                <span>Cảnh báo & trừ điểm ({totalWarningCount ?? warningRecords.length})</span>
              </h3>
              {(totalWarningCount ?? warningRecords.length) === 0 ? (
                <p className="text-xs text-[#64748B] italic py-2">Tuyệt vời! Không có ghi nhận cảnh báo/vi phạm nào.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-hover">
                  {warningRecords.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-2.5 bg-rose-500/5 border border-rose-500/10 rounded-xl flex items-start gap-2.5 text-xs shadow-xs"
                    >
                      <div className="w-5 h-5 rounded-md bg-rose-500/10 text-rose-700 border border-rose-500/20 shrink-0 flex items-center justify-center text-[10px] font-bold">
                        {item.impactScore}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#1E293B] truncate">{item.latestRecordTitle}</p>
                        {item.dominantCriterionName && (
                          <p className="text-[10px] text-[#64748B] mt-0.5 truncate">Tiêu chí: {item.dominantCriterionName}</p>
                        )}
                      </div>
                      <span className="text-[9px] text-[#64748B] shrink-0 font-medium">
                        {item.latestRecordAt ? new Date(item.latestRecordAt).toLocaleDateString('vi-VN') : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    );
  }

  // Render Admin / Teacher Spotlight (Leaderboard & Highlights)
  type CategoryId = 'discipline' | 'rewards' | 'bonus';
  const categoryConfigs: Array<{ id: CategoryId; label: string; icon: typeof AlertTriangle; color: string; list: StudentHighlightItem[] }> = [
    { id: 'discipline', label: 'Kỷ luật & Chú ý', icon: AlertTriangle, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', list: studentHighlights.topDiscipline || [] },
    { id: 'rewards', label: 'Khen thưởng', icon: Award, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', list: studentHighlights.topRewards || [] },
    { id: 'bonus', label: 'Điểm cộng', icon: PlusCircle, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', list: studentHighlights.topBonus || [] },
  ];

  const renderList = (category: typeof categoryConfigs[number], compact = false) => {
    const list = category.list.slice(0, 10);
    return list.length === 0 ? (
      <div className="text-center py-8 border border-dashed border-slate-300/40 rounded-xl bg-white/20">
        <Activity className="mx-auto text-slate-400 w-8 h-8 mb-2" />
        <p className="text-xs text-[#64748B] font-bold">Chưa có dữ liệu học sinh trong học kỳ này</p>
      </div>
    ) : (
      <div className={`space-y-2 overflow-y-auto pr-1 scrollbar-hover ${compact ? 'max-h-[calc(70vh-5rem)]' : 'max-h-[360px]'}`}>
        {list.map(item => (
          <div key={item.studentId} className={`group min-w-0 ${compact ? 'bg-slate-50/90 border-slate-200/80 hover:bg-slate-100/90' : 'bg-white/50 border-white/70 hover:bg-white/85'} border rounded-xl flex items-center justify-between transition-all duration-150 ease-out shadow-xs shadow-slate-200/20 ${compact ? 'p-2.5 gap-2' : 'p-3.5 gap-4'}`} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 72px' }}>
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`rounded-xl bg-gradient-to-tr ${getAvatarBg(item.studentName, category.id)} text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm border border-white/20 ${compact ? 'w-9 h-9' : 'w-10 h-10'}`}>{getInitials(item.studentName)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`font-extrabold text-[#1E293B] text-xs truncate ${compact ? 'max-w-[125px]' : 'max-w-[150px]'}`}>{item.studentName}</h4>
                  <span className="text-[10px] text-[#64748B] truncate max-w-[110px]">MSSV: {item.studentCode}</span>
                  <span className="text-[10px] text-[#64748B] truncate max-w-[90px]">{item.className}</span>
                </div>
                <p className="text-[10.5px] text-[#64748B] mt-1 truncate font-medium">
                  {category.id === 'rewards' && <>Số lượt khen thưởng: <strong className="text-amber-700">{item.recordCount} lần</strong> • {item.groupedRecords?.map(group => `${group.label} (${group.count})`).join(', ')}</>}
                  {category.id === 'bonus' && <>Số lượt: <strong className="text-emerald-700">{item.recordCount} lần</strong> • Tổng điểm cộng: <strong className="text-emerald-700">+{item.impactScore} điểm</strong> • {item.groupedRecords?.map(group => `${group.label} (${group.count})`).join(', ')}</>}
                  {category.id === 'discipline' && <>Số lượt: <strong className="text-rose-700">{item.recordCount} lần</strong> • Điểm bị trừ: <strong className="text-rose-700">{item.impactScore}</strong> • Ghi nhận: <span className="text-rose-600">{item.groupedRecords?.map(group => `${group.label} (${group.count})`).join(', ')}</span></>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:inline text-[9px] text-[#64748B]">{item.latestRecordAt ? new Date(item.latestRecordAt).toLocaleDateString('vi-VN') : ''}</span>
              {item.classId && item.studentId && <button onClick={() => handleNav(`/students/${item.classId}/${item.studentId}`)} aria-label={`Xem hồ sơ ${item.studentName}`} className="min-h-11 min-w-11 shrink-0 rounded-lg bg-white/50 text-[#1A73E8] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8]" title="Xem hồ sơ rèn luyện chi tiết"><ArrowUpRight size={14} /></button>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 transition-all duration-150 ease-out hover:shadow-md">
      
      {/* Title */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#1A73E8] to-[#63B3ED] flex items-center justify-center text-white border border-white/20">
            <TrendingUp size={16} />
          </div>
          <div>
            <h2 className="font-extrabold text-[#1E293B] text-sm tracking-tight">Ghi nhận học sinh sinh viên</h2>
          </div>
        </div>

        {/* View all records CTA */}
        <button
          onClick={() => handleNav('/students/record')}
          className="text-xs font-bold text-[#1A73E8] hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          <span>Xem tất cả ghi nhận</span>
          <ArrowUpRight size={14} />
        </button>
      </div>

      <div className="hidden md:grid md:grid-cols-3 gap-4">
        {categoryConfigs.map(category => <section key={category.id} aria-labelledby={`${category.id}-heading`} className="min-w-0"><div className={`flex items-center gap-2 mb-3 text-xs font-bold ${category.color.split(' ')[0]}`}><category.icon size={15} /><h3 id={`${category.id}-heading`}>{category.label} ({category.list.length})</h3></div>{renderList(category)}</section>)}
      </div>

      <div className="grid md:hidden grid-cols-3 gap-2">
        {categoryConfigs.map(category => {
          const Icon = category.icon;
          return (
            <Popover key={category.id} modal={true}>
              <PopoverTrigger asChild>
                <button
                  aria-label={category.label}
                  className={`min-h-11 min-w-0 flex items-center justify-center gap-1 p-2 rounded-xl border text-xs font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] ${category.color}`}
                >
                  <Icon size={14} />
                  <span className="sr-only">{category.label}</span>
                  <span aria-hidden="true">{category.list.length}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                overlay
                centered
                showCloseButton
                className="w-[calc(100vw-2rem)] max-w-sm max-h-[70vh] overflow-y-auto p-4 bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl rounded-2xl z-50 flex flex-col"
              >
                <div className={`flex items-center gap-2 mb-3 text-xs font-bold pr-7 ${category.color.split(' ')[0]}`}>
                  <Icon size={15} />
                  <h3 className="font-bold text-sm text-[#1E293B] truncate">{category.label} ({category.list.length})</h3>
                </div>
                {renderList(category, true)}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

    </div>
  );
}
