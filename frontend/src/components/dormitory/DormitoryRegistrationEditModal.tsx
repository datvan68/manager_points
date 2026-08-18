'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { ApplicantProfile, DormitoryRosterEntry, UpdateDormitoryRosterEntryInput, dormitoryApi } from '@/api/dormitory-api';
import { Semester } from '@/api/semester-api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { toast } from 'sonner';
import { ApplicantProfileFields, compactApplicantProfile, emptyApplicantProfile } from './PublicDormitoryRegistrationModal';

export type ActiveSemesterValues = { semester: string; academic_year: string };

export function mapActiveSemester(semesters: Semester[]): ActiveSemesterValues {
  const active = semesters.filter(semester => semester.status === 'active');
  if (active.length !== 1) throw new Error(active.length ? 'Có nhiều học kỳ đang active. Vui lòng kiểm tra cấu hình học kỳ.' : 'Chưa có học kỳ active. Vui lòng cấu hình học kỳ trước khi đăng ký.');
  const match = active[0].semester_name.trim().match(/^(HK[12]|Hè|[12])\s*-\s*(\d{4})\s*-\s*(\d{4})$/i);
  if (!match) throw new Error(`Không đọc được định dạng học kỳ active: ${active[0].semester_name}`);
  return { semester: match[1].toUpperCase() === 'HÈ' ? 'Hè' : match[1].toUpperCase(), academic_year: `${match[2]}-${match[3]}` };
}

export type EditForm = {
  full_name: string;
  student_code: string;
  semester: string;
  academic_year: string;
  date_of_birth: string;
  gender: '' | 'Male' | 'Female' | 'Other';
  phone_number: string;
  room_type: 'Thường' | 'Máy lạnh';
  notes: string;
  applicant_profile: ApplicantProfile;
};

export const emptyEditForm = (): EditForm => ({ full_name: '', student_code: '', semester: '', academic_year: '', date_of_birth: '', gender: '', phone_number: '', room_type: 'Thường', notes: '', applicant_profile: emptyApplicantProfile() });

export const dateInputValue = (value?: string | Date) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const dateLabel = (value: string) => {
  if (!value) return 'Chọn ngày sinh';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Chọn ngày sinh' : date.toLocaleDateString('vi-VN');
};

const applicantProfileValue = (profile?: ApplicantProfile): ApplicantProfile => ({
  ...emptyApplicantProfile(),
  ...(profile || {}),
  father: { ...emptyApplicantProfile().father, ...(profile?.father || {}) },
  mother: { ...emptyApplicantProfile().mother, ...(profile?.mother || {}) },
});

export function formFromRegistration(row: DormitoryRosterEntry): EditForm {
  const student = row.student_id && typeof row.student_id === 'object' ? row.student_id : null;
  return {
    full_name: row.full_name || student?.full_name || '',
    student_code: row.student_code || student?.student_code || '',
    semester: row.semester || '',
    academic_year: row.academic_year || '',
    date_of_birth: dateInputValue(row.date_of_birth),
    gender: row.gender || '',
    phone_number: row.phone_number || '',
    room_type: (row.room_type || 'Thường') as EditForm['room_type'],
    notes: row.notes || '',
    applicant_profile: applicantProfileValue(row.applicant_profile),
  };
}

export function buildEditRegistrationPayload(editForm: EditForm, original?: EditForm): UpdateDormitoryRosterEntryInput {
  const normalized = { full_name: editForm.full_name.trim(), student_code: editForm.student_code.trim() || undefined, date_of_birth: editForm.date_of_birth, gender: editForm.gender as Exclude<EditForm['gender'], ''>, phone_number: editForm.phone_number.trim(), room_type: editForm.room_type, notes: editForm.notes.trim() || undefined, applicant_profile: compactApplicantProfile(editForm.applicant_profile) };
  if (!original) return normalized;
  const originalPayload = buildEditRegistrationPayload(original);
  return Object.fromEntries(Object.entries(normalized).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify((originalPayload as any)[key]))) as UpdateDormitoryRosterEntryInput;
}

export type DormitoryRegistrationEditModalProps = {
  open: boolean;
  registration: DormitoryRosterEntry | null;
  canEdit?: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => Promise<void> | void;
  onSubmit?: (registration: DormitoryRosterEntry, form: EditForm) => Promise<void>;
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
  successMessage?: string;
  requirePersonalDetails?: boolean;
};

