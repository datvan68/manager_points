'use client';

import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import Popup from '@/components/popups/Popup';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { dormitoryApi, DormitoryRosterImportResponse, DormitoryRosterImportRowInput } from '@/api/dormitory-api';
import { semesterApi } from '@/api/semester-api';
import { runRosterBatches } from './roster-batch';
import RosterOperationProgressDialog, { RosterOperationProgress } from './RosterOperationProgressDialog';

export const DORMITORY_ROSTER_HEADERS = ['Họ và tên', 'Ngày sinh', 'Giới tính', 'Số điện thoại', 'Mã phòng'] as const;
const REQUIRED_DORMITORY_ROSTER_HEADERS = DORMITORY_ROSTER_HEADERS.slice(0, 4);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_ROWS = 5000;
const PHONE_PATTERN = /^[0-9+().\s-]{8,20}$/;

export interface DormitoryRosterImportValidationError {
  row: number;
  field?: string;
  reason: string;
}

export interface ParsedDormitoryRosterRow extends DormitoryRosterImportRowInput {
  rowNumber: number;
}

export function formatDormitoryRosterRowRanges(rows: number[]): string {
  const sortedRows = [...new Set(rows)].filter(Number.isFinite).sort((left, right) => left - right);
  const ranges: string[] = [];
  for (let index = 0; index < sortedRows.length; index += 1) {
    const start = sortedRows[index];
    let end = start;
    while (sortedRows[index + 1] === end + 1) end = sortedRows[++index];
    ranges.push(start === end ? String(start) : `${start}–${end}`);
  }
  return ranges.join(', ');
}

export function groupDormitoryRosterImportResults(results: ReadonlyArray<DormitoryRosterImportResponse['results'][number]>) {
  const groups = new Map<string, { status: DormitoryRosterImportResponse['results'][number]['status']; reason?: string; rows: number[] }>();
  for (const item of results) {
    const key = `${item.status}\u0000${item.reason || ''}`;
    const group = groups.get(key) || { status: item.status, reason: item.reason, rows: [] };
    group.rows.push(item.row);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function validateDormitoryRosterFile(file: Pick<File, 'name' | 'size'>): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension !== 'xlsx' && extension !== 'xls') return 'Chỉ chấp nhận tệp Excel (.xlsx, .xls).';
  if (file.size > MAX_FILE_SIZE) return 'Dung lượng tệp vượt quá 10 MB.';
  return null;
}

export function normalizeDormitoryRosterGender(value: unknown): DormitoryRosterImportRowInput['gender'] | null {
  const normalized = String(value ?? '').trim().toLocaleLowerCase('vi-VN');
  return ({ male: 'Male', female: 'Female', other: 'Other', nam: 'Male', nữ: 'Female', khac: 'Other', khác: 'Other' } as Record<string, DormitoryRosterImportRowInput['gender']>)[normalized] || null;
}

function excelSerialToDate(value: number) {
  const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeDormitoryRosterDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = excelSerialToDate(value);
    return date?.toISOString().slice(0, 10) || null;
  }
  const raw = String(value ?? '').trim();
  const vietnamese = raw.match(/^(\d{1,2})[\\/-](\d{1,2})[\\/-](\d{2,4})$/);
  if (vietnamese) {
    const year = Number(vietnamese[3].length === 2 ? `20${vietnamese[3]}` : vietnamese[3]);
    const date = new Date(Date.UTC(year, Number(vietnamese[2]) - 1, Number(vietnamese[1])));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== Number(vietnamese[2]) - 1 || date.getUTCDate() !== Number(vietnamese[1])) return null;
    return date.toISOString().slice(0, 10);
  }
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    if (date.getUTCFullYear() !== Number(iso[1]) || date.getUTCMonth() !== Number(iso[2]) - 1 || date.getUTCDate() !== Number(iso[3])) return null;
    return date.toISOString().slice(0, 10);
  }
  return null;
}

const textCell = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
const normalizedHeader = (value: unknown) => textCell(value).replace(/^\uFEFF/, '').normalize('NFKC').toLocaleLowerCase('vi-VN');

