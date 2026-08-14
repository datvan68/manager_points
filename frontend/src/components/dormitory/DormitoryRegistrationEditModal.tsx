'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { ApplicantProfile, DormRegistration, DormRegistrationSource, UpdateDormRegistrationInput, dormitoryApi } from '@/api/dormitory-api';
import { semesterApi, Semester } from '@/api/semester-api';
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
  priority_group: 'Chính sách' | 'Xa nhà' | 'Học lực giỏi' | 'Khó khăn' | 'Không';
  applicant_profile: ApplicantProfile;
};

export const emptyEditForm = (): EditForm => ({ full_name: '', student_code: '', semester: '', academic_year: '', date_of_birth: '', gender: '', phone_number: '', room_type: 'Thường', notes: '', priority_group: 'Không', applicant_profile: emptyApplicantProfile() });

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

export function formFromRegistration(row: DormRegistration): EditForm {
  return {
    full_name: (row as any).full_name || row.public_registration?.full_name || '',
    student_code: (row as any).student_code || row.public_registration?.student_code || '',
    semester: row.semester || '',
    academic_year: row.academic_year || '',
    date_of_birth: dateInputValue(row.date_of_birth || row.public_registration?.date_of_birth),
    gender: row.gender || '',
    phone_number: row.phone_number || row.public_registration?.phone_number || '',
    room_type: (row.preference?.room_type || (row as any).room_type || 'Thường') as EditForm['room_type'],
    notes: row.preference?.notes || (row as any).notes || '',
    priority_group: (row.priority_group || 'Không') as EditForm['priority_group'],
    applicant_profile: applicantProfileValue(row.applicant_profile),
  };
}

export function buildEditRegistrationPayload(source: DormRegistrationSource, editForm: EditForm): UpdateDormRegistrationInput {
  return source === 'FORMAL'
    ? { semester: editForm.semester, academic_year: editForm.academic_year, date_of_birth: editForm.date_of_birth, gender: editForm.gender as Exclude<EditForm['gender'], ''>, phone_number: editForm.phone_number.trim(), priority_group: editForm.priority_group, preference: { room_type: editForm.room_type, notes: editForm.notes || undefined }, applicant_profile: compactApplicantProfile(editForm.applicant_profile) }
    : { full_name: editForm.full_name.trim(), student_code: editForm.student_code.trim(), semester: editForm.semester, academic_year: editForm.academic_year, date_of_birth: editForm.date_of_birth, gender: editForm.gender as Exclude<EditForm['gender'], ''>, phone_number: editForm.phone_number.trim(), room_type: editForm.room_type, notes: editForm.notes || undefined, priority_group: editForm.priority_group, applicant_profile: compactApplicantProfile(editForm.applicant_profile) };
}

export type DormitoryRegistrationEditModalProps = {
  open: boolean;
  registration: DormRegistration | null;
  canEdit?: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => Promise<void> | void;
  onSubmit?: (registration: DormRegistration, form: EditForm) => Promise<void>;
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
  successMessage?: string;
  requirePersonalDetails?: boolean;
};

