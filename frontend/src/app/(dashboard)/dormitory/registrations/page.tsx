'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardList, Check, X, Search, Users } from 'lucide-react';
import { dormitoryApi, DormRegistration } from '@/api/dormitory-api';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  'Chờ duyệt': 'bg-amber-100 text-amber-700',
  'Đã duyệt': 'bg-green-100 text-green-700',
  'Từ chối': 'bg-red-100 text-red-700',
};

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<DormRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [meta, setMeta] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dormitoryApi.registrations.getAll({
        trang_thai: filterStatus || undefined,
        search: search || undefined,
        limit: 50,
      });
      setRegistrations(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải danh sách đăng ký');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const pending = registrations.filter(r => r.trang_thai === 'Chờ duyệt');
    if (selected.size === pending.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pending.map(r => r._id)));
    }
  }

  async function handleApprove(id: string) {
    try {
      await dormitoryApi.registrations.approve(id, { trang_thai: 'Đã duyệt' });
      toast.success('Đã duyệt đơn đăng ký');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi duyệt đơn');
    }
  }

  async function handleReject() {
    if (!rejectId || !rejectReason) return;
    try {
      await dormitoryApi.registrations.approve(rejectId, { trang_thai: 'Từ chối', ly_do_tu_choi: rejectReason });
      toast.success('Đã từ chối đơn đăng ký');
      setRejectId(null);
      setRejectReason('');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi từ chối đơn');
    }
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return;
    try {
      const res = await dormitoryApi.registrations.bulkApprove({
        registration_ids: Array.from(selected),
        trang_thai: 'Đã duyệt',
      });
      toast.success(`Đã duyệt ${res.success} đơn${res.failed > 0 ? `, ${res.failed} lỗi` : ''}`);
      setSelected(new Set());
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi duyệt hàng loạt');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-800">Đăng ký KTX</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Tìm kiếm..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">Tất cả trạng thái</option>
            <option value="Chờ duyệt">Chờ duyệt</option>
            <option value="Đã duyệt">Đã duyệt</option>
            <option value="Từ chối">Từ chối</option>
          </select>
          {selected.size > 0 && (
            <button onClick={handleBulkApprove} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <Check size={16} /> Duyệt {selected.size} đơn
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-3 text-left w-10">
                  <input type="checkbox" onChange={toggleAll} checked={selected.size > 0 && selected.size === registrations.filter(r => r.trang_thai === 'Chờ duyệt').length} className="rounded" />
                </th>
                <th className="p-3 text-left font-medium text-gray-600">Mã ĐK</th>
                <th className="p-3 text-left font-medium text-gray-600">Sinh viên</th>
                <th className="p-3 text-left font-medium text-gray-600">Kỳ/Năm</th>
                <th className="p-3 text-left font-medium text-gray-600">Ưu tiên</th>
                <th className="p-3 text-left font-medium text-gray-600">Trạng thái</th>
                <th className="p-3 text-left font-medium text-gray-600">Ngày tạo</th>
                <th className="p-3 text-center font-medium text-gray-600">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="p-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : registrations.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Không có đơn đăng ký nào</td></tr>
              ) : registrations.map(reg => (
                <tr key={reg._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-3">
                    {reg.trang_thai === 'Chờ duyệt' && (
                      <input type="checkbox" checked={selected.has(reg._id)} onChange={() => toggleSelect(reg._id)} className="rounded" />
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs">{reg.ma_dk}</td>
                  <td className="p-3">
                    <div className="font-medium text-gray-800">{reg.student_id?.full_name || '—'}</div>
                    <div className="text-xs text-gray-400">{reg.student_id?.student_code || ''}</div>
                  </td>
                  <td className="p-3 text-gray-600">{reg.ky_hoc} / {reg.nam_hoc}</td>
                  <td className="p-3 text-gray-600 text-xs">{reg.doi_tuong_uu_tien}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[reg.trang_thai] || ''}`}>{reg.trang_thai}</span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{reg.createdAt ? new Date(reg.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                  <td className="p-3 text-center">
                    {reg.trang_thai === 'Chờ duyệt' && (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleApprove(reg._id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Duyệt">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setRejectId(reg._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600" title="Từ chối">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            Hiển thị {registrations.length} / {meta.total} đơn đăng ký
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setRejectId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Từ chối đơn đăng ký</h2>
            <textarea placeholder="Nhập lý do từ chối..." value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-4" rows={3} required />
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Hủy</button>
              <button onClick={handleReject} disabled={!rejectReason} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">Từ chối</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
