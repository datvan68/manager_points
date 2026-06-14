import React, { useState, useEffect } from 'react';
import { History, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomPagination } from '@/components/ui/pagination';

export interface HistoryRecord {
  id: string;
  detailId: string;
  title: string;
  points: number;
  count: number;
  date: string;
  session: string;
  role: string;
  evaluatorName?: string;
  type: "reward" | "violation";
  status: string;
}

interface HistoryCardProps {
  rec: HistoryRecord;
  index: number;
  total: number;
  onDelete: () => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ rec, index, onDelete }) => {
  const isViolation = rec.type === "violation";

  let statusLabel = "Bản nháp";
  let statusStyle = "bg-slate-500/10 text-[#64748B] border-slate-500/10";
  if (rec.status === "teacher_evaluated") {
    statusLabel = "Cố vấn đã chấm";
    statusStyle = "bg-sky-500/10 text-sky-700 border-sky-500/25";
  } else if (rec.status === "supervisor_evaluated") {
    statusLabel = "Quản sinh đã chấm";
    statusStyle = "bg-amber-500/10 text-amber-700 border-amber-500/25";
  } else if (rec.status === "finalized") {
    statusLabel = "Đã phê duyệt";
    statusStyle = "bg-emerald-500/10 text-emerald-700 border-emerald-500/25";
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="relative flex flex-col gap-3.5 p-4.5 md:p-5 w-full bg-white/70 backdrop-blur-md border border-white/85 rounded-[24px] transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:-translate-y-1"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h5 className="font-bold text-[#1E293B] text-[14.5px] leading-snug break-words">
            {rec.title}
          </h5>
          <span
            className={`inline-flex items-center gap-1 self-start px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
              isViolation
                ? "bg-rose-500/10 text-rose-700 border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
            }`}
          >
            {isViolation ? "Vi phạm" : "Khen thưởng"}
          </span>
        </div>

        <div className="flex flex-col items-end shrink-0 text-right">
          <span
            className={`font-extrabold text-[17.5px] leading-none ${
              isViolation ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {isViolation ? "" : "+"}
            {rec.points}đ
          </span>
          <span className="text-[10px] text-[#64748B] font-bold mt-1.5 bg-slate-100/50 px-2 py-0.5 rounded-md border border-slate-200/20 font-sans">
            Đã chấm: {rec.count} lần
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3.5 pt-2.5 border-t border-slate-100/50 mt-1">
        <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-[#64748B] font-medium">
          <span className="bg-slate-100/70 border border-slate-200/30 px-2 py-0.5 rounded-lg shrink-0 font-bold font-sans">
            {rec.date} ({rec.session})
          </span>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold ${
              rec.role === "admin"
                ? "bg-purple-500/10 text-purple-700 border-purple-500/20"
                : rec.role === "teacher"
                  ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                  : rec.role === "supervisor"
                    ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
                    : "bg-slate-500/10 text-[#64748B] border-slate-500/20"
            }`}
          >
            Người chấm: {
              rec.role === "admin"
                ? "Quản trị viên"
                : rec.role === "teacher"
                  ? "Cố vấn"
                  : rec.role === "supervisor"
                    ? "Quản sinh"
                    : "Sinh viên"
            }
          </span>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-bold ${statusStyle}`}
          >
            {statusLabel}
          </span>
        </div>

        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer shadow-sm hover:scale-[1.05]"
          title="Xóa lịch sử ghi nhận này"
        >
          <Trash2 size={13} strokeWidth={2.5} />
        </button>
      </div>
    </motion.div>
  );
};

export interface ScoreHistoryPanelProps {
  historyRecords: HistoryRecord[];
  isHistoryFetching: boolean;
  historyPage: number;
  setHistoryPage: (page: number) => void;
  setRecordToDelete: (record: HistoryRecord) => void;
  setIsConfirmDeleteOpen: (open: boolean) => void;
}

export default function ScoreHistoryPanel({
  historyRecords,
  isHistoryFetching,
  historyPage,
  setHistoryPage,
  setRecordToDelete,
  setIsConfirmDeleteOpen,
}: ScoreHistoryPanelProps) {
  const pageSize = 10;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex-1 flex flex-col min-h-0 bg-white/40 rounded-3xl"
    >
      <div className="flex-1 overflow-y-auto px-1 pb-20 custom-scrollbar">
        {historyRecords.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#94a3b8] p-8 mt-10">
            <div className="w-20 h-20 rounded-full bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center justify-center mb-5">
              <History size={36} strokeWidth={1.5} />
            </div>
            <p className="text-[15px] font-bold text-[#475569] mb-1.5">
              Chưa có lịch sử
            </p>
            <p className="text-[13px] text-center max-w-[280px] leading-relaxed">
              Các thay đổi điểm số sẽ được ghi nhận và hiển thị chi tiết tại
              đây.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-2 max-w-4xl mx-auto w-full px-2 lg:px-4">
            {historyRecords
              .slice((historyPage - 1) * pageSize, historyPage * pageSize)
              .map((rec, index) => (
                <HistoryCard
                  key={rec.id}
                  rec={rec}
                  index={index}
                  total={historyRecords.length}
                  onDelete={() => {
                    setRecordToDelete(rec);
                    setIsConfirmDeleteOpen(true);
                  }}
                />
              ))}
          </div>
        )}
      </div>

      {historyRecords.length > 0 && (
        <div className="shrink-0 p-4 border-t border-slate-200/50 bg-white/60 backdrop-blur-md rounded-b-[32px]">
          <CustomPagination
            currentPage={historyPage}
            pageSize={pageSize}
            totalItems={historyRecords.length}
            onPageChange={(page) => {
              setHistoryPage(page);
            }}
            label="bản ghi"
            isLoading={isHistoryFetching}
          />
        </div>
      )}
    </motion.div>
  );
}
