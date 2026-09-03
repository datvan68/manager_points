'use client';

import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import Popup from '@/components/popups/Popup';
import { dormitoryApi, DormitoryRosterImportResponse, DormitoryRosterImportRowInput } from '@/api/dormitory-api';

export const DORMITORY_ROSTER_HEADERS = ['Họ và tên', 'Ngày sinh', 'Giới tính', 'Số điện thoại'] as const;
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
  const expected = DORMITORY_ROSTER_HEADERS.map(normalizedHeader);
  const headersValid = header.length > 0 && header.filter(value => textCell(value)).length === expected.length && expected.every(value => headerIndexes.has(value));
  if (!headersValid) return { rows: [], errors: [{ row: 1, reason: `Tiêu đề phải gồm đúng: ${DORMITORY_ROSTER_HEADERS.join(', ')}.` }], nonEmptyRowCount: 0 };

  const dataRows = rawRows.slice(1).map((row, index) => ({ row: Array.isArray(row) ? row : [], rowNumber: index + 2 })).filter(({ row }) => row.some(value => textCell(value)));
  if (dataRows.length === 0) return { rows: [], errors: [{ row: 1, reason: 'Tệp Excel không chứa dòng dữ liệu.' }], nonEmptyRowCount: 0 };
  if (dataRows.length > MAX_ROWS) return { rows: [], errors: [{ row: 1, reason: 'Số lượng dòng dữ liệu vượt quá giới hạn 5.000.' }], nonEmptyRowCount: dataRows.length };

  const rows: ParsedDormitoryRosterRow[] = [];
  for (const { row, rowNumber } of dataRows) {
    const fullName = textCell(row[headerIndexes.get(normalizedHeader(DORMITORY_ROSTER_HEADERS[0]))!]);
    const dateOfBirth = normalizeDormitoryRosterDate(row[headerIndexes.get(normalizedHeader(DORMITORY_ROSTER_HEADERS[1]))!]);
    const gender = normalizeDormitoryRosterGender(row[headerIndexes.get(normalizedHeader(DORMITORY_ROSTER_HEADERS[2]))!]);
    const phoneNumber = textCell(row[headerIndexes.get(normalizedHeader(DORMITORY_ROSTER_HEADERS[3]))!]);
    const rowErrors: DormitoryRosterImportValidationError[] = [];
    if (fullName.length < 2) rowErrors.push({ row: rowNumber, field: 'Họ và tên', reason: 'Họ và tên không hợp lệ.' });
    if (!dateOfBirth || dateOfBirth >= new Date().toISOString().slice(0, 10)) rowErrors.push({ row: rowNumber, field: 'Ngày sinh', reason: 'Ngày sinh phải là ngày hợp lệ trong quá khứ.' });
    if (!gender) rowErrors.push({ row: rowNumber, field: 'Giới tính', reason: 'Giới tính phải là Nam, Nữ, Khác hoặc giá trị canonical tương ứng.' });
    if (!PHONE_PATTERN.test(phoneNumber)) rowErrors.push({ row: rowNumber, field: 'Số điện thoại', reason: 'Số điện thoại không hợp lệ.' });
    if (rowErrors.length) errors.push(...rowErrors);
    else rows.push({ rowNumber, full_name: fullName, date_of_birth: dateOfBirth!, gender: gender!, phone_number: phoneNumber });
  }
  return { rows, errors, nonEmptyRowCount: dataRows.length };
}

