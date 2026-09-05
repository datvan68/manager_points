'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { dormitoryApi, DormitoryRosterEntry, DormitoryRosterLinkCandidate } from '@/api/dormitory-api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface RosterStudentLinkModalProps {
  open: boolean;
  registration: DormitoryRosterEntry | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => Promise<void> | void;
  restoreFocus?: () => void;
}

const errorMessage = (error: any) => error?.message || 'Không thể tải danh sách sinh viên hiện tại.';

export default function RosterStudentLinkModal({ open, registration, onOpenChange, onSuccess, restoreFocus }: RosterStudentLinkModalProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState<DormitoryRosterLinkCandidate[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<DormitoryRosterLinkCandidate | null>(null);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  useEffect(() => {
    if (!open || !registration) return;
    setSearch(''); setPage(1); setCandidates([]); setMeta({ total: 0, page: 1, limit: 20, totalPages: 0 }); setSelected(null); setError('');
  }, [open, registration?._id]);

  useEffect(() => {
    if (!open || !registration) return;
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const response = await dormitoryApi.roster.getLinkCandidates({ search: search.trim() || undefined, page, limit: 20, signal: controller.signal });
        if (requestRef.current !== requestId) return;
        setCandidates(response.data || []); setMeta(response.meta); setSelected(current => current && response.data.some(item => item._id === current._id) ? current : null);
      } catch (err: any) {
        if (err?.name === 'AbortError' || controller.signal.aborted || requestRef.current !== requestId) return;
        setCandidates([]); setError(errorMessage(err));
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [open, registration, search, page]);

  const close = (nextOpen: boolean) => {
    if (nextOpen || saving) return;
    onOpenChange(false);
  };

  const link = async () => {
    if (!registration || !selected || saving) return;
    setSaving(true); setError('');
    try {
      await dormitoryApi.roster.update(registration._id, { student_id: selected._id });
      toast.success('Đã liên kết sinh viên vào mục Danh sách KTX.');
      await onSuccess?.();
      onOpenChange(false);
      window.setTimeout(() => restoreFocus?.(), 100);
    } catch (err: any) {
      setError(errorMessage(err));
      toast.error(errorMessage(err));
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent
      showCloseButton={!saving}
      onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}
      onPointerDownOutside={event => { if (saving) event.preventDefault(); }}
      onInteractOutside={event => { if (saving) event.preventDefault(); }}
      className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-2xl p-4 sm:p-6"
    >
      <DialogHeader>
        <DialogTitle>Liên kết sinh viên</DialogTitle>
        <DialogDescription>Chỉ chọn sinh viên đang học và thuộc một lớp hiện tại. Mục KTX: {registration ? `${registration.roster_entry_code} · ${registration.full_name || 'Chưa có tên'}` : ''}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input aria-label="Tìm sinh viên theo tên, mã hoặc lớp" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm theo tên, mã sinh viên hoặc lớp…" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-10 text-sm outline-none ring-blue-200 focus:ring-2" autoComplete="off" /></div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"><span /> <span>Mã / Họ tên</span><span>Lớp</span><span>Trạng thái</span></div>
          <div className="max-h-[45vh] overflow-y-auto">
            {loading ? <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Đang tải sinh viên…</div> : candidates.length ? candidates.map(candidate => <button type="button" key={candidate._id} onClick={() => setSelected(candidate)} className={`grid w-full grid-cols-[auto_1fr_1fr_auto] items-center gap-3 border-b border-slate-100 px-3 py-3 text-left text-sm last:border-b-0 hover:bg-blue-50 ${selected?._id === candidate._id ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : ''}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected?._id === candidate._id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>{selected?._id === candidate._id ? <Check className="h-3.5 w-3.5" /> : null}</span><span className="min-w-0"><strong className="block truncate text-slate-800">{candidate.student_code}</strong><span className="block truncate text-xs text-slate-600">{candidate.full_name}</span></span><span className="truncate text-xs text-slate-600">{typeof candidate.class_id === 'object' ? candidate.class_id.class_name : candidate.class_id}</span><span className="text-xs font-semibold text-emerald-700">Đang học</span></button>) : <div className="px-4 py-10 text-center text-sm text-slate-500">Không có sinh viên hiện tại phù hợp.</div>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-slate-600"><span>{meta.total ? `${meta.total} kết quả · Trang ${meta.page}/${meta.totalPages}` : 'Chưa có kết quả'}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Trang trước"><ChevronLeft className="h-4 w-4" /></Button><Button type="button" variant="outline" size="sm" disabled={loading || page >= meta.totalPages} onClick={() => setPage(value => value + 1)} aria-label="Trang sau"><ChevronRight className="h-4 w-4" /></Button></div></div>
        {selected && <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">Đã chọn: <strong>{selected.student_code} — {selected.full_name}</strong> · {typeof selected.class_id === 'object' ? selected.class_id.class_name : selected.class_id}</p>}
      </div>
      <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => close(false)}>Hủy</Button><Button type="button" disabled={saving || !selected} onClick={() => void link()}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang liên kết…</> : 'Xác nhận liên kết'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