export function parseDormitoryRosterRows(rawRows: unknown[][]): { rows: ParsedDormitoryRosterRow[]; errors: DormitoryRosterImportValidationError[]; nonEmptyRowCount: number } {
  const errors: DormitoryRosterImportValidationError[] = [];
  const header = Array.isArray(rawRows[0]) ? rawRows[0] : [];
  const headerIndexes = new Map<string, number>();
  header.forEach((value, index) => {
    const key = normalizedHeader(value);
    if (key) headerIndexes.set(key, index);
  });
  const requiredHeaders = REQUIRED_DORMITORY_ROSTER_HEADERS.map(normalizedHeader);
  const optionalRoomHeader = normalizedHeader(DORMITORY_ROSTER_HEADERS[4]);
  const nonEmptyHeaderCount = header.filter(value => textCell(value)).length;
  const headersValid = header.length > 0
    && [requiredHeaders.length, DORMITORY_ROSTER_HEADERS.length].includes(nonEmptyHeaderCount)
    && requiredHeaders.every(value => headerIndexes.has(value))
    && (nonEmptyHeaderCount === requiredHeaders.length || headerIndexes.has(optionalRoomHeader));
  if (!headersValid) return { rows: [], errors: [{ row: 1, reason: `Tiêu đề phải gồm bốn cột bắt buộc: ${REQUIRED_DORMITORY_ROSTER_HEADERS.join(', ')}; có thể thêm Mã phòng.` }], nonEmptyRowCount: 0 };

  const dataRows = rawRows.slice(1).map((row, index) => ({ row: Array.isArray(row) ? row : [], rowNumber: index + 2 })).filter(({ row }) => row.some(value => textCell(value)));
  if (dataRows.length === 0) return { rows: [], errors: [{ row: 1, reason: 'Tệp Excel không chứa dòng dữ liệu.' }], nonEmptyRowCount: 0 };
  if (dataRows.length > MAX_ROWS) return { rows: [], errors: [{ row: 1, reason: 'Số lượng dòng dữ liệu vượt quá giới hạn 5.000.' }], nonEmptyRowCount: dataRows.length };

  const rows: ParsedDormitoryRosterRow[] = [];
  for (const { row, rowNumber } of dataRows) {
    const fullName = textCell(row[headerIndexes.get(normalizedHeader(DORMITORY_ROSTER_HEADERS[0]))!]);
    const dateOfBirth = normalizeDormitoryRosterDate(row[headerIndexes.get(normalizedHeader(DORMITORY_ROSTER_HEADERS[1]))!]);
    const gender = normalizeDormitoryRosterGender(row[headerIndexes.get(normalizedHeader(DORMITORY_ROSTER_HEADERS[2]))!]);
    const phoneNumber = textCell(row[headerIndexes.get(normalizedHeader(DORMITORY_ROSTER_HEADERS[3]))!]);
    const roomCode = textCell(row[headerIndexes.get(optionalRoomHeader) ?? -1]);
    const rowErrors: DormitoryRosterImportValidationError[] = [];
    if (fullName.length < 2) rowErrors.push({ row: rowNumber, field: 'Họ và tên', reason: 'Họ và tên không hợp lệ.' });
    if (!dateOfBirth || dateOfBirth >= new Date().toISOString().slice(0, 10)) rowErrors.push({ row: rowNumber, field: 'Ngày sinh', reason: 'Ngày sinh phải là ngày hợp lệ trong quá khứ.' });
    if (!gender) rowErrors.push({ row: rowNumber, field: 'Giới tính', reason: 'Giới tính phải là Nam, Nữ, Khác hoặc giá trị canonical tương ứng.' });
    if (!PHONE_PATTERN.test(phoneNumber)) rowErrors.push({ row: rowNumber, field: 'Số điện thoại', reason: 'Số điện thoại không hợp lệ.' });
    if (rowErrors.length) errors.push(...rowErrors);
    else rows.push({ rowNumber, full_name: fullName, date_of_birth: dateOfBirth!, gender: gender!, phone_number: phoneNumber, room_code: roomCode || undefined });
  }
  return { rows, errors, nonEmptyRowCount: dataRows.length };
}

interface DormitoryRosterImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onOperationStateChange?: (pending: boolean) => void;
}

