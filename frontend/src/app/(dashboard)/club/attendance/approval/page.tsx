'use client';

import React, { useEffect, useState } from 'react';
import { UserCheck, CheckCircle2, XCircle, Clock, Filter, Search } from 'lucide-react';
import { clubAttendanceApi, ClubAttendance } from '@/api/club-api';
import { toast } from 'sonner';

export default function AttendanceApprovalPage() {
  const [items, setItems] = useState<ClubAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | ''>('pending');

  useEffect(() => { loadData(); }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await clubAttendanceApi.getAll({
        approval_status: filter || undefined,
        limit: 100,
      });
      setItems(data?.items || []);
    } catch { toast.error('Không thể tải dữ liệu'); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id: string) => {
    try {
      await clubAttendanceApi.approve(id, { status: 'approved' });
      toast.success('Đã duyệt');
      loadData();
    } catch { toast.error('Lỗi khi duyệt'); }
  };

  const handleReject = async (id: string) => {
    try {
      await clubAttendanceApi.reject(id, { status: 'rejected', rejection_reason: 'Không hợp lệ' });
      toast.success('Đã từ chối');
      loadData();
    } catch { toast.error('Lỗi khi từ chối'); }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) { toast.error('Chọn ít nhất 1 bản ghi'); return; }
    try {
      const result = await clubAttendanceApi.batchApprove(selectedIds);
      toast.success(`Đã duyệt ${result?.approved || selectedIds.length} bản ghi`);
      setSelectedIds([]);
      loadData();
    } catch { toast.error('Lỗi khi duyệt hàng loạt'); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === items.length) setSelectedIds([]);
    else setSelectedIds(items.map(i => i._id));
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    present: { label: 'Có mặt', color: 'text-emerald-600 bg-emerald-500/10' },
    absent: { label: 'Vắng', color: 'text-red-600 bg-red-500/10' },
    late: { label: 'Muộn', color: 'text-amber-600 bg-amber-500/10' },
    excused: { label: 'Có phép', color: 'text-blue-600 bg-blue-500/10' },
  };

  const approvalLabels: Record<string, { label: string; color: string }> = {
    pending: { label: 'Chờ duyệt', color: 'text-amber-600 bg-amber-500/10' },
    approved: { label: 'Đã duyệt', color: 'text-emerald-600 bg-emerald-500/10' },
    rejected: { label: 'Từ chối', color: 'text-red-600 bg-red-500/10' },
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <UserCheck size={20} className="text-blue-500" /> Duyệt điểm danh
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{items.length} bản ghi</p>
        </div>
        {selectedIds.length > 0 && filter === 'pending' && (
          <button onClick={handleBatchApprove}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 cursor-pointer shadow-md shadow-emerald-500/20">
            <CheckCircle2 size={16} /> Duyệt {selectedIds.length} mục
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f as any)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
              filter === f ? 'bg-blue-500 text-white shadow-sm' : 'bg-white/60 text-slate-500 hover:bg-white/80'
            }`}>
            {f === '' ? 'Tất cả' : f === 'pending' ? 'Chờ duyệt' : f === 'approved' ? 'Đã duyệt' : 'Từ chối'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-white/40 rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <UserCheck size={36} className="text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">Không có bản ghi nào</p>
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-sm border border-white/70 rounded-2xl overflow-hidden">
          {/* Header */}
          {filter === 'pending' && (
            <div className="px-4 py-2 border-b border-white/50 flex items-center gap-3">
              <input type="checkbox" checked={selectedIds.length === items.length && items.length > 0}
                onChange={toggleAll} className="w-4 h-4 rounded cursor-pointer accent-blue-500" />
              <span className="text-xs text-slate-400">Chọn tất cả</span>
            </div>
          )}

          <div className="divide-y divide-white/40">
            {items.map(att => {
              const student = att.student_id as any;
              const schedule = att.schedule_id as any;
              const club = att.club_id as any;
              const sts = statusLabels[att.status] || statusLabels.present;
              const appr = approvalLabels[att.approval_status] || approvalLabels.pending;

              return (
                <div key={att._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/40 transition-colors">
                  {filter === 'pending' && (
                    <input type="checkbox" checked={selectedIds.includes(att._id)}
                      onChange={() => toggleSelect(att._id)} className="w-4 h-4 rounded cursor-pointer accent-blue-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-700 truncate">{student?.full_name || '—'}</p>
                      <span className="text-xs text-slate-400">{student?.student_code}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{club?.name || ''}</span>
                      <span>·</span>
                      <span>{schedule?.title || ''}</span>
                      <span>·</span>
                      <Clock size={10} />
                      <span>{new Date(att.recorded_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sts.color}`}>{sts.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${appr.color}`}>{appr.label}</span>

                  {att.approval_status === 'pending' && (
                    <div className="flex gap-1">
                      <button onClick={() => handleApprove(att._id)}
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 cursor-pointer">
                        <CheckCircle2 size={14} />
                      </button>
                      <button onClick={() => handleReject(att._id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 cursor-pointer">
                        <XCircle size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
