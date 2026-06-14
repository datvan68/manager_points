'use client';
import React, { useState, useRef } from 'react';
import Popup from './Popup';
import { Download, UploadCloud, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { ImportValidationError } from './ImportResultPopup';
import ImportClassRecordResultPopup from './ImportClassRecordResultPopup';
import { classApi } from '@/api/class-api';
import { studentApi } from '@/api/student-api';
import { criteriaApi } from '@/api/criteria-api';
import { semesterApi } from '@/api/semester-api';
import { dailyClassReportApi } from '@/api/daily-class-report-api';
import { academicRecordApi } from '@/api/academic-record-api';
import { summariesPointApi } from '@/api/summaries-point-api';
import { evaluationDetailApi } from '@/api/evaluation-detail-api';
import { useAuth } from '@/providers/auth-provider';

interface ImportClassRecordPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const normalizeText = (value: unknown) =>
  (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getDateKey = (value: string) => value.split('T')[0];

const isAbsentCriterion = (criterion: any) =>
  normalizeText(criterion?.criterion_name).includes('vang');

const getRowValue = (row: any, keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  const normalizedMap = new Map<string, any>();
  Object.keys(row).forEach((key) => normalizedMap.set(normalizeText(key), row[key]));
  for (const key of keys) {
    const value = normalizedMap.get(normalizeText(key));
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
};

export default function ImportClassRecordPopup({ isOpen, onClose, onSuccess }: ImportClassRecordPopupProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showResultPopup, setShowResultPopup] = useState(false);
  const [importStats, setImportStats] = useState<{ reports: number; records: number; errors: ImportValidationError[] }>({ reports: 0, records: 0, errors: [] });

  const handleDownloadTemplate = () => {
    try {
      const headers = [['Ma lop', 'Ngay bao cao', 'Giang vien ghi nhan', 'Ma sinh vien', 'Tieu chi', 'Ghi chu lop', 'Ghi chu ghi nhan', 'Trang thai']];
      const sample = [['CS101','15/05/2026','Nguyen Van A','SV202601','Vắng có phép','Ghi chú lớp','Ghi chú ghi nhận','active']];
      const ws = XLSX.utils.aoa_to_sheet([...headers, ...sample]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Import_Class_Records');
      XLSX.writeFile(wb, 'Mau_Import_Class_Records.xlsx');
      toast.success('Đã tải file mẫu');
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi tạo file mẫu');
    }
  };

  const validateAndSetFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') { toast.error('Chỉ chấp nhận file Excel'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('Dung lượng vượt quá 10MB'); return; }
    setFile(f);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) validateAndSetFile(e.target.files[0]);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeAndReset = () => {
    setFile(null);
    setIsImporting(false);
    setImportStats({ reports: 0, records: 0, errors: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowResultPopup(false);
    onClose();
  };

  const handleStartImport = async () => {
    if (!file) { toast.error('Chọn file'); return; }
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(sheet) as any[];
        if (!rawRows || rawRows.length === 0) throw new Error('Tệp Excel rỗng');
        if (rawRows.length > 5000) throw new Error('Giới hạn 5.000 dòng');

        // load references
        const [allClasses, allStudentsRes, allCriteria, allSemesters] = await Promise.all([
          classApi.getClasses(), studentApi.getStudents(), criteriaApi.getCriteria(), semesterApi.getSemesters()
        ]);
        const allStudents = Array.isArray(allStudentsRes) ? allStudentsRes : (allStudentsRes?.data || []);

        const errors: ImportValidationError[] = [];
        const activeSem = allSemesters.find((ss:any) => ss.status === 'active');
        if (!activeSem?._id) {
          setImportStats({
            reports: 0,
            records: 0,
            errors: [{ row: 0, reason: 'Khong co hoc ky active. Vui long cau hinh hoc ky active truoc khi import.' }]
          });
          setShowResultPopup(true);
          return;
        }

        const currentUserId = getObjectId(user);
        if (!currentUserId) {
          throw new Error('Khong xac dinh duoc nguoi dung dang nhap de tao bao cao');
        }

        const existingReports = await dailyClassReportApi.getDailyClassReports();
        const existingReportKeys = new Set(
          existingReports.map((report: any) => `${getObjectId(report.class_id)}||${getDateKey(report.report_date)}`)
        );
        const seenRecordKeys = new Map<string, number>();

        // group rows by class + date + teacher
        const groups = new Map<string, { rows: any[]; classObj: any; reportDate: string; teacherName: string }>();

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          const rowNumber = i + 2;
          const classCode = (row['Ma lop'] || row['Mã lớp'] || row['class_code'] || '').toString().trim();
          const dateRaw = row['Ngay bao cao'] || row['Ngày báo cáo'] || row['report_date'];
          const teacher = (row['Giang vien ghi nhan'] || row['Giảng viên'] || row['teacher'] || '').toString().trim();
          const studentCode = (row['Ma sinh vien'] || row['Mã SV'] || row['student_code'] || '').toString().trim();
          const criterionRaw = row['Tieu chi'] || row['Tiêu chí'] || row['criterion'] || '';
          const noteClass = row['Ghi chu lop'] || row['Ghi chú lớp'] || row['class_note'] || '';
          const noteRecord = row['Ghi chu ghi nhan'] || row['Ghi chú ghi nhận'] || row['record_note'] || '';
          const statusRaw = row['Trang thai'] || row['Trạng thái'] || row['status'];

          if (!classCode) { errors.push({ row: rowNumber, studentCode: studentCode || undefined, fullName: undefined, reason: 'Thiếu Ma lop' }); continue; }
          if (!teacher) { errors.push({ row: rowNumber, studentCode: studentCode || undefined, fullName: undefined, reason: 'Thiếu Giang vien' }); continue; }
          if (!studentCode) { errors.push({ row: rowNumber, studentCode: undefined, fullName: undefined, reason: 'Thiếu Ma sinh vien' }); continue; }
          if (!criterionRaw) { errors.push({ row: rowNumber, studentCode, fullName: undefined, reason: 'Thiếu Tieu chi' }); continue; }
          if (dateRaw === undefined || dateRaw === null || dateRaw === '') { errors.push({ row: rowNumber, studentCode, fullName: undefined, reason: 'Thiếu Ngay bao cao' }); continue; }

          // resolve class
          const normalizedClassCode = normalizeText(classCode);
          const foundClass = allClasses.find((c: any) =>
            c._id === classCode ||
            normalizeText(c.class_code) === normalizedClassCode ||
            normalizeText(c.class_name) === normalizedClassCode
          );
          if (!foundClass) { errors.push({ row: rowNumber, studentCode, fullName: undefined, reason: `Không tìm thấy lớp: ${classCode}` }); continue; }

          // resolve student
          const normalizedStudentCode = normalizeText(studentCode);
          const foundStudent = allStudents.find((s: any) => s._id === studentCode || normalizeText(s.student_code) === normalizedStudentCode);
          if (!foundStudent) { errors.push({ row: rowNumber, studentCode, fullName: undefined, reason: `Không tìm thấy sinh viên: ${studentCode}` }); continue; }
          // student must belong to class
          const studentClassId = typeof foundStudent.class_id === 'object' ? foundStudent.class_id?._id : foundStudent.class_id;
          if (studentClassId !== foundClass._id) { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Sinh viên không thuộc lớp ${classCode}` }); continue; }

          // resolve criterion
          const critName = criterionRaw.toString().trim();
          const normalizedCriterion = normalizeText(critName);
          const foundCriterion = allCriteria.find((c: any) =>
            c._id === critName ||
            normalizeText(c.criterion_code) === normalizedCriterion ||
            normalizeText(c.criterion_name) === normalizedCriterion
          );
          if (!foundCriterion) { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Không tìm thấy tiêu chí: ${critName}` }); continue; }

          // parse report date
          let reportDateIso = '';
          if (typeof dateRaw === 'number') {
            const js = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
            if (isNaN(js.getTime())) { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Ngày báo cáo không hợp lệ: ${dateRaw}` }); continue; }
            reportDateIso = js.toISOString();
          } else {
            const s = dateRaw.toString().trim();
            const dmy = /^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$/;
            const m = s.match(dmy);
            if (m) {
              const day = parseInt(m[1],10), month = parseInt(m[2],10)-1, year = parseInt(m[3],10);
              const parsed = new Date(year, month, day);
              if (isNaN(parsed.getTime()) || parsed.getDate() !== day) { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Ngày báo cáo không tồn tại: ${s}` }); continue; }
              reportDateIso = parsed.toISOString();
            } else {
              const parsed = new Date(s);
              if (isNaN(parsed.getTime())) { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Ngày báo cáo không hợp lệ: ${s}` }); continue; }
              reportDateIso = parsed.toISOString();
            }
          }

          // validate status
          const status = statusRaw ? statusRaw.toString().trim().toLowerCase() : 'active';
          if (status && status !== 'active' && status !== 'inactive') { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Trạng thái không hợp lệ: ${statusRaw}` }); continue; }

          const reportDateKey = getDateKey(reportDateIso);
          const recordKey = `${foundClass._id}||${reportDateKey}||${foundStudent._id}||${foundCriterion._id}`;
          const firstDuplicateRow = seenRecordKeys.get(recordKey);
          if (firstDuplicateRow) {
            errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Trung ghi nhan voi dong ${firstDuplicateRow}` });
            continue;
          }
          seenRecordKeys.set(recordKey, rowNumber);

          // group key
          const key = `${foundClass._id}||${reportDateKey}`;
          const entry = groups.get(key) || { rows: [], classObj: foundClass, reportDate: reportDateIso, teacherName: teacher };
          entry.rows.push({ rowNumber, student: foundStudent, criterion: foundCriterion, noteClass, noteRecord, status });
          groups.set(key, entry);
        }

        let reportsCreated = 0;
        let recordsCreated = 0;
        let summariesCache: any[] = [];
        try {
          const summariesRes = await summariesPointApi.getSummariesPoints();
          summariesCache = Array.isArray(summariesRes) ? summariesRes : (summariesRes?.data || []);
        } catch (e) {
          console.warn('Khong the nap summaries point', e);
        }
        const evaluationDetailsCache = new Map<string, any[]>();

        // process groups
        for (const [key, group] of groups.entries()) {
          if (existingReportKeys.has(key)) {
            group.rows.forEach(r => errors.push({ row: r.rowNumber, studentCode: r.student.student_code, fullName: r.student.full_name, reason: 'Bao cao lop da ton tai cho lop va ngay nay' }));
            continue;
          }

          // validate group level: must have class, teacher, reportDate
          if (!group.classObj || !group.teacherName) {
            group.rows.forEach(r => errors.push({ row: r.rowNumber, studentCode: r.student?.student_code, fullName: r.student?.full_name, reason: 'Thông tin report không hợp lệ' }));
            continue;
          }

          // Create daily class report
          try {
            // compute absent/present based on criteria (simple heuristic)
            const absentCritNames = new Set<string>();
            // assume criteria already loaded above
            const uniqueStudents = new Set<string>();
            let absentCount = 0;
            group.rows.forEach((r:any) => { uniqueStudents.add(r.student._id); if ((r.criterion.criterion_name || '').toLowerCase().includes('vắng')) absentCount++; });
            const totalPresent = Math.max(0, uniqueStudents.size - absentCount);
            const classStudents = allStudents.filter((student: any) => getObjectId(student.class_id) === group.classObj._id);
            const absentStudentIds = new Set<string>();
            group.rows.forEach((r:any) => {
              if (isAbsentCriterion(r.criterion)) absentStudentIds.add(r.student._id);
            });
            const safeAbsentCount = absentStudentIds.size;
            const safeTotalPresent = Math.max(0, classStudents.length - safeAbsentCount);

            const reportDto = {
              class_id: group.classObj._id,
              reported_by: currentUserId,
              report_date: group.reportDate,
              teacher_name: group.teacherName,
              total_present: safeTotalPresent,
              total_absent: safeAbsentCount,
              class_notes: group.rows[0]?.noteClass || ''
            } as any;

            const createdReport = await dailyClassReportApi.createDailyClassReport(reportDto);
            reportsCreated++;

            // For each row create summaries/evaluationDetail/academicRecord
            for (const r of group.rows) {
              try {
                // ensure summariesPoint exists
                let summary = null;
                try {
                  const summaryList = summariesCache;
                  summary = summaryList.find((s:any) => {
                    const sId = getObjectId(s.student_id);
                    const semId = getObjectId(s.semester_id);
                    const activeId = activeSem._id;
                    return sId === r.student._id && semId === activeId;
                  });
                } catch (e) {
                  console.warn('Không thể nạp summaries point', e);
                }
                if (!summary) {
                  const activeSem = allSemesters.find((ss:any) => ss.status === 'active');
                  if (!activeSem) {
                    errors.push({ row: r.rowNumber, studentCode: r.student.student_code, fullName: r.student.full_name, reason: 'Không có học kỳ active' });
                    continue;
                  }
                  summary = await summariesPointApi.createSummariesPoint({ student_id: r.student._id, semester_id: activeSem._id, total_score: 100, grading: 'Xuất sắc', status: 'draft' });
                }

                // evaluation detail
                let evalDetails = evaluationDetailsCache.get(summary._id);
                if (!evalDetails) {
                  try { evalDetails = await evaluationDetailApi.getEvaluationDetailsBySummary(summary._id); } catch (e) { evalDetails = []; }
                  evaluationDetailsCache.set(summary._id, evalDetails);
                }
                let evalDetail = evalDetails.find(d => { const cId = getObjectId(d.criterion_id); return cId === r.criterion._id; });
                if (!evalDetail) {
                  evalDetail = await evaluationDetailApi.createEvaluationDetail({ summary_id: summary._id, criterion_id: r.criterion._id, current_count: 0, status: 'draft', description: `Tạo tự động từ import`, log: [] });
                }

                // create academic record
                await academicRecordApi.createAcademicRecord({
                  student_id: r.student._id,
                  criterion_id: r.criterion._id,
                  semester_id: activeSem._id,
                  record_title: r.criterion.criterion_name,
                  description: r.noteRecord || '',
                  daily_report_id: createdReport._id,
                  status: r.status || 'active',
                  recorded_at: group.reportDate,
                  recorded_by: currentUserId
                });
                recordsCreated++;
              } catch (recErr:any) {
                console.error('Error creating academic record', recErr);
                errors.push({ row: r.rowNumber, studentCode: r.student.student_code, fullName: r.student.full_name, reason: recErr?.message || 'Lỗi khi tạo ghi nhận sinh viên' });
              }
            }
          } catch (repErr:any) {
            console.error('Error creating report', repErr);
            group.rows.forEach(r => errors.push({ row: r.rowNumber, studentCode: r.student.student_code, fullName: r.student.full_name, reason: repErr?.message || 'Lỗi khi tạo báo cáo lớp' }));
          }
        }

        // finalize
        setImportStats({ reports: reportsCreated, records: recordsCreated, errors });
        setShowResultPopup(true);
        // reset file input but keep popup open per spec
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if ((reportsCreated > 0 || recordsCreated > 0) && onSuccess) onSuccess();
      } catch (err:any) {
        console.error(err);
        toast.error(err?.message || 'Lỗi khi import');
      } finally {
        setIsImporting(false);
      }
    };
    reader.onerror = () => { toast.error('Lỗi đọc file'); setIsImporting(false); };
    reader.readAsArrayBuffer(file);
  };

  return (
    <>
    <Popup isOpen={isOpen} onClose={closeAndReset} className="max-w-[600px]" contentClassName="p-0">
      <div className="bg-white flex flex-col items-start overflow-hidden rounded-[12px] w-full font-sans">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 w-full shrink-0">
          <h2 className="text-[18px] font-bold text-[#0f172a] leading-7">Import Báo cáo lớp và Ghi nhận</h2>
        </div>

        <div className="flex flex-col gap-3 px-6 py-5 w-full overflow-y-auto max-h-[75vh]">
          <div className="flex gap-2 items-center w-full">
            <div className="bg-[#d8e2ff] flex items-center justify-center rounded-full shrink-0 w-6 h-6">
              <span className="font-bold text-[#004493] text-xs">1</span>
            </div>
            <h3 className="font-bold text-[#0f172a] text-xs tracking-wider uppercase">BƯỚC 1: TẢI FILE MẪU</h3>
          </div>
          <div className="pl-8">
            <button onClick={handleDownloadTemplate} className="border border-blue-100 hover:bg-blue-50 text-[#1a73e8] flex gap-2 items-center px-4 py-2 rounded-lg text-xs font-bold">
              <Download size={14} /> Tải file mẫu (.xlsx)
            </button>
          </div>

          <div className="flex gap-2 items-center w-full">
            <div className="bg-[#d8e2ff] flex items-center justify-center rounded-full shrink-0 w-6 h-6">
              <span className="font-bold text-[#004493] text-xs">2</span>
            </div>
            <h3 className="font-bold text-[#0f172a] text-xs tracking-wider uppercase">BƯỚC 2: TẢI TỆP LÊN</h3>
          </div>

          <div className="w-full pl-8">
            <div className={`bg-[#f8fafc] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer select-none ${dragActive ? 'border-blue-500 bg-blue-50/20' : 'border-[#cbd5e1] hover:border-blue-400 hover:bg-slate-50/50'}`} onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} disabled={isImporting} />
              {file ? (
                <div className="flex flex-col items-center gap-3 w-full" onClick={(e) => e.stopPropagation()}>
                  <div className="bg-emerald-50 rounded-full w-12 h-12 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100"><FileSpreadsheet size={24} /></div>
                  <div className="flex flex-col items-center max-w-[85%]"><p className="text-[14px] font-bold text-slate-800 truncate w-full">{file.name}</p><p className="text-xs text-slate-400 font-medium mt-0.5">{(file.size/1024).toFixed(1)} KB</p></div>
                  <button type="button" onClick={handleRemoveFile} className="mt-1 text-xs text-rose-500 hover:text-rose-700 font-bold px-3 py-1 hover:bg-rose-50 rounded-lg">Chọn tệp khác</button>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50/70 rounded-full w-12 h-12 flex items-center justify-center text-blue-600 mb-3 shadow-sm border border-blue-100/50"><UploadCloud size={24} /></div>
                  <p className="text-[14px] font-semibold text-slate-800 leading-6 px-2">Kéo thả tệp hoặc nhấn để chọn</p>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">Chấp nhận .xlsx, .xls (Tối đa 10MB) - Tối đa 5.000 dòng</p>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2 items-center w-full pt-2">
            <div className="bg-[#d8e2ff] flex items-center justify-center rounded-full shrink-0 w-6 h-6"><span className="font-bold text-[#004493] text-xs">3</span></div>
            <h3 className="font-bold text-[#0f172a] text-xs tracking-wider uppercase">BƯỚC 3: XỬ LÝ & IMPORT</h3>
          </div>
          <div className="pl-8 text-slate-500 text-sm">Hệ thống sẽ xác thực theo Mã lớp, Mã SV, Tiêu chí và Ngày báo cáo. Các báo cáo/lưu ghi nhận hợp lệ sẽ được tạo, bản ghi lỗi được báo cáo.</div>
        </div>

        <div className="bg-slate-50 flex gap-3 items-center justify-end px-6 py-4 border-t border-slate-100 w-full shrink-0">
          <button type="button" onClick={closeAndReset} disabled={isImporting} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg">Hủy bỏ</button>
          <button type="button" onClick={handleStartImport} disabled={!file || isImporting} className="bg-[#1a73e8] hover:bg-blue-700 disabled:bg-blue-300 text-white flex gap-1.5 items-center px-5 py-2.5 rounded-lg text-xs font-bold">{isImporting && <Loader2 size={14} className="animate-spin"/>}{isImporting ? 'Đang import...' : 'Bắt đầu Import'}</button>
        </div>
      </div>
    </Popup>

    <ImportClassRecordResultPopup isOpen={showResultPopup} onClose={() => { setShowResultPopup(false); if ((importStats.reports > 0 || importStats.records > 0) && onSuccess) onSuccess(); }} reportsCount={importStats.reports} recordsCount={importStats.records} errors={importStats.errors} />
    </>
  );
}
