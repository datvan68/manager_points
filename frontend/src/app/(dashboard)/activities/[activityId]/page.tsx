'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  activityApi,
  activityScheduleApi,
  activityCompletionRuleApi,
  Activity,
  ActivityMember,
  ActivitySchedule,
  ActivityCompletionRule
} from '@/api/activity-api';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { criteriaApi } from '@/api/criteria-api';
import { isTeacherRole, isStudentRole } from '@/utils/role.util';
import { toast } from 'sonner';
import {
  Compass, Calendar, Users, Award, ShieldAlert,
  ChevronLeft, Sparkles, UserCheck, CalendarDays,
  Settings, Clock, MapPin, User, Star, CheckCircle2,
  ClipboardCheck, Radio, QrCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ActivityMemberTable from '@/components/activities/ActivityMemberTable';
import ActivityScheduleTimeline from '@/components/activities/ActivityScheduleTimeline';
import ActivityCompletionRuleForm from '@/components/activities/ActivityCompletionRuleForm';
import { useAttendanceSession } from '@/hooks/useAttendanceSession';
import AttendanceMethodSelector from '@/components/attendance/AttendanceMethodSelector';
import AttendanceSessionStatus from '@/components/attendance/AttendanceSessionStatus';
import QrDisplayPanel from '@/components/attendance/QrDisplayPanel';
import QrScannerModal from '@/components/attendance/QrScannerModal';
import ProximityPanel from '@/components/attendance/ProximityPanel';
import ProximityCheckinButton from '@/components/attendance/ProximityCheckinButton';

const categoryLabels: Record<string, string> = {
  academic: 'Học thuật',
  sports: 'Thể thao',
  art: 'Nghệ thuật',
  volunteer: 'Tình nguyện',
  technology: 'Công nghệ',
  other: 'Khác',
};

const typeLabels: Record<string, string> = {
  club: 'Câu lạc bộ',
  event: 'Sự kiện',
  activity: 'Hoạt động',
  festival: 'Lễ hội',
};

const normalizeEntityId = (value: any) => {
  if (value && typeof value === 'object') {
    return value._id || value.id || '';
  }
  return value || '';
};

const getCriterionLabel = (criterion: any, criteriaById: Record<string, string>) => {
  const id = normalizeEntityId(criterion);

  if (criterion && typeof criterion === 'object') {
    return criterion.criterion_name || criterion.name || criteriaById[id] || id || '';
  }

  return criteriaById[id] || id || '';
};

export default function ActivityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const { user } = useAuth();
  const activityId = params.activityId as string;

  const [activity, setActivity] = useState<Activity | null>(null);
  const [members, setMembers] = useState<ActivityMember[]>([]);
  const [schedules, setSchedules] = useState<ActivitySchedule[]>([]);
  const [completionRule, setCompletionRule] = useState<ActivityCompletionRule | null>(null);
  const [criteriaById, setCriteriaById] = useState<Record<string, string>>({});
  
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'schedule' | 'rule' | 'attendance'>('info');

  useEffect(() => {
    if (tabParam && ['info', 'members', 'schedule', 'rule', 'attendance'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    const newParams = new URLSearchParams(window.location.search);
    newParams.set('tab', tab);
    router.replace(`/activities/${activityId}?${newParams.toString()}`);
  };

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);

  const isAdminOrAdvisor = isAdminUser(user) || isTeacherRole(user);
  const isStudent = isStudentRole(user);


  const loadActivityData = async () => {
    try {
      setLoading(true);
      const [actData, membersData, schedulesResponse, rulesList, criteriaList] = await Promise.all([
        activityApi.getById(activityId),
        activityApi.getMembers(activityId).catch(() => []),
        activityScheduleApi.getActivityTimeline(activityId).catch(() => ({ items: [] } as any)),
        activityCompletionRuleApi.getAll().catch(() => []),
        (async () => criteriaApi.getCriteria())().catch(() => []),
      ]);

      setActivity(actData);
      setMembers(membersData);
      setCriteriaById(
        (Array.isArray(criteriaList) ? criteriaList : []).reduce((acc: Record<string, string>, criterion: any) => {
          if (criterion?._id && criterion?.criterion_name) {
            acc[criterion._id] = criterion.criterion_name;
          }
          return acc;
        }, {})
      );
      
      const timelineItems = Array.isArray(schedulesResponse) 
        ? schedulesResponse 
        : schedulesResponse?.items || [];
      setSchedules(timelineItems);

      // Find the completion rule for this activity
      const rule = rulesList.find((r: any) => {
        const rActivityId = normalizeEntityId(r.activity_id);
        const rSemId = normalizeEntityId(r.semester_id);
        const actSemId = normalizeEntityId(actData.semester_id);
        
        return rActivityId === activityId && rSemId === actSemId;
      });
      setCompletionRule(rule || null);
    } catch (err: any) {
      toast.error('Lỗi khi tải thông tin hoạt động');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activityId) {
      loadActivityData();
    }
  }, [activityId]);

  // Join activity (student)
  const handleJoinActivity = async () => {
    if (!activity) return;
    setJoining(true);
    try {
      const actSemId = typeof activity.semester_id === 'object' 
        ? activity.semester_id?._id 
        : activity.semester_id;

      await activityApi.joinActivity(activityId, { semester_id: actSemId });
      toast.success(
        activity.settings?.require_approval 
          ? 'Gửi yêu cầu tham gia thành công. Vui lòng chờ phê duyệt!' 
          : 'Đăng ký tham gia hoạt động thành công!'
      );
      loadActivityData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi đăng ký tham gia');
    } finally {
      setJoining(false);
    }
  };

  // Member functions
  const handleApproveMember = async (memberId: string) => {
    await activityApi.approveMember(activityId, memberId, { status: 'active' });
    loadActivityData();
  };

  const handleRejectMember = async (memberId: string) => {
    await activityApi.approveMember(activityId, memberId, { status: 'rejected' });
    loadActivityData();
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    await activityApi.updateMember(activityId, memberId, { role: newRole });
    loadActivityData();
  };

  const handleRemoveMember = async (memberId: string) => {
    await activityApi.removeMember(activityId, memberId);
    loadActivityData();
  };

  // Schedule functions
  const handleRegisterSchedule = async (scheduleId: string) => {
    await activityScheduleApi.register(scheduleId, activityId);
    loadActivityData();
  };

  const handleCancelRegisterSchedule = async (scheduleId: string) => {
    await activityScheduleApi.cancelRegistration(scheduleId);
    loadActivityData();
  };

  // Completion Rule functions
  const handleSaveCompletionRule = async (data: any) => {
    try {
      const semesterId = normalizeEntityId(activity?.semester_id);
      const { activity_id, ...rest } = data;
      const payload = {
        ...rest,
        activity_id: activityId,
        semester_id: semesterId,
      };

      if (completionRule) {
        await activityCompletionRuleApi.update(completionRule._id, payload);
        toast.success('Cập nhật quy tắc hoàn thành thành công');
      } else {
        await activityCompletionRuleApi.create(payload);
        toast.success('Thiết lập quy tắc hoàn thành thành công');
      }
      setShowRuleModal(false);
      loadActivityData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu quy tắc hoàn thành');
    }
  };

  // Check registration status of current student
  const studentMembership = members.find(m => {
    const mStudentId = typeof m.student_id === 'object' ? m.student_id?._id : m.student_id;
    const mStudentUserId = typeof m.student_id === 'object' ? m.student_id?.user_id?._id || m.student_id?.user_id : '';
    
    return mStudentId === user?.studentId || mStudentUserId === user?.id;
  });

  const memberStatus = studentMembership?.status || 'none';

  if (loading) {
    return (
      <div className="h-full min-h-0 overflow-y-auto custom-scrollbar pb-12 p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-100 rounded-xl w-32" />
        <div className="h-40 bg-slate-100 rounded-2xl w-full" />
        <div className="h-10 bg-slate-100 rounded-xl w-80" />
        <div className="h-64 bg-slate-100 rounded-2xl w-full" />
      </div>
    );
  }


  if (!activity) {
    return (
      <div className="h-full min-h-0 overflow-y-auto custom-scrollbar pb-12 p-6 text-center">
        <p className="text-sm font-bold text-slate-500">Không tìm thấy thông tin hoạt động</p>
        <Button onClick={() => router.push('/activities')} className="mt-4 cursor-pointer">
          Quay lại danh sách
        </Button>
      </div>
    );
  }


  const actType = typeLabels[activity.activity_type] || activity.activity_type;

  return (
    <div className="h-full min-h-0 overflow-y-auto custom-scrollbar pb-12 p-6 space-y-6">

      {/* Back button */}
      <button
        onClick={() => router.push('/activities')}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors cursor-pointer"
      >
        <ChevronLeft size={16} />
        Danh sách hoạt động
      </button>

      {/* Hero Banner / Cover */}
      <div className="relative overflow-hidden bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
        {/* Cover background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 -z-10" />

        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 font-black text-2xl uppercase">
          {activity.logo_url ? (
            <img src={activity.logo_url} alt={activity.name} className="w-full h-full object-cover rounded-2xl" />
          ) : (
            activity.code.slice(0, 2)
          )}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-200 text-[10px] font-black uppercase tracking-wider">
              {actType}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg bg-slate-500/10 text-slate-600 border border-slate-200 text-[10px] font-bold">
              {categoryLabels[activity.category] || activity.category}
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              Học kỳ: {typeof activity.semester_id === 'object' ? activity.semester_id?.semester_name : '—'}
            </span>
          </div>

          <h1 className="text-xl font-black text-slate-800">{activity.name}</h1>
          
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1">
              <User size={14} className="text-slate-400" />
              Cố vấn: {activity.advisor_id?.full_name || activity.advisor_id?.user_name || 'Chưa phân công'}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={14} className="text-slate-400" />
              Phòng: {activity.classroom}
            </span>
          </div>
        </div>

        {/* Registration Button (For Students) */}
        {isStudent && (
          <div className="shrink-0 self-stretch md:self-center flex items-center">
            {memberStatus === 'none' ? (
              <Button
                onClick={handleJoinActivity}
                disabled={joining}
                className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-750 text-white rounded-xl shadow-md shadow-blue-500/10 font-bold cursor-pointer"
              >
                Đăng ký tham gia
              </Button>
            ) : memberStatus === 'pending' ? (
              <div className="px-4 py-2 bg-amber-500/10 border border-amber-200 text-amber-600 font-bold rounded-xl text-xs flex items-center gap-1.5">
                <Clock size={14} />
                Chờ duyệt tham gia
              </div>
            ) : memberStatus === 'active' ? (
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-200 text-emerald-600 font-bold rounded-xl text-xs flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Đang tham gia hoạt động
              </div>
            ) : (
              <div className="px-4 py-2 bg-red-500/10 border border-red-200 text-red-600 font-bold rounded-xl text-xs">
                Yêu cầu bị từ chối
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200">
        <div className="flex gap-6 overflow-x-auto custom-scrollbar w-full sm:w-auto">
          <button
            onClick={() => handleTabChange('info')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 px-1 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'info'
                ? 'border-blue-500 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Compass size={14} />
            Thông tin chung
          </button>
          <button
            onClick={() => handleTabChange('members')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 px-1 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users size={14} />
            Thành viên ({members.filter(m => m.status === 'active').length})
          </button>
          <button
            onClick={() => handleTabChange('schedule')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 px-1 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'schedule'
                ? 'border-blue-500 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <CalendarDays size={14} />
            Lịch sinh hoạt ({schedules.length})
          </button>
          {(isAdminOrAdvisor || memberStatus === 'active') && (
            <button
              onClick={() => handleTabChange('attendance')}
              className={`pb-3 text-xs font-bold transition-all border-b-2 px-1 cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'attendance'
                  ? 'border-blue-500 text-blue-600 font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <ClipboardCheck size={14} />
              Điểm danh
            </button>
          )}
          <button
            onClick={() => handleTabChange('rule')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 px-1 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rule'
                ? 'border-blue-500 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Award size={14} />
            Quy tắc hoàn thành
          </button>
        </div>
        
        {isAdminOrAdvisor && (
          <Button 
            onClick={() => setShowRuleModal(true)} 
            className="mb-2 shrink-0 h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
          >
             <Settings size={14} className="mr-1.5" /> Cấu hình quy tắc hoàn thành
          </Button>
        )}
      </div>

      {/* Tab contents */}
      <div className="space-y-6">
        {/* Tab 1: Info */}
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Description & metadata */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white/50 backdrop-blur-md border border-white/60 p-5 rounded-2xl space-y-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Giới thiệu hoạt động
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                  {activity.description || 'Chưa có thông tin mô tả chi tiết cho hoạt động này.'}
                </p>
              </div>

              {/* Completion criteria info for students */}
              {isStudent && completionRule && (
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200 p-5 rounded-2xl space-y-3">
                  <h3 className="text-xs font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Award size={16} className="text-rose-500" />
                    Cơ chế tích lũy điểm rèn luyện
                  </h3>
                  <div className="text-xs font-semibold text-slate-700 space-y-1">
                    <p>• Yêu cầu tham gia tối thiểu: <span className="text-blue-600 font-black">{completionRule.minimum_attendance} buổi</span></p>
                    <p>
                      • Tiêu chí cộng điểm:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pl-3 pt-1">
                      {completionRule.criterion_ids?.map((c: any) => (
                        <span key={c._id || c} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-600 text-[10px] font-bold rounded-lg">
                          {c.criterion_name || 'Tiêu chí học bạ'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar metadata */}
            <div className="space-y-6">
              <div className="bg-white/50 backdrop-blur-md border border-white/60 p-5 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Chi tiết hoạt động
                </h3>

                <div className="space-y-3 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Người quản lý:</span>
                    <span className="text-slate-700 font-bold">{activity.president_id?.full_name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Giới hạn thành viên:</span>
                    <span className="text-slate-700 font-bold">
                      {activity.max_members ? `${activity.max_members} người` : 'Không giới hạn'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ngày bắt đầu:</span>
                    <span className="text-slate-700 font-bold">
                      {activity.activity_start_date 
                        ? new Date(activity.activity_start_date).toLocaleDateString('vi-VN') 
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ngày kết thúc:</span>
                    <span className="text-slate-700 font-bold">
                      {activity.activity_end_date 
                        ? new Date(activity.activity_end_date).toLocaleDateString('vi-VN') 
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tự đăng ký:</span>
                    <span className={`font-bold ${activity.settings?.allow_self_registration ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {activity.settings?.allow_self_registration ? 'Cho phép' : 'Khóa'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Members */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">Danh sách thành viên</h2>
            </div>
            <ActivityMemberTable
              members={members}
              onApprove={handleApproveMember}
              onReject={handleRejectMember}
              onUpdateRole={handleUpdateMemberRole}
              onRemove={handleRemoveMember}
              isAdminOrAdvisor={isAdminOrAdvisor}
            />
          </div>
        )}

        {/* Tab 3: Schedules */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">Lịch trình & dòng thời gian</h2>
            </div>
            <ActivityScheduleTimeline
              schedules={schedules}
              onRegister={handleRegisterSchedule}
              onCancelRegistration={handleCancelRegisterSchedule}
              canViewAttendanceRoster={isAdminOrAdvisor}
              canViewOwnAttendance={isStudent && memberStatus === 'active'}
              isAdminOrAdvisor={isAdminOrAdvisor}
              isStudent={isStudent && memberStatus === 'active'}
              onOpenAttendance={() => handleTabChange('attendance')}
            />
          </div>
        )}

        {/* Tab 4: Completion Rules */}
        {activeTab === 'rule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">Thông tin quy tắc hoàn thành</h2>
            </div>
            {completionRule ? (
              <div className="bg-white/50 backdrop-blur-md border border-white/60 p-5 rounded-2xl shadow-sm space-y-4 max-w-2xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Award size={16} className="text-rose-500" />
                      Cơ chế tích lũy điểm rèn luyện
                    </h3>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${completionRule.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {completionRule.status === 'active' ? 'Đang áp dụng' : 'Tạm ngưng'}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-700 space-y-3">
                  <p className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-blue-500" />
                    <span>Yêu cầu tham gia tối thiểu: <span className="text-blue-600 font-black">{completionRule.minimum_attendance} buổi</span></span>
                  </p>
                  <div>
                    <p className="flex items-center gap-2 mb-2">
                      <Star size={16} className="text-amber-500" />
                      <span>Tiêu chí cộng điểm:</span>
                    </p>
                    <div className="flex flex-wrap gap-2 pl-6">
                      {completionRule.criterion_ids?.map((c: any) => (
                        <span key={normalizeEntityId(c)} className="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-bold rounded-xl shadow-sm">
                          {getCriterionLabel(c, criteriaById)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/50 backdrop-blur-md border border-white/60 p-8 rounded-2xl shadow-sm text-center max-w-2xl">
                <Award size={48} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">Chưa có quy tắc hoàn thành nào được thiết lập</p>
                <p className="text-xs text-slate-400 mt-1">Hoạt động này hiện chưa có cơ chế tính điểm rèn luyện tự động.</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Attendance */}
        {activeTab === 'attendance' && (isAdminOrAdvisor || memberStatus === 'active') && (
          <div className="space-y-4">
            <ActivityAttendanceTab
              activityId={activityId}
              activity={activity}
              schedules={schedules}
              showMethodSelector={showMethodSelector}
              setShowMethodSelector={setShowMethodSelector}
              showQrScanner={showQrScanner}
              setShowQrScanner={setShowQrScanner}
            />
          </div>
        )}
      </div>

      <Dialog open={showRuleModal} onOpenChange={setShowRuleModal}>
        <DialogContent className="max-w-3xl bg-slate-50/95 backdrop-blur-xl border border-white shadow-2xl p-0 overflow-hidden rounded-[24px]">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg font-black text-slate-800">
              Cấu hình quy tắc hoàn thành
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
            <ActivityCompletionRuleForm
              initialData={completionRule}
              activityId={activityId}
              semesterId={typeof activity.semester_id === 'object' ? activity.semester_id?._id : activity.semester_id}
              onSubmit={handleSaveCompletionRule}
              onCancel={() => setShowRuleModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Activity Attendance Tab Component ──
function ActivityAttendanceTab({
  activityId,
  activity,
  schedules,
  showMethodSelector,
  setShowMethodSelector,
  showQrScanner,
  setShowQrScanner,
}: {
  activityId: string;
  activity: any;
  schedules: any[];
  showMethodSelector: boolean;
  setShowMethodSelector: (v: boolean) => void;
  showQrScanner: boolean;
  setShowQrScanner: (v: boolean) => void;
}) {
  const attendance = useAttendanceSession({
    contextType: activity.activity_type === 'club' ? 'club' : 'activity',
    contextId: activityId,
    enabled: true,
  });

  const hasActiveSession = attendance.session?.status === 'active';
  const isQrSession = hasActiveSession && attendance.session?.method === 'qr';
  const isProximitySession = hasActiveSession && attendance.session?.method === 'proximity';

  const handleOpenSession = async (params: {
    method: 'qr' | 'proximity';
    latitude?: number;
    longitude?: number;
    radius_meters?: number;
    qr_refresh_interval?: number;
  }) => {
    try {
      await attendance.openSession({
        ...params,
        semester_id: activity.semester_id?._id || activity.semester_id || '',
        title: `Điểm danh hoạt động ${activity.name}`,
      });
      setShowMethodSelector(false);
      toast.success('Đã mở phiên điểm danh thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Không thể mở phiên điểm danh');
    }
  };

  const handleCloseSession = async () => {
    try {
      await attendance.closeSession();
      toast.success('Đã đóng phiên điểm danh');
    } catch {
      toast.error('Không thể đóng phiên');
    }
  };

  return (
    <div className="space-y-6">
      {/* Session Status Bar */}
      {hasActiveSession && attendance.session && (
        <AttendanceSessionStatus
          status={attendance.session.status as any}
          method={attendance.session.method as any}
          checkinCount={attendance.session.checkin_count}
          openedAt={attendance.session.opened_at}
        />
      )}

      {/* No active session */}
      {!hasActiveSession && !showMethodSelector && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-8 shadow-sm text-center max-w-lg mx-auto">
          <ClipboardCheck size={44} className="text-blue-500 mb-4 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-800">Điểm danh hoạt động</h3>
          <p className="text-xs text-slate-450 mt-1.5 mb-6 max-w-sm leading-relaxed font-semibold mx-auto">
            Mở phiên điểm danh bằng QR Code hoặc GPS Proximity để sinh viên tự điểm danh qua thiết bị.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mx-auto">
            <button
              onClick={() => setShowMethodSelector(true)}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Radio size={15} /> Mở điểm danh
            </button>
            <button
              onClick={() => setShowQrScanner(true)}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <QrCode size={15} /> Quét QR
            </button>
          </div>
        </div>
      )}

      {/* Method Selector Modal */}
      {!hasActiveSession && showMethodSelector && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-6 shadow-sm">
          <AttendanceMethodSelector
            onSelect={handleOpenSession}
            loading={attendance.loading}
          />
          <button
            onClick={() => setShowMethodSelector(false)}
            className="w-full mt-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          >
            ← Quay lại
          </button>
        </div>
      )}

      {/* Active QR Session */}
      {isQrSession && attendance.qrData && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl shadow-sm overflow-hidden">
          <QrDisplayPanel
            token={attendance.qrData.token}
            expiresAt={attendance.qrData.expires_at}
            refreshInterval={attendance.qrData.refresh_interval}
            checkinCount={attendance.qrData.checkin_count}
            onClose={handleCloseSession}
            sessionTitle={attendance.session?.title}
          />
        </div>
      )}

      {/* Active Proximity Session */}
      {isProximitySession && attendance.session && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl shadow-sm overflow-hidden">
          <ProximityPanel
            latitude={attendance.session.latitude!}
            longitude={attendance.session.longitude!}
            radiusMeters={attendance.session.radius_meters!}
            checkinCount={attendance.session.checkin_count}
            checkins={attendance.checkins}
            onClose={handleCloseSession}
            sessionTitle={attendance.session.title}
          />
        </div>
      )}

      {/* Student Proximity check-in */}
      {isProximitySession && attendance.session && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl shadow-sm overflow-hidden">
          <ProximityCheckinButton
            sessionLatitude={attendance.session.latitude!}
            sessionLongitude={attendance.session.longitude!}
            sessionRadius={attendance.session.radius_meters!}
            onCheckin={async (lat, lng) => { await attendance.checkinProximity(lat, lng); }}
            checkinStatus={attendance.checkinStatus}
            checkinError={attendance.checkinError}
          />
        </div>
      )}

      {/* Student QR Scanner */}
      {isQrSession && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowQrScanner(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <QrCode size={18} /> Quét mã để điểm danh
          </button>
        </div>
      )}

      {/* Checkins List */}
      {hasActiveSession && attendance.checkins.length > 0 && (
        <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 pb-3 border-b border-white/50 mb-3">
            Đã điểm danh ({attendance.checkins.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {attendance.checkins.map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between px-3 py-2.5 bg-white/60 rounded-xl border border-white/80"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-600 border border-blue-500/20">
                    {(c.student_id?.full_name || '?')[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{c.student_id?.full_name || '—'}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{c.student_id?.student_code || ''}</p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                    {c.method === 'qr' ? 'QR' : 'GPS'}
                  </span>
                  {c.distance_meters != null && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{c.distance_meters}m</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      <QrScannerModal
        open={showQrScanner}
        onClose={() => {
          setShowQrScanner(false);
          attendance.resetCheckinStatus();
        }}
        onScanned={async (token) => {
          await attendance.checkinQr(token);
        }}
        checkinStatus={attendance.checkinStatus}
        checkinError={attendance.checkinError}
        onReset={attendance.resetCheckinStatus}
      />

      {/* Error */}
      {attendance.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600 font-medium">
          {attendance.error}
        </div>
      )}
    </div>
  );
}