export default function DormitoryRegistrationEditModal({ open, registration, canEdit = true, onOpenChange, onSuccess, onSubmit, restoreFocusRef, successMessage = 'Đã cập nhật đơn đăng ký', requirePersonalDetails = true }: DormitoryRegistrationEditModalProps) {
  const [form, setForm] = useState<EditForm>(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const formalFieldsLocked = Boolean(registration?.student_id);

  useEffect(() => {
    if (!open || !registration) return;
    let cancelled = false;
    setForm(formFromRegistration(registration));
    setError('');
    setCalendarOpen(false);
    return () => { cancelled = true; };
  }, [open, registration?._id]);

  const restoreFocus = () => {
    if (restoreFocusRef) setTimeout(() => restoreFocusRef.current?.focus(), 100);
  };

  const close = (nextOpen: boolean) => {
    if (nextOpen || saving) return;
    onOpenChange(false);
    restoreFocus();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!registration || saving || !canEdit) return;
    setError('');
    if (!form.full_name.trim()) { setError('Vui lòng nhập họ và tên.'); return; }
    const birthDate = form.date_of_birth ? new Date(`${form.date_of_birth}T00:00:00`) : null;
    if (requirePersonalDetails && (!birthDate || Number.isNaN(birthDate.getTime()) || birthDate >= new Date())) { setError('Ngày sinh phải là một ngày hợp lệ trong quá khứ.'); return; }
    if (!form.phone_number.trim() || (requirePersonalDetails && !form.gender)) { setError('Vui lòng nhập đủ ngày sinh, giới tính và số điện thoại.'); return; }
    try {
      setSaving(true);
      if (onSubmit) await onSubmit(registration, form);
      else {
        const payload = buildEditRegistrationPayload(form, formFromRegistration(registration));
        if (!Object.keys(payload).length) { setError('Chưa có thay đổi cần lưu.'); return; }
        await dormitoryApi.roster.update(registration._id, payload);
      }
      toast.success(successMessage);
      onOpenChange(false);
      restoreFocus();
      await onSuccess?.();
    } catch (err: any) {
      const message = err?.message || 'Không thể cập nhật đơn đăng ký.';
      setError(message);
      toast.error(message);
    } finally { setSaving(false); }
  };

  const setField = <K extends keyof EditForm>(key: K, value: EditForm[K]) => setForm(current => ({ ...current, [key]: value }));

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl">
      <DialogHeader className="border-b border-white/50 pb-3">
      <DialogTitle>Sửa đơn đăng ký</DialogTitle>
      </DialogHeader>
      {!canEdit ? <p className="py-6 text-sm text-slate-600">Bạn không có quyền cập nhật mục Danh sách KTX.</p> : <form onSubmit={submit} className="grid gap-4 py-4 sm:grid-cols-2">
        {formalFieldsLocked ? <><Input label="Họ và tên" value={form.full_name || 'Chưa cập nhật'} readOnly /><Input label="Mã SV" value={form.student_code || 'Chưa cập nhật'} readOnly /></> : <><Input label="Họ và tên" required value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="Nhập họ và tên" /><Input label="Mã SV" value={form.student_code} onChange={e => setField('student_code', e.target.value)} placeholder="Nhập mã sinh viên (nếu có)" /></>}
        <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Ngày sinh <span className="text-red-500">*</span></label><Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-full justify-between rounded-xl border border-white/70 bg-white/50 px-3 text-sm font-normal"><span className="truncate">{dateLabel(form.date_of_birth)}</span><Calendar size={15} /></Button></PopoverTrigger><PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start"><CustomCalendar startDate={form.date_of_birth ? new Date(`${form.date_of_birth}T00:00:00`) : null} endDate={null} onRangeSelect={() => undefined} onRangeConfirm={start => setField('date_of_birth', dateInputValue(start))} onCancel={() => setCalendarOpen(false)} onConfirm={() => setCalendarOpen(false)} /></PopoverContent></Popover></div>
        <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Giới tính <span className="text-red-500">*</span></label><Select value={form.gender} onValueChange={value => setField('gender', value as EditForm['gender'])}><SelectTrigger aria-label="Giới tính"><SelectValue placeholder="Chọn giới tính" /></SelectTrigger><SelectContent><SelectItem value="Male">Nam</SelectItem><SelectItem value="Female">Nữ</SelectItem><SelectItem value="Other">Khác</SelectItem></SelectContent></Select></div>
        <Input label="Số điện thoại" required type="tel" value={form.phone_number} onChange={e => setField('phone_number', e.target.value)} placeholder="Nhập số điện thoại" />
        {formalFieldsLocked ? <Input label="Loại phòng" value={form.room_type} readOnly /> : <div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Loại phòng</label><Select value={form.room_type} onValueChange={value => setField('room_type', value as EditForm['room_type'])}><SelectTrigger aria-label="Loại phòng"><SelectValue placeholder="Chọn loại phòng" /></SelectTrigger><SelectContent><SelectItem value="Thường">Thường</SelectItem><SelectItem value="Máy lạnh">Máy lạnh</SelectItem></SelectContent></Select></div>}
        <Input label="Ghi chú" multiline rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} readOnly={formalFieldsLocked} placeholder="Nhập ghi chú (nếu có)" containerClassName="sm:col-span-2" />
        <ApplicantProfileFields value={form.applicant_profile} onChange={value => setField('applicant_profile', value)} className="sm:col-span-2" />
        {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
        <DialogFooter className="col-span-full border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => close(false)} disabled={saving}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang lưu...</> : 'Lưu thay đổi'}</Button></DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}
