'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, ChevronDown, Loader2 } from 'lucide-react';
import { systemApi } from '@/api/system-api';
import type { ClassRecordSummary } from '@/api/system-api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ClassRecordPanelProps {
  semesterId?: string | null;
}

export default function ClassRecordPanel({ semesterId }: ClassRecordPanelProps) {
  const [items, setItems] = useState<ClassRecordSummary[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setState('loading');
    systemApi.getClassRecordSummaries({ semesterId: semesterId || undefined, page: 1, limit: 20 }, controller.signal)
      .then((result) => {
        if (!current) return;
        setItems(result.items || []);
        setState('ready');
      })
      .catch((error) => {
        if (!current || error?.name === 'AbortError') return;
        setItems([]);
        setState('error');
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [semesterId]);

  return (
    <section className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[#1A73E8]" />
          <h2 className="font-bold text-[#1E293B] text-sm">Ghi nhận theo lớp</h2>
        </div>
        {state === 'loading' && <Loader2 size={15} className="animate-spin text-slate-400" aria-label="Đang tải" />}
      </div>

      {state === 'error' && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          <AlertTriangle size={15} /> Không thể tải danh sách ghi nhận.
        </div>
      )}
      {state === 'ready' && items.length === 0 && (
        <p className="py-8 text-center text-xs italic text-[#64748B]">Chưa có ghi nhận trong học kỳ này.</p>
      )}
      {state === 'ready' && items.length > 0 && (
        <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-hover pr-1">
          {items.map((item) => (
            <Popover key={item.classId}>
              <PopoverTrigger asChild>
                <button type="button" className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/45 p-3 text-left hover:bg-white/70 transition-colors">
                  <span className="min-w-0 truncate text-xs font-bold text-[#1E293B]">Lớp {item.className} - {item.recordCount} ghi nhận</span>
                  <ChevronDown size={14} className="shrink-0 text-[#64748B]" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] max-h-[300px] overflow-y-auto" aria-label={`Ghi nhận lớp ${item.className}`}>
                <p className="mb-3 text-xs font-extrabold text-[#1E293B]">Ghi nhận mới nhất — lớp {item.className}</p>
                <div className="space-y-2">
                  {item.records.map((record) => (
                    <div key={record.recordId} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                      <p className="text-[11px] font-bold text-[#1E293B]">{record.studentName} - {record.className}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">{record.content || 'Ghi nhận học vụ'}{record.count > 1 ? ` (${record.count} lần)` : ''}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      )}
    </section>
  );
}