interface DormitoryRosterImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DormitoryRosterImportModal({ isOpen, onClose, onSuccess }: DormitoryRosterImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ParsedDormitoryRosterRow[]>([]);
  const [errors, setErrors] = useState<DormitoryRosterImportValidationError[]>([]);
  const [result, setResult] = useState<DormitoryRosterImportResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null); setPreviewRows([]); setErrors([]); setResult(null); setBusy(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const close = () => { if (busy) return; reset(); onClose(); };

  const downloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.aoa_to_sheet([[...DORMITORY_ROSTER_HEADERS], ['Nguyễn Văn A', '02/01/2004', 'Nam', '0912345678']]);
      worksheet['D2'].t = 's'; worksheet['D2'].z = '@';
      worksheet['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 18 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh_sach_KTX');
      XLSX.writeFile(workbook, 'Mau_Import_Danh_sach_KTX.xlsx');
      toast.success('Đã tải tệp mẫu Excel.');
    } catch { toast.error('Không thể tạo tệp mẫu.'); }
  };

  const selectFile = (selected: File) => {
    const validation = validateDormitoryRosterFile(selected);
    if (validation) { toast.error(validation); return; }
    setFile(selected); setPreviewRows([]); setErrors([]); setResult(null);
  };

  const previewFile = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await file.arrayBuffer();
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(new Uint8Array(data), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][];
      const parsed = parseDormitoryRosterRows(rawRows);
      setPreviewRows(parsed.rows); setErrors(parsed.errors);
    } catch { setPreviewRows([]); setErrors([{ row: 1, reason: 'Không thể đọc tệp Excel.' }]); }
    finally { setBusy(false); }
  };

  const importRows = async () => {
    if (!previewRows.length || errors.length) return;
    setBusy(true);
    try {
      const response = await dormitoryApi.roster.importRows(previewRows.map(({ rowNumber: _rowNumber, ...row }) => row));
      setResult(response); setFile(null); setPreviewRows([]); setErrors([]);
      if (response.created > 0) { onSuccess?.(); toast.success(`Đã nhập ${response.created} dòng vào Danh sách KTX.`); }
      else toast.warning('Không có dòng mới được tạo.');
    } catch (error: any) { toast.error(error?.message || 'Không thể nhập Danh sách KTX.'); }
    finally { setBusy(false); }
  };

  return <Popup isOpen={isOpen} onClose={close} title="Nhập Danh sách KTX từ Excel" className="max-w-3xl" contentClassName="p-0">
    <div className="space-y-5 p-6">
      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800"><FileSpreadsheet size={18} className="mt-0.5 shrink-0" /><span>Chỉ nhập bốn cột: Họ và tên, Ngày sinh, Giới tính, Số điện thoại. Dữ liệu được kiểm tra trong cửa sổ này trước khi gửi.</span></div>
      {!result && <>
        <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800">1. Tải tệp mẫu</h3><p className="text-xs text-slate-500">Tối đa 10 MB và 5.000 dòng không rỗng.</p></div><button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Download size={15} />Tải tệp mẫu</button></div>
        <div><h3 className="mb-2 text-sm font-bold text-slate-800">2. Chọn tệp</h3><label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center hover:border-blue-400"><Upload size={22} className="text-blue-600" /><span className="text-xs font-semibold text-slate-700">Nhấn để chọn .xlsx hoặc .xls</span><span className="text-[11px] text-slate-500">{file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : 'Chưa chọn tệp'}</span><input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={event => { const selected = event.target.files?.[0]; if (selected) selectFile(selected); }} disabled={busy} /></label></div>
        {errors.length > 0 && <div className="max-h-44 overflow-auto rounded-xl border border-red-100 bg-red-50 p-3"><p className="mb-2 flex items-center gap-2 text-xs font-bold text-red-700"><AlertCircle size={15} />{errors.length} lỗi cần sửa trước khi import</p>{errors.map((error, index) => <p key={`${error.row}-${error.field}-${index}`} className="text-xs text-red-700">Dòng {error.row}{error.field ? ` · ${error.field}` : ''}: {error.reason}</p>)}</div>}
        {previewRows.length > 0 && <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-800"><p className="font-bold">Đã kiểm tra: {previewRows.length} dòng hợp lệ{errors.length ? `, ${errors.length} lỗi` : ''}.</p><div className="mt-2 max-h-40 overflow-auto">{previewRows.slice(0, 20).map(row => <p key={row.rowNumber}>Dòng {row.rowNumber}: {row.full_name} · {row.date_of_birth} · {row.gender} · {row.phone_number}</p>)}</div></div>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={close} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600">Hủy</button><button type="button" onClick={previewRows.length && !errors.length ? importRows : previewFile} disabled={!file || busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />}{previewRows.length && !errors.length ? 'Import dữ liệu' : 'Kiểm tra tệp'}</button></div>
      </>}
      {result && <div className="space-y-4"><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-xl bg-emerald-50 p-3"><CheckCircle2 className="mx-auto mb-1 text-emerald-600" size={20} /><strong className="block text-lg text-emerald-700">{result.created}</strong><span className="text-[11px] text-emerald-800">Đã tạo</span></div><div className="rounded-xl bg-amber-50 p-3"><AlertCircle className="mx-auto mb-1 text-amber-600" size={20} /><strong className="block text-lg text-amber-700">{result.duplicated}</strong><span className="text-[11px] text-amber-800">Trùng</span></div><div className="rounded-xl bg-red-50 p-3"><XCircle className="mx-auto mb-1 text-red-600" size={20} /><strong className="block text-lg text-red-700">{result.failed}</strong><span className="text-[11px] text-red-800">Lỗi</span></div></div><div className="max-h-64 overflow-auto rounded-xl border border-slate-200 p-3">{result.results.map(item => <p key={item.row} className="text-xs text-slate-700">Dòng {item.row}: <span className="font-semibold">{item.status === 'created' ? 'Đã tạo' : item.status === 'duplicated' ? 'Trùng' : 'Lỗi'}</span>{item.reason ? ` · ${item.reason}` : ''}</p>)}</div><div className="flex justify-end border-t border-slate-100 pt-4"><button type="button" onClick={close} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Đóng</button></div></div>}
    </div>
  </Popup>;
}
