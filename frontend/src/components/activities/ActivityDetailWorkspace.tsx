'use client';

import React, { useState } from 'react';
import {
  Users, Calendar, ClipboardCheck, ArrowLeft, Crown, Shield, Clock, MapPin, Sparkles, BookOpen, QrCode, Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAttendanceSession } from '@/hooks/useAttendanceSession';
import AttendanceMethodSelector from '@/components/attendance/AttendanceMethodSelector';
import AttendanceSessionStatus from '@/components/attendance/AttendanceSessionStatus';
import QrDisplayPanel from '@/components/attendance/QrDisplayPanel';
import QrScannerModal from '@/components/attendance/QrScannerModal';
import ProximityPanel from '@/components/attendance/ProximityPanel';
import ProximityCheckinButton from '@/components/attendance/ProximityCheckinButton';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { cn } from '@/lib/utils';
import ActivityMemberTable from './ActivityMemberTable';
import ActivityScheduleTimeline from './ActivityScheduleTimeline';
import { getActivityCategoryLabel } from './activity-view-policy';

const getImageUrl = (url?: string) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return url;
};

const categoryConfigs: Record<string, {
  label: string;
  gradient: string;
  bg: string;
  text: string;
  border: string;
  heroGradient: string;
  badge: string;
}> = {
  academic: {
    label: 'Học thuật',
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-500/10',
    text: 'text-blue-600',
    border: 'border-blue-500/20',
    heroGradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    badge: 'ACADEMIC HUB',
  },
  sports: {
    label: 'Thể thao',
    gradient: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    border: 'border-emerald-500/20',
    heroGradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    badge: 'SPORTS HUB',
  },
  art: {
    label: 'Nghệ thuật',
    gradient: 'from-purple-500 to-pink-600',
    bg: 'bg-purple-500/10',
    text: 'text-purple-600',
    border: 'border-purple-500/20',
    heroGradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    badge: 'ART HUB',
  },
  volunteer: {
    label: 'Tình nguyện',
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    border: 'border-amber-500/20',
    heroGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
    badge: 'VOLUNTEER HUB',
  },
  technology: {
    label: 'Công nghệ',
    gradient: 'from-cyan-500 to-blue-600',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600',
    border: 'border-cyan-500/20',
    heroGradient: 'linear-gradient(135deg, #0891b2 0%, #0369a1 100%)',
    badge: 'RESEARCH HUB',
  },
  other: {
    label: 'Khác',
    gradient: 'from-slate-500 to-gray-600',
    bg: 'bg-slate-500/10',
    text: 'text-slate-600',
    border: 'border-slate-500/20',
    heroGradient: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
    badge: 'COMMUNITY HUB',
  },
};

