'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Search, XCircle, CalendarPlus } from 'lucide-react';
import { dormitoryApi, DormContract } from '@/api/dormitory-api';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  'Hiệu lực': 'bg-green-100 text-green-700',
  'Hết hạn': 'bg-gray-100 text-gray-600',
  'Đã hủy': 'bg-red-100 text-red-700',
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<DormContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState<any>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dormitoryApi.contracts.getAll({ trang_thai: filterStatus || undefined, search: search || undefined, limit: 50 });
      setContracts(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải danh sách hợp đồng');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel() {
    if (!cancelId || !cancelReason) return;
    try {
      await dormitoryApi.contracts.cancel(cancelId, cancelReason);
      toast.success('Đã hủy hợp đồng');
      setCancelId(null);
      setCancelReason('');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi hủy hợp đồng');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-800">Hợp đồng KTX</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Tìm mã HĐ..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">Tất cả</option>
            <option value="Hiệu lực">Hiệu lực</option>
            <option value="Hết hạn">Hết hạn</option>
            <option value="Đã hủy">Đã hủy</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-3 text-left font-medium text-gray-600">Mã HĐ</th>
                <th className="p-3 text-left font-medium text-gray-600">Sinh viên</th>
                <th className="p-3 text-left font-medium text-gray-600">Phòng</th>
                <th className="p-3 text-left font-medium text-gray-600">Giường</th>
                <th className="p-3 text-left font-medium text-gray-600">Ngày BĐ</th>
                <th className="p-3 text-left font-medium text-gray-600">Ngày KT</th>
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
              ) : contracts.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Không có hợp đồng nào</td></tr>
              ) : contracts.map(c => (
                <tr key={c._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-3 font-mono text-xs">{c.ma_hd}</td>
                  <td className="p-3">
                    <div className="font-medium text-gray-800">{c.student_id?.full_name || '—'}</div>
                    <div className="text-xs text-gray-400">{c.student_id?.student_code || ''}</div>
                  </td>
                  <td className="p-3 text-gray-600">{c.room_id?.ma_phong || '—'}</td>
                  <td className="p-3 text-gray-600">{c.bed_id?.ma_giuong || '—'}</td>
                  <td className="p-3 text-gray-500 text-xs">{c.ngay_bat_dau ? new Date(c.ngay_bat_dau).toLocaleDateString('vi-VN') : '—'}</td>
                  <td className="p-3 text-gray-500 text-xs">{c.ngay_ket_thuc ? new Date(c.ngay_ket_thuc).toLocaleDateString('vi-VN') : '—'}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[c.trang_thai] || ''}`}>{c.trang_thai}</span></td>
                  <td className="p-3 text-center">
                    {c.trang_thai === 'Hiệu lực' && (
                      <button onClick={() => setCancelId(c._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Hủy hợp đồng">
                        <XCircle size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">Hiển thị {contracts.length} / {meta.total} hợp đồng</div>}
      </div>

      {cancelId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCancelId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Hủy hợp đồng</h2>
            <textarea placeholder="Nhập lý do hủy..." value={cancelReason} onChange={e => setCancelReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-4" rows={3} required />
            <div className="flex gap-3">
              <button onClick={() => setCancelId(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Đóng</button>
              <button onClick={handleCancel} disabled={!cancelReason} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">Xác nhận hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
