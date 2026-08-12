'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Check, DoorOpen, FileSpreadsheet, Pencil, Plus, QrCode, RefreshCw, Search as SearchIcon, Trash2, X } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { Bed, CreateDormRegistrationInput, dormitoryApi, DormRegistration, DormRegistrationSource, Room, UpdateDormRegistrationInput } from '@/api/dormitory-api';
import { studentApi, Student } from '@/api/student-api';
import { semesterApi, Semester } from '@/api/semester-api';
import { useAuth } from '@/providers/auth-provider';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';
import FloatingActionBar from '@/components/ui/FloatingActionBar';
import { CustomPagination } from '@/components/ui/pagination';
import { Research } from '@/components/ui/Research';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import ConfirmModal from '@/components/modals/ConfirmModal';

const pageSizeOptions = [20, 40, 50, 100];
export const REGISTRATION_TABLE_CLASS_NAME = 'text-xs';
export const PUBLIC_REGISTRATION_PATH = '/public/dormitory/register';
export const getPublicRegistrationUrl = (origin: string) => `${origin.replace(/\/$/, '')}${PUBLIC_REGISTRATION_PATH}`;
export const roomStatusLabel = (status: Room['status']) => ({ 'Trống': 'Trống', 'Đầy': 'Đầy', 'Khóa': 'Khóa', 'Bảo trì': 'Bảo trì' }[status] || status);
export const roomQuantityLabel = (room: Pick<Room, 'available_bed_count'> & Partial<Pick<Room, 'max_students'>>) => room.max_students === undefined
  ? `Còn ${room.available_bed_count} giường trống`
  : `Còn ${room.available_bed_count}/${room.max_students} giường trống`;
export const isAvailableBed = (bed: Bed) => bed.status === 'Trống';
export const studentName = (r: DormRegistration) => r.student_id?.full_name || r.public_registration?.full_name || (r as any).full_name || '—';
export const studentCode = (r: DormRegistration) => {
  const value = r.student_id?.student_code || r.public_registration?.student_code || (r as any).student_code;
  return typeof value === 'string' && value.trim() ? value.trim() : 'Chưa có mã SV';
};
export const priorityLabel = (r: DormRegistration) => r.priority_group?.trim() && r.priority_group.trim() !== 'Không' ? 'Có' : 'Không';
export const sourceLabel = (source?: DormRegistrationSource) => source === 'PUBLIC' ? 'QR' : 'Thủ công';
export const roomLabel = (r: DormRegistration) => (r as any).assigned_room_name || (r as any).room_name || (r as any).room_code || r.preference?.building_id || 'Chưa xếp phòng';
export const isUnassignedRoom = (r: DormRegistration) => !((r as any).assigned_room_name || (r as any).room_name || (r as any).room_code || r.preference?.building_id);
export const hasAssignedBed = (r: DormRegistration) => Boolean(r.bed_id || (r.source === 'FORMAL' && (r as any).assigned_room_name));
export type RoomAssignment = { room: Room; bed: Bed; registration?: DormRegistration; active_contract_id?: string };
export const applyRoomAssignment = (row: DormRegistration, assignment: RoomAssignment): DormRegistration => ({
  ...row,
  ...(assignment.registration || {}),
  room_id: assignment.room,
  bed_id: assignment.bed,
  assigned_room_name: assignment.room.room_name || assignment.room.room_code,
  active_contract_id: assignment.active_contract_id || assignment.registration?.active_contract_id || row.active_contract_id,
});
export const createdDateLabel = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
};

export type ActiveSemesterValues = { semester: string; academic_year: string };

export function mapActiveSemester(semesters: Semester[]): ActiveSemesterValues {
  const active = semesters.filter(semester => semester.status === 'active');
  if (active.length !== 1) throw new Error(active.length ? 'Có nhiều học kỳ đang active. Vui lòng kiểm tra cấu hình học kỳ.' : 'Chưa có học kỳ active. Vui lòng cấu hình học kỳ trước khi đăng ký.');
  const match = active[0].semester_name.trim().match(/^(HK[12]|Hè|[12])\s*-\s*(\d{4})\s*-\s*(\d{4})$/i);
  if (!match) throw new Error(`Không đọc được định dạng học kỳ active: ${active[0].semester_name}`);
  return { semester: match[1].toUpperCase() === 'HÈ' ? 'Hè' : match[1].toUpperCase(), academic_year: `${match[2]}-${match[3]}` };
}

type CreateForm = ActiveSemesterValues & {
  date_of_birth: string;
  gender: '' | 'Male' | 'Female' | 'Other';
  phone_number: string;
  room_type: 'Thường' | 'Máy lạnh';
  notes: string;
};

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
};

const emptyEditForm = (): EditForm => ({ full_name: '', student_code: '', semester: '', academic_year: '', date_of_birth: '', gender: '', phone_number: '', room_type: 'Thường', notes: '', priority_group: 'Không' });

const emptyCreateForm = (): CreateForm => ({ semester: '', academic_year: '', date_of_birth: '', gender: '', phone_number: '', room_type: 'Thường', notes: '' });
const dateInputValue = (value?: string | Date) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const dateLabel = (value: string) => {
  if (!value) return 'Chọn ngày sinh';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'Chọn ngày sinh' : date.toLocaleDateString('vi-VN');
};

export function buildEditRegistrationPayload(source: DormRegistrationSource, editForm: EditForm): UpdateDormRegistrationInput {
  return source === 'FORMAL'
    ? { semester: editForm.semester, academic_year: editForm.academic_year, date_of_birth: editForm.date_of_birth, gender: editForm.gender as Exclude<EditForm['gender'], ''>, phone_number: editForm.phone_number.trim(), priority_group: editForm.priority_group, preference: { room_type: editForm.room_type, notes: editForm.notes || undefined } }
    : { full_name: editForm.full_name.trim(), student_code: editForm.student_code.trim(), semester: editForm.semester, academic_year: editForm.academic_year, date_of_birth: editForm.date_of_birth, gender: editForm.gender as Exclude<EditForm['gender'], ''>, phone_number: editForm.phone_number.trim(), room_type: editForm.room_type, notes: editForm.notes || undefined, priority_group: editForm.priority_group };
}

