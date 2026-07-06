'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Plus, Trash2, Save, Pencil, RefreshCw } from 'lucide-react';
import { clubConfigApi, clubAttendanceApi, clubApi, AttendanceConfig, Club } from '@/api/club-api';
import { toast } from 'sonner';

export default function ConfigPage() {
  const [configs, setConfigs] = useState<AttendanceConfig[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState({
    club_id: '',
    semester_id: '',
    criterion_id: '',
    point_per_attendance: 0.5,
    point_per_late: 0.25,
    max_points_per_semester: 10,
    min_attendance_for_points: 1,
    auto_sync_on_approve: true,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configsData, clubsData] = await Promise.all([
        clubConfigApi.getAll(),
        clubApi.getAll(),
      ]);
      setConfigs(Array.isArray(configsData) ? configsData : []);
      setClubs(Array.isArray(clubsData) ? clubsData : []);
    } catch { toast.error('Không thể tải cấu hình'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.criterion_id) { toast.error('Vui lòng nhập Criterion ID'); return; }
    try {
      const payload = {
        ...form,
        club_id: form.club_id || undefined,
      };
      if (editId) {
        await clubConfigApi.update(editId, payload);
        toast.success('Đã cập nhật cấu hình');
      } else {
        await clubConfigApi.create(payload);
        toast.success('Đã tạo cấu hình mới');
      }
      setShowForm(false);
      setEditId('');
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi lưu');
    }
  };

  const handleEdit = (config: AttendanceConfig) => {
    setForm({
      club_id: (config.club_id as any)?._id || config.club_id || '',
      semester_id: (config.semester_id as any)?._id || config.semester_id || '',
      criterion_id: (config.criterion_id as any)?._id || config.criterion_id || '',
      point_per_attendance: config.point_per_attendance,
      point_per_late: config.point_per_late,
      max_points_per_semester: config.max_points_per_semester || 10,
      min_attendance_for_points: config.min_attendance_for_points,
      auto_sync_on_approve: config.auto_sync_on_approve,
    });
    setEditId(config._id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa cấu hình này?')) return;
    try {
      await clubConfigApi.delete(id);
      toast.success('Đã xóa');
      loadData();
    } catch { toast.error('Lỗi khi xóa'); }
  };

  const handleSync = async (config: AttendanceConfig) => {
    const clubId = (config.club_id as any)?._id || config.club_id;
    const semesterId = (config.semester_id as any)?._id || config.semester_id;
    if (!semesterId) { toast.error('Thiếu thông tin học kỳ'); return; }

    const target = clubId
      ? `CLB "${(config.club_id as any)?.name || clubId}"`
      : 'tất cả CLB (cấu hình mặc định)';

    if (!confirm(`Sync điểm danh đã duyệt → điểm rèn luyện cho ${target}?`)) return;

    try {
      if (clubId) {
        const result = await clubAttendanceApi.batchSync(clubId, semesterId);
        toast.success(
          `Đã sync: ${result?.synced || 0} bản ghi, bỏ qua: ${result?.skipped || 0}` +
          (result?.errors?.length ? `, lỗi: ${result.errors.length}` : ''),
        );
      } else {
        // Default config — sync all clubs
        const allClubs = clubs.filter(c => c.status === 'active');
        let totalSynced = 0;
        for (const club of allClubs) {
          const result = await clubAttendanceApi.batchSync(club._id, semesterId);
          totalSynced += result?.synced || 0;
        }
        toast.success(`Đã sync ${totalSynced} bản ghi từ ${allClubs.length} CLB`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi sync');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Settings size={20} className="text-blue-500" /> Cấu hình điểm CLB
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Mapping điểm danh → điểm rèn luyện</p>
        </div>
        <button onClick={() => { setEditId(''); setForm({ club_id: '', semester_id: '', criterion_id: '', point_per_attendance: 0.5, point_per_late: 0.25, max_points_per_semester: 10, min_attendance_for_points: 1, auto_sync_on_approve: true }); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 cursor-pointer shadow-md shadow-blue-500/20">
          <Plus size={16} /> Thêm cấu hình
        </button>
      </div>

      {/* Config List */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}</div>
      ) : configs.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Settings size={36} className="text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Chưa có cấu hình nào</p>
          <p className="text-xs text-slate-400 mt-1">Tạo cấu hình để bắt đầu cộng điểm rèn luyện từ CLB</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map(c => (
            <div key={c._id} className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-xl px-4 py-3 flex items-center gap-4 hover:bg-white/80 transition-all">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                <Settings size={18} className="text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700">
                  {(c.club_id as any)?.name || 'Cấu hình mặc định (tất cả CLB)'}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                  <span>Có mặt: <b className="text-emerald-600">{c.point_per_attendance} đ</b></span>
                  <span>Muộn: <b className="text-amber-600">{c.point_per_late} đ</b></span>
                  {c.max_points_per_semester && <span>Tối đa: <b className="text-blue-600">{c.max_points_per_semester} đ/HK</b></span>}
                  <span>Tối thiểu: <b>{c.min_attendance_for_points} buổi</b></span>
                  <span className={c.auto_sync_on_approve ? 'text-emerald-500' : 'text-slate-400'}>
                    {c.auto_sync_on_approve ? '● Auto sync' : '○ Manual sync'}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'}`}>
                {c.status === 'active' ? 'Kích hoạt' : 'Tắt'}
              </span>
              <button onClick={() => handleEdit(c)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-500 cursor-pointer"><Pencil size={14} /></button>
              <button onClick={() => handleSync(c)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-500 cursor-pointer" title="Sync điểm danh → điểm rèn luyện"><RefreshCw size={14} /></button>
              <button onClick={() => handleDelete(c._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">{editId ? 'Sửa cấu hình' : 'Thêm cấu hình mới'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">CLB (để trống = mặc định)</label>
                <select value={form.club_id} onChange={e => setForm({ ...form, club_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Mặc định (tất cả CLB)</option>
                  {clubs.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Semester ID *</label>
                  <input type="text" value={form.semester_id} onChange={e => setForm({ ...form, semester_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Criterion ID *</label>
                  <input type="text" value={form.criterion_id} onChange={e => setForm({ ...form, criterion_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Điểm/buổi (có mặt)</label>
                  <input type="number" step="0.1" min="0" value={form.point_per_attendance}
                    onChange={e => setForm({ ...form, point_per_attendance: +e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Điểm/buổi (muộn)</label>
                  <input type="number" step="0.1" min="0" value={form.point_per_late}
                    onChange={e => setForm({ ...form, point_per_late: +e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tối đa điểm/HK</label>
                  <input type="number" step="0.5" min="0" value={form.max_points_per_semester}
                    onChange={e => setForm({ ...form, max_points_per_semester: +e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tối thiểu buổi</label>
                  <input type="number" min="0" value={form.min_attendance_for_points}
                    onChange={e => setForm({ ...form, min_attendance_for_points: +e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.auto_sync_on_approve}
                  onChange={e => setForm({ ...form, auto_sync_on_approve: e.target.checked })}
                  className="w-4 h-4 rounded accent-blue-500" />
                <span className="text-sm text-slate-600">Tự động sync khi duyệt điểm danh</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-slate-500 cursor-pointer">Hủy</button>
                <button type="submit" className="px-5 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 cursor-pointer shadow-md shadow-blue-500/20">
                  <Save size={14} className="inline mr-1" /> {editId ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