interface ActivityDetailWorkspaceProps {
  activity: any;
  members: any[];
  schedules: any[];
  loading: boolean;
  myMembershipStatus: string;
  activeTab: 'info' | 'members' | 'schedules' | 'attendance';
  setActiveTab: (tab: 'info' | 'members' | 'schedules' | 'attendance') => void;
  isAdminOrAdvisor: boolean;
  isStudent: boolean;
  onJoinClick: () => void;
  onLeaveClick: () => void;
  onApproveMember: (memberId: string) => Promise<void>;
  onRejectMember: (memberId: string) => Promise<void>;
  onUpdateMemberRole: (memberId: string, newRole: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onCreateSchedule: (data: any) => Promise<void>;
  onDeleteSchedule: (scheduleId: string) => Promise<void>;
  onBackClick: () => void;
  studentsList?: any[];
  semestersList?: any[];
  selectedStudentId?: string;
  setSelectedStudentId?: (id: string) => void;
  selectedSemesterId?: string;
  setSelectedSemesterId?: (id: string) => void;
  onAdminTransfer?: () => Promise<void>;
  adminTransferLoading?: boolean;
  showLeaveConfirm: boolean;
  setShowLeaveConfirm: (show: boolean) => void;
  leaveLoading?: boolean;
  showRejectionModal: boolean;
  setShowRejectionModal: (show: boolean) => void;
}

export default function ActivityDetailWorkspace({
  activity,
  members,
  schedules,
  loading,
  myMembershipStatus,
  activeTab,
  setActiveTab,
  isAdminOrAdvisor,
  isStudent,
  onJoinClick,
  onLeaveClick,
  onApproveMember,
  onRejectMember,
  onUpdateMemberRole,
  onRemoveMember,
  onCreateSchedule,
  onDeleteSchedule,
  onBackClick,
  studentsList = [],
  semestersList = [],
  selectedStudentId = '',
  setSelectedStudentId,
  selectedSemesterId = '',
  setSelectedSemesterId,
  onAdminTransfer,
  adminTransferLoading = false,
  showLeaveConfirm,
  setShowLeaveConfirm,
  leaveLoading = false,
  showRejectionModal,
  setShowRejectionModal,
}: ActivityDetailWorkspaceProps) {
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  if (loading || !activity) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-xs font-semibold text-slate-500">Đang tải chi tiết hoạt động...</span>
      </div>
    );
  }

  const conf = categoryConfigs[activity.category] || categoryConfigs.other;
  const isClub = activity.activity_type === 'club';

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBackClick}
        className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} /> Quay lại danh sách
      </button>

      {/* Hero Banner */}
      <div 
        className="relative rounded-3xl overflow-hidden shadow-lg border border-white/60 p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 justify-between text-white"
        style={{
          backgroundImage: activity.cover_url ? `url(${getImageUrl(activity.cover_url)})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#3B82F6', // fallback
        }}
      >
        <div className="absolute inset-0 bg-slate-900/40 pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-center gap-5 z-10 text-center md:text-left">
          {activity.logo_url && (
            <img 
              src={getImageUrl(activity.logo_url)} 
              alt="Logo" 
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-white/80 object-cover shadow-md bg-white shrink-0"
            />
          )}
          <div>
            <span className="px-2 py-0.5 rounded-lg bg-white/20 border border-white/30 text-[9px] font-black uppercase tracking-wider">
              {conf.badge}
            </span>
            <h2 className="text-xl md:text-2xl font-black mt-1.5 leading-tight">{activity.name}</h2>
            <p className="text-xs text-white/80 font-bold mt-1">
              Mã: {activity.code} · Phòng: {activity.classroom}
            </p>
          </div>
        </div>

        {/* Join/Leave Button for Student */}
        {isStudent && (
          <div className="relative z-10 shrink-0">
            {myMembershipStatus === 'none' && (
              <Button
                onClick={onJoinClick}
                className="px-6 py-3 bg-white text-blue-600 font-extrabold text-xs rounded-xl hover:bg-slate-50 transition-all cursor-pointer shadow-md"
              >
                Đăng ký tham gia
              </Button>
            )}
            {myMembershipStatus === 'pending' && (
              <span className="px-4 py-2 rounded-xl bg-amber-500/25 border border-amber-400 text-amber-200 text-xs font-bold shadow-inner">
                Đang chờ phê duyệt
              </span>
            )}
            {myMembershipStatus === 'active' && (
              <Button
                onClick={onLeaveClick}
                className="px-5 py-2.5 bg-red-600 text-white font-extrabold text-xs rounded-xl hover:bg-red-750 transition-all cursor-pointer shadow-md"
              >
                Rời hoạt động
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs list */}
      <div className="flex gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab('info')}
          className={cn(
            "px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
            activeTab === 'info' ? "border-blue-500 text-blue-600 font-extrabold" : "border-transparent text-slate-555 hover:text-slate-800"
          )}
        >
          Thông tin chung
        </button>
        {(!isStudent || myMembershipStatus === 'active') && (
          <button
            onClick={() => setActiveTab('members')}
            className={cn(
              "px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'members' ? "border-blue-500 text-blue-600 font-extrabold" : "border-transparent text-slate-555 hover:text-slate-800"
            )}
          >
            Thành viên ({members.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('schedules')}
          className={cn(
            "px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
            activeTab === 'schedules' ? "border-blue-500 text-blue-600 font-extrabold" : "border-transparent text-slate-555 hover:text-slate-800"
          )}
        >
          Lịch hoạt động ({schedules.length})
        </button>
        {isAdminOrAdvisor && (
          <button
            onClick={() => setActiveTab('attendance')}
            className={cn(
              "px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
              activeTab === 'attendance' ? "border-blue-500 text-blue-600 font-extrabold" : "border-transparent text-slate-555 hover:text-slate-800"
            )}
          >
            Điểm danh
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Description */}
            <div className="lg:col-span-2 backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-800">Giới thiệu hoạt động</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                {activity.description || 'Chưa có thông tin mô tả chi tiết cho hoạt động này.'}
              </p>
            </div>

            {/* General details */}
            <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold text-slate-800">Thông tin chi tiết</h3>
              <div className="divide-y divide-slate-100">
                <InfoItem label="Phân loại" value={getActivityCategoryLabel(activity.category)} />
                <InfoItem label="Phòng hoạt động" value={activity.classroom || '—'} />
                <InfoItem label="Cố vấn" value={activity.advisor_id?.full_name || 'Chưa phân công'} />
                {isClub && (
                  <InfoItem label="Chủ nhiệm" value={activity.president_id?.full_name || 'Chưa phân công'} />
                )}
                <InfoItem label="Ngày bắt đầu" value={activity.activity_start_date ? new Date(activity.activity_start_date).toLocaleDateString('vi-VN') : '—'} />
                <InfoItem label="Ngày kết thúc" value={activity.activity_end_date ? new Date(activity.activity_end_date).toLocaleDateString('vi-VN') : '—'} />
              </div>
            </div>

            {/* Admin Direct Transfer (Club Officer Only) */}
            {isAdminOrAdvisor && isClub && setSelectedStudentId && setSelectedSemesterId && onAdminTransfer && (
              <div className="lg:col-span-3 backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="pb-3 border-b border-white/50">
                  <h3 className="text-sm font-bold text-slate-800">Bổ nhiệm trực tiếp Ban chủ nhiệm CLB</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Chỉ dành cho Admin & Giảng viên cố vấn.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Chọn Sinh viên</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full text-xs font-bold text-slate-700 p-2.5 rounded-xl border border-slate-200 bg-white/85 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn sinh viên bổ nhiệm --</option>
                      {studentsList.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.full_name} ({s.student_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Chọn Học kỳ</label>
                    <select
                      value={selectedSemesterId}
                      onChange={(e) => setSelectedSemesterId(e.target.value)}
                      className="w-full text-xs font-bold text-slate-700 p-2.5 rounded-xl border border-slate-200 bg-white/85 shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-- Chọn học kỳ áp dụng --</option>
                      {semestersList.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.semester_name || s.name} {s.status === 'active' ? '(Hiện tại)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={onAdminTransfer}
                    disabled={adminTransferLoading}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {adminTransferLoading ? 'Đang bổ nhiệm...' : 'Xác nhận bổ nhiệm'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <h3 className="text-sm font-extrabold text-slate-800">Thành viên tham gia hoạt động</h3>
            </div>
            <ActivityMemberTable
              members={members}
              onApprove={onApproveMember}
              onReject={onRejectMember}
              onUpdateRole={onUpdateMemberRole}
              onRemove={onRemoveMember}
              isAdminOrAdvisor={isAdminOrAdvisor}
            />
          </div>
        )}

        {activeTab === 'schedules' && (
          <div className="backdrop-blur-md bg-white/45 border border-white/70 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="pb-3 border-b border-white/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800">Lịch hoạt động chi tiết</h3>
            </div>
            <ActivityScheduleTimeline
              schedules={schedules}
              isAdminOrAdvisor={isAdminOrAdvisor}
              isStudent={isStudent}
              onCreateSchedule={onCreateSchedule}
              onDeleteSchedule={onDeleteSchedule}
            />
          </div>
        )}

        {activeTab === 'attendance' && (
          <ActivityAttendanceTab
            activityId={activity._id}
            activity={activity}
            schedules={schedules}
            showMethodSelector={showMethodSelector}
            setShowMethodSelector={setShowMethodSelector}
            showQrScanner={showQrScanner}
            setShowQrScanner={setShowQrScanner}
          />
        )}
      </div>

      {/* Leave Confirmation Modal */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={onLeaveClick}
        title="Xác nhận rời hoạt động"
        message={`Bạn có chắc chắn muốn rời khỏi hoạt động "${activity.name}"?`}
        confirmLabel={leaveLoading ? 'Đang rời...' : 'Rời hoạt động'}
        cancelLabel="Hủy"
        variant="danger"
      />

      {/* Rejection Modal */}
      <ConfirmModal
        isOpen={showRejectionModal}
        onClose={() => setShowRejectionModal(false)}
        onConfirm={() => setShowRejectionModal(false)}
        title="Đăng ký bị từ chối"
        message="Yêu cầu tham gia của bạn đã bị từ chối."
        confirmLabel="Đóng"
        showCancel={false}
        variant="danger"
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-200/20 last:border-b-0 text-xs font-semibold">
      <span className="text-slate-450">{label}</span>
      <span className="text-slate-800 font-bold">{value}</span>
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
