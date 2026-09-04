'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { Bed, Building, Room, dormitoryApi } from '@/api/dormitory-api';
import { useAuth } from '@/providers/auth-provider';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Research } from '@/components/ui/Research';
import ResponsiveDataView, { ResponsiveColumn } from '@/components/ui/ResponsiveDataView';
import { CustomPagination } from '@/components/ui/pagination';
import { toast } from 'sonner';

const roomDefaults = { room_code: '', room_name: '', building_id: '', room_type: 'Thường', bed_count: 1, room_price: 0, status: 'Trống', description: '' };
const buildingDefaults = { building_code: '', name: '', address: '', status: 'Trống', description: '' };
const pageSizeOptions = [20, 40, 50, 100];
type FormValue = Record<string, any>;
type RoomMutationInput = {
  room_code: string;
  room_name: string;
  building_id: string;
  room_type: string;
  bed_count: number;
  room_price: number;
  status?: Room['status'];
  amenities?: string[];
  description?: string;
};

export const roomFormFromRoom = (room: Room): FormValue => ({
  ...room,
  building_id: typeof room.building_id === 'object' ? room.building_id._id : room.building_id,
  room_name: room.room_name || room.room_code,
});

export const toRoomMutationPayload = (form: FormValue): RoomMutationInput => {
  const payload: RoomMutationInput = {
    room_code: String(form.room_code ?? '').trim().toUpperCase(),
    room_name: String(form.room_name ?? '').trim(),
    building_id: String(typeof form.building_id === 'object' ? form.building_id?._id : form.building_id ?? '').trim(),
    room_type: String(form.room_type ?? '').trim(),
    bed_count: Number(form.bed_count),
    room_price: Number(form.room_price),
  };
  if (form.status) payload.status = form.status as Room['status'];
  if (Array.isArray(form.amenities)) payload.amenities = form.amenities;
  const description = String(form.description ?? '').trim();
  if (description) payload.description = description;
  return payload;
};
export type FormErrors = Record<string, string>;
export const validateRoomForm = (form: FormValue): FormErrors => {
  const errors: FormErrors = {};
  if (!String(form.room_code ?? '').trim()) errors.room_code = 'Vui lòng nhập mã phòng.';
  if (!String(form.room_name ?? '').trim()) errors.room_name = 'Vui lòng nhập tên phòng.';
  if (!String(typeof form.building_id === 'object' ? form.building_id?._id : form.building_id ?? '').trim()) errors.building_id = 'Vui lòng chọn khu vực.';
  if (!String(form.room_type ?? '').trim()) errors.room_type = 'Vui lòng chọn loại phòng.';
  const bedCount = Number(form.bed_count);
  if (!Number.isInteger(bedCount) || bedCount <= 0) errors.bed_count = 'Số giường phải là số nguyên dương.';
  const roomPrice = Number(form.room_price);
  if (!Number.isFinite(roomPrice) || roomPrice < 0) errors.room_price = 'Giá phòng phải là số không âm.';
  return errors;
};
export const validateBuildingForm = (form: FormValue): FormErrors => {
  const errors: FormErrors = {};
  if (!String(form.building_code ?? '').trim()) errors.building_code = 'Vui lòng nhập mã khu vực.';
  if (!String(form.name ?? '').trim()) errors.name = 'Vui lòng nhập tên khu vực.';
  return errors;
};
const formatRoomPrice = (value: unknown) => `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} VNĐ`;
export const roomBedCountLabel = (room: Pick<Room, 'max_students'>) => String(room.max_students ?? 0);

const mergeUnique = (current: Room[], incoming: Room[]) => {
  const byId = new Map(current.map(room => [room._id, room]));
  incoming.forEach(room => byId.set(room._id, room));
  return [...byId.values()];
};