export default function DormitoryRosterImportModal({ isOpen, onClose, onSuccess, onOperationStateChange }: DormitoryRosterImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedDormitoryRosterRow[]>([]);
  const [errors, setErrors] = useState<DormitoryRosterImportValidationError[]>([]);
  const [result, setResult] = useState<DormitoryRosterImportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [importConfirmationOpen, setImportConfirmationOpen] = useState(false);
  const [skippedRows, setSkippedRows] = useState(0);
  const [operationProgress, setOperationProgress] = useState<RosterOperationProgress | null>(null);
  const [operationPending, setOperationPending] = useState(false);
  const [semesterWarning, setSemesterWarning] = useState('');
  const errorGroups = Object.values(errors.reduce<Record<number, DormitoryRosterImportValidationError[]>>((groups, error) => {
    (groups[error.row] ||= []).push(error);
    return groups;
  }, {}));
  const importResultGroups = result ? groupDormitoryRosterImportResults(result.results) : [];

  const reset = () => {
    dragDepth.current = 0;
    setFile(null); setPreviewRows([]); setErrors([]); setResult(null); setBusy(false); setIsDraggingFile(false); setImportConfirmationOpen(false); setSkippedRows(0); setOperationProgress(null); setOperationPending(false); setSemesterWarning('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const close = () => { if (busy) return; reset(); onClose(); };

  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet([[...DORMITORY_ROSTER_HEADERS], ['Nguyễn Văn A', '02/01/2004', 'Nam', '0912345678', 'P101']]);
      worksheet['D2'].t = 's'; worksheet['D2'].z = '@';
      worksheet['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh_sach_KTX');
      XLSX.writeFile(workbook, 'Mau_Import_Danh_sach_KTX.xlsx');
      toast.success('Đã tải tệp mẫu Excel.');
    } catch { toast.error('Không thể tạo tệp mẫu.'); }
  };

  const selectFile = (selected: File) => {
    const validation = validateDormitoryRosterFile(selected);
    if (validation) { toast.error(validation); return; }
    setFile(selected); setPreviewRows([]); setErrors([]); setResult(null); setImportConfirmationOpen(false); setSkippedRows(0);
  };

  const handleFileDragEnter = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (busy || !event.dataTransfer.types.includes('Files')) return;
    dragDepth.current += 1;
    setIsDraggingFile(true);
  };

  const handleFileDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setIsDraggingFile(false);
  };

  const handleFileDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDraggingFile(false);
    if (busy) return;
    const selected = event.dataTransfer.files?.[0];
    if (selected) selectFile(selected);
  };

  const previewFile = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(new Uint8Array(data), { type: 'array', cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][];
      const parsed = parseDormitoryRosterRows(rawRows);
      setPreviewRows(parsed.rows); setErrors(parsed.errors);
    } catch { setPreviewRows([]); setErrors([{ row: 1, reason: 'Không thể đọc tệp Excel.' }]); }
    finally { setBusy(false); }
  };

  const importRows = async () => {
    if (!previewRows.length) return;
    const snapshot = Object.freeze(previewRows.slice());
    setBusy(true);
    setImportConfirmationOpen(false);
    setOperationProgress({ phase: 'preparing', processed: 0, total: snapshot.length, counters: { created: 0, duplicated: 0, failed: 0, linked: 0, unlinked: 0, conflicts: 0 }, unconfirmed: 0, unsent: 0 });
    setOperationPending(true);
    onOperationStateChange?.(true);
    onClose();
    try {
      const semesters = await semesterApi.getSemesters();
      const active = semesters.filter(item => item.status === 'active');
      if (active.length !== 1) {
        setOperationProgress(current => current ? { ...current, phase: 'interrupted', unsent: snapshot.length, message: active.length ? 'Có nhiều học kỳ active; import đã dừng trước khi gửi batch.' : 'Chưa có học kỳ active; import đã dừng trước khi gửi batch.' } : current);
        return;
      }
      const pinnedSemesterId = active[0]._id;
      setOperationProgress(current => current ? { ...current, phase: 'processing' } : current);
      const batchRun = await runRosterBatches<ParsedDormitoryRosterRow, DormitoryRosterImportResponse>(snapshot, 50, async batch => {
        const response = await dormitoryApi.roster.importRows(batch.map(({ rowNumber: _rowNumber, ...row }) => row), pinnedSemesterId);
        return { ...response, results: response.results.map(item => ({ ...item, row: batch[item.row - 2]?.rowNumber || item.row })) };
      }, state => {
        const parts = state.acknowledged;
        const totals = parts.reduce((total, part) => ({ created: total.created + part.created, duplicated: total.duplicated + part.duplicated, failed: total.failed + part.failed, linked: total.linked + (part.linked || 0), unlinked: total.unlinked + (part.unlinked || 0), conflicts: total.conflicts + (part.conflicts || 0) }), { created: 0, duplicated: 0, failed: 0, linked: 0, unlinked: 0, conflicts: 0 });
        setOperationProgress({ phase: state.status === 'interrupted' ? 'interrupted' : state.status === 'partial' ? 'partial' : state.status === 'completed' ? 'completed' : 'processing', processed: state.processed, total: state.total, counters: totals, unconfirmed: state.unconfirmed.length, unsent: state.unsent.length });
      }, response => response.failed > 0);
      if (batchRun.status === 'interrupted') toast.error('Import bị gián đoạn; các dòng chưa xác nhận vẫn được giữ lại để xem xét.');
      const response = batchRun.acknowledged.reduce((total, part) => ({ requested: total.requested + part.requested, created: total.created + part.created, duplicated: total.duplicated + part.duplicated, failed: total.failed + part.failed, linked: (total.linked || 0) + (part.linked || 0), unlinked: (total.unlinked || 0) + (part.unlinked || 0), conflicts: (total.conflicts || 0) + (part.conflicts || 0), results: [...total.results, ...part.results] }), { requested: 0, created: 0, duplicated: 0, failed: 0, results: [] } as DormitoryRosterImportResponse);
      if (batchRun.status !== 'interrupted') setResult(response);
      setFile(null); setPreviewRows([]); setErrors([]);
      if (response.created > 0) { onSuccess?.(); toast.success(`Đã nhập ${response.created} dòng vào Danh sách KTX.`); }
      if (response.duplicated > 0) toast.warning(`Đã bỏ qua ${response.duplicated} dòng trùng trong Danh sách KTX.`);
      if (response.failed > 0) toast.error(`${response.failed} dòng không thể import. Xem chi tiết bên dưới.`);
      if (!response.created && !response.duplicated && !response.failed) toast.warning('Không có dòng mới được tạo.');
    } catch (error: any) {
      setOperationProgress(current => current ? { ...current, phase: 'interrupted', unconfirmed: 0, unsent: snapshot.length, message: error?.message || 'Không thể nhập Danh sách KTX.' } : current);
      toast.error(error?.message || 'Không thể nhập Danh sách KTX.');
    } finally { setBusy(false); setOperationPending(false); onOperationStateChange?.(false); }
  };

  const closeOperation = (open: boolean) => { if (!operationPending && !open) { reset(); onClose(); } };

  return <>
  <Popup isOpen={isOpen && !operationProgress} onClose={close} title="Nhập Danh sách KTX từ Excel" className="max-w-3xl" contentClassName="flex min-h-0 flex-1 flex-col p-0">
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      {semesterWarning && <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{semesterWarning}</p>}
      <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800"><FileSpreadsheet size={18} className="mt-0.5 shrink-0" /><span>Bốn cột bắt buộc: Họ và tên, Ngày sinh, Giới tính, Số điện thoại. Có thể thêm Mã phòng để tự xếp vào giường trống đầu tiên của phòng đó.</span></div>
      {!result && <>
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800">1. Tải tệp mẫu</h3><p className="text-xs text-slate-500">Tối đa 10 MB và 5.000 dòng không rỗng.</p></div><button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download size={15} />Tải tệp mẫu</button></div>
        <div><h3 className="mb-2 text-sm font-bold text-slate-800">2. Chọn tệp</h3><label onDragEnter={handleFileDragEnter} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; if (!busy) setIsDraggingFile(true); }} onDragLeave={handleFileDragLeave} onDrop={handleFileDrop} className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-7 text-center transition-colors ${isDraggingFile ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-300 bg-slate-50 hover:border-blue-400'}`}><Upload size={22} className="text-blue-600" /><span className="text-xs font-semibold text-slate-700">{isDraggingFile ? 'Thả tệp Excel vào đây' : 'Kéo thả hoặc nhấn để chọn .xlsx, .xls'}</span><span className="text-[11px] text-slate-500">{file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : 'Tối đa 10 MB'}</span><input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={event => { const selected = event.target.files?.[0]; if (selected) selectFile(selected); }} disabled={busy} /></label></div>
        {errors.length > 0 && <section aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 p-4"><div className="flex items-start gap-3"><span className="rounded-lg bg-red-100 p-2 text-red-600"><AlertCircle size={18} /></span><div><h4 className="text-sm font-bold text-red-800">Phát hiện {errors.length} lỗi trong tệp</h4><p className="mt-0.5 text-xs leading-5 text-red-700">Các lỗi được gom theo dòng. Bạn vẫn có thể import các dòng hợp lệ; các dòng lỗi sẽ được bỏ qua.</p></div></div><div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-red-100 bg-white/80">{errorGroups.map(rowErrors => <div key={rowErrors[0].row} className="grid grid-cols-[auto_1fr] gap-3 border-b border-red-100 px-3 py-2.5 last:border-b-0"><span className="mt-0.5 whitespace-nowrap rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Dòng {rowErrors[0].row}</span><div className="min-w-0 space-y-1">{rowErrors.map((error, index) => <p key={`${error.field}-${index}`} className="text-xs leading-5 text-red-800">{error.field && <span className="font-semibold">{error.field}: </span>}{error.reason}</p>)}</div></div>)}</div></section>}
        {previewRows.length > 0 && <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-bold">{previewRows.length} dòng hợp lệ đã sẵn sàng</h4><p className="mt-0.5 text-xs leading-5 text-emerald-800">{errors.length ? 'Bạn có thể import ngay các dòng hợp lệ; các dòng lỗi sẽ được bỏ qua.' : 'Xem trước 20 dòng đầu tiên trước khi import.'}</p></div><span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Hợp lệ</span></div>{!errors.length && <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-emerald-100 bg-white/70">{previewRows.slice(0, 20).map(row => <div key={row.rowNumber} className="grid grid-cols-[auto_1fr] gap-3 border-b border-emerald-100 px-3 py-2 text-xs last:border-b-0"><span className="font-semibold text-emerald-800">{row.rowNumber}</span><span className="truncate">{row.full_name} · {row.date_of_birth} · {row.gender} · {row.phone_number}{row.room_code ? ` · ${row.room_code}` : ''}</span></div>)}</div>}</section>}
      </>}
      {result && <div className="space-y-4">{skippedRows > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Đã bỏ qua {skippedRows} dòng lỗi từ bước kiểm tra tệp.</div>}<div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-xl bg-emerald-50 p-3"><CheckCircle2 className="mx-auto mb-1 text-emerald-600" size={20} /><strong className="block text-lg text-emerald-700">{result.created}</strong><span className="text-[11px] text-emerald-800">Đã tạo</span></div><div className="rounded-xl bg-amber-50 p-3"><AlertCircle className="mx-auto mb-1 text-amber-600" size={20} /><strong className="block text-lg text-amber-700">{result.duplicated}</strong><span className="text-[11px] text-amber-800">Trùng</span></div><div className="rounded-xl bg-red-50 p-3"><XCircle className="mx-auto mb-1 text-red-600" size={20} /><strong className="block text-lg text-red-700">{result.failed}</strong><span className="text-[11px] text-red-800">Lỗi</span></div></div><section className="overflow-hidden rounded-xl border border-slate-200"><div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Chi tiết theo nhóm</div><div className="max-h-64 overflow-auto">{importResultGroups.map(group => <div key={`${group.status}-${group.reason || ''}`} className="grid grid-cols-[auto_1fr] gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0"><span className="mt-0.5 whitespace-nowrap rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">Dòng {formatDormitoryRosterRowRanges(group.rows)}</span><p className="text-xs leading-5 text-slate-700"><span className="font-semibold">{group.status === 'created' ? 'Đã tạo' : group.status === 'duplicated' ? 'Trùng' : 'Lỗi'}</span>{group.rows.length > 1 ? ` · ${group.rows.length} dòng` : ''}{group.reason ? ` · ${group.reason}` : ''}</p></div>)}</div></section></div>}
      </div>
    </div>
    {!result && <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white/90 px-6 py-4 backdrop-blur"><button type="button" onClick={close} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Hủy</button><button type="button" onClick={previewRows.length ? () => { setSkippedRows(errorGroups.length); setImportConfirmationOpen(true); } : previewFile} disabled={!file || busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />}{previewRows.length ? `Import ${previewRows.length} dòng hợp lệ` : 'Kiểm tra tệp'}</button></div>}
    {result && <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white/90 px-6 py-4 backdrop-blur"><button type="button" onClick={close} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Đóng</button></div>}
    <ConfirmModal isOpen={importConfirmationOpen} onClose={() => setImportConfirmationOpen(false)} onConfirm={importRows} title="Xác nhận import Danh sách KTX" message={<><p>Sẽ import {previewRows.length} dòng hợp lệ.</p>{skippedRows > 0 && <p className="mt-1">{skippedRows} dòng lỗi sẽ được bỏ qua.</p>}<p className="mt-1">Các dòng trùng sẽ không được tạo và sẽ được thông báo sau khi import.</p></>} confirmLabel="Import dữ liệu" cancelLabel="Quay lại" variant="info" />
  </Popup>
  {operationProgress && <RosterOperationProgressDialog open operation="import" progress={operationProgress} pending={operationPending} onOpenChange={closeOperation} />}
  </>;
}
