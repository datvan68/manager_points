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
const reasonLabels: Record<string, string> = { NAME_EXACT: 'Trùng họ tên', NAME_SIMILAR: 'Tên gần giống', DOB_EXACT: 'Trùng ngày sinh', DOB_NEAR: 'Ngày sinh gần' };
const formatDate = (value?: string | null) => {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 'Chưa cập nhật';
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day ? `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` : 'Chưa cập nhật';
};

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
        const response = await dormitoryApi.roster.getLinkCandidates({ roster_entry_id: registration._id, search: search.trim() || undefined, page, limit: 20, signal: controller.signal });
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
      className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-2xl border border-white/75 bg-white/45 p-4 text-[#1E293B] shadow-sm shadow-slate-300/40 backdrop-blur-md sm:p-5"
    >
      <DialogHeader>
        <DialogTitle>Liên kết sinh viên</DialogTitle>
        <DialogDescription className="text-[#64748B]">Chỉ chọn sinh viên đang học và thuộc một lớp hiện tại.</DialogDescription>
        {registration && <div className="rounded-xl border border-white/70 bg-white/50 px-3 py-2 text-sm text-[#1E293B]"><span className="font-semibold">Mục KTX:</span> {registration.roster_entry_code} · {registration.full_name || 'Chưa có tên'} <span className="text-[#64748B]">· Ngày sinh: {formatDate(registration.date_of_birth)}</span></div>}
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" aria-hidden="true" /><input aria-label="Tìm sinh viên theo tên, mã hoặc lớp" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm theo tên, mã sinh viên hoặc lớp…" className="h-11 w-full rounded-xl border border-white/75 bg-white/50 px-10 text-sm text-[#1E293B] outline-none ring-[#1A73E8]/30 focus:ring-2" autoComplete="off" /></div>
        {error && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="overflow-hidden rounded-xl border border-white/75 bg-white/40">
          <div className="hidden grid-cols-[auto_1.2fr_1fr_1fr] gap-3 border-b border-white/75 bg-white/50 px-3 py-2 text-xs font-semibold text-[#64748B] sm:grid"><span /> <span>Mã / Họ tên</span><span>Ngày sinh / Lớp</span><span>Độ phù hợp</span></div>
          <div className="max-h-[45vh] overflow-y-auto">
            {loading ? <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[#64748B]"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Đang tải sinh viên…</div> : candidates.length ? <div role="radiogroup" aria-label="Sinh viên đủ điều kiện để liên kết">{candidates.map(candidate => { const className = typeof candidate.class_id === 'object' ? candidate.class_id.class_name : candidate.class_id; const isSelected = selected?._id === candidate._id; const reasons = (candidate.match_reasons || []).map(reason => reasonLabels[reason]).filter(Boolean).join(' · '); return <button type="button" role="radio" aria-checked={isSelected} key={candidate._id} onClick={() => setSelected(candidate)} className={`flex w-full items-start gap-3 border-b border-white/60 px-3 py-3 text-left text-sm last:border-b-0 hover:bg-blue-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1A73E8] sm:grid sm:grid-cols-[auto_1.2fr_1fr_1fr] sm:items-center ${isSelected ? 'bg-blue-500/10' : ''}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-xl border sm:mt-0 ${isSelected ? 'border-[#1A73E8] bg-[#1A73E8] text-white' : 'border-white/75 bg-white/50'}`} aria-hidden="true">{isSelected ? <Check className="h-3.5 w-3.5" /> : null}</span><span className="min-w-0 flex-1"><strong className="block break-words text-[#1E293B]">{candidate.student_code}</strong><span className="block break-words text-xs text-[#64748B]">{candidate.full_name}</span><span className="block break-words text-xs text-[#64748B] sm:hidden">{formatDate(candidate.date_bir)} · Lớp: {className || 'Chưa cập nhật'}</span></span><span className="hidden break-words text-xs text-[#64748B] sm:block">{formatDate(candidate.date_bir)}<br />{className || 'Chưa cập nhật'}</span><span className={`text-xs font-semibold ${candidate.recommended ? 'text-emerald-700' : 'text-[#64748B]'}`}>{candidate.match_score != null ? `${candidate.recommended ? 'Gợi ý' : 'Phù hợp'} ${candidate.match_score}/100` : 'Thủ công'}{reasons && <span className="block max-w-[12rem] break-words text-[11px] font-normal text-[#64748B]">{reasons}</span>}</span></button>; })}</div> : <div className="px-4 py-10 text-center text-sm text-[#64748B]">Không có sinh viên hiện tại phù hợp.</div>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-[#64748B]"><span>{meta.total ? `${meta.total} kết quả · Trang ${meta.page}/${meta.totalPages}` : 'Chưa có kết quả'}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)} aria-label="Trang trước" className="min-h-9 min-w-9 rounded-xl"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button><Button type="button" variant="outline" size="sm" disabled={loading || page >= meta.totalPages} onClick={() => setPage(value => value + 1)} aria-label="Trang sau" className="min-h-9 min-w-9 rounded-xl"><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button></div></div>
        {selected && <p role="status" aria-live="polite" className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-[#1A73E8]">Đã chọn: <strong>{selected.student_code} — {selected.full_name}</strong> · {typeof selected.class_id === 'object' ? selected.class_id.class_name : selected.class_id}</p>}
      </div>
      <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => close(false)}>Hủy</Button><Button type="button" disabled={saving || !selected} onClick={() => void link()}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang liên kết…</> : 'Xác nhận liên kết'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
