'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Search, Plus, Shield } from 'lucide-react';
import { dormitoryApi, DormViolation } from '@/api/dormitory-api';
import { toast } from 'sonner';

const severityColors: Record<string, string> = {
  'Nhẹ': 'bg-yellow-100 text-yellow-700',
  'Trung bình': 'bg-orange-100 text-orange-700',
  'Nghiêm trọng': 'bg-red-100 text-red-700',
};
const statusColors: Record<string, string> = {
  'Mới': 'bg-blue-100 text-blue-700',
  'Đã xử lý': 'bg-green-100 text-green-700',
  'Đang xét': 'bg-amber-100 text-amber-700',
};

export default function ViolationsPage() {
  const [violations, setViolations] = useState<DormViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState<any>(null);
  const [handleId, setHandleId] = useState<string | null>(null);
  const [handleForm, setHandleForm] = useState({ hinh_thuc_xu_ly: 'Nhắc nhở', ghi_chu_xu_ly: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dormitoryApi.violations.getAll({ trang_thai: filterStatus || undefined, search: search || undefined, limit: 50 });
      setViolations(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải danh sách vi phạm');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  async function submitHandle() {
    if (!handleId) return;
    try {
      await dormitoryApi.violations.handle(handleId, handleForm);
      toast.success('Đã xử lý vi phạm');
      setHandleId(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xử lý vi phạm');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-800">Vi phạm nội quy</h1>
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
            <option value="Đã xử lý">Đã xử lý</option>
            <option value="Đang xét">Đang xét</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-3 text-left font-medium text-gray-600">Mã VP</th>
                <th className="p-3 text-left font-medium text-gray-600">Sinh viên</th>
                <th className="p-3 text-left font-medium text-gray-600">Phòng</th>
                <th className="p-3 text-left font-medium text-gray-600">Loại</th>
                <th className="p-3 text-left font-medium text-gray-600">Mức độ</th>
                <th className="p-3 text-left font-medium text-gray-600">Trạng thái</th>
                <th className="p-3 text-left font-medium text-gray-600">Ngày</th>
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
              ) : violations.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Không có vi phạm nào</td></tr>
              ) : violations.map(v => (
                <tr key={v._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-3 font-mono text-xs">{v.ma_vp}</td>
                  <td className="p-3">
                    <div className="font-medium text-gray-800">{v.student_id?.full_name || '—'}</div>
                    <div className="text-xs text-gray-400">{v.student_id?.student_code || ''}</div>
                  </td>
                  <td className="p-3 text-gray-600">{v.room_id?.ma_phong || '—'}</td>
                  <td className="p-3 text-gray-600 text-xs">{v.loai_vi_pham}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[v.muc_do] || ''}`}>{v.muc_do}</span></td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[v.trang_thai] || ''}`}>{v.trang_thai}</span></td>
                  <td className="p-3 text-gray-500 text-xs">{v.ngay_ghi_nhan ? new Date(v.ngay_ghi_nhan).toLocaleDateString('vi-VN') : '—'}</td>
                  <td className="p-3 text-center">
                    {v.trang_thai !== 'Đã xử lý' && (
                      <button onClick={() => { setHandleId(v._id); setHandleForm({ hinh_thuc_xu_ly: 'Nhắc nhở', ghi_chu_xu_ly: '' }); }}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Xử lý">
                        <Shield size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">Hiển thị {violations.length} / {meta.total} vi phạm</div>}
      </div>

      {handleId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setHandleId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Xử lý vi phạm</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hình thức xử lý</label>
                <select value={handleForm.hinh_thuc_xu_ly} onChange={e => setHandleForm(f => ({ ...f, hinh_thuc_xu_ly: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="Nhắc nhở">Nhắc nhở</option>
                  <option value="Cảnh cáo">Cảnh cáo</option>
                  <option value="Phạt tiền">Phạt tiền</option>
                  <option value="Buộc rời KTX">Buộc rời KTX</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú xử lý</label>
                <textarea value={handleForm.ghi_chu_xu_ly} onChange={e => setHandleForm(f => ({ ...f, ghi_chu_xu_ly: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" rows={3} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setHandleId(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Hủy</button>
                <button onClick={submitHandle} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Xử lý</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
