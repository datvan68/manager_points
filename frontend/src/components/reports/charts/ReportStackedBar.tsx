'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Segment {
  name: string;
  value: number;
  colorClass: string;
}

interface ReportStackedBarProps {
  title: string;
  data: { name: string; value: number }[];
  height?: number;
}

const ColorMap: Record<string, string> = {
  'Khen thưởng': 'bg-emerald-500',
  'Cộng điểm': 'bg-blue-500',
  'Kỷ luật': 'bg-rose-500',
  'Khác': 'bg-slate-400'
};

const TextColorMap: Record<string, string> = {
  'Khen thưởng': 'text-emerald-600',
  'Cộng điểm': 'text-blue-600',
  'Kỷ luật': 'text-rose-600',
  'Khác': 'text-slate-500'
};

export default function ReportStackedBar({
  title,
  data,
  height = 20
}: ReportStackedBarProps) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  const segments: Segment[] = data.map(item => ({
    name: item.name,
    value: item.value,
    colorClass: ColorMap[item.name] || 'bg-slate-400'
  })).filter(s => s.value > 0);

  return (
    <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
      <div className="border-b border-slate-100/60 pb-3">
        <h4 className="font-bold text-slate-800 text-[14px]">{title}</h4>
      </div>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs py-8">
          Không có ghi nhận phát sinh
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center space-y-5 mt-4">
          {/* Stacked Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full overflow-hidden flex" style={{ height: `${height}px` }}>
            {segments.map((seg, idx) => {
              const pct = (seg.value / total) * 100;
              return (
                <motion.div
                  key={idx}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: idx * 0.1 }}
                  className={`${seg.colorClass} h-full relative group cursor-pointer`}
                  title={`${seg.name}: ${seg.value} (${pct.toFixed(1)}%)`}
                >
                  {/* Inner label if wide enough */}
                  {pct > 12 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white truncate px-1">
                      {seg.value}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Legend and stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {data.map((item, idx) => {
              const color = ColorMap[item.name] || 'bg-slate-400';
              const textCol = TextColorMap[item.name] || 'text-slate-500';
              const pct = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div key={idx} className="flex items-center gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100/30">
                  <div className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-bold uppercase truncate">{item.name}</div>
                    <div className={`text-[12px] font-black ${textCol} flex items-baseline gap-1 mt-0.5`}>
                      <span>{item.value}</span>
                      <span className="text-[9px] text-slate-400 font-semibold">({pct.toFixed(0)}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
