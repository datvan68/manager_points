import React from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Building2, 
  Award, 
  Clock, 
  CheckSquare, 
  Bell, 
  ShieldCheck, 
  ShieldAlert, 
  Database, 
  FileText 
} from 'lucide-react';
import { DashboardMetrics } from './dashboard-helpers';

interface KpiGridProps {
  metrics: DashboardMetrics;
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<any>;
  color: string;
  onClick?: () => void;
}

function StatCard({ title, value, description, icon: Icon, color, onClick }: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title}: ${value}`}
      className={`bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-3 sm:p-5 shadow-sm shadow-slate-300/40 hover:scale-[1.01] hover:shadow-md transition-all duration-150 ease-out flex flex-col-reverse sm:flex-row items-center sm:justify-between gap-2 sm:gap-4 min-h-24 sm:min-h-0 text-left ${onClick ? 'cursor-pointer' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] focus-visible:ring-offset-2`}
    >
      <div className="flex-1 min-w-0">
        <span className="hidden sm:block text-[#64748B] text-xs font-semibold tracking-wide mb-1 truncate">{title}</span>
        <h3 className="text-2xl font-black text-[#1E293B] tracking-tight">{value}</h3>
        {description && (
          <p className="hidden sm:block text-[10px] text-[#64748B] mt-1.5 font-medium truncate">{description}</p>
        )}
      </div>
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${color} shrink-0 bg-opacity-10 shadow-sm border border-white/40`}>
        <Icon className="w-5 h-5" />
      </div>
    </button>
  );
}

