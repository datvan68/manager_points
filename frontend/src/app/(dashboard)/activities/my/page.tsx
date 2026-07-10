'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { isStudentRole } from '@/utils/role.util';
import {
  activityApi,
  activityScheduleApi,
  activityAttendanceApi,
  activityCompletionRuleApi,
  ActivityMember,
  ActivitySchedule,
  ActivityCompletionRule,
  Activity
} from '@/api/activity-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { academicRecordApi, AcademicRecord } from '@/api/academic-record-api';
import { toast } from 'sonner';
import { Sparkles, Calendar, Award, GraduationCap, Compass, BookOpen, Clock, AlertCircle, MapPin } from 'lucide-react';
import StudentActivityCard from '@/components/activities/StudentActivityCard';
import { Button } from '@/components/ui/button';

export default function MyActivitiesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  
  const [myMemberships, setMyMemberships] = useState<ActivityMember[]>([]);
  const [myAttendances, setMyAttendances] = useState<any[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [rules, setRules] = useState<ActivityCompletionRule[]>([]);
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<ActivitySchedule[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Authenticate student role
  useEffect(() => {
    if (!authLoading && user && !isStudentRole(user)) {
      toast.error('Trang này chỉ dành cho Sinh viên');
      router.push('/activities');
    }
  }, [user, authLoading]);

  // Load Initial Semesters
  useEffect(() => {
    async function loadSemesters() {
      try {
        const list = await semesterApi.getSemesters();
        setSemesters(list);
        
        // Default to active semester, or the first one
        const activeSem = list.find(s => s.status === 'active') || list[0];
        if (activeSem) {
          setSelectedSemesterId(activeSem._id);
        }
      } catch {
        toast.error('Lỗi khi tải học kỳ');
      }
    }
    loadSemesters();
  }, []);

  // Load Dashboard Data based on selected semester
  const loadDashboardData = async () => {
    if (!selectedSemesterId || !user?.studentId) return;
    setLoading(true);
    try {
      const [membershipsData, activitiesData, attendancesData, rulesData, recordsData, schedulesData] = await Promise.all([
        activityApi.getMyActivities().catch(() => []),
        activityApi.getAll({ semester_id: selectedSemesterId }).catch(() => []),
        activityAttendanceApi.getMyAttendance({ semester_id: selectedSemesterId }).catch(() => []),
        activityCompletionRuleApi.getAll().catch(() => []),
        academicRecordApi.getAcademicRecords({ studentId: user.studentId, semesterId: selectedSemesterId }).catch(() => []),
        activityScheduleApi.getMySchedules().catch(() => []),
      ]);

      setMyMemberships(membershipsData);
      setAllActivities(activitiesData);
      setMyAttendances(attendancesData);
      setRules(rulesData);
      
      const recordsList = Array.isArray(recordsData) ? recordsData : (recordsData as any).data || [];
      setRecords(recordsList);

      // Filter upcoming schedules for activities student has joined
      const joinedActivityIds = membershipsData
        .filter(m => m.status === 'active')
        .map(m => typeof m.club_id === 'object' ? m.club_id?._id : m.club_id);

      const filteredSchedules = schedulesData
        .filter((sch: any) => {
          const schClubId = typeof sch.club_id === 'object' ? sch.club_id?._id : sch.club_id;
          const schSemId = typeof sch.semester_id === 'object' ? sch.semester_id?._id : sch.semester_id;
          
          return joinedActivityIds.includes(schClubId) && 
                 schSemId === selectedSemesterId &&
                 new Date(sch.start_time) >= new Date();
        })
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      setUpcomingSchedules(filteredSchedules.slice(0, 5));
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tải dữ liệu hoạt động cá nhân');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSemesterId && user?.studentId) {
      loadDashboardData();
    }
  }, [selectedSemesterId, user]);

  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-100 rounded-xl w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-44 bg-slate-100 rounded-2xl" />
              <div className="h-44 bg-slate-100 rounded-2xl" />
            </div>
          </div>
          <div className="h-80 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Active student memberships in the selected semester
  const joinedMemberships = myMemberships.filter(m => {
    const memSemId = typeof m.semester_id === 'object' ? m.semester_id?._id : m.semester_id;
    return memSemId === selectedSemesterId;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Sparkles size={22} className="text-blue-500" />
            Hoạt động của tôi
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Theo dõi tiến độ điểm danh và lịch sinh hoạt của các hoạt động bạn đã đăng ký
          </p>
        </div>

        {/* Semester select */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Học kỳ:</label>
          <select
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            className="h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
          >
            {semesters.map(s => (
              <option key={s._id} value={s._id}>
                {s.semester_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Joined activities */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Compass className="text-blue-500" size={18} />
            <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">Hoạt động đang tham gia</h2>
          </div>

          {joinedMemberships.length === 0 ? (
            <div className="py-12 text-center bg-white/40 border border-slate-100 rounded-2xl">
              <BookOpen size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">Bạn chưa tham gia hoạt động nào trong học kỳ này</p>
              <Button
                onClick={() => router.push('/activities')}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 cursor-pointer"
              >
                Khám phá các hoạt động
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {joinedMemberships.map((membership) => {
                const actId = typeof membership.club_id === 'object' ? membership.club_id?._id : membership.club_id;
                
                // Find matching activity
                const activity = allActivities.find(a => a._id === actId) || (membership.club_id as Activity);
                if (!activity) return null;

                // Compute present/late count
                const attendanceCount = myAttendances.filter(
                  (att) => {
                    const attClubId = typeof att.club_id === 'object' ? att.club_id?._id : att.club_id;
                    return attClubId === actId && 
                           att.approval_status === 'approved' && 
                           (att.status === 'present' || att.status === 'late');
                  }
                ).length;

                // Find completion rule
                const rule = rules.find((r: any) => {
                  const rClubId = typeof r.club_id === 'object' ? r.club_id?._id : r.club_id;
                  const rSemId = typeof r.semester_id === 'object' ? r.semester_id?._id : r.semester_id;
                  return rClubId === actId && rSemId === selectedSemesterId;
                });
                
                const minAttendance = rule?.minimum_attendance || 0;

                // Check if completed (rewarded in AcademicRecord)
                const isCompleted = records.some(
                  rec => rec.source_type === 'activity_completion' && 
                         (typeof rec.student_id === 'object' ? rec.student_id?._id : rec.student_id) === user?.studentId &&
                         rec.status === 'active' &&
                         (typeof rec.source_id === 'object' ? rec.source_id?._id : rec.source_id) === actId
                );

                return (
                  <StudentActivityCard
                    key={membership._id}
                    activity={activity}
                    memberStatus={membership.status}
                    attendanceCount={attendanceCount}
                    minAttendanceRequired={minAttendance}
                    isCompleted={isCompleted}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Upcoming schedules */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Calendar className="text-indigo-500" size={18} />
            <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">Lịch sinh hoạt sắp tới</h2>
          </div>

          <div className="bg-white/50 backdrop-blur-md border border-white/60 p-5 rounded-2xl shadow-sm space-y-4">
            {upcomingSchedules.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400">
                Chưa có buổi sinh hoạt nào sắp diễn ra
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingSchedules.map((schedule) => {
                  const date = new Date(schedule.start_time);
                  const dateLabel = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
                  const timeLabel = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                  const activityName = typeof schedule.club_id === 'object' ? (schedule.club_id as any).name : 'Hoạt động';

                  return (
                    <div key={schedule._id} className="flex gap-3 items-start border-b border-slate-100/50 pb-3 last:border-0 last:pb-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex flex-col items-center justify-center shrink-0 border border-blue-100">
                        <span className="text-[10px] font-black">{dateLabel}</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-700 truncate">{schedule.title}</h4>
                        <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{activityName}</p>
                        
                        <div className="flex gap-3 text-[9px] text-slate-400 font-bold mt-1">
                          <span className="flex items-center gap-0.5">
                            <Clock size={10} />
                            {timeLabel}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <MapPin size={10} className="shrink-0" />
                            <span className="truncate">{schedule.location || '—'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
