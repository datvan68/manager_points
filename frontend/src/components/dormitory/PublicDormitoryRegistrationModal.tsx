'use client';

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import { dormitoryApi, PublicDormitoryRegistrationInput, PublicDormitorySemester } from '@/api/dormitory-api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';

type FormState = Omit<PublicDormitoryRegistrationInput, 'qr_room_id' | 'gender'> & { qr_room_id?: string; gender: '' | PublicDormitoryRegistrationInput['gender'] };

const emptyForm: FormState = { full_name: '', student_code: '', date_of_birth: '', gender: '', phone_number: '', room_type: 'Thường', notes: '' };

const toDateValue = (date: Date | null) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';
const dateLabel = (value: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('vi-VN') : 'Chọn ngày sinh';
export const publicRoomTypeForGender = (gender: FormState['gender'], requested: FormState['room_type'] = 'Thường') => gender === 'Female' ? requested : 'Thường';

export function PublicDormitoryRegistrationModal({ qrRoomId }: { qrRoomId?: string }) {
  const [form, setForm] = useState<FormState>({ ...emptyForm, qr_room_id: qrRoomId });
  const [semester, setSemester] = useState<PublicDormitorySemester | null>(null);
  const [semesterError, setSemesterError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [successCode, setSuccessCode] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dormitoryApi.public.getActiveSemester().then(value => { if (!cancelled) setSemester(value); }).catch(err => { if (!cancelled) setSemesterError(err?.message || 'Không thể tải học kỳ active.'); });
    return () => { cancelled = true; };
  }, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || successCode) return;
    setError('');
    const birth = form.date_of_birth ? new Date(`${form.date_of_birth}T00:00:00`) : null;
    if (!semester || semesterError) return setError('Chưa xác định được học kỳ active. Vui lòng thử lại sau.');
    if (!form.full_name.trim() || !form.date_of_birth || !birth || Number.isNaN(birth.getTime()) || birth >= new Date()) return setError('Vui lòng nhập họ tên và ngày sinh hợp lệ trong quá khứ.');
    if (!form.gender || !form.phone_number.trim()) return setError('Vui lòng nhập giới tính và số điện thoại.');
    if (!/^[0-9+().\s-]{8,20}$/.test(form.phone_number.trim())) return setError('Số điện thoại không hợp lệ.');
    const gender = form.gender as PublicDormitoryRegistrationInput['gender'];
    const payload: PublicDormitoryRegistrationInput = { full_name: form.full_name.trim(), student_code: form.student_code?.trim() || undefined, date_of_birth: form.date_of_birth, gender: gender, phone_number: form.phone_number.trim(), notes: form.notes?.trim() || undefined, room_type: publicRoomTypeForGender(gender, form.room_type), qr_room_id: form.qr_room_id };
    try {
      setSaving(true);
      const result = await dormitoryApi.public.register(payload);
      if (!result.success) { setError(result.message || 'Số điện thoại đã có đăng ký đang chờ xác nhận.'); return; }
      setSuccessCode(result.registration_code || '');
    } catch (err: any) {
      setError(err?.message || 'Không thể gửi đăng ký. Vui lòng thử lại.');
    } finally { setSaving(false); }
  };

  return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#EBF2FA] via-white to-[#DCE6F1] p-4">
    <Dialog open>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-2xl bg-white/45 p-6 shadow-2xl shadow-slate-300/40 backdrop-blur-md sm:max-w-2xl">
        {successCode ? <div className="py-8 text-center"><CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-600" /><DialogTitle className="text-xl font-black text-[#1E293B]">Đăng ký thành công</DialogTitle><p className="mt-2 text-sm text-slate-600">Mã đăng ký của bạn</p><p className="my-4 rounded-xl bg-white/70 px-4 py-3 font-mono text-xl font-black text-blue-700">{successCode}</p><p className="text-xs text-slate-500">Vui lòng lưu mã để tra cứu với bộ phận quản lý KTX.</p></div> : <>
          <DialogHeader className="mb-4 border-b border-white/60 pb-3"><DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-black uppercase tracking-wider text-[#1E293B]">Đăng ký KTX {semester && <span className="text-[11px] font-semibold normal-case text-[#64748B]">{semester.semester_name}</span>}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA]/80 to-[#DCE6F1]/70 p-4 sm:grid-cols-2">
              <Input label="Họ và tên" required value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="Nguyễn Văn A" />
              <Input label="Mã sinh viên (nếu có)" value={form.student_code} onChange={e => setField('student_code', e.target.value)} placeholder="SV001" />
              <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Ngày sinh <span className="text-red-500">*</span></label><Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-full justify-between rounded-xl border-white/90 bg-white/70 px-3 text-sm font-normal"><span>{dateLabel(form.date_of_birth)}</span><Calendar size={15} /></Button></PopoverTrigger><PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start"><CustomCalendar startDate={form.date_of_birth ? new Date(`${form.date_of_birth}T00:00:00`) : null} endDate={null} onRangeSelect={(start) => setField('date_of_birth', toDateValue(start))} onRangeConfirm={(start) => setField('date_of_birth', toDateValue(start))} onCancel={() => setCalendarOpen(false)} onConfirm={() => setCalendarOpen(false)} /></PopoverContent></Popover></div>
              <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Giới tính <span className="text-red-500">*</span></label><Select value={form.gender} onValueChange={value => setForm(current => ({ ...current, gender: value as FormState['gender'], room_type: value === 'Female' ? current.room_type : 'Thường' }))}><SelectTrigger aria-label="Giới tính" className="w-full bg-white/70"><SelectValue placeholder="Chọn giới tính" /></SelectTrigger><SelectContent><SelectItem value="Male">Nam</SelectItem><SelectItem value="Female">Nữ</SelectItem><SelectItem value="Other">Khác</SelectItem></SelectContent></Select></div>
              <Input label="Số điện thoại" required type="tel" value={form.phone_number} onChange={e => setField('phone_number', e.target.value)} placeholder="0912345678" />
              <div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Loại phòng</label><Select value={form.room_type} disabled={form.gender !== 'Female'} onValueChange={value => setField('room_type', value as FormState['room_type'])}><SelectTrigger aria-label="Loại phòng" className="w-full bg-white/70"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Thường">Thường</SelectItem><SelectItem value="Máy lạnh">Máy lạnh (Ưu tiên cho nữ)</SelectItem></SelectContent></Select></div>
              <div className="sm:col-span-2"><Input label="Ghi chú (nếu có)" multiline rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Thông tin cần lưu ý..." /></div>
            </div>
            {(error || semesterError) && <p role="alert" className="text-sm text-red-600">{error || semesterError}</p>}
            <DialogFooter className="border-t border-white/60 pt-4"><Button type="submit" disabled={saving || !semester || Boolean(semesterError)}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang gửi...</> : 'Gửi đăng ký'}</Button></DialogFooter>
          </form>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
