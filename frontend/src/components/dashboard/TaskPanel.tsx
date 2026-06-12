import React from 'react';
import { CheckSquare, Clock, AlertCircle, ArrowUpRight } from 'lucide-react';
import { DashboardMetrics } from './dashboard-helpers';

interface TaskPanelProps {
  metrics: DashboardMetrics;
}

export default function TaskPanel({ metrics }: TaskPanelProps) {
  const { urgentTasks, roleScope } = metrics;

  const handleNav = (path: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  const getPriorityStyle = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      default:
        return 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'high': return 'Khẩn';
      case 'medium': return 'Trung bình';
      default: return 'Thường';
    }
  };

  const formatDeadline = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' }) + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 h-full flex flex-col justify-between transition-all duration-150 ease-out">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-[#1E293B] text-sm flex items-center gap-1.5">
            <CheckSquare size={16} className="text-[#1A73E8]" />
            <span>Nhiệm vụ khẩn cấp</span>
          </h2>
          <button 
            onClick={() => handleNav('/students/tasks')}
            className="text-[#1A73E8] text-xs font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>Tất cả</span>
            <ArrowUpRight size={12} />
          </button>
        </div>

        {urgentTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#64748B] text-center">
            <CheckSquare size={32} className="opacity-45 mb-2" />
            <p className="text-xs font-semibold text-[#1E293B]">Không có nhiệm vụ khẩn cấp</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">Tất cả công việc đã được giải quyết hoặc chưa đến hạn.</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[260px] overflow-y-auto scrollbar-hover pr-1">
            {urgentTasks.map((task, i) => {
              const taskTitle = task.title;
              const isUrgent = task.priority === 'high';
              return (
                <div 
                  key={task.id || task._id || i}
                  onClick={() => handleNav(task.linkedPage || '/students/tasks')}
                  className="p-3 bg-white/40 border border-white/50 rounded-xl hover:bg-white/70 hover:scale-[1.01] hover:shadow-xs transition-all duration-150 ease-out cursor-pointer flex items-start justify-between gap-3 shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-[#1E293B] truncate">{taskTitle}</p>
                      {isUrgent && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#64748B] font-semibold">
                      <span className="flex items-center gap-0.5 text-rose-600 font-bold">
                        <Clock size={11} />
                        <span>Hạn: {formatDeadline(task.deadline)}</span>
                      </span>
                      {task.subject && <span className="truncate">• {task.subject}</span>}
                    </div>
                  </div>

                  <span className={`text-[9px] font-extrabold border rounded-lg px-2 py-0.5 shrink-0 ${getPriorityStyle(task.priority)}`}>
                    {getPriorityLabel(task.priority)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => handleNav('/students/tasks')}
        className="w-full mt-4 rounded-xl border border-white/70 bg-white/40 px-4 py-2 text-xs font-bold text-[#1A73E8] hover:bg-white/70 hover:scale-[1.01] transition-all duration-150 ease-out cursor-pointer flex items-center justify-center gap-1 shadow-sm"
      >
        <span>Đi tới bảng nhiệm vụ</span>
        <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