export default function BuildingsPage() {
  const { hasPermission } = useAuth();
  const canCreateRoom = hasPermission('DORM_ROOM_CREATE');
  const canUpdateRoom = hasPermission('DORM_ROOM_UPDATE');
  const canDeleteRoom = hasPermission('DORM_ROOM_DELETE');
  const canManageBeds = hasPermission('DORM_BED_UPDATE') || hasPermission('DORM_BED_DELETE');
  const canUpdateBed = hasPermission('DORM_BED_UPDATE');
  const canDeleteBed = hasPermission('DORM_BED_DELETE');
  const canCreateBuilding = hasPermission('DORM_BUILDING_CREATE');
  const canUpdateBuilding = hasPermission('DORM_BUILDING_UPDATE');
  const canDeleteBuilding = hasPermission('DORM_BUILDING_DELETE');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [mobileLoadingMore, setMobileLoadingMore] = useState(false);
  const [mobileLoadError, setMobileLoadError] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const roomsRequestRef = useRef(0);
  const queryGenerationRef = useRef(0);
  const mobilePageRef = useRef(1);
  const mobileHasMoreRef = useRef(true);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const [roomEdit, setRoomEdit] = useState<Room | null>(null);
  const [buildingEdit, setBuildingEdit] = useState<Building | null>(null);
  const [areaFormOpen, setAreaFormOpen] = useState(false);
  const [roomForm, setRoomForm] = useState<FormValue>(roomDefaults);
  const [buildingForm, setBuildingForm] = useState<FormValue>(buildingDefaults);
  const [roomErrors, setRoomErrors] = useState<FormErrors>({});
  const [roomSaveError, setRoomSaveError] = useState('');
  const [buildingErrors, setBuildingErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const roomSavingRef = useRef(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);
  const [bedRoom, setBedRoom] = useState<Room | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [bedsLoading, setBedsLoading] = useState(false);
  const [deletingBedId, setDeletingBedId] = useState<string | null>(null);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => { if (mobileSearchOpen) searchRef.current?.focus(); }, [mobileSearchOpen]);

  const load = useCallback(async (background = false) => {
    const requestId = ++roomsRequestRef.current;
    const requestedPage = isCompact ? 1 : page;
    try {
      if (background) setRefreshing(true); else setLoading(true);
      setError('');
      const [roomResult, buildingResult] = await Promise.all([
        dormitoryApi.rooms.getAll({ search: search.trim() || undefined, page: requestedPage, limit: pageSize }),
        dormitoryApi.buildings.getAll({ limit: 100 }),
      ]);
      if (roomsRequestRef.current !== requestId) return;
      setRooms(roomResult.data);
      setMeta(roomResult.meta);
      setBuildings(buildingResult.data);
      mobilePageRef.current = requestedPage;
      mobileHasMoreRef.current = isCompact && requestedPage < roomResult.meta.totalPages;
      setMobileLoadError(false);
      setPage(current => isCompact ? 1 : current);
    } catch (err: any) {
      if (roomsRequestRef.current !== requestId) return;
      setError(err?.message || 'Không thể tải danh sách phòng.');
      toast.error(err?.message || 'Không thể tải danh sách phòng.');
    } finally {
      if (roomsRequestRef.current === requestId) { setLoading(false); setRefreshing(false); }
    }
  }, [isCompact, page, pageSize, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    queryGenerationRef.current += 1;
    mobilePageRef.current = 1;
    mobileHasMoreRef.current = true;
    setMobileLoadError(false);
    if (isCompact) setPage(1);
  }, [isCompact, pageSize, search]);

  const loadMoreMobile = useCallback(async () => {
    if (!isCompact || loading || mobileLoadingMore || !mobileHasMoreRef.current) return;
    const nextPage = mobilePageRef.current + 1;
    const generation = queryGenerationRef.current;
    const requestId = ++roomsRequestRef.current;
    setMobileLoadingMore(true);
    setMobileLoadError(false);
    try {
      const result = await dormitoryApi.rooms.getAll({ search: search.trim() || undefined, page: nextPage, limit: pageSize });
      if (roomsRequestRef.current !== requestId || queryGenerationRef.current !== generation) return;
      setRooms(current => mergeUnique(current, result.data));
      mobilePageRef.current = nextPage;
      mobileHasMoreRef.current = nextPage < result.meta.totalPages;
    } catch (err: any) {
      setMobileLoadError(true);
      toast.error(err?.message || 'Không thể tải thêm phòng.');
    } finally {
      setMobileLoadingMore(false);
    }
  }, [isCompact, loading, mobileLoadingMore, pageSize, search]);

  useEffect(() => {
    if (!isCompact || !mobileSentinelRef.current || !mobileScrollRef.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && !mobileLoadError) void loadMoreMobile(); }, { root: mobileScrollRef.current, rootMargin: '160px' });
    observer.observe(mobileSentinelRef.current);
    return () => observer.disconnect();
  }, [isCompact, loadMoreMobile, mobileLoadError]);

  const openRoom = (room?: Room) => {
    setRoomEdit(room || null);
    setRoomForm(room ? roomFormFromRoom(room) : { ...roomDefaults, building_id: buildings[0]?._id || '' });
    setRoomErrors({});
    setRoomSaveError('');
    setRoomOpen(true);
  };
  const openArea = (building?: Building) => {
    setBuildingEdit(building || null);
    setBuildingForm(building ? { ...building } : { ...buildingDefaults });
    setBuildingErrors({});
    setAreaFormOpen(Boolean(building));
    setAreaOpen(true);
  };
  const startCreateArea = () => { setBuildingEdit(null); setBuildingForm({ ...buildingDefaults }); setBuildingErrors({}); setAreaFormOpen(true); };

  const saveRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || roomSavingRef.current) return;
    setRoomSaveError('');
    const errors = validateRoomForm(roomForm);
    setRoomErrors(errors);
    if (Object.keys(errors).length) return;
    roomSavingRef.current = true;
    setSaving(true);
    try {
      const payload = toRoomMutationPayload(roomForm);
      if (roomEdit) await dormitoryApi.rooms.update(roomEdit._id, payload); else await dormitoryApi.rooms.create(payload);
       await load(true);
       toast.success(roomEdit ? 'Đã cập nhật phòng' : 'Đã thêm phòng');
       setRoomOpen(false);
    } catch (err: any) {
      const message = err?.message || 'Không thể lưu phòng.';
      setRoomSaveError(message);
      toast.error(message);
    } finally {
      roomSavingRef.current = false;
      setSaving(false);
    }
  };
  const saveArea = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const errors = validateBuildingForm(buildingForm);
    setBuildingErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const buildingPayload = { ...buildingForm };
      buildingPayload.building_code = String(buildingPayload.building_code ?? '').trim().toUpperCase();
      if (buildingEdit) await dormitoryApi.buildings.update(buildingEdit._id, buildingPayload); else await dormitoryApi.buildings.create(buildingPayload);
      toast.success(buildingEdit ? 'Đã cập nhật khu vực' : 'Đã thêm khu vực');
      setBuildingEdit(null); setAreaFormOpen(false); await load(true);
    } catch (err: any) { toast.error(err?.message || 'Không thể lưu khu vực.'); } finally { setSaving(false); }
  };
  const removeRoom = async () => {
    if (!roomToDelete) return;
    try {
      await dormitoryApi.rooms.delete(roomToDelete._id);
      setRoomToDelete(null);
      toast.success('Đã xóa phòng');
      await load(true);
    } catch (err: any) { toast.error(err?.message || 'Không thể xóa phòng.'); throw err; }
  };
  const removeBuilding = async () => {
    if (!buildingToDelete) return;
    try {
      await dormitoryApi.buildings.delete(buildingToDelete._id);
      setBuildingToDelete(null);
      toast.success('Đã xóa khu vực');
      await load(true);
    } catch (err: any) { toast.error(err?.message || 'Không thể xóa khu vực.'); throw err; }
  };

  const openBedManager = async (room: Room) => {
    setBedRoom(room); setBedsLoading(true);
    try { setBeds(await dormitoryApi.beds.getByRoom(room._id)); }
    catch (err: any) { toast.error(err?.message || 'Không thể tải danh sách giường.'); }
    finally { setBedsLoading(false); }
  };
  const refreshBeds = async () => { if (bedRoom) await openBedManager(bedRoom); await load(true); };
  const changeBedStatus = async (bed: Bed, status: string) => {
    try { await dormitoryApi.beds.updateStatus(bed._id, status); await refreshBeds(); toast.success('Đã cập nhật trạng thái giường'); }
    catch (err: any) { toast.error(err?.message || 'Không thể cập nhật giường.'); }
  };
  const removeBed = async (bed: Bed) => {
    if (deletingBedId) return;
    setDeletingBedId(bed._id);
    try { await dormitoryApi.beds.delete(bed._id); await refreshBeds(); toast.success('Đã xóa giường'); }
    catch (err: any) { toast.error(err?.message || 'Không thể xóa giường.'); }
    finally { setDeletingBedId(null); }
  };

  const field = (label: string, key: string, type = 'text', required = false) => <Input label={label} type={type} required={required} error={roomErrors[key]} value={roomForm[key] ?? ''} onChange={e => { setRoomErrors(errors => ({ ...errors, [key]: '' })); setRoomForm(value => ({ ...value, [key]: key === 'room_code' ? e.target.value.toUpperCase() : e.target.value })); }} />;
  const areaField = (label: string, key: string, type = 'text', required = false, multiline = false) => <Input label={label} type={type} multiline={multiline} required={required} error={buildingErrors[key]} value={buildingForm[key] ?? ''} onChange={e => { setBuildingErrors(errors => ({ ...errors, [key]: '' })); setBuildingForm(value => ({ ...value, [key]: key === 'building_code' ? e.target.value.toUpperCase() : e.target.value })); }} />;
  const selectError = (errors: FormErrors, key: string) => errors[key] ? <p className="px-1 text-[12px] font-medium text-red-500">{errors[key]}</p> : null;

  const columns: ResponsiveColumn<Room>[] = useMemo(() => [
    { key: 'room_code', header: 'Mã phòng', priority: 'primary' },
    { key: 'room_name', header: 'Tên phòng', priority: 'secondary', render: (value, room) => value || room.room_code },
    { key: 'room_type', header: 'Loại phòng', render: value => String(value || 'Thường') },
    { key: 'max_students', header: 'Giường', render: (_, room) => roomBedCountLabel(room) },
    { key: 'current_students', header: 'Số SV hiện tại', render: value => String(value ?? 0) },
    { key: 'room_price', header: 'Giá phòng', render: value => formatRoomPrice(value) },
    { key: 'actions', header: 'Thao tác', priority: 'action', className: 'text-right', render: (_, room) => <div className="flex items-center justify-end gap-1">{canManageBeds && <button aria-label={`Quản lý giường ${room.room_code}`} title="Quản lý giường" onClick={() => void openBedManager(room)} className="rounded-xl px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">Giường</button>}{canUpdateRoom && <button aria-label={`Sửa phòng ${room.room_code}`} title="Sửa" onClick={() => openRoom(room)} className="rounded-xl p-1.5 text-blue-600 hover:bg-blue-50"><Pencil size={15} /></button>}{canDeleteRoom && <button aria-label={`Xóa phòng ${room.room_code}`} title="Xóa" onClick={() => setRoomToDelete(room)} className="rounded-xl p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>}</div> },
  ], [canDeleteRoom, canManageBeds, canUpdateRoom]);

  return <main className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6">
    {mobileSearchOpen ? (
      <div className="flex w-full items-center gap-1 py-0.5 lg:hidden">
        <Research ref={searchRef} aria-label="Tìm kiếm phòng" placeholder="Tìm mã hoặc tên phòng..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} containerClassName="flex-1 w-full max-w-none" />
        <Button type="button" variant="outline" aria-label="Đóng tìm kiếm phòng" title="Đóng" onClick={() => setMobileSearchOpen(false)} className="h-9 w-9 shrink-0 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700"><X size={16} /></Button>
      </div>
    ) : null}
    <div className={`flex shrink-0 items-center justify-start gap-1 overflow-x-auto scrollbar-none py-0.5 w-full flex-nowrap ${mobileSearchOpen ? 'hidden lg:flex' : ''}`}>
      <Research aria-label="Tìm kiếm phòng" placeholder="Tìm mã hoặc tên phòng..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} containerClassName="hidden lg:flex w-[280px] shrink-0" />
      {!mobileSearchOpen && <Button type="button" variant="outline" aria-label="Mở tìm kiếm phòng" title="Tìm kiếm" onClick={() => setMobileSearchOpen(true)} className="flex lg:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/50 p-0"><Search size={15} /></Button>}
      <div className="ml-auto flex shrink-0 gap-2">{canCreateRoom && <Button variant="outline" aria-label="Thêm phòng" title="Thêm phòng" onClick={() => openRoom()} className="h-9 rounded-xl px-3"><Plus size={15} /><span>Thêm phòng</span></Button>} {(canCreateBuilding || canUpdateBuilding || canDeleteBuilding) && <Button variant="outline" aria-label="Quản lý khu vực" title="Quản lý khu vực" onClick={() => { setAreaFormOpen(false); setAreaOpen(true); }} className="h-9 w-9 rounded-xl p-0"><Building2 size={15} /></Button>}<Button variant="outline" aria-label="Tải lại danh sách" title="Tải lại" onClick={() => void load(true)} className="h-9 w-9 rounded-xl p-0"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /></Button></div>
    </div>

    <div className="flex min-h-0 flex-1 overflow-hidden lg:rounded-2xl lg:border lg:border-white/70 lg:bg-white/45 lg:shadow-sm lg:shadow-slate-300/40 lg:backdrop-blur-md [&_table]:text-xs [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-2.5">
      <ResponsiveDataView data={rooms} columns={columns} isLoading={loading} breakpoint="lg" keyExtractor={room => room._id} mobileScrollRef={mobileScrollRef} mobileVirtualization mobileClassName="px-0 py-4" hidePaginationOnMobile mobileFooter={<div ref={mobileSentinelRef} className="flex min-h-12 items-center justify-center py-3 text-xs text-slate-500">{mobileLoadingMore ? 'Đang tải thêm...' : mobileLoadError ? <button type="button" className="text-blue-600 underline" onClick={() => void loadMoreMobile()}>Thử lại</button> : !mobileHasMoreRef.current && rooms.length ? 'Đã hiển thị tất cả phòng.' : null}</div>} emptyState={<div className="p-8 text-center text-sm text-slate-500">{error || 'Chưa có phòng nào'}</div>} pagination={<CustomPagination totalItems={meta.total} pageSize={pageSize} currentPage={page} onPageChange={next => { setPage(next); }} onPageSizeChange={size => { setPage(1); setPageSize(size); }} pageSizeOptions={pageSizeOptions} isLoading={loading} label="phòng" />} />
    </div>

    <Dialog open={roomOpen} onOpenChange={setRoomOpen}><DialogContent className="w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] max-w-2xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-4 shadow-2xl sm:w-full sm:max-h-[90vh] sm:p-6"><DialogHeader className="border-b border-white/50 pb-3"><DialogTitle>{roomEdit ? 'Sửa phòng' : 'Thêm phòng'}</DialogTitle></DialogHeader><form onSubmit={saveRoom} className="grid gap-4 py-4 sm:grid-cols-2">{field('Mã phòng', 'room_code', 'text', true)}{field('Tên phòng', 'room_name', 'text', true)}<div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Khu vực</label><Select value={roomForm.building_id} onValueChange={value => { setRoomErrors(errors => ({ ...errors, building_id: '' })); setRoomForm(current => ({ ...current, building_id: value })); }}><SelectTrigger aria-invalid={Boolean(roomErrors.building_id)}><SelectValue placeholder="Chọn khu vực" /></SelectTrigger><SelectContent>{buildings.map(building => <SelectItem key={building._id} value={building._id}>{building.name}</SelectItem>)}</SelectContent></Select>{selectError(roomErrors, 'building_id')}</div><div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Loại phòng</label><Select value={roomForm.room_type} onValueChange={value => { setRoomErrors(errors => ({ ...errors, room_type: '' })); setRoomForm(current => ({ ...current, room_type: value })); }}><SelectTrigger aria-invalid={Boolean(roomErrors.room_type)}><SelectValue placeholder="Chọn loại phòng" /></SelectTrigger><SelectContent><SelectItem value="Thường">Thường</SelectItem><SelectItem value="Máy lạnh">Máy lạnh</SelectItem></SelectContent></Select>{selectError(roomErrors, 'room_type')}</div>{field('Tổng số giường', 'bed_count', 'number', true)}{field('Giá phòng', 'room_price', 'number', true)}<div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Trạng thái</label><Select value={roomForm.status} onValueChange={value => setRoomForm(current => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Trống', 'Đầy', 'Khóa', 'Bảo trì'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div className="sm:col-span-2"><Input label="Mô tả" multiline rows={3} value={roomForm.description ?? ''} onChange={event => setRoomForm(current => ({ ...current, description: event.target.value }))} /></div>{roomSaveError && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{roomSaveError}</p>}<DialogFooter className="col-span-full border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => setRoomOpen(false)}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu phòng'}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={areaOpen} onOpenChange={setAreaOpen}><DialogContent className="w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] max-w-2xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-4 shadow-2xl sm:w-full sm:max-h-[90vh] sm:p-6"><DialogHeader className="border-b border-white/50 pb-3"><DialogTitle>Quản lý khu vực</DialogTitle></DialogHeader><div className="space-y-3 py-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-600">Danh sách khu vực</p>{canCreateBuilding && <Button variant="outline" size="icon" aria-label="Thêm khu vực" title="Thêm khu vực" onClick={startCreateArea} className="h-9 w-9 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700 hover:bg-white/80 shrink-0"><Plus size={15} /></Button>}</div>{buildings.length === 0 ? <p className="rounded-xl border border-white/60 bg-white/40 p-6 text-center text-sm text-slate-500">Chưa có khu vực nào.</p> : <div className="space-y-2">{buildings.map(building => <div key={building._id} className="flex items-center justify-between rounded-xl border border-white/70 bg-white/45 px-3 py-2"><div><p className="font-semibold text-slate-800">{building.name}</p><p className="text-xs text-slate-500">{building.building_code}</p></div><div className="flex gap-1">{canUpdateBuilding && <button aria-label={`Sửa khu vực ${building.name}`} onClick={() => openArea(building)} className="rounded-xl p-1.5 text-blue-600 hover:bg-blue-50"><Pencil size={15} /></button>}{canDeleteBuilding && <button aria-label={`Xóa khu vực ${building.name}`} onClick={() => setBuildingToDelete(building)} className="rounded-xl p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>}</div></div>)}</div>}{areaFormOpen && <form onSubmit={saveArea} className="grid gap-4 border-t border-white/60 pt-4 sm:grid-cols-2">{areaField('Mã khu vực', 'building_code', 'text', true)}{areaField('Tên khu vực', 'name', 'text', true)}{areaField('Địa chỉ', 'address')}<div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Trạng thái</label><Select value={buildingForm.status} onValueChange={value => setBuildingForm(current => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Trống">Trống</SelectItem><SelectItem value="Đầy">Đầy</SelectItem></SelectContent></Select></div>{areaField('Mô tả', 'description', 'text', false, true)}<DialogFooter className="col-span-full border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => { setAreaFormOpen(false); setBuildingEdit(null); }}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : buildingEdit ? 'Lưu khu vực' : 'Thêm khu vực'}</Button></DialogFooter></form>}</div></DialogContent></Dialog>

    <Dialog open={Boolean(bedRoom)} onOpenChange={open => !open && setBedRoom(null)}><DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl"><DialogHeader><DialogTitle>Quản lý giường {bedRoom?.room_code}</DialogTitle></DialogHeader><div className="space-y-3">{bedsLoading ? <p className="py-6 text-center text-sm text-slate-500">Đang tải giường...</p> : beds.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Phòng chưa có giường.</p> : <div className="space-y-2">{beds.map(bed => <div key={bed._id} className="flex items-center justify-between rounded-xl border border-white/70 bg-white/50 px-3 py-2"><div><p className="font-semibold text-slate-800">{bed.bed_code}</p><p className="text-xs text-slate-500">{bed.position || 'Chưa có vị trí'} · {bed.status}</p></div><div className="flex gap-1">{canUpdateBed && bed.status !== 'Đang sử dụng' && bed.status !== 'Đã nghỉ' && <button type="button" className="rounded-lg px-2 py-1 text-xs text-amber-700 hover:bg-amber-50" onClick={() => void changeBedStatus(bed, bed.status === 'Bảo trì' ? 'Trống' : 'Bảo trì')}>{bed.status === 'Bảo trì' ? 'Mở lại' : 'Bảo trì'}</button>}{canDeleteBed && (bed.status === 'Trống' || bed.status === 'Đã nghỉ') && <button type="button" disabled={deletingBedId === bed._id} className="rounded-lg px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50" onClick={() => void removeBed(bed)}>{deletingBedId === bed._id ? 'Đang xóa...' : 'Xóa'}</button>}</div></div>)}</div>}</div></DialogContent></Dialog>

    <ConfirmModal isOpen={Boolean(roomToDelete)} onClose={() => setRoomToDelete(null)} onConfirm={removeRoom} title="Xóa phòng" message={roomToDelete ? `Bạn có chắc chắn muốn xóa phòng ${roomToDelete.room_code}?` : ''} confirmLabel="Xóa phòng" variant="danger" />
    <ConfirmModal isOpen={Boolean(buildingToDelete)} onClose={() => setBuildingToDelete(null)} onConfirm={removeBuilding} title="Xóa khu vực" message={buildingToDelete ? `Bạn có chắc chắn muốn xóa khu vực ${buildingToDelete.name}?` : ''} confirmLabel="Xóa khu vực" variant="danger" />
  </main>;
}