export function buildRegistrationExportRows(rows: DormRegistration[]) {
  return rows.map(row => ({
    'Mã SV': studentCode(row),
    'Họ và tên': studentName(row),
    'Phòng': roomLabel(row),
    'Ưu tiên': priorityLabel(row),
    'Trạng thái': sourceLabel(row.source as DormRegistrationSource),
    'Ngày tạo': createdDateLabel(row.createdAt),
  }));
}

type RoomAssignmentPopoverProps = {
  row: DormRegistration;
  onAssigned: (assignment: RoomAssignment) => void;
};

export function RoomAssignmentPopover({ row, onAssigned }: RoomAssignmentPopoverProps) {
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(false);
  const [bedsLoading, setBedsLoading] = useState(false);
  const [error, setError] = useState('');
  const [assigning, setAssigning] = useState(false);
  const currentRoomId = typeof row.room_id === 'object' ? row.room_id._id : row.room_id;
  const currentBedId = typeof row.bed_id === 'object' ? row.bed_id._id : row.bed_id;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;

    setRooms([]);
    setSelectedRoom(null);
    setBeds([]);
    setError('');
    setLoading(true);
    void dormitoryApi.registrations.suggestRooms(row._id)
      .then(setRooms)
      .catch((err: any) => setError(err?.message || 'Không thể tải danh sách phòng.'))
      .finally(() => setLoading(false));
  };

  const selectRoom = async (room: Room) => {
    if (assigning) return;
    setSelectedRoom(room);
    setBeds([]);
    setError('');
    setBedsLoading(true);
    try {
      setBeds(await dormitoryApi.beds.getByRoom(room._id));
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách giường.');
    } finally {
      setBedsLoading(false);
    }
  };

  const assignBed = async (room: Room, bed: Bed) => {
    if (assigning || bed._id === currentBedId || !isAvailableBed(bed) || room.status !== 'Trống') return;
    setAssigning(true);
    setError('');
    try {
      const result = await dormitoryApi.registrations.assignRoom({ registration_id: row._id, room_id: room._id, bed_id: bed._id });
      toast.success(currentRoomId ? 'Đã đổi phòng cho sinh viên' : 'Đã phân phòng cho sinh viên');
      setOpen(false);
      onAssigned({ room: result.room || room, bed: result.bed || bed, registration: result.registration, active_contract_id: result.active_contract_id });
    } catch (err: any) {
      setError(err?.message || 'Không thể phân phòng.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${currentRoomId ? 'Đổi phòng' : 'Thêm phòng'} cho ${studentName(row)}`} title={currentRoomId ? 'Đổi phòng' : 'Thêm phòng'} className="rounded-xl p-1.5 text-emerald-600 hover:bg-emerald-50">
          <DoorOpen size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={6} collisionPadding={8} className="z-[120] w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        <div className="px-2 pb-2 text-xs font-semibold text-slate-700">Chọn phòng</div>
        {loading ? (
          <p className="px-2 py-3 text-xs text-slate-500">Đang tải phòng...</p>
        ) : error ? (
          <p role="alert" className="px-2 py-3 text-xs text-red-600">{error}</p>
        ) : rooms.length === 0 ? (
          <p className="px-2 py-3 text-xs text-slate-500">Không có phòng phù hợp.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            <div className="space-y-1">
              {rooms.map(room => {
                const isCurrentRoom = room._id === currentRoomId;
                const selectable = isCurrentRoom || (room.status === 'Trống' && room.available_bed_count > 0);
                return (
                  <button type="button" key={room._id} disabled={!selectable || assigning} onClick={() => void selectRoom(room)} className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${selectedRoom?._id === room._id ? 'bg-slate-100' : ''}`}>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-700">{room.room_name || room.room_code}</span>
                      <span className="block text-[11px] text-slate-500">{roomQuantityLabel(room)}{isCurrentRoom ? ' · Phòng hiện tại' : ''}</span>
                    </span>
                    <span className="ml-2 shrink-0 text-[11px] text-slate-500">{roomStatusLabel(room.status)}</span>
                  </button>
                );
              })}
            </div>
            {selectedRoom && (
              <div className="border-t border-slate-200 pt-2">
                <p className="px-2 pb-1 text-[11px] font-semibold text-slate-600">Giường trong {selectedRoom.room_name || selectedRoom.room_code}</p>
                {bedsLoading ? (
                  <p className="px-2 py-2 text-xs text-slate-500">Đang tải giường...</p>
                ) : beds.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-slate-500">Phòng chưa có giường.</p>
                ) : (
                  <div className="space-y-1">
                    {beds.map(bed => {
                      const isCurrentBed = bed._id === currentBedId;
                      const selectable = !isCurrentBed && selectedRoom.status === 'Trống' && isAvailableBed(bed);
                      return (
                        <button type="button" key={bed._id} disabled={!selectable || assigning} onClick={() => void assignBed(selectedRoom, bed)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60">
                          <span className="font-semibold text-slate-700">{bed.bed_code || bed._id}</span>
                          <span className={`text-[11px] ${isCurrentBed ? 'font-semibold text-emerald-700' : 'text-slate-500'}`}>{isCurrentBed ? 'Đang chọn' : bed.status}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function RegistrationsPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('DORM_REG_CREATE');
  const canView = hasPermission('DORM_REG_READ');
  const canUpdate = hasPermission('DORM_REG_UPDATE');
  const canDelete = hasPermission('DORM_REG_DELETE');
  // Temporary: room assignment is open until the permission is finalized.
  const canAssignRoom = true;
  const [registrations, setRegistrations] = useState<DormRegistration[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); const [source, setSource] = useState('');
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(40);
  const [selected, setSelected] = useState<string[]>([]); const [rejectId, setRejectId] = useState<string | null>(null); const [rejectReason, setRejectReason] = useState('');
  const [meta, setMeta] = useState<{ total: number; totalPages: number } | null>(null); const [refreshing, setRefreshing] = useState(false); const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null); const mobileScrollRef = useRef<HTMLDivElement>(null); const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false); const mobilePageRef = useRef(1); const mobileHasMoreRef = useRef(true);
  const [createOpen, setCreateOpen] = useState(false); const [createSaving, setCreateSaving] = useState(false); const [createError, setCreateError] = useState(''); const [semesterError, setSemesterError] = useState(''); const [semesterLoading, setSemesterLoading] = useState(false); const [activeSemesterName, setActiveSemesterName] = useState(''); const [calendarOpen, setCalendarOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false); const [qrDataUrl, setQrDataUrl] = useState(''); const [qrError, setQrError] = useState('');
  const [studentSearch, setStudentSearch] = useState(''); const [studentOptions, setStudentOptions] = useState<Student[]>([]); const [student, setStudent] = useState<Student | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [editRow, setEditRow] = useState<DormRegistration | null>(null); const [editForm, setEditForm] = useState<EditForm>(emptyEditForm); const [editSaving, setEditSaving] = useState(false); const [editError, setEditError] = useState(''); const [editSemesterLoading, setEditSemesterLoading] = useState(false); const [editSemesterError, setEditSemesterError] = useState(''); const [editActiveSemesterName, setEditActiveSemesterName] = useState(''); const [editCalendarOpen, setEditCalendarOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<DormRegistration | null>(null); const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false); const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    if (!qrOpen) return;
    const url = getPublicRegistrationUrl(window.location.origin);
    setQrError('');
    void QRCodeLib.toDataURL(url, { errorCorrectionLevel: 'H', type: 'image/png', width: 320, margin: 3, color: { dark: '#000000', light: '#FFFFFF' } }).then(setQrDataUrl).catch(() => { setQrDataUrl(''); setQrError('Không thể tạo mã QR.'); });
  }, [qrOpen]);

  useEffect(() => { if (mobileSearchOpen) searchRef.current?.focus(); }, [mobileSearchOpen]);
  useEffect(() => {
    if (!createOpen || !studentSearch.trim() || student) { setStudentOptions([]); return; }
    const timer = window.setTimeout(async () => {
      try { const result = await studentApi.getStudents({ search: studentSearch.trim(), page: 1, limit: 10, status: 'Studying' }); setStudentOptions(Array.isArray(result) ? result : result.data || []); } catch { setStudentOptions([]); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [createOpen, studentSearch, student]);
  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    setSemesterLoading(true); setSemesterError('');
    void semesterApi.getSemesters().then(items => { if (!cancelled) { const values = mapActiveSemester(items); const active = items.find(semester => semester.status === 'active'); setActiveSemesterName(active?.semester_name || ''); setCreateForm(current => ({ ...current, ...values })); } }).catch((err: any) => { if (!cancelled) { setActiveSemesterName(''); setSemesterError(err?.message || 'Không thể tải học kỳ active.'); setCreateForm(current => ({ ...current, semester: '', academic_year: '' })); } }).finally(() => { if (!cancelled) setSemesterLoading(false); });
    return () => { cancelled = true; };
  }, [createOpen]);
  const resetCreate = () => { setStudent(null); setStudentSearch(''); setStudentOptions([]); setCreateError(''); setSemesterError(''); setActiveSemesterName(''); setCalendarOpen(false); setCreateForm(emptyCreateForm()); };
  const selectStudent = (item: Student) => { setStudent(item); setStudentSearch(''); setStudentOptions([]); setCreateForm(current => ({ ...current, date_of_birth: dateInputValue(item.date_bir), gender: item.sex, room_type: item.sex === 'Female' ? current.room_type : 'Thường', phone_number: (item as Student & { phone_number?: string }).phone_number || '' })); };
  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault(); setCreateError('');
    const birthDate = createForm.date_of_birth ? new Date(`${createForm.date_of_birth}T00:00:00`) : null;
    if (semesterLoading) { setCreateError('Đang tải học kỳ active, vui lòng chờ.'); return; }
    if (semesterError || !createForm.semester || !createForm.academic_year) { setCreateError(semesterError || 'Chưa xác định được học kỳ active.'); return; }
    const hasClass = Boolean(student && student.student_code && student.class_id);
    const temporaryName = student ? '' : studentSearch.trim();
    if (!hasClass && !temporaryName) { setCreateError('Vui lòng chọn sinh viên từ kết quả tìm kiếm hoặc nhập họ tên để lưu tạm.'); return; }
    if (student && !hasClass) { setCreateError('Sinh viên đã chọn chưa có mã sinh viên và lớp đầy đủ. Hãy xóa lựa chọn rồi nhập họ tên để lưu tạm.'); return; }
    if (!birthDate || Number.isNaN(birthDate.getTime()) || birthDate >= new Date()) { setCreateError('Ngày sinh phải là một ngày hợp lệ trong quá khứ.'); return; }
    if (!createForm.gender || !createForm.phone_number.trim()) { setCreateError('Vui lòng nhập đủ ngày sinh, giới tính và số điện thoại.'); return; }
    if (!/^[0-9+().\s-]{8,20}$/.test(createForm.phone_number.trim())) { setCreateError('Số điện thoại không hợp lệ.'); return; }
    if (!student) {
      try { setCreateSaving(true); await dormitoryApi.registrations.createTemporary({ full_name: temporaryName, date_of_birth: createForm.date_of_birth, gender: createForm.gender, phone_number: createForm.phone_number.trim(), room_type: createForm.gender === 'Female' ? createForm.room_type : 'Thường', notes: createForm.notes || undefined }); toast.success('Đã lưu đăng ký tạm, chờ phân loại'); setCreateOpen(false); resetCreate(); reset(); await load(true); } catch (err: any) { setCreateError(err?.message || 'Không thể lưu đăng ký tạm.'); } finally { setCreateSaving(false); }
      return;
    }
    const payload: CreateDormRegistrationInput = { student_id: student._id, semester: createForm.semester, academic_year: createForm.academic_year, date_of_birth: createForm.date_of_birth, gender: createForm.gender, phone_number: createForm.phone_number.trim() };
    const preference = { room_type: createForm.gender === 'Female' ? createForm.room_type : 'Thường', notes: createForm.notes || undefined };
    if (Object.values(preference).some(Boolean)) payload.preference = preference;
    try { setCreateSaving(true); await dormitoryApi.registrations.create(payload); toast.success('Đã tạo đơn đăng ký KTX'); setCreateOpen(false); resetCreate(); reset(); await load(true); } catch (err: any) { setCreateError(err?.message || 'Không thể tạo đơn đăng ký.'); } finally { setCreateSaving(false); }
  };
  const reset = () => { setPage(1); setSelected([]); mobilePageRef.current = 1; mobileHasMoreRef.current = true; };
  const load = useCallback(async (background = false) => { try { background ? setRefreshing(true) : setLoading(true); setError(''); const res = await dormitoryApi.registrations.getAll({ status: filterStatus || undefined, source: source || undefined, search: search.trim() || undefined, page, limit: pageSize }); setRegistrations(res.data); setMeta(res.meta); } catch (err: any) { setError(err?.message || 'Không thể tải danh sách đăng ký.'); toast.error(err?.message || 'Lỗi tải danh sách đăng ký'); } finally { setLoading(false); setRefreshing(false); } }, [filterStatus, source, search, page, pageSize]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 200); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { mobilePageRef.current = 1; mobileHasMoreRef.current = true; }, [filterStatus, source, search, pageSize]);
  const loadMoreMobile = useCallback(async () => {
    if (mobileLoadingMore || !mobileHasMoreRef.current) return;
    setMobileLoadingMore(true);
    const nextPage = mobilePageRef.current + 1;
    try {
      const res = await dormitoryApi.registrations.getAll({ status: filterStatus || undefined, source: source || undefined, search: search.trim() || undefined, page: nextPage, limit: pageSize });
      const next = res.data || [];
      setRegistrations(current => [...current, ...next.filter(item => !current.some(row => row._id === item._id))]);
      mobilePageRef.current = nextPage;
      mobileHasMoreRef.current = next.length === pageSize && nextPage * pageSize < res.meta.total;
    } catch { setError('Không thể tải thêm đăng ký.'); } finally { setMobileLoadingMore(false); }
  }, [filterStatus, source, search, pageSize, mobileLoadingMore]);
  useEffect(() => {
    const target = mobileSentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void loadMoreMobile(); }, { root: mobileScrollRef.current, rootMargin: '160px', threshold: 0.1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMoreMobile]);
  const allSelected = registrations.length > 0 && registrations.every(row => selected.includes(row._id));
  const toggleAll = (checked: boolean) => setSelected(checked ? registrations.map(row => row._id) : []);
  const approve = async (id: string) => { try { await dormitoryApi.registrations.approve(id, { status: 'Đã duyệt' }); toast.success('Đã duyệt đơn đăng ký'); void load(true); } catch (err: any) { toast.error(err?.message || 'Lỗi duyệt đơn'); } };
  const reject = async () => { if (!rejectId || !rejectReason) return; try { await dormitoryApi.registrations.approve(rejectId, { status: 'Từ chối', rejection_reason: rejectReason }); toast.success('Đã từ chối đơn đăng ký'); setRejectId(null); setRejectReason(''); void load(true); } catch (err: any) { toast.error(err?.message || 'Lỗi từ chối đơn'); } };
  const openEdit = (row: DormRegistration) => {
    setEditRow(row); setEditError(''); setEditSemesterError(''); setEditActiveSemesterName(''); setEditCalendarOpen(false);
    setEditForm({
      full_name: (row as any).full_name || row.public_registration?.full_name || '',
      student_code: (row as any).student_code || row.public_registration?.student_code || '',
      semester: row.semester || '', academic_year: row.academic_year || '',
      date_of_birth: dateInputValue(row.date_of_birth || row.public_registration?.date_of_birth),
      gender: row.gender || '', phone_number: row.phone_number || row.public_registration?.phone_number || '',
      room_type: row.preference?.room_type || (row as any).room_type || 'Thường',
      notes: row.preference?.notes || (row as any).notes || '', priority_group: (row.priority_group || 'Không') as EditForm['priority_group'],
    });
  };
  useEffect(() => {
    if (!editRow || editRow.source !== 'ADMIN_TEMPORARY') { setEditSemesterLoading(false); setEditActiveSemesterName(''); return; }
    let cancelled = false;
    setEditSemesterLoading(true); setEditSemesterError('');
    void semesterApi.getSemesters().then(items => {
      if (cancelled) return;
      const values = mapActiveSemester(items);
      const active = items.find(semester => semester.status === 'active');
      setEditActiveSemesterName(active?.semester_name || '');
      setEditForm(current => ({ ...current, ...values }));
    }).catch((err: any) => {
      if (cancelled) return;
      setEditActiveSemesterName('');
      setEditSemesterError(err?.message || 'Không thể tải học kỳ active.');
      setEditForm(current => ({ ...current, semester: '', academic_year: '' }));
    }).finally(() => { if (!cancelled) setEditSemesterLoading(false); });
    return () => { cancelled = true; };
  }, [editRow]);
  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!editRow) return; setEditError('');
    if (editRow.source === 'ADMIN_TEMPORARY' && (editSemesterLoading || editSemesterError || !editForm.semester || !editForm.academic_year)) { setEditError(editSemesterLoading ? 'Đang tải học kỳ active, vui lòng chờ.' : editSemesterError || 'Chưa xác định được học kỳ active.'); return; }
    if (editRow.source !== 'FORMAL' && !editForm.full_name.trim()) { setEditError('Vui lòng nhập họ và tên.'); return; }
    const birthDate = editForm.date_of_birth ? new Date(`${editForm.date_of_birth}T00:00:00`) : null;
    if (!birthDate || Number.isNaN(birthDate.getTime()) || birthDate >= new Date()) { setEditError('Ngày sinh phải là một ngày hợp lệ trong quá khứ.'); return; }
    if (!editForm.gender || !editForm.phone_number.trim()) { setEditError('Vui lòng nhập đủ ngày sinh, giới tính và số điện thoại.'); return; }
    const payload = buildEditRegistrationPayload(editRow.source as DormRegistrationSource, editForm);
    try { setEditSaving(true); await dormitoryApi.registrations.update(editRow._id, editRow.source as DormRegistrationSource, payload); toast.success('Đã cập nhật đơn đăng ký'); setEditRow(null); setEditForm(emptyEditForm()); await load(true); } catch (err: any) { setEditError(err?.message || 'Không thể cập nhật đơn đăng ký.'); } finally { setEditSaving(false); }
  };
  const deleteRegistration = async () => {
    if (!deleteRow) return;
    await dormitoryApi.registrations.delete(deleteRow._id, deleteRow.source as DormRegistrationSource);
    toast.success('Đã xóa đơn đăng ký'); setSelected(ids => ids.filter(id => id !== deleteRow._id)); setDeleteRow(null); await load(true);
  };
  const removeSelected = async () => {
    if (bulkDeleting || !selected.length) return;
    setBulkDeleting(true);
    const selectedIds = [...selected];
    const results = await Promise.allSettled(selectedIds.map(id => { const row = registrations.find(item => item._id === id); return row ? dormitoryApi.registrations.delete(id, row.source as DormRegistrationSource) : Promise.reject(new Error('Không tìm thấy đơn đăng ký')); }));
    const deletedIds = selectedIds.filter((_, index) => results[index].status === 'fulfilled');
    const failedIds = selectedIds.filter((_, index) => results[index].status === 'rejected');
    setSelected(failedIds); setBulkDeleteOpen(false);
    if (deletedIds.length) await load(true);
    if (!failedIds.length) toast.success(`Đã xóa ${deletedIds.length} đơn đăng ký`);
    else if (deletedIds.length) toast.warning(`Đã xóa ${deletedIds.length} đơn, ${failedIds.length} đơn không thể xóa`);
    else toast.error('Không thể xóa các đơn đăng ký đã chọn.');
    setBulkDeleting(false);
  };
  const exportSelected = async () => {
    const rows = registrations.filter(row => selected.includes(row._id));
    if (!rows.length) return;
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(buildRegistrationExportRows(rows));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Đăng ký KTX');
    XLSX.writeFile(workbook, 'Danh_sach_dang_ky_KTX.xlsx');
  };
  const columns: ResponsiveColumn<DormRegistration>[] = [
    { key: 'student_code', header: 'Mã SV', priority: 'primary', render: (_, r) => studentCode(r) }, { key: 'student_name', header: 'Họ và tên', priority: 'secondary', render: (_, r) => studentName(r) },
    { key: 'room', header: 'Phòng', render: (_, r) => <span className={isUnassignedRoom(r) ? 'font-medium text-amber-600' : undefined}>{roomLabel(r)}</span> }, { key: 'priority', header: 'Ưu tiên', render: (_, r) => priorityLabel(r) },
    { key: 'status', header: 'Trạng thái', render: (_, r) => <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-700">{sourceLabel(r.source as DormRegistrationSource)}</span> },
    { key: 'created', header: 'Ngày tạo', render: (_, r) => createdDateLabel(r.createdAt) },
    { key: 'actions', header: 'Thao tác', priority: 'action', className: 'text-right', render: (_, r) => <div className="flex justify-end gap-1">{canAssignRoom && <RoomAssignmentPopover row={r} onAssigned={assignment => setRegistrations(current => current.map(item => item._id === r._id ? applyRoomAssignment(item, assignment) : item))} />}{canUpdate && <button aria-label={`Sửa đơn ${studentName(r)}`} title="Sửa" onClick={() => openEdit(r)} className="rounded-xl p-1.5 text-blue-600 hover:bg-blue-50"><Pencil size={16} /></button>}{canDelete && <button aria-label={`Xóa đơn ${studentName(r)}`} title="Xóa" onClick={() => setDeleteRow(r)} className="rounded-xl p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>}{r.source !== 'PUBLIC' && r.source !== 'ADMIN_TEMPORARY' && r.status === 'Chờ duyệt' && <><button aria-label="Duyệt" title="Duyệt" onClick={() => void approve(r._id)} className="rounded-xl p-1.5 text-green-600 hover:bg-green-50"><Check size={16} /></button><button aria-label="Từ chối" title="Từ chối" onClick={() => setRejectId(r._id)} className="rounded-xl p-1.5 text-red-600 hover:bg-red-50"><X size={16} /></button></>}</div> },
  ];
  return <main className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6">
    {mobileSearchOpen ? (
      <div className="flex w-full items-center gap-1 py-0.5 sm:hidden">
        <Research ref={searchRef} aria-label="Tìm kiếm đăng ký" placeholder="Tìm kiếm..." value={search} onChange={e => { setSearch(e.target.value); reset(); }} containerClassName="flex-1 w-full max-w-none" />
        <Button type="button" variant="outline" aria-label="Đóng tìm kiếm" title="Đóng" onClick={() => setMobileSearchOpen(false)} className="h-9 w-9 shrink-0 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700"><X size={16} /></Button>
      </div>
    ) : (
      <div className="flex shrink-0 items-center justify-start gap-1 overflow-x-auto scrollbar-none py-0.5 w-full flex-nowrap">
        <Research aria-label="Tìm kiếm đăng ký" placeholder="Tìm kiếm..." value={search} onChange={e => { setSearch(e.target.value); reset(); }} containerClassName="hidden sm:flex shrink-0 w-[231px]" />
        <Button type="button" variant="outline" aria-label="Mở tìm kiếm" title="Tìm kiếm" onClick={() => setMobileSearchOpen(true)} className="flex sm:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700"><SearchIcon size={15} /></Button>
        <div className="ml-auto flex items-center gap-2 shrink-0 flex-nowrap">
          <Select value={filterStatus || 'ALL'} onValueChange={v => { setFilterStatus(v === 'ALL' ? '' : v); reset(); }}>
            <SelectTrigger aria-label="Lọc trạng thái" className="h-9 min-w-[140px] rounded-xl border border-white/80 bg-white/60 px-3 text-xs font-semibold text-slate-700 shadow-none"><SelectValue placeholder="Tất cả trạng thái" /></SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-md border border-white/70 shadow-xl rounded-xl z-[100]">
              <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
              <SelectItem value="Chờ duyệt">Chờ duyệt</SelectItem>
              <SelectItem value="Đã duyệt">Đã duyệt</SelectItem>
              <SelectItem value="Từ chối">Từ chối</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source || 'ALL'} onValueChange={v => { setSource(v === 'ALL' ? '' : v); reset(); }}>
            <SelectTrigger aria-label="Lọc nguồn" className="h-9 min-w-[115px] rounded-xl border border-white/80 bg-white/60 px-3 text-xs font-semibold text-slate-700 shadow-none"><SelectValue placeholder="Tất cả nguồn" /></SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-md border border-white/70 shadow-xl rounded-xl z-[100]">
              <SelectItem value="ALL">Tất cả nguồn</SelectItem>
              <SelectItem value="FORMAL">Chính thức</SelectItem>
              <SelectItem value="PUBLIC">QR</SelectItem>
              <SelectItem value="ADMIN_TEMPORARY">Nhập tạm</SelectItem>
            </SelectContent>
          </Select>
          {canView && <Button type="button" variant="outline" aria-label="Mở QR đăng ký KTX" title="QR đăng ký KTX" onClick={() => setQrOpen(true)} className="h-9 w-9 shrink-0 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700"><QrCode size={15} /></Button>}
          {canCreate && <Button type="button" variant="outline" aria-label="Thêm sinh viên" onClick={() => setCreateOpen(true)} className="h-9 shrink-0 rounded-xl border border-white/80 bg-white/50 px-3 text-xs text-slate-700 hover:bg-white/80"><Plus size={14} /> <span className="hidden sm:inline">Thêm sinh viên</span></Button>}
          <Button type="button" variant="outline" aria-label="Tải lại danh sách" title="Tải lại" onClick={() => void load(true)} disabled={refreshing} className="h-9 w-9 shrink-0 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700"><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /></Button>
        </div>
      </div>
    )}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-sm shadow-slate-300/40 backdrop-blur-md"><ResponsiveDataView data={registrations} columns={columns} isLoading={loading} keyExtractor={r => r._id} tableClassName={REGISTRATION_TABLE_CLASS_NAME} mobileScrollRef={mobileScrollRef} hidePaginationOnMobile mobileFooter={<div ref={mobileSentinelRef} className="py-3 text-center text-xs text-slate-500">{mobileLoadingMore ? 'Đang tải thêm...' : !mobileHasMoreRef.current && registrations.length ? 'Đã hiển thị tất cả bản ghi.' : null}</div>} selection={{ selectedKeys: selected, onSelectRow: (key, checked) => setSelected(ids => checked ? [...ids, key] : ids.filter(id => id !== key)), onSelectAll: toggleAll, allSelected }} emptyState={<div className="p-8 text-center text-sm text-slate-500">Chưa có đơn đăng ký nào</div>} pagination={<CustomPagination totalItems={meta?.total || 0} pageSize={pageSize} currentPage={page} onPageChange={p => { setPage(p); setSelected([]); }} onPageSizeChange={s => { setPage(1); setPageSize(s); setSelected([]); }} pageSizeOptions={pageSizeOptions} isLoading={loading} label="đơn đăng ký" />} /></div>
    <FloatingActionBar selectedCount={selected.length} onClear={() => setSelected([])} itemLabel="đơn" actions={<>{canDelete && <button type="button" aria-label="Xóa đơn đã chọn" disabled={bulkDeleting} onClick={() => setBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"><Trash2 size={14} /> Xóa</button>}{canView && <button type="button" aria-label="Xuất Excel" onClick={() => void exportSelected()} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"><FileSpreadsheet size={14} /> Xuất Excel</button>}</>} />
    {rejectId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectId(null)}><div role="dialog" aria-labelledby="reject-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}><h2 id="reject-title" className="mb-4 text-lg font-bold text-gray-800">Từ chối đơn đăng ký</h2><textarea aria-label="Lý do từ chối" placeholder="Nhập lý do từ chối..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" rows={3} /><div className="flex gap-3"><button onClick={() => setRejectId(null)} className="flex-1 rounded-lg border px-4 py-2 text-sm">Hủy</button><button onClick={() => void reject()} disabled={!rejectReason} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">Từ chối</button></div></div></div>}
    <Dialog open={qrOpen} onOpenChange={setQrOpen}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-4 font-sans shadow-2xl">
        <DialogHeader className="border-b border-white/60 pb-2"><DialogTitle className="flex items-center gap-2 text-sm font-bold text-[#1E293B]"><QrCode className="h-4 w-4 text-blue-600" />QR đăng ký KTX</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 text-center"><p className="text-xs text-slate-600">Quét mã để mở trang đăng ký KTX công khai</p>{qrDataUrl && <img src={qrDataUrl} alt="QR mở trang đăng ký KTX" className="mx-auto h-64 w-64 rounded-lg bg-white p-2" />}{qrError && <p role="alert" className="text-sm text-red-600">{qrError}</p>}<p className="break-all rounded-xl border border-white/80 bg-white/60 px-3 py-2 text-[11px] text-slate-600">{typeof window !== 'undefined' ? getPublicRegistrationUrl(window.location.origin) : PUBLIC_REGISTRATION_PATH}</p></div>
        <DialogFooter className="border-t border-white/60 pt-2"><Button type="button" variant="outline" onClick={() => setQrOpen(false)}>Đóng</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(editRow)} onOpenChange={open => { if (!open && !editSaving) { setEditRow(null); setEditForm(emptyEditForm()); setEditError(''); setEditSemesterError(''); setEditActiveSemesterName(''); setEditCalendarOpen(false); } }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl">
        <DialogHeader className="border-b border-white/50 pb-3"><DialogTitle className="flex flex-wrap items-center gap-2">{editRow?.source === 'FORMAL' ? 'Sửa đơn đăng ký' : 'Sửa đăng ký tạm'}{editRow?.source === 'ADMIN_TEMPORARY' && editActiveSemesterName && <span className="text-xs font-semibold text-[#64748B]">{editActiveSemesterName}</span>}{editRow?.source === 'ADMIN_TEMPORARY' && editSemesterLoading && <span className="text-xs font-semibold text-[#64748B]">Đang tải học kỳ...</span>}</DialogTitle></DialogHeader>
        <form onSubmit={submitEdit} className="grid gap-4 py-4 sm:grid-cols-2">
          {editRow?.source !== 'FORMAL' && <><Input label="Họ và tên" required value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} /><Input label="Mã SV" value={editForm.student_code} onChange={e => setEditForm(f => ({ ...f, student_code: e.target.value }))} placeholder="Chưa có mã SV" /></>}
          {editRow?.source === 'FORMAL' && <><Input label="Kỳ" required value={editForm.semester} onChange={e => setEditForm(f => ({ ...f, semester: e.target.value }))} /><Input label="Năm học" required value={editForm.academic_year} onChange={e => setEditForm(f => ({ ...f, academic_year: e.target.value }))} /></>}
          <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Ngày sinh <span className="text-red-500">*</span></label><Popover open={editCalendarOpen} onOpenChange={setEditCalendarOpen}><PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 w-full justify-between rounded-xl border border-white/70 bg-white/50 px-3 text-sm font-normal text-[#1E293B] hover:bg-white/70"><span className="truncate">{dateLabel(editForm.date_of_birth)}</span><Calendar size={15} className="shrink-0 text-[#64748B]" /></Button></PopoverTrigger><PopoverContent className="z-[100] w-auto overflow-hidden border-none bg-transparent p-0 shadow-none" align="start"><CustomCalendar startDate={editForm.date_of_birth ? new Date(`${editForm.date_of_birth}T00:00:00`) : null} endDate={null} onRangeSelect={start => setEditForm(f => ({ ...f, date_of_birth: dateInputValue(start) }))} onRangeConfirm={start => setEditForm(f => ({ ...f, date_of_birth: dateInputValue(start) }))} onCancel={() => setEditCalendarOpen(false)} onConfirm={() => setEditCalendarOpen(false)} /></PopoverContent></Popover></div>
          <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Giới tính <span className="text-red-500">*</span></label><Select value={editForm.gender} onValueChange={value => setEditForm(f => ({ ...f, gender: value as EditForm['gender'] }))}><SelectTrigger aria-label="Giới tính"><SelectValue placeholder="Chọn giới tính" /></SelectTrigger><SelectContent><SelectItem value="Male">Nam</SelectItem><SelectItem value="Female">Nữ</SelectItem><SelectItem value="Other">Khác</SelectItem></SelectContent></Select></div>
          <Input label="Số điện thoại" required type="tel" value={editForm.phone_number} onChange={e => setEditForm(f => ({ ...f, phone_number: e.target.value }))} />
          <div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Ưu tiên</label><Select value={editForm.priority_group} onValueChange={value => setEditForm(f => ({ ...f, priority_group: value as EditForm['priority_group'] }))}><SelectTrigger aria-label="Ưu tiên"><SelectValue /></SelectTrigger><SelectContent>{['Không', 'Chính sách', 'Xa nhà', 'Học lực giỏi', 'Khó khăn'].map(value => <SelectItem key={value} value={value}>{value === 'Không' ? 'Không' : `Có - ${value}`}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Loại phòng</label><Select value={editForm.room_type} onValueChange={value => setEditForm(f => ({ ...f, room_type: value as EditForm['room_type'] }))}><SelectTrigger aria-label="Loại phòng"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Thường">Thường</SelectItem><SelectItem value="Máy lạnh">Máy lạnh</SelectItem></SelectContent></Select></div>
          <Input label="Ghi chú" multiline rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} containerClassName="sm:col-span-2" />
          {(editError || editSemesterError) && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{editError || editSemesterError}</p>}
          <DialogFooter className="col-span-full border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => setEditRow(null)} disabled={editSaving}>Hủy</Button><Button type="submit" disabled={editSaving || editSemesterLoading || Boolean(editSemesterError) || (editRow?.source === 'ADMIN_TEMPORARY' && (!editForm.semester || !editForm.academic_year))}>{editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmModal
      isOpen={Boolean(deleteRow)}
      onClose={() => setDeleteRow(null)}
      onConfirm={async () => {
        try { await deleteRegistration(); } catch (err: any) { toast.error(err?.message || 'Không thể xóa đơn đăng ký.'); throw err; }
      }}
      title="Xóa đơn đăng ký"
      message={deleteRow ? <>Bạn có chắc muốn xóa đơn của <strong>{studentName(deleteRow)}</strong> ({studentCode(deleteRow)}) không?</> : null}
      confirmLabel="Xóa đơn"
      cancelLabel="Hủy"
      variant="danger"
    />
    <ConfirmModal isOpen={bulkDeleteOpen} onClose={() => !bulkDeleting && setBulkDeleteOpen(false)} onConfirm={removeSelected} title="Xóa đơn đăng ký đã chọn" message={`Bạn có chắc muốn xóa ${selected.length} đơn đăng ký đã chọn?`} confirmLabel="Xóa đơn" cancelLabel="Hủy" variant="danger" />
    <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open && !createSaving) resetCreate(); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl shadow-slate-300/40 backdrop-blur-md sm:max-w-4xl">
        <DialogHeader className="mb-4 border-b border-white/50 pb-3">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-black uppercase tracking-wider text-[#1E293B]">
            <span>Thêm sinh viên đăng ký KTX</span>
            {activeSemesterName && <span className="text-[11px] font-semibold normal-case text-[#64748B]">{activeSemesterName}</span>}
            {semesterLoading && <span className="text-[11px] font-semibold normal-case text-[#64748B]">Đang tải học kỳ...</span>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submitCreate} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-4 rounded-2xl border border-white/80 bg-white/60 p-4 shadow-sm">
              <div className="relative">
                <Input label="Sinh viên / họ tên tạm" required id="registration-student" value={student ? `${student.student_code} — ${student.full_name}` : studentSearch} onChange={e => { setStudent(null); setStudentSearch(e.target.value); }} placeholder="Tìm sinh viên hoặc nhập họ tên để lưu tạm" autoComplete="off" />
                {!student && studentSearch.trim() && <p className="mt-1 px-1 text-xs text-amber-700">Không chọn kết quả tìm kiếm: hồ sơ sẽ được lưu tạm để phân loại sau.</p>}
                {studentOptions.length > 0 && <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-white/80 bg-white shadow-xl">{studentOptions.map(item => <Button variant="ghost" type="button" key={item._id} onClick={() => selectStudent(item)} className="h-auto w-full justify-start rounded-none px-3 py-2 text-left text-sm"><span className="font-semibold">{item.student_code} — {item.full_name}</span><span className="ml-2 text-xs text-slate-500">{typeof item.class_id === 'object' ? item.class_id?.class_name : ''}</span></Button>)}</div>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex w-full flex-col gap-1.5">
                  <label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Ngày sinh <span className="text-red-500">*</span></label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="h-10 w-full justify-between rounded-xl border border-white/70 bg-white/50 px-3 text-sm font-normal text-[#1E293B] hover:bg-white/70"><span className="truncate">{dateLabel(createForm.date_of_birth)}</span><Calendar size={15} className="shrink-0 text-[#64748B]" /></Button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[100] w-auto overflow-hidden border-none bg-transparent p-0 shadow-none" align="start">
                      <CustomCalendar
                        startDate={createForm.date_of_birth ? new Date(`${createForm.date_of_birth}T00:00:00`) : null}
                        endDate={null}
                        onRangeSelect={(start) => setCreateForm(f => ({ ...f, date_of_birth: dateInputValue(start) }))}
                        onRangeConfirm={(start, end) => setCreateForm(f => {
                          const startValue = dateInputValue(start);
                          const endValue = end ? dateInputValue(end) : '';
                          return { ...f, date_of_birth: endValue && startValue === f.date_of_birth ? endValue : startValue };
                        })}
                        onCancel={() => setCalendarOpen(false)}
                        onConfirm={() => setCalendarOpen(false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Giới tính <span className="text-red-500">*</span></label><Select value={createForm.gender} onValueChange={value => setCreateForm(f => ({ ...f, gender: value as CreateForm['gender'], room_type: value === 'Female' ? f.room_type : 'Thường' }))}><SelectTrigger aria-label="Giới tính" className="w-full"><SelectValue placeholder="Chọn giới tính" /></SelectTrigger><SelectContent><SelectItem value="Male">Nam</SelectItem><SelectItem value="Female">Nữ</SelectItem><SelectItem value="Other">Khác</SelectItem></SelectContent></Select></div>
              </div>
              <Input label="Số điện thoại" required type="tel" value={createForm.phone_number} onChange={e => setCreateForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="Nhập số điện thoại" />
            </section>
            <section className="space-y-4 rounded-2xl border border-white/80 bg-white/60 p-4 shadow-sm">
              <div className="space-y-1.5"><label className="flex items-center gap-1 px-1 text-[13px] font-bold text-[#1E293B]">Loại phòng</label><Select value={createForm.room_type} disabled={createForm.gender !== 'Female'} onValueChange={value => setCreateForm(f => ({ ...f, room_type: value as CreateForm['room_type'] }))}><SelectTrigger aria-label="Loại phòng" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Thường">Thường</SelectItem><SelectItem value="Máy lạnh">Máy lạnh (Ưu tiên cho nữ)</SelectItem></SelectContent></Select></div>
              <Input label="Ghi chú" multiline rows={3} value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} />
            </section>
          </div>
          {(createError || semesterError) && <p role="alert" className="text-sm text-red-600">{createError || semesterError}</p>}
          <DialogFooter className="mt-2 border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createSaving}>Hủy</Button><Button type="submit" disabled={createSaving || semesterLoading || Boolean(semesterError) || !createForm.semester}>{createSaving ? 'Đang lưu...' : 'Tạo đăng ký'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </main>;
}
