'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

interface ReportFunnelProps {
  title: string;
  data: { name: string; value: number }[];
}

export default function ReportFunnel({ title, data }: ReportFunnelProps) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  const maxVal = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
      <div className="border-b border-slate-100/60 pb-3">
        <h4 className="font-bold text-slate-800 text-[14px]">{title}</h4>
      </div>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs py-8">
          Không có hồ sơ đánh giá
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center gap-3 mt-4">
          {data.map((stage, idx) => {
            const pctOfMax = (stage.value / maxVal) * 100;
            const pctOfTotal = total > 0 ? (stage.value / total) * 100 : 0;
            
            // Generate color shade of blue
            const opacityClass = idx === 0 
              ? 'bg-blue-600/90' 
              : idx === 1 
                ? 'bg-blue-500/85' 
                : idx === 2 
                  ? 'bg-blue-400/80' 
                  : 'bg-blue-300/75';

            return (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <div className="flex justify-center text-slate-300">
                    <ArrowDown size={14} className="animate-pulse" />
                  </div>
                )}
                <div className="relative flex items-center w-full">
                  {/* Funnel Stage Bar */}
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(pctOfMax, 30)}%` }} // Ensure at least 30% width for layout stability
                    transition={{ type: 'spring', damping: 22, stiffness: 120, delay: idx * 0.08 }}
                    className={`${opacityClass} text-white rounded-xl py-2 px-4 shadow-sm flex items-center justify-between mx-auto min-w-[200px] h-10`}
                  >
                    <span className="text-[12px] font-bold truncate mr-2">{stage.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[13px] font-black">{stage.value}</span>
                      <span className="text-[9px] font-bold text-white/70">({pctOfTotal.toFixed(0)}%)</span>
                    </div>
                  </motion.div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
