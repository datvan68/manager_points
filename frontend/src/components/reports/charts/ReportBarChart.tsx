'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ChartDatum {
  name: string;
  value: number;
}

interface ReportBarChartProps {
  title: string;
  data: ChartDatum[];
  valueSuffix?: string;
  height?: number;
}

export default function ReportBarChart({
  title,
  data,
  valueSuffix = '',
  height = 200
}: ReportBarChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
      <div className="border-b border-slate-100/60 pb-3 flex items-center justify-between">
        <h4 className="font-bold text-slate-800 text-[14px]">{title}</h4>
      </div>

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs py-8">
          Không có dữ liệu hiển thị
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-end mt-4" style={{ height: `${height}px` }}>
          {/* Chart Bars */}
          <div className="flex items-end justify-around gap-2 h-full pb-2 border-b border-slate-100">
            {data.map((item, idx) => {
              const pct = (item.value / maxValue) * 100;
              return (
                <div key={idx} className="flex flex-col items-center flex-1 group relative h-full justify-end">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-lg pointer-events-none shadow-md z-10 whitespace-nowrap">
                    {item.value} {valueSuffix}
                  </div>
                  
                  {/* Bar */}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100, delay: idx * 0.05 }}
                    className="w-full sm:w-8 max-w-[40px] rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 group-hover:from-blue-500 group-hover:to-blue-300 transition-all duration-300 shadow-sm"
                  />
                </div>
              );
            })}
          </div>

          {/* Labels */}
          <div className="flex justify-around items-start pt-2 gap-2 text-[10px] font-bold text-slate-400">
            {data.map((item, idx) => (
              <span key={idx} className="text-center truncate flex-1" title={item.name}>
                {item.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
