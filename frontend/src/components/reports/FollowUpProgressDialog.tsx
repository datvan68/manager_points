'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type FollowUpProgressPhase = 'processing' | 'completed' | 'partial' | 'interrupted';

export interface FollowUpProgress {
  phase: FollowUpProgressPhase;
  processed: number;
  total: number;
  succeeded: number;
  failed: number;
  unconfirmed: number;
  unsent: number;
  message?: string;
}

interface FollowUpProgressDialogProps {
  open: boolean;
  progress: FollowUpProgress;
  onOpenChange: (open: boolean) => void;
}

export function followUpProgressPercentage(progress: Pick<FollowUpProgress, 'processed' | 'total'>) {
  if (progress.total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((progress.processed / progress.total) * 100)));
}

const phaseLabels: Record<FollowUpProgressPhase, string> = {
  processing: 'Đang xử lý',
  completed: 'Đã xử lý hoàn tất',
  partial: 'Hoàn tất một phần',
  interrupted: 'Bị gián đoạn',
};

export default function FollowUpProgressDialog({ open, progress, onOpenChange }: FollowUpProgressDialogProps) {
  const pending = progress.phase === 'processing';
  const percentage = followUpProgressPercentage(progress);
  const terminal = !pending;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!pending) onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-describedby="follow-up-progress-description"
        showCloseButton={!pending}
        onEscapeKeyDown={event => { if (pending) event.preventDefault(); }}
        onPointerDownOutside={event => { if (pending) event.preventDefault(); }}
        onInteractOutside={event => { if (pending) event.preventDefault(); }}
        className="w-[calc(100%-1rem)] max-w-xl rounded-2xl border border-white/75 bg-white/45 p-4 text-[#1E293B] shadow-sm shadow-slate-300/40 backdrop-blur-md sm:p-5"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            {pending ? <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" /> : progress.phase === 'interrupted' ? <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />}
            Tiến độ xử lý ghi nhận
          </DialogTitle>
          <DialogDescription id="follow-up-progress-description" className="text-[#64748B]">
            {phaseLabels[progress.phase]} · Tiến độ chỉ tăng sau khi máy chủ xác nhận kết quả.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-[#1E293B]">
            <span>{phaseLabels[progress.phase]}</span>
            <span>{progress.processed}/{progress.total} · {percentage}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Tiến độ xử lý ghi nhận"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.processed}
            aria-valuetext={`${progress.processed}/${progress.total} · ${percentage}%`}
            className="h-2 overflow-hidden rounded-xl bg-blue-500/10"
          >
            <div className="h-full rounded-xl bg-[#1A73E8] transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${percentage}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl border border-white/75 bg-white/50 px-3 py-2 shadow-sm"><span className="block text-[#64748B]">Thành công</span><strong className="text-sm text-[#1E293B]">{progress.succeeded}</strong></div>
            <div className="rounded-xl border border-white/75 bg-white/50 px-3 py-2 shadow-sm"><span className="block text-[#64748B]">Thất bại</span><strong className="text-sm text-[#1E293B]">{progress.failed}</strong></div>
            <div className="rounded-xl border border-white/75 bg-white/50 px-3 py-2 shadow-sm"><span className="block text-[#64748B]">Chưa xác nhận</span><strong className="text-sm text-[#1E293B]">{progress.unconfirmed}</strong></div>
            <div className="rounded-xl border border-white/75 bg-white/50 px-3 py-2 shadow-sm"><span className="block text-[#64748B]">Chưa gửi</span><strong className="text-sm text-[#1E293B]">{progress.unsent}</strong></div>
          </div>
          {progress.message ? <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">{progress.message}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>{terminal ? 'Đóng' : 'Đang xử lý…'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
