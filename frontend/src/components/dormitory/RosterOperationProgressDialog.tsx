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
  total: number;
  counters: Record<string, number>;
  unconfirmed?: number;
  unsent?: number;
  message?: string;
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
  if (!progress.total) return 0;
  return Math.min(100, Math.max(0, Math.floor((progress.processed / progress.total) * 100)));
}

export default function RosterOperationProgressDialog({ open, operation, progress, pending, onOpenChange }: RosterOperationProgressDialogProps) {
  const percentage = rosterOperationPercentage(progress);
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
      className="w-[calc(100%-1rem)] max-w-xl rounded-2xl p-4 sm:p-6"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
          {pending ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" /> : terminal && progress.phase === 'interrupted' ? <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
          Tiến độ {operationLabels[operation]}
        </DialogTitle>
        <DialogDescription>{phaseLabels[progress.phase]} · Tiến độ chỉ tăng sau khi server xác nhận từng batch.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
          <span>{phaseLabels[progress.phase]}</span>
          <span>{progress.processed}/{progress.total} · {percentage}%</span>
        </div>
        <div role="progressbar" aria-label={`Tiến độ ${operationLabels[operation]}`} aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.processed} aria-valuetext={`${percentage}%`} className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${percentage}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {Object.entries(progress.counters).map(([key, value]) => <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"><span className="block text-slate-500">{counterLabels[key] || key}</span><strong className="text-sm text-slate-800">{value}</strong></div>)}
        </div>
        {(progress.unconfirmed || progress.unsent) ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Chưa xác nhận: {progress.unconfirmed || 0} · Chưa gửi: {progress.unsent || 0}. Không tự động gửi lại.</div> : null}
        {progress.message ? <p role="alert" className="text-sm text-slate-700">{progress.message}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>{pending ? 'Đang xử lý…' : 'Đóng'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
