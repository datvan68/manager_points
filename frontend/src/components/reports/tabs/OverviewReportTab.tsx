'use client';

import React from 'react';
import ReportBarChart from '../charts/ReportBarChart';
import ReportFunnel from '../charts/ReportFunnel';
import ReportStackedBar from '../charts/ReportStackedBar';
import ReportHeatmap from '../charts/ReportHeatmap';
import { AlertCircle } from 'lucide-react';

interface OverviewReportTabProps {
  charts: {
    scoreDistribution: { name: string; value: number }[];
    evaluationFunnel: { name: string; value: number }[];
    recordTypeDistribution: { name: string; value: number }[];
    attendanceTrend: { name: string; value: number }[];
  };
  attentionStudents: {
    _id: string;
    student_code: string;
    full_name: string;
    class_name: string;
    reason: string;
    severity: 'high' | 'medium';
  }[];
}

export default function OverviewReportTab({ charts, attentionStudents }: OverviewReportTabProps) {
  return (
    <div className="space-y-6 p-6">
      {/* Charts row 1: Distribution & Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportBarChart
          title="Phân bổ xếp loại rèn luyện"
          data={charts.scoreDistribution}
          valueSuffix="SV"
        />
        <ReportFunnel
          title="Tiến độ phê duyệt điểm rèn luyện"
          data={charts.evaluationFunnel}
        />
      </div>

      {/* Charts row 2: Records & Attendance Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportStackedBar
          title="Phân loại ghi nhận rèn luyện (Khen thưởng / Kỷ luật)"
          data={charts.recordTypeDistribution}
        />
        <ReportHeatmap
          title="Tỉ lệ chuyên cần các lớp (%)"
          data={charts.attendanceTrend}
        />
      </div>

      {/* Attention Required List */}
      <div className="bg-white/45 backdrop-blur-md border border-white/75 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-white/50 pb-3.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <AlertCircle size={16} />
          </div>
          <div>
            <h4 className="font-bold text-[#1E293B] text-[14px]">HSSV cần chú ý đặc biệt</h4>
            <p className="text-[11px] text-[#64748B] font-semibold mt-0.5">Danh sách học sinh có kết quả rèn luyện yếu, chuyên cần kém hoặc vi phạm kỷ luật</p>
          </div>
        </div>

        {attentionStudents.length === 0 ? (
          <div className="text-center py-6 text-[#64748B] text-xs font-semibold">
            Không có HSSV nào cần chú ý trong bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[12px] font-sans">
              <thead>
                <tr className="text-[#64748B] font-bold uppercase border-b border-white/50 text-[10px]">
                  <th className="px-4 py-2">Mã HSSV</th>
                  <th className="px-4 py-2">Họ & Tên</th>
                  <th className="px-4 py-2">Lớp</th>
                  <th className="px-4 py-2">Lý do cần chú ý</th>
                  <th className="px-4 py-2 text-right">Mức độ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/40 text-[#1E293B] font-semibold">
                {attentionStudents.map((stu) => (
                  <tr key={stu._id} className="hover:bg-white/60">
                    <td className="px-4 py-3">{stu.student_code}</td>
                    <td className="px-4 py-3 font-bold text-[#1E293B]">{stu.full_name}</td>
                    <td className="px-4 py-3">{stu.class_name}</td>
                    <td className="px-4 py-3 text-[#64748B] font-medium">{stu.reason}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-xl text-[9px] font-extrabold ${
                        stu.severity === 'high' 
                          ? 'bg-rose-500/10 border border-rose-500/20 text-rose-700' 
                          : 'bg-amber-500/10 border border-amber-500/20 text-amber-700'
                      }`}>
                        {stu.severity === 'high' ? 'Cao' : 'Trung bình'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