export default function KpiGrid({ metrics }: KpiGridProps) {
  const { roleScope, kpis } = metrics;
  const router = useRouter();

  // Click handlers for easy navigation
  const handleNav = (path: string) => {
    router.push(path);
  };

  const getKpis = () => {
    const commonKpis = [
      {
        title: "Nhiệm vụ cần làm",
        value: kpis.urgentTasksCount,
        description: kpis.urgentTasksCount > 0 ? "Nhiệm vụ khẩn cấp chưa xong" : "Đã hoàn thành hết",
        icon: CheckSquare,
        color: kpis.urgentTasksCount > 0 ? "bg-amber-500/10 text-amber-700 border-amber-500/20" : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
        onClick: () => handleNav('/students/tasks')
      },
      {
        title: "Thông báo mới",
        value: kpis.unreadNotificationsCount,
        description: kpis.unreadNotificationsCount > 0 ? `${kpis.unreadNotificationsCount} tin nhắn chưa đọc` : "Không có thông báo mới",
        icon: Bell,
        color: kpis.unreadNotificationsCount > 0 ? "bg-red-500/10 text-red-700 border-red-500/20" : "bg-slate-500/10 text-[#64748B] border-slate-500/20",
        onClick: () => handleNav('/notifications')
      }
    ];

    if (roleScope === 'student') {
      const evaluationStatusText = () => {
        switch (kpis.myEvaluationStatus) {
          case 'draft': return 'Bản nháp - Chưa nộp';
          case 'sv_submitted': return 'Chờ giảng viên duyệt';
          case 'gv_reviewed': return 'Chờ admin chốt';
          case 'locked': return 'Đã khóa điểm';
          default: return 'Chưa tạo hồ sơ';
        }
      };

      const evaluationStatusColor = () => {
        switch (kpis.myEvaluationStatus) {
          case 'draft': return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
          case 'sv_submitted': return 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20';
          case 'gv_reviewed': return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
          case 'locked': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
          default: return 'bg-slate-500/10 text-[#64748B] border-slate-500/20';
        }
      };

      return [
        {
          title: "Điểm rèn luyện hiện tại",
          value: kpis.myCurrentScore !== null ? `${kpis.myCurrentScore} / 100` : "Chưa chấm",
          description: kpis.myGrading ? `Xếp loại: ${kpis.myGrading}` : "Chưa xếp loại",
          icon: Award,
          color: "bg-blue-500/10 text-[#1A73E8] border-blue-500/20",
          onClick: () => handleNav('/grading/score')
        },
        {
          title: "Trạng thái tự đánh giá",
          value: kpis.myEvaluationStatus ? (kpis.myEvaluationStatus === 'sv_submitted' ? 'Đã nộp' : kpis.myEvaluationStatus === 'gv_reviewed' ? 'Đã duyệt' : kpis.myEvaluationStatus === 'locked' ? 'Khóa' : 'Nháp') : 'Chưa có',
          description: evaluationStatusText(),
          icon: Clock,
          color: evaluationStatusColor(),
          onClick: () => handleNav('/grading/score')
        },
        ...commonKpis
      ];
    }

    if (roleScope === 'system') {
      const getBackupStatusColor = () => {
        switch (kpis.lastBackupStatus) {
          case 'success': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
          case 'failed': return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
          case 'running': return 'bg-blue-500/10 text-[#1A73E8] border-blue-500/20';
          default: return 'bg-slate-500/10 text-[#64748B] border-slate-500/20';
        }
      };

      const getBackupStatusText = () => {
        if (!kpis.lastBackupStatus) return 'Không có';
        switch (kpis.lastBackupStatus) {
          case 'success': return 'Thành công';
          case 'failed': return 'Thất bại';
          case 'running': return 'Đang chạy';
          default: return 'Đang hàng chờ';
        }
      };

      return [
        {
          title: "Đăng nhập hôm nay (Thành công)",
          value: kpis.todayLoginSuccess,
          description: `Thất bại: ${kpis.todayLoginFailure} lượt`,
          icon: ShieldCheck,
          color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
          onClick: () => handleNav('/system')
        },
        {
          title: "Yêu cầu hệ thống chờ xử lý",
          value: kpis.pendingSystemRequests,
          description: kpis.pendingSystemRequests > 0 ? `${kpis.pendingSystemRequests} yêu cầu pending` : "Không có yêu cầu nào",
          icon: FileText,
          color: kpis.pendingSystemRequests > 0 ? "bg-amber-500/10 text-amber-700 border-amber-500/20" : "bg-slate-500/10 text-[#64748B] border-slate-500/20",
          onClick: () => handleNav('/system')
        },
        {
          title: "Bản sao lưu gần nhất",
          value: getBackupStatusText(),
          description: kpis.lastBackupTime ? new Date(kpis.lastBackupTime).toLocaleString('vi-VN') : 'Chưa sao lưu',
          icon: Database,
          color: getBackupStatusColor(),
          onClick: () => handleNav('/system')
        },
        commonKpis[1] // Notification
      ];
    }

    // Admin or Teacher
    const isTeacher = roleScope === 'teacher';
    return [
      {
        title: isTeacher ? "Sinh viên phụ trách" : "Tổng số sinh viên",
        value: kpis.totalStudents,
        description: `Active trong hệ thống`,
        icon: Users,
        color: "bg-blue-500/10 text-[#1A73E8] border-blue-500/20",
        onClick: () => handleNav('/students')
      },
      {
        title: isTeacher ? "Lớp đang phụ trách" : "Tổng số lớp học",
        value: kpis.totalClasses,
        description: `Quản lý hành chính`,
        icon: Building2,
        color: "bg-purple-500/10 text-purple-700 border-purple-500/20",
        onClick: () => handleNav('/students')
      },
      {
        title: "Điểm rèn luyện trung bình",
        value: kpis.averageScore > 0 ? `${kpis.averageScore} / 100` : "Chưa chấm",
        description: isTeacher ? "Điểm trung bình lớp phụ trách" : "Điểm trung bình toàn trường",
        icon: Award,
        color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
        onClick: () => handleNav('/grading')
      },
      {
        title: isTeacher ? "Hồ sơ chờ phê duyệt" : "Sinh viên cần xử lý",
        value: isTeacher ? kpis.pendingMyReviewCount : kpis.studentAttentionCount,
        description: isTeacher ? (kpis.pendingMyReviewCount > 0 ? `${kpis.pendingMyReviewCount} hồ sơ chờ duyệt` : "Đã duyệt hết") : (kpis.studentAttentionCount > 0 ? `${kpis.studentAttentionCount} sinh viên có trên 3 lượt` : "Không có sinh viên vượt ngưỡng"),
        icon: Clock,
        color: (isTeacher ? kpis.pendingMyReviewCount : kpis.studentAttentionCount) > 0 ? "bg-amber-500/10 text-amber-700 border-amber-500/20" : "bg-slate-500/10 text-[#64748B] border-slate-500/20",
        onClick: () => handleNav(isTeacher ? '/grading/score' : '/grading')
      }
    ];
  };

  const statCards = getKpis();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      {statCards.map((card, i) => (
        <StatCard 
          key={i}
          title={card.title}
          value={card.value}
          description={card.description}
          icon={card.icon}
          color={card.color}
          onClick={card.onClick}
        />
      ))}
    </div>
  );
}
