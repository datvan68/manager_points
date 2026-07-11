import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Award, 
  ClipboardCheck, 
  PlusCircle, 
  Database, 
  Users, 
  Bell, 
  FileText, 
  Settings 
} from 'lucide-react';

interface QuickActionsPanelProps {
  roleScope: 'admin' | 'teacher' | 'student' | 'system' | 'unknown';
}

export default function QuickActionsPanel({ roleScope }: QuickActionsPanelProps) {
  const router = useRouter();
  
  const handleNav = (path: string) => {
    router.push(path);
  };

  const getActions = () => {
    switch (roleScope) {
      case 'admin':
        return [
          { label: 'Quản lý đợt đánh giá', icon: Award, url: '/grading', color: 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20' },
          { label: 'Tạo nhiệm vụ mới', icon: PlusCircle, url: '/students/tasks', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
          { label: 'Quản lý sinh viên & lớp', icon: Users, url: '/students', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
          { label: 'Cấu hình & Sao lưu', icon: Database, url: '/system', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
        ];
      case 'teacher':
        return [
          { label: 'Chấm điểm rèn luyện lớp', icon: Award, url: '/grading/score', color: 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20' },
          { label: 'Báo cáo lớp & chuyên cần', icon: ClipboardCheck, url: '/students/record', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
          { label: 'Giao nhiệm vụ cho lớp', icon: PlusCircle, url: '/students/tasks', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
        ];
      case 'student':
        return [
          { label: 'Tự đánh giá rèn luyện', icon: Award, url: '/grading/score', color: 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20' },
          { label: 'Nhiệm vụ được giao của tôi', icon: ClipboardCheck, url: '/students/tasks', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
          { label: 'Xem thông báo mới', icon: Bell, url: '/notifications', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
        ];
      case 'system':
        return [
          { label: 'Tạo bản sao lưu hệ thống', icon: Database, url: '/system', color: 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20' },
          { label: 'Xem nhật ký đăng nhập', icon: Settings, url: '/system', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
          { label: 'Xử lý yêu cầu vận hành', icon: FileText, url: '/system', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
        ];
      default:
        return [];
    }
  };

  const actions = getActions();

  if (actions.length === 0) return null;

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 transition-all duration-150 ease-out">
      <h2 className="font-bold text-[#1E293B] text-sm mb-4">Thao tác nhanh</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {actions.map((act, idx) => (
          <button
            key={idx}
            onClick={() => handleNav(act.url)}
            className="rounded-xl border border-white/70 bg-white/40 p-4 transition-all duration-150 hover:bg-white/70 hover:scale-[1.01] hover:shadow-sm flex items-center gap-3 cursor-pointer text-left w-full group shadow-xs"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 group-hover:scale-[1.03] transition-transform ${act.color}`}>
              <act.icon size={18} />
            </div>
            <span className="text-xs font-bold text-[#1E293B] leading-snug">{act.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
