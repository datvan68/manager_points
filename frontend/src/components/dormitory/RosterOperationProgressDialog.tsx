'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type RosterOperation = 'import' | 'delete' | 'reconcile';
export type RosterOperationPhase = 'preparing' | 'processing' | 'completed' | 'partial' | 'interrupted';

export interface RosterOperationProgress {
  phase: RosterOperationPhase;
  processed: number;
  total: number | null;
  counters: Record<string, number>;
  unconfirmed?: number;
  unsent?: number;
  message?: string;
  details?: Array<{ status: string; reason?: string; rows: number[] }>;
}

interface RosterOperationProgressDialogProps {
  open: boolean;
  operation: RosterOperation;
  progress: RosterOperationProgress;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
}

const operationLabels: Record<RosterOperation, string> = {
  import: 'Import Danh sách KTX',
  delete: 'Xóa mục Danh sách KTX',
  reconcile: 'Đối chiếu liên kết KTX',
};

const phaseLabels: Record<RosterOperationPhase, string> = {
  preparing: 'Đang chuẩn bị',
  processing: 'Đang xử lý',
  completed: 'Hoàn tất',
  partial: 'Hoàn tất một phần',
  interrupted: 'Bị gián đoạn',
};

const counterLabels: Record<string, string> = {
  created: 'Đã tạo',
  duplicated: 'Trùng',
  failed: 'Lỗi',
  linked: 'Đã liên kết',
  unlinked: 'Chưa liên kết',
  conflicts: 'Xung đột',
  deleted: 'Đã xóa',
  blocked: 'Bị chặn',
  notFound: 'Không tìm thấy',
  invalid: 'Không hợp lệ',
};

export function rosterOperationPercentage(progress: Pick<RosterOperationProgress, 'processed' | 'total'>) {
  if (!progress.total) return null;
  return Math.min(100, Math.max(0, Math.floor((progress.processed / progress.total) * 100)));
}

export default function RosterOperationProgressDialog({ open, operation, progress, pending, onOpenChange }: RosterOperationProgressDialogProps) {
  const percentage = rosterOperationPercentage(progress);
  const indeterminate = operation === 'reconcile' && progress.phase === 'processing' && progress.total === null;
  const terminal = progress.phase === 'completed' || progress.phase === 'partial' || progress.phase === 'interrupted';
  const handleOpenChange = (nextOpen: boolean) => {
    if (!pending) onOpenChange(nextOpen);
  };

  return <Dialog open={open} onOpenChange={handleOpenChange}>
    <DialogContent
      showCloseButton={!pending}
      onEscapeKeyDown={event => { if (pending) event.preventDefault(); }}
      onPointerDownOutside={event => { if (pending) event.preventDefault(); }}
      onInteractOutside={event => { if (pending) event.preventDefault(); }}
      className="w-[calc(100%-1rem)] max-w-xl rounded-2xl border border-white/75 bg-white/45 p-4 text-[#1E293B] shadow-sm shadow-slate-300/40 backdrop-blur-md sm:p-5"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
          {pending ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" /> : terminal && progress.phase === 'interrupted' ? <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
          Tiến độ {operationLabels[operation]}
        </DialogTitle>
        <DialogDescription className="text-[#64748B]">{phaseLabels[progress.phase]} · Tiến độ chỉ tăng sau khi server xác nhận từng batch.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-sm font-semibold text-[#1E293B]">
          <span>{phaseLabels[progress.phase]}</span>
          <span>{indeterminate ? `Đã quét ${progress.processed}` : `${progress.processed}/${progress.total || 0} · ${percentage ?? 0}%`}</span>
        </div>
        <div role="progressbar" aria-label={`Tiến độ ${operationLabels[operation]}`} aria-valuemin={0} {...(indeterminate ? {} : { 'aria-valuemax': progress.total || 0, 'aria-valuenow': progress.processed })} aria-valuetext={indeterminate ? `Đã quét ${progress.processed}` : `${percentage ?? 0}%`} className="h-2 overflow-hidden rounded-xl bg-blue-500/10">
          <div className={`h-full rounded-xl bg-[#1A73E8] ${indeterminate ? 'w-1/3 animate-pulse motion-reduce:animate-none' : 'transition-[width] duration-150 motion-reduce:transition-none'}`} style={indeterminate ? undefined : { width: `${percentage ?? 0}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {Object.entries(progress.counters).map(([key, value]) => <div key={key} className="rounded-xl border border-white/75 bg-white/50 px-3 py-2 shadow-sm"><span className="block text-[#64748B]">{counterLabels[key] || key}</span><strong className="text-sm text-[#1E293B]">{value}</strong></div>)}
        </div>
        {(progress.unconfirmed || progress.unsent) ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700">Chưa xác nhận: {progress.unconfirmed || 0} · Chưa gửi: {progress.unsent || 0}. Không tự động gửi lại.</div> : null}
        {progress.message ? <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{progress.message}</p> : null}
        {progress.details?.length ? <section className="max-h-48 overflow-y-auto rounded-xl border border-white/75 bg-white/40 p-3" aria-label="Chi tiết kết quả import"><h3 className="mb-2 text-xs font-semibold text-[#1E293B]">Chi tiết theo dòng</h3><div className="space-y-2">{progress.details.map(group => <div key={`${group.status}-${group.reason || ''}-${group.rows.join(',')}`} className="rounded-xl border border-white/75 bg-white/50 px-3 py-2 text-xs"><span className="font-semibold text-[#1E293B]">Dòng {group.rows.join(', ')}</span><span className="ml-2 text-[#64748B]">{group.status === 'created' ? 'Đã tạo' : group.status === 'duplicated' ? 'Trùng' : 'Lỗi'}{group.reason ? ` · ${group.reason}` : ''}</span></div>)}</div></section> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>{pending ? 'Đang xử lý…' : 'Đóng'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
