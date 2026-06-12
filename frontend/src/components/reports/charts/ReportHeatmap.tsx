'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ReportHeatmapProps {
  title: string;
  data: { name: string; value: number }[]; // value is attendance rate (0 to 100)
}

export default function ReportHeatmap({ title, data }: ReportHeatmapProps) {
  const getCellColor = (val: number) => {
    if (val >= 95) return 'bg-emerald-500 hover:bg-emerald-600 text-white';
    if (val >= 90) return 'bg-emerald-400 hover:bg-emerald-500 text-white';
    if (val >= 85) return 'bg-blue-500 hover:bg-blue-600 text-white';
    if (val >= 75) return 'bg-amber-500 hover:bg-amber-600 text-white';
    return 'bg-rose-500 hover:bg-rose-600 text-white';
  };

  return (
    <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
      <div className="border-b border-slate-100/60 pb-3 flex items-center justify-between">
        <h4 className="font-bold text-slate-800 text-[14px]">{title}</h4>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs py-8">
          Không có dữ liệu chuyên cần
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between mt-4">
          {/* Heatmap Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {data.map((item, idx) => {
              const val = item.value;
              const colorClass = getCellColor(val);
              
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 100, delay: idx * 0.04 }}
                  className={`${colorClass} rounded-xl p-3 shadow-sm flex flex-col justify-between h-[80px] cursor-pointer transition-all duration-200 relative group`}
                >
                  <span className="text-[11px] font-black tracking-tight truncate w-full" title={item.name}>
                    {item.name}
                  </span>
                  
                  <div className="flex items-baseline justify-between mt-auto">
                    <span className="text-lg font-black">{val.toFixed(1)}%</span>
                  </div>

                  {/* Hover Tooltip Details */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900 text-white text-[9px] font-bold py-1.5 px-2.5 rounded-lg shadow-md pointer-events-none z-10 whitespace-nowrap">
                    <div>Lớp: {item.name}</div>
                    <div className="mt-0.5">Tỉ lệ chuyên cần: {val.toFixed(1)}%</div>
                    <div className="mt-0.5">Trạng thái: {val >= 85 ? 'Tốt' : val >= 75 ? 'Trung bình' : 'Nguy cơ'}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Scale Legend */}
          <div className="flex flex-wrap items-center justify-start gap-4 mt-5 pt-3 border-t border-slate-100/60 text-[10px] font-bold text-slate-400">
            <span className="uppercase">CHÚ GIẢI TỈ LỆ:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span>{'>'}= 95%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-400" />
              <span>90% - 95%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>85% - 90%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span>75% - 85%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-rose-500" />
              <span>{'<'}= 75%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
