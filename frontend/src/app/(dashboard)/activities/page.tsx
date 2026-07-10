'use client';

import React, { useEffect, useState } from 'react';
import { activityApi, Activity } from '@/api/activity-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { isTeacherRole } from '@/utils/role.util';
import { toast } from 'sonner';
import { Plus, Search, Filter, RefreshCw, LayoutGrid, List, Sparkles, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ActivityForm from '@/components/activities/ActivityForm';
import Link from 'next/link';

const typeLabels: Record<string, string> = {
  club: 'Câu lạc bộ',
  event: 'Sự kiện',
  activity: 'Hoạt động',
  festival: 'Lễ hội',
};

const categoryLabels: Record<string, string> = {
  academic: 'Học thuật',
  sports: 'Thể thao',
  art: 'Nghệ thuật',
  volunteer: 'Tình nguyện',
  technology: 'Công nghệ',
  other: 'Khác',
};

const statusLabels: Record<string, string> = {
  draft: 'Bản nháp',
  published: 'Hoạt động',
  completed: 'Đã kết thúc',
  cancelled: 'Đã hủy',
};

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  published: 'bg-emerald-100 text-emerald-600 border-emerald-200',
  completed: 'bg-blue-100 text-blue-600 border-blue-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
};

export default function ActivitiesPage() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal controllers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  
  const canManage = isAdminUser(user) || isTeacherRole(user);

  const loadData = async () => {
    setLoading(true);
    try {
      const [activitiesList, semestersList] = await Promise.all([
        activityApi.getAll().catch(() => []),
        semesterApi.getSemesters().catch(() => []),
      ]);
      setActivities(activitiesList);
      setSemesters(semestersList);
    } catch {
      toast.error('Lỗi khi tải danh sách hoạt động');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateActivity = async (data: any) => {
    setSaving(true);
    try {
      await activityApi.create(data);
      toast.success('Tạo hoạt động thành công');
      setShowCreateModal(false);
      loadData();
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

  const handleDeleteActivity = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa hoạt động này?')) return;
    try {
      await activityApi.delete(id);
      toast.success('Đã xóa hoạt động thành công');
      loadData();
    } catch {
      toast.error('Lỗi khi xóa hoạt động');
    }
  };

  // Filtration logic on client side for smoother experience
  const filteredActivities = activities.filter(act => {
    const matchSearch = act.name.toLowerCase().includes(search.toLowerCase()) || 
                        act.code.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || act.activity_type === typeFilter;
    const matchSemester = semesterFilter === 'all' || 
                          (typeof act.semester_id === 'object' 
                            ? act.semester_id?._id === semesterFilter 
                            : act.semester_id === semesterFilter);
    const matchStatus = statusFilter === 'all' || act.participation_status === statusFilter;
    
    return matchSearch && matchType && matchSemester && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Sparkles size={22} className="text-blue-500 animate-pulse" />
            Quản lý Hoạt động
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Danh sách câu lạc bộ, sự kiện rèn luyện và lễ hội trong hệ thống
          </p>
        </div>

        <div className="flex gap-2">
          {canManage && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-750 text-white rounded-xl shadow-md cursor-pointer"
            >
              <Plus size={16} />
              Tạo hoạt động
            </Button>
          )}
          <Button
            variant="outline"
            onClick={loadData}
            className="w-10 h-10 p-0 border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white/60 backdrop-blur-md border border-white/70 p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
        {/* Search bar */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Tìm kiếm</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Tên hoặc mã hoạt động..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-3 text-slate-400" size={14} />
          </div>
        </div>

        {/* Type filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Loại hoạt động</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none"
          >
            <option value="all">Tất cả loại hình</option>
            <option value="club">Câu lạc bộ</option>
            <option value="event">Sự kiện</option>
            <option value="activity">Hoạt động khác</option>
            <option value="festival">Lễ hội</option>
          </select>
        </div>

        {/* Semester filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Học kỳ</label>
          <select
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none"
          >
            <option value="all">Tất cả học kỳ</option>
            {semesters.map(sem => (
              <option key={sem._id} value={sem._id}>
                {sem.semester_name}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white/50 focus:outline-none"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="draft">Bản nháp</option>
            <option value="published">Đang hoạt động</option>
            <option value="completed">Đã kết thúc</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-slate-100/60 rounded-2xl animate-pulse border border-slate-100" />
          ))}
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="py-16 text-center bg-white/40 border border-slate-100 rounded-2xl">
          <Filter size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-500">Không tìm thấy hoạt động nào phù hợp</p>
          <p className="text-xs text-slate-400 mt-1">Hãy thử thay đổi bộ lọc hoặc tạo hoạt động mới</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredActivities.map((act) => {
            const isDraft = act.participation_status === 'draft';
            return (
              <div
                key={act._id}
                className="group relative overflow-hidden bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl p-5 shadow-sm hover:shadow-md hover:scale-[1.01] hover:bg-white/80 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Category & Status Badges */}
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 text-[10px] font-bold uppercase tracking-wide">
                      {typeLabels[act.activity_type] || act.activity_type}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-bold ${statusColors[act.participation_status]}`}>
                      {statusLabels[act.participation_status] || act.participation_status}
                    </span>
                  </div>

                  {/* Title & Info */}
                  <div>
                    <Link href={`/activities/${act._id}`} className="font-extrabold text-slate-700 hover:text-blue-600 transition-colors line-clamp-1 block">
                      {act.name}
                    </Link>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Mã: {act.code} · Phòng: {act.classroom}
                    </p>
                  </div>

                  {act.description && (
                    <p className="text-xs text-slate-400 font-semibold line-clamp-2">{act.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100/60">
                  <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[150px]">
                    Cố vấn: {act.advisor_id?.full_name || act.advisor_id?.user_name || 'Chưa phân công'}
                  </span>

                  <div className="flex gap-2">
                    {canManage && (
                      <>
                        <button
                          onClick={() => setEditingActivity(act)}
                          className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Sửa hoạt động"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(act._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa hoạt động"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <Link
                      href={`/activities/${act._id}`}
                      className="px-3 py-1 bg-slate-100 hover:bg-blue-500 hover:text-white text-slate-600 rounded-lg text-xs font-bold transition-all"
                    >
                      Chi tiết
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl bg-white/90 backdrop-blur-md rounded-2xl border border-white/80 shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-800 uppercase tracking-wider">
              Tạo hoạt động mới
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-medium">
              Vui lòng điền thông tin chi tiết của hoạt động rèn luyện mới vào form dưới đây.
            </DialogDescription>
          </DialogHeader>
          <ActivityForm
            onSubmit={handleCreateActivity}
            onCancel={() => setShowCreateModal(false)}
            saving={saving}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editingActivity !== null} onOpenChange={(open) => !open && setEditingActivity(null)}>
        <DialogContent className="max-w-4xl bg-white/90 backdrop-blur-md rounded-2xl border border-white/80 shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-slate-800 uppercase tracking-wider">
              Cập nhật thông tin hoạt động
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-medium">
              Chỉnh sửa các trường thông tin cho hoạt động {editingActivity?.name}.
            </DialogDescription>
          </DialogHeader>
          {editingActivity && (
            <ActivityForm
              initialData={editingActivity}
              onSubmit={handleUpdateActivity}
              onCancel={() => setEditingActivity(null)}
              saving={saving}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
