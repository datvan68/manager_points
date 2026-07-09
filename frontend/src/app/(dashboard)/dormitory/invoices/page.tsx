'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Receipt, Search, CheckCircle, Plus } from 'lucide-react';
import { dormitoryApi, DormInvoice } from '@/api/dormitory-api';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  'Chưa thanh toán': 'bg-amber-100 text-amber-700',
  'Đã thanh toán': 'bg-green-100 text-green-700',
  'Quá hạn': 'bg-red-100 text-red-700',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<DormInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState<any>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('Tiền mặt');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkForm, setBulkForm] = useState({ ky_thu: '', han_thanh_toan: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dormitoryApi.invoices.getAll({ trang_thai: filterStatus || undefined, search: search || undefined, limit: 50 });
      setInvoices(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải danh sách hóa đơn');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  async function handlePay() {
    if (!payId) return;
    try {
      await dormitoryApi.invoices.pay(payId, { phuong_thuc: payMethod });
      toast.success('Xác nhận thanh toán thành công');
      setPayId(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xác nhận thanh toán');
    }
  }

  async function handleBulkCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await dormitoryApi.invoices.bulkCreate(bulkForm);
      toast.success(`Đã tạo ${res.created} hóa đơn, bỏ qua ${res.skipped} (đã tồn tại)`);
      setShowBulk(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi sinh hóa đơn hàng loạt');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-800">Hóa đơn & Phí KTX</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Tìm mã HĐ..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">Tất cả</option>
            <option value="Chưa thanh toán">Chưa thanh toán</option>
            <option value="Đã thanh toán">Đã thanh toán</option>
            <option value="Quá hạn">Quá hạn</option>
          </select>
          <button onClick={() => setShowBulk(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={16} /> Sinh HĐ hàng loạt
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-3 text-left font-medium text-gray-600">Mã HĐ</th>
                <th className="p-3 text-left font-medium text-gray-600">Sinh viên</th>
                <th className="p-3 text-left font-medium text-gray-600">Kỳ thu</th>
                <th className="p-3 text-right font-medium text-gray-600">Tổng tiền</th>
                <th className="p-3 text-left font-medium text-gray-600">Hạn TT</th>
                <th className="p-3 text-left font-medium text-gray-600">Trạng thái</th>
                <th className="p-3 text-center font-medium text-gray-600">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 7 }).map((_, j) => <td key={j} className="p-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-400">Không có hóa đơn nào</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="p-3 font-mono text-xs">{inv.ma_hoa_don}</td>
                  <td className="p-3">
                    <div className="font-medium text-gray-800">{inv.student_id?.full_name || '—'}</div>
                    <div className="text-xs text-gray-400">{inv.student_id?.student_code || ''}</div>
                  </td>
                  <td className="p-3 text-gray-600">{inv.ky_thu}</td>
                  <td className="p-3 text-right font-medium text-gray-800">{inv.tong_tien?.toLocaleString('vi-VN')}đ</td>
                  <td className="p-3 text-gray-500 text-xs">{inv.han_thanh_toan ? new Date(inv.han_thanh_toan).toLocaleDateString('vi-VN') : '—'}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.trang_thai] || ''}`}>{inv.trang_thai}</span></td>
                  <td className="p-3 text-center">
                    {inv.trang_thai !== 'Đã thanh toán' && (
                      <button onClick={() => setPayId(inv._id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Xác nhận thanh toán">
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">Hiển thị {invoices.length} / {meta.total} hóa đơn</div>}
      </div>

      {/* Pay Modal */}
      {payId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPayId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Xác nhận thanh toán</h2>
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="Tiền mặt">Tiền mặt</option>
              <option value="Chuyển khoản">Chuyển khoản</option>
              <option value="Cổng thanh toán">Cổng thanh toán</option>
            </select>
            <div className="flex gap-3">
              <button onClick={() => setPayId(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Hủy</button>
              <button onClick={handlePay} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowBulk(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Sinh hóa đơn hàng loạt</h2>
            <form onSubmit={handleBulkCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kỳ thu (VD: T07/2026)</label>
                <input type="text" required value={bulkForm.ky_thu} onChange={e => setBulkForm(f => ({ ...f, ky_thu: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hạn thanh toán</label>
                <input type="date" required value={bulkForm.han_thanh_toan} onChange={e => setBulkForm(f => ({ ...f, han_thanh_toan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowBulk(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Hủy</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Sinh hóa đơn</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
