'use client';

import React, { useEffect, useState } from 'react';
import { activityApi, Activity } from '@/api/activity-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { isTeacherRole } from '@/utils/role.util';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ActivityForm from '@/components/activities/ActivityForm';
import ActivityListWorkspace from '@/components/activities/ActivityListWorkspace';
import ActivityManagementModals from '@/components/activities/ActivityManagementModals';
import ActivityCardDesignModal from '@/components/activities/ActivityCardDesignModal';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActivitiesRealtime } from '@/hooks/useActivitiesRealtime';

export default function ActivitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityType = searchParams.get('activityType') || '';
  const { user, hasPermission } = useAuth();
  const canViewAttendance = isAdminUser(user) || !!hasPermission?.('ACTIVITY_ATTENDANCE_READ');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal controllers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);

  // Join/Delete Modals States
  const [activityPendingDelete, setActivityPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [activityToJoin, setActivityToJoin] = useState<any | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);

  // Card Design Modal State
  const [designTargetActivity, setDesignTargetActivity] = useState<any | null>(null);
  const [designSaving, setDesignSaving] = useState(false);

  // Bulk actions and status selection states
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [bulkConfirmation, setBulkConfirmation] = useState<'deactivate' | 'delete' | null>(null);
  const [pendingStatusActivityIds, setPendingStatusActivityIds] = useState<Record<string, boolean>>({});
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState<Record<string, boolean>>({});

  const canManage = (act?: Activity) => isAdminUser(user) || isTeacherRole(user);

  const loadData = async () => {
    setLoading(true);
    try {
      const activitiesList = await activityApi.getAll().catch(() => []);
      const isStudent = !!user && !isAdminUser(user) && !isTeacherRole(user);
      if (isStudent) {
        const activeClub = activitiesList.find((item) => item.activity_type === 'club' && item.membership_status === 'active');
        setActivities(activeClub
          ? activitiesList.filter((item) =>
              item.activity_type !== 'club'
              || item._id === activeClub._id
              || item.settings?.require_registration_for_attendance === false,
            )
          : activitiesList);
      } else {
        setActivities(activitiesList);
      }
    } catch {
      toast.error('Lỗi khi tải danh sách hoạt động');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([
      loadData(),
      Promise.resolve(semesterApi.getSemesters ? semesterApi.getSemesters() : []).then((items) => setActiveSemester(items.find((item) => item.status === 'active') || null)).catch(() => setActiveSemester(null)),
    ]);
  }, []);
  const handleFavoriteUpdated = React.useCallback((payload: { activity_id: string; favorite_count: number }) => {
    setActivities(prev => prev.map(item => item._id === payload.activity_id ? { ...item, favorite_count: payload.favorite_count } : item));
  }, []);
  useActivitiesRealtime(!!user, loadData, handleFavoriteUpdated);

  const handleCreateActivity = async (data: any) => {
    setSaving(true);
    try {
      const createdActivity = await activityApi.create(data);
      toast.success('Tạo hoạt động thành công');
      setShowCreateModal(false);
      router.push(`/activities/schedule?activityId=${createdActivity._id}`);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tạo hoạt động');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateActivity = async (data: any) => {
    if (!editingActivity) return;
    setSaving(true);
    try {
      await activityApi.update(editingActivity._id, data);
      toast.success('Cập nhật hoạt động thành công');
      setEditingActivity(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật hoạt động');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDesign = async (config: any) => {
    if (!designTargetActivity || designSaving) return;
    setDesignSaving(true);
    try {
      await activityApi.update(designTargetActivity._id, { background_config: config });
      toast.success('Lưu thiết kế thẻ thành công');
      setDesignTargetActivity(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Lỗi khi lưu thiết kế thẻ');
    } finally {
      setDesignSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!activityPendingDelete) return;
    try {
      await activityApi.delete(activityPendingDelete.id);
      toast.success('Đã vô hiệu hóa hoạt động thành công');
      setActivityPendingDelete(null);
      loadData();
    } catch {
      toast.error('Lỗi khi vô hiệu hóa hoạt động');
    }
  };

  const handleJoinConfirm = async () => {
    if (!activityToJoin || joinLoading) return;
    setJoinLoading(true);
    try {
      const activeSemesterId = activityToJoin.semester_id?._id || activityToJoin.semester_id;
      if (!activeSemesterId) {
        toast.error('Không tìm thấy học kỳ hoạt động để đăng ký.');
        return;
      }
      const res = await activityApi.joinActivity(activityToJoin._id, { semester_id: activeSemesterId });
      if (res.membership.status === 'pending') {
        toast.success('Đã gửi yêu cầu tham gia, vui lòng chờ duyệt.');
      } else {
        toast.success('Đăng ký tham gia thành công!');
      }
      setActivities(prev => prev.map(item => {
        if (item._id === activityToJoin._id) {
          return {
            ...item,
            membership_status: res.membership.status as Activity['membership_status']
          };
        }
        return item;
      }));
      setActivityToJoin(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Lỗi đăng ký tham gia');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleFavoriteClick = async (act: any) => {
    if (pendingFavoriteIds[act._id]) return;
    setPendingFavoriteIds(prev => ({ ...prev, [act._id]: true }));
    const wasFavorited = act.is_favorited;
    try {
      let result: { favorite_count: number; is_favorited: boolean };
      if (wasFavorited) {
        result = await activityApi.unfavoriteActivity(act._id);
        toast.success('Đã bỏ yêu thích');
      } else {
        result = await activityApi.favoriteActivity(act._id);
        toast.success('Đã thêm vào yêu thích');
      }
      setActivities(prev => prev.map(item => {
        if (item._id === act._id) {
          const newCount = result.favorite_count;
          return {
            ...item,
            is_favorited: result.is_favorited,
            favorite_count: newCount
          };
        }
        return item;
      }));
    } catch {
      toast.error('Lỗi khi cập nhật yêu thích');
    } finally {
      setPendingFavoriteIds(prev => {
        const next = { ...prev };
        delete next[act._id];
        return next;
      });
    }
  };

  const handleSingleStatusChange = async (id: string, status: 'draft' | 'published' | 'cancelled') => {
    if (pendingStatusActivityIds[id]) return;
    setPendingStatusActivityIds(prev => ({ ...prev, [id]: true }));
    try {
      const updated = await activityApi.update(id, { participation_status: status });
      toast.success('Cập nhật trạng thái hoạt động thành công');
      setActivities(prev => prev.map(act => act._id === id ? { ...act, participation_status: updated.participation_status } : act));
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái hoạt động');
    } finally {
      setPendingStatusActivityIds(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedActivityIds.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        selectedActivityIds.map(id =>
          activityApi.update(id, { participation_status: 'cancelled' })
        )
      );
      toast.success('Vô hiệu hóa các hoạt động thành công');
      setSelectedActivityIds([]);
      setBulkConfirmation(null);
      loadData();
    } catch (err: any) {
      toast.error('Có lỗi xảy ra khi thực hiện vô hiệu hóa hàng loạt');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedActivityIds.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        selectedActivityIds.map(id => activityApi.delete(id))
      );
      toast.success('Xóa hàng loạt hoạt động thành công');
      setSelectedActivityIds([]);
      setBulkConfirmation(null);
      loadData();
    } catch (err: any) {
      toast.error('Có lỗi xảy ra khi thực hiện xóa hàng loạt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 space-y-3 overflow-y-auto h-full custom-scrollbar">
      <ActivityListWorkspace
        activities={activities}
        activityType={activityType}
        onActivityTypeChange={(type) => {
          const newParams = new URLSearchParams(window.location.search);
          if (type) {
            newParams.set('activityType', type);
          } else {
            newParams.delete('activityType');
          }
          router.replace(`/activities?${newParams.toString()}`);
        }}
        loading={loading}
        onJoinClick={(act) => setActivityToJoin(act)}
        onFavoriteClick={handleFavoriteClick}
        onEditClick={(act) => setEditingActivity(act)}
        onDeleteClick={(act) => setActivityPendingDelete({ id: act._id, name: act.name })}
        onCreateClick={() => setShowCreateModal(true)}
        canManage={canManage}
        onNavigateToDetail={(id) => router.push(`/activities/${id}`)}
        onConfigureDesign={(act) => setDesignTargetActivity(act)}
        selectedActivityIds={selectedActivityIds}
        onSelectedActivityIdsChange={setSelectedActivityIds}
        onBulkActionClick={(actionType: 'deactivate' | 'delete') => setBulkConfirmation(actionType)}
        onSingleStatusChange={handleSingleStatusChange}
        onScheduleClick={() => router.push(activityType ? `/activities/schedule?activityType=${activityType}` : '/activities/schedule')}
        onAttendanceClick={() => router.push('/activities/attendance')}
        canViewAttendance={canViewAttendance}
        onRefreshClick={loadData}
        pendingStatusActivityIds={pendingStatusActivityIds}
        activityToJoin={activityToJoin}
        joinLoading={joinLoading}
      />

      {/* Create Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-4xl rounded-2xl overflow-hidden bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 p-6">
            <DialogHeader className="border-b border-white/50 pb-3 mb-4">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-black text-[#1E293B] uppercase tracking-wider">
                <span>{activityType === 'club' ? 'Tạo câu lạc bộ mới' : 'Tạo hoạt động mới'}</span>
                {activeSemester && <span className="text-[11px] font-semibold normal-case text-[#64748B]">{activeSemester.semester_name}</span>}
              </DialogTitle>
            </DialogHeader>
            <ActivityForm
              mode="create"
              initialData={activityType === 'club' ? { activity_type: 'club' } as any : undefined}
              onSubmit={handleCreateActivity}
              onCancel={() => setShowCreateModal(false)}
              saving={saving}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Modal */}
      {editingActivity && (
        <Dialog open={!!editingActivity} onOpenChange={(open) => !open && setEditingActivity(null)}>
          <DialogContent className="max-w-4xl rounded-2xl overflow-hidden bg-white/45 backdrop-blur-md border border-white/70 shadow-sm shadow-slate-300/40 p-6">
            <DialogHeader className="border-b border-white/50 pb-3 mb-4">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-black text-[#1E293B] uppercase tracking-wider">
                <span>Cập nhật hoạt động</span>
                {activeSemester && <span className="text-[11px] font-semibold normal-case text-[#64748B]">{activeSemester.semester_name}</span>}
              </DialogTitle>
            </DialogHeader>
            <ActivityForm
              mode="edit"
              initialData={editingActivity}
              onSubmit={handleUpdateActivity}
              onCancel={() => setEditingActivity(null)}
              saving={saving}
            />
          </DialogContent>
        </Dialog>
      )}

      <ActivityManagementModals
        activityPendingDelete={activityPendingDelete}
        onCloseDelete={() => setActivityPendingDelete(null)}
        onConfirmDelete={handleDeleteConfirm}
        activityToJoin={activityToJoin}
        showJoinConfirm={!!activityToJoin}
        onCloseJoin={() => setActivityToJoin(null)}
        onConfirmJoin={handleJoinConfirm}
        joinLoading={joinLoading}
        showSwitchConfirm={false}
        onCloseSwitch={() => {}}
        onConfirmSwitch={async () => {}}
        bulkActionType={bulkConfirmation}
        selectedCount={selectedActivityIds.length}
        onCloseBulk={() => setBulkConfirmation(null)}
        onConfirmBulk={bulkConfirmation === 'delete' ? handleBulkDelete : handleBulkDeactivate}
      />

      {designTargetActivity && (
        <ActivityCardDesignModal
          open={!!designTargetActivity}
          onClose={() => setDesignTargetActivity(null)}
          initialConfig={designTargetActivity.background_config}
          onSave={handleSaveDesign}
          activityName={designTargetActivity.name}
          activityCode={designTargetActivity.code}
          activityCategory={designTargetActivity.category}
        />
      )}
    </div>
  );
}
