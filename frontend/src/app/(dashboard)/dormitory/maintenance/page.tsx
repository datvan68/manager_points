'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Wrench, Search, Settings } from 'lucide-react';
import { dormitoryApi, DormMaintenance } from '@/api/dormitory-api';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  'Mới': 'bg-blue-100 text-blue-700',
  'Đang xử lý': 'bg-amber-100 text-amber-700',
  'Hoàn tất': 'bg-green-100 text-green-700',
  'Từ chối': 'bg-red-100 text-red-700',
};
const priorityColors: Record<string, string> = {
  'Thấp': 'bg-gray-100 text-gray-600',
  'Trung bình': 'bg-blue-100 text-blue-600',
  'Cao': 'bg-orange-100 text-orange-700',
  'Khẩn cấp': 'bg-red-100 text-red-700',
};

export default function MaintenancePage() {
  const [items, setItems] = useState<DormMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState<any>(null);
  const [handleId, setHandleId] = useState<string | null>(null);
  const [handleForm, setHandleForm] = useState({ trang_thai: 'Đang xử lý', ghi_chu_xu_ly: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dormitoryApi.maintenance.getAll({ trang_thai: filterStatus || undefined, search: search || undefined, limit: 50 });
      setItems(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải danh sách bảo trì');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  async function submitHandle() {
    if (!handleId) return;
    try {
      await dormitoryApi.maintenance.handle(handleId, handleForm);
      toast.success('Cập nhật yêu cầu bảo trì thành công');
      setHandleId(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi cập nhật');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-800">Bảo trì thiết bị</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">Tất cả</option>
            <option value="Mới">Mới</option>
            <option value="Đang xử lý">Đang xử lý</option>
            <option value="Hoàn tất">Hoàn tất</option>
            <option value="Từ chối">Từ chối</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-3 text-left font-medium text-gray-600">Mã YC</th>
                <th className="p-3 text-left font-medium text-gray-600">Phòng</th>
                <th className="p-3 text-left font-medium text-gray-600">Người báo</th>
                <th className="p-3 text-left font-medium text-gray-600">Loại sự cố</th>
                <th className="p-3 text-left font-medium text-gray-600">Mô tả</th>
                <th className="p-3 text-left font-medium text-gray-600">Ưu tiên</th>
                <th className="p-3 text-left font-medium text-gray-600">Trạng thái</th>
                <th className="p-3 text-center font-medium text-gray-600">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 8 }).map((_, j) => <td key={j} className="p-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Không có yêu cầu bảo trì nào</td></tr>
              ) : items.map(m => (
                <tr key={m._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-3 font-mono text-xs">{m.ma_ycbt}</td>
                  <td className="p-3 text-gray-600">{m.room_id?.ma_phong || '—'}</td>
                  <td className="p-3">
                    <div className="font-medium text-gray-800 text-xs">{m.student_id?.full_name || '—'}</div>
                  </td>
                  <td className="p-3 text-gray-600 text-xs">{m.loai_su_co}</td>
                  <td className="p-3 text-gray-600 text-xs max-w-[200px] truncate">{m.mo_ta}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[m.do_uu_tien] || ''}`}>{m.do_uu_tien}</span></td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[m.trang_thai] || ''}`}>{m.trang_thai}</span></td>
                  <td className="p-3 text-center">
                    {m.trang_thai !== 'Hoàn tất' && m.trang_thai !== 'Từ chối' && (
                      <button onClick={() => { setHandleId(m._id); setHandleForm({ trang_thai: m.trang_thai === 'Mới' ? 'Đang xử lý' : 'Hoàn tất', ghi_chu_xu_ly: '' }); }}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Cập nhật">
                        <Settings size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">Hiển thị {items.length} / {meta.total} yêu cầu</div>}
      </div>

      {handleId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setHandleId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Cập nhật yêu cầu bảo trì</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                <select value={handleForm.trang_thai} onChange={e => setHandleForm(f => ({ ...f, trang_thai: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="Mới">Mới</option>
                  <option value="Đang xử lý">Đang xử lý</option>
                  <option value="Hoàn tất">Hoàn tất</option>
                  <option value="Từ chối">Từ chối</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú xử lý</label>
                <textarea value={handleForm.ghi_chu_xu_ly} onChange={e => setHandleForm(f => ({ ...f, ghi_chu_xu_ly: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" rows={3} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setHandleId(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Hủy</button>
                <button onClick={submitHandle} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Cập nhật</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