export default function DormitoryRegistrationEditModal({ open, registration, canEdit = true, onOpenChange, onSuccess, onSubmit, restoreFocusRef, successMessage = 'Đã cập nhật đơn đăng ký', requirePersonalDetails = true }: DormitoryRegistrationEditModalProps) {
  const [form, setForm] = useState<EditForm>(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [semesterLoading, setSemesterLoading] = useState(false);
  const [semesterError, setSemesterError] = useState('');
  const [activeSemesterName, setActiveSemesterName] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const source = (registration?.source || 'FORMAL') as DormRegistrationSource;

  useEffect(() => {
    if (!open || !registration) return;
    let cancelled = false;
    setForm(formFromRegistration(registration));
    setError('');
    setSemesterError('');
    setActiveSemesterName('');
    setCalendarOpen(false);
    setSemesterLoading(true);
    void semesterApi.getSemesters().then(items => {
      if (cancelled) return;
      const values = mapActiveSemester(items);
      const active = items.find(semester => semester.status === 'active');
      setActiveSemesterName(active?.semester_name || '');
      setForm(current => ({ ...current, ...values }));
    }).catch((err: any) => {
      if (cancelled) return;
      setActiveSemesterName('');
      setSemesterError(err?.message || 'Không thể tải học kỳ active.');
      setForm(current => ({ ...current, semester: '', academic_year: '' }));
    }).finally(() => { if (!cancelled) setSemesterLoading(false); });
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
    if (semesterLoading || semesterError || !form.semester || !form.academic_year) {
      setError(semesterLoading ? 'Đang tải học kỳ active, vui lòng chờ.' : semesterError || 'Chưa xác định được học kỳ active.');
      return;
    }
    if (source !== 'FORMAL' && !form.full_name.trim()) { setError('Vui lòng nhập họ và tên.'); return; }
    const birthDate = form.date_of_birth ? new Date(`${form.date_of_birth}T00:00:00`) : null;
    if (requirePersonalDetails && (!birthDate || Number.isNaN(birthDate.getTime()) || birthDate >= new Date())) { setError('Ngày sinh phải là một ngày hợp lệ trong quá khứ.'); return; }
    if (!form.phone_number.trim() || (requirePersonalDetails && !form.gender)) { setError('Vui lòng nhập đủ ngày sinh, giới tính và số điện thoại.'); return; }
    try {
      setSaving(true);
      if (onSubmit) await onSubmit(registration, form);
      else await dormitoryApi.registrations.update(registration._id, source, buildEditRegistrationPayload(source, form));
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
        <DialogTitle className="flex flex-wrap items-center gap-2">Sửa đơn đăng ký{activeSemesterName && <span className="text-xs font-semibold text-[#64748B]">{activeSemesterName}</span>}{semesterLoading && <span className="text-xs font-semibold text-[#64748B]">Đang tải học kỳ...</span>}</DialogTitle>
      </DialogHeader>
      {!canEdit ? <p className="py-6 text-sm text-slate-600">Bạn không có quyền cập nhật thông tin đơn này.</p> : <form onSubmit={submit} className="grid gap-4 py-4 sm:grid-cols-2">
        {source !== 'FORMAL' && <><Input label="Họ và tên" required value={form.full_name} onChange={e => setField('full_name', e.target.value)} /><Input label="Mã SV" value={form.student_code} onChange={e => setField('student_code', e.target.value)} placeholder="Chưa có mã SV" /></>}
        <Input label="Kỳ" required value={form.semester} onChange={e => setField('semester', e.target.value)} />
        <Input label="Năm học" required value={form.academic_year} onChange={e => setField('academic_year', e.target.value)} />
        <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Ngày sinh <span className="text-red-500">*</span></label><Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-full justify-between rounded-xl border border-white/70 bg-white/50 px-3 text-sm font-normal"><span className="truncate">{dateLabel(form.date_of_birth)}</span><Calendar size={15} /></Button></PopoverTrigger><PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start"><CustomCalendar startDate={form.date_of_birth ? new Date(`${form.date_of_birth}T00:00:00`) : null} endDate={null} onRangeSelect={() => undefined} onRangeConfirm={start => setField('date_of_birth', dateInputValue(start))} onCancel={() => setCalendarOpen(false)} onConfirm={() => setCalendarOpen(false)} /></PopoverContent></Popover></div>
        <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Giới tính <span className="text-red-500">*</span></label><Select value={form.gender} onValueChange={value => setField('gender', value as EditForm['gender'])}><SelectTrigger aria-label="Giới tính"><SelectValue placeholder="Chọn giới tính" /></SelectTrigger><SelectContent><SelectItem value="Male">Nam</SelectItem><SelectItem value="Female">Nữ</SelectItem><SelectItem value="Other">Khác</SelectItem></SelectContent></Select></div>
        <Input label="Số điện thoại" required type="tel" value={form.phone_number} onChange={e => setField('phone_number', e.target.value)} />
        <div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Ưu tiên</label><Select value={form.priority_group} onValueChange={value => setField('priority_group', value as EditForm['priority_group'])}><SelectTrigger aria-label="Ưu tiên"><SelectValue /></SelectTrigger><SelectContent>{['Không', 'Chính sách', 'Xa nhà', 'Học lực giỏi', 'Khó khăn'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Loại phòng</label><Select value={form.room_type} onValueChange={value => setField('room_type', value as EditForm['room_type'])}><SelectTrigger aria-label="Loại phòng"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Thường">Thường</SelectItem><SelectItem value="Máy lạnh">Máy lạnh</SelectItem></SelectContent></Select></div>
        <Input label="Ghi chú" multiline rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} containerClassName="sm:col-span-2" />
        <ApplicantProfileFields value={form.applicant_profile} onChange={value => setField('applicant_profile', value)} className="sm:col-span-2" />
        {(error || semesterError) && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error || semesterError}</p>}
        <DialogFooter className="col-span-full border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => close(false)} disabled={saving}>Hủy</Button><Button type="submit" disabled={saving || semesterLoading || Boolean(semesterError)}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang lưu...</> : 'Lưu thay đổi'}</Button></DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}
