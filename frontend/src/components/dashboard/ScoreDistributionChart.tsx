import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

interface ScoreDistributionChartProps {
  distribution: {
    xuatsac: number;
    tot: number;
    kha: number;
    trungbinh: number;
    yeu: number;
  };
}

export default function ScoreDistributionChart({ distribution }: ScoreDistributionChartProps) {
  const { xuatsac, tot, kha, trungbinh, yeu } = distribution;
  const total = xuatsac + tot + kha + trungbinh + yeu;

  const chartData = [
    { label: 'Xuất sắc', count: xuatsac, range: '>= 90', color: 'bg-[#1A73E8]', textColor: 'text-[#1A73E8]' },
    { label: 'Tốt', count: tot, range: '80 - 89', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
    { label: 'Khá', count: kha, range: '65 - 79', color: 'bg-purple-500', textColor: 'text-purple-600' },
    { label: 'Trung bình', count: trungbinh, range: '50 - 64', color: 'bg-amber-500', textColor: 'text-amber-600' },
    { label: 'Yếu', count: yeu, range: '< 50', color: 'bg-rose-500', textColor: 'text-rose-600' },
  ];

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  const getPercent = (count: number) => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  return (
    <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm shadow-slate-300/40 flex flex-col justify-between h-full transition-all duration-150 ease-out">
      <div>
        <h2 className="font-bold text-[#1E293B] text-sm mb-4 flex items-center gap-1.5">
          <BarChart3 size={16} className="text-[#1A73E8]" />
          <span>Phân bổ xếp loại rèn luyện ({total} hồ sơ)</span>
        </h2>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center">
            <BarChart3 size={32} className="opacity-45 mb-2" />
            <p className="text-xs font-semibold text-[#1E293B]">Chưa có dữ liệu xếp loại</p>
            <p className="text-[10px] text-[#64748B] mt-0.5">Không tìm thấy hồ sơ điểm nào trong học kỳ này.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visual Bars Container */}
            <div className="h-44 flex items-end justify-between gap-3 px-2 pt-4 border-b border-slate-200/50">
              {chartData.map((data, i) => {
                const heightPercent = (data.count / maxCount) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="w-full bg-slate-100 rounded-t-lg relative h-full flex items-end overflow-visible">
                      {/* Tooltip on Hover */}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#1E293B] text-white text-[9px] font-bold px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-sm pointer-events-none whitespace-nowrap z-10">
                        {data.count} sinh viên ({getPercent(data.count)}%)
                      </div>
                      
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPercent || 5}%` }} // Ensure a tiny height so it's clickable
                        transition={{ delay: i * 0.05, duration: 0.8, ease: 'easeOut' }}
                        className={`w-full ${data.color} rounded-t-lg group-hover:brightness-95 transition-all cursor-pointer`}
                      />
                    </div>
                    
                    {/* Compact Label */}
                    <div className="text-center w-full min-w-0">
                      <span className="text-[10px] font-black text-[#1E293B] block">{getPercent(data.count)}%</span>
                      <span className="text-[9px] font-semibold text-[#64748B] block truncate leading-none mt-0.5">{data.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Info Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-2 text-[10px] font-semibold text-[#64748B]">
              {chartData.map((data, i) => (
                <div key={i} className="flex flex-col p-1.5 bg-white/40 border border-white/50 rounded-xl shadow-xs">
                  <span className={`font-bold ${data.textColor}`}>{data.label}</span>
                  <span className="text-[9px] text-[#64748B] mt-0.5">{data.range}</span>
                  <span className="text-[11px] font-black text-[#1E293B] mt-1">{data.count} SV</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
