'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AcademicRecord, academicRecordApi } from '@/api/academic-record-api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ReportTable, { TableColumn } from '../ReportTable';
import { AcademicRecordStudentSummaryRow } from '../report-types';

type RecordCategory = 'khen_thuong' | 'cong_diem' | 'ky_luat';

const categoryLabels: Record<RecordCategory, string> = {
  khen_thuong: 'Khen thưởng',
  cong_diem: 'Cộng điểm',
  ky_luat: 'Kỷ luật',
};

interface AcademicRecordReportTabProps {
  data: AcademicRecordStudentSummaryRow[];
  isLoading: boolean;
  onExport: () => void;
  serverSide?: boolean;
  totalItems?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  detailQuery?: {
    semesterId?: string;
    classId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  };
}

function resolveRecordCategory(record: AcademicRecord): RecordCategory | 'khac' {
  const criterionType = typeof record.criterion_id === 'object'
    ? record.criterion_id?.criterion_type
    : undefined;
  if (criterionType && criterionType in categoryLabels) return criterionType as RecordCategory;

  const title = (record.record_title || '').toLowerCase();
  const points = record.points_effect ?? record.effectivePoints ?? 0;
  if (title.includes('kỷ luật') || title.includes('vi phạm') || points < 0) return 'ky_luat';
  if (title.includes('khen thưởng') || title.includes('giải thưởng') || title.includes('xuất sắc')) return 'khen_thuong';
  return points > 0 ? 'cong_diem' : 'khac';
}

function CategoryButton({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Xem chi tiết ${label}`}
      disabled={count === 0}
      onClick={onClick}
      className="min-w-8 rounded-lg border border-[#1A73E8]/20 bg-[#1A73E8]/5 px-2 py-1 font-bold text-[#1A73E8] transition-colors hover:bg-[#1A73E8]/10 disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-[#64748B]"
    >
      {count}
    </button>
  );
}

export default function AcademicRecordReportTab({
  data,
  isLoading,
  onExport,
  serverSide,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  detailQuery,
}: AcademicRecordReportTabProps) {
  const [selection, setSelection] = useState<{ row: AcademicRecordStudentSummaryRow; category: RecordCategory } | null>(null);
  const [detailRecords, setDetailRecords] = useState<AcademicRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const requestIdRef = useRef(0);
  const detailSemesterId = detailQuery?.semesterId;
  const detailClassId = detailQuery?.classId;
  const detailSearch = detailQuery?.search;
  const detailStartDate = detailQuery?.startDate;
  const detailEndDate = detailQuery?.endDate;

  useEffect(() => {
    if (!selection) return;

    const requestId = ++requestIdRef.current;
    setDetailLoading(true);
    setDetailError('');
    setDetailRecords([]);

    academicRecordApi.getAcademicRecords({
      semesterId: detailSemesterId,
      classId: detailClassId,
      search: detailSearch,
      startDate: detailStartDate,
      endDate: detailEndDate,
      studentId: selection.row._id,
    }).then(response => {
      if (requestId !== requestIdRef.current) return;
      const records = Array.isArray(response) ? response : response.data;
      setDetailRecords((records as AcademicRecord[]).filter(record => resolveRecordCategory(record) === selection.category));
    }).catch(() => {
      if (requestId === requestIdRef.current) setDetailError('Không thể tải chi tiết ghi nhận. Vui lòng thử lại.');
    }).finally(() => {
      if (requestId === requestIdRef.current) setDetailLoading(false);
    });
  }, [selection, detailSemesterId, detailClassId, detailSearch, detailStartDate, detailEndDate]);

  const openCategory = (row: AcademicRecordStudentSummaryRow, category: RecordCategory) => {
    setSelection({ row, category });
  };

  const columns: TableColumn[] = [
    { key: 'student_code', header: 'Mã HSSV', className: 'font-bold text-[#1E293B]' },
    { key: 'full_name', header: 'Họ tên', className: 'font-bold text-[#1E293B]' },
    { key: 'class_name', header: 'Lớp' },
    { key: 'record_count', header: 'Số lượt', className: 'text-[11px]', render: (value: number) => <span>{value} lần</span> },
    { key: 'reward_count', header: 'Khen thưởng', render: (value: number, row: AcademicRecordStudentSummaryRow) => <CategoryButton label="Khen thưởng" count={value} onClick={() => openCategory(row, 'khen_thuong')} /> },
    { key: 'bonus_count', header: 'Cộng điểm', render: (value: number, row: AcademicRecordStudentSummaryRow) => <CategoryButton label="Cộng điểm" count={value} onClick={() => openCategory(row, 'cong_diem')} /> },
    { key: 'discipline_count', header: 'Kỷ luật', render: (value: number, row: AcademicRecordStudentSummaryRow) => <CategoryButton label="Kỷ luật" count={value} onClick={() => openCategory(row, 'ky_luat')} /> },
    { key: 'total_points', header: 'Tổng điểm', className: 'font-black' },
  ];

  return (
    <>
      <div className="p-6 text-xs">
        <ReportTable
          title="Tổng hợp Ghi nhận sinh viên"
          columns={columns}
          data={data}
          isLoading={isLoading}
          onExportExcel={onExport}
          label="sinh viên"
          emptyMessage="Không tìm thấy sinh viên có ghi nhận nào khớp với bộ lọc."
          serverSide={serverSide}
          totalItems={totalItems}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>

      <Dialog open={Boolean(selection)} onOpenChange={open => {
        if (!open) {
          requestIdRef.current++;
          setSelection(null);
        }
      }}>
        <DialogContent className="max-h-[85vh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-5 shadow-2xl sm:p-6">
          <DialogHeader className="border-b border-white/60 pb-3">
            <DialogTitle className="text-base font-bold text-[#1E293B]">
              Chi tiết {selection ? categoryLabels[selection.category].toLowerCase() : 'ghi nhận'}
            </DialogTitle>
            {selection && (
              <p className="text-xs font-medium text-[#64748B]">
                {selection.row.full_name} · {selection.row.student_code} · {selection.row.class_name}
              </p>
            )}
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải chi tiết...
            </div>
          ) : detailError ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm font-semibold text-red-700">{detailError}</p>
          ) : detailRecords.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-[#64748B]">Không có ghi nhận phù hợp với bộ lọc hiện tại.</p>
          ) : (
            <div className="space-y-2">
              {detailRecords.map(record => {
                const points = record.points_effect ?? record.effectivePoints ?? 0;
                const recordedAt = record.recorded_at || record.date_record || record.createdAt;
                return (
                  <article key={record._id} className="rounded-xl border border-white/80 bg-white/55 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-bold text-[#1E293B]">{record.record_title || (selection ? categoryLabels[selection.category] : 'Ghi nhận')}</h4>
                      <span className={`shrink-0 font-black ${points < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {points > 0 ? '+' : ''}{points} điểm
                      </span>
                    </div>
                    {record.description && <p className="mt-1 text-xs text-[#475569]">{record.description}</p>}
                    <p className="mt-2 text-[11px] font-semibold text-[#64748B]">
                      {recordedAt ? new Date(recordedAt).toLocaleDateString('vi-VN') : 'Chưa xác định ngày'}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
