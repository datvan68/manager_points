'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
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
import FloatingActionBar from '@/components/ui/FloatingActionBar';
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

const toRoomMutationPayload = (form: FormValue): RoomMutationInput => ({
  room_code: String(form.room_code ?? '').trim().toUpperCase(),
  room_name: String(form.room_name ?? '').trim(),
  building_id: typeof form.building_id === 'object' ? form.building_id?._id : String(form.building_id ?? ''),
  room_type: String(form.room_type ?? ''),
  bed_count: Number(form.bed_count),
  room_price: Number(form.room_price),
  status: form.status || undefined,
  amenities: Array.isArray(form.amenities) ? form.amenities : undefined,
  description: form.description ? String(form.description) : undefined,
});
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
  const [isMobile, setIsMobile] = useState(false);
  const mobilePageRef = useRef(1);
  const mobileHasMoreRef = useRef(true);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [roomOpen, setRoomOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const [roomEdit, setRoomEdit] = useState<Room | null>(null);
  const [buildingEdit, setBuildingEdit] = useState<Building | null>(null);
  const [areaFormOpen, setAreaFormOpen] = useState(false);
  const [roomForm, setRoomForm] = useState<FormValue>(roomDefaults);
  const [buildingForm, setBuildingForm] = useState<FormValue>(buildingDefaults);
  const [saving, setSaving] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bedRoom, setBedRoom] = useState<Room | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [bedsLoading, setBedsLoading] = useState(false);
  const [deletingBedId, setDeletingBedId] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const load = useCallback(async (background = false) => {
    try {
      if (background) setRefreshing(true); else setLoading(true);
      setError('');
      const [roomResult, buildingResult] = await Promise.all([
        dormitoryApi.rooms.getAll({ search: search.trim() || undefined, page: isMobile ? 1 : page, limit: pageSize }),
        dormitoryApi.buildings.getAll({ limit: 100 }),
      ]);
      setRooms(roomResult.data);
      setMeta(roomResult.meta);
      setBuildings(buildingResult.data);
      mobilePageRef.current = 1;
      mobileHasMoreRef.current = roomResult.meta.totalPages > 1;
      setMobileLoadError(false);
      setSelected([]);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách phòng.');
      toast.error(err?.message || 'Không thể tải danh sách phòng.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isMobile, page, pageSize, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const loadMoreMobile = useCallback(async () => {
    if (!isMobile || mobileLoadingMore || !mobileHasMoreRef.current) return;
    const nextPage = mobilePageRef.current + 1;
    setMobileLoadingMore(true);
    setMobileLoadError(false);
    try {
      const result = await dormitoryApi.rooms.getAll({ search: search.trim() || undefined, page: nextPage, limit: pageSize });
      setRooms(current => mergeUnique(current, result.data));
      mobilePageRef.current = nextPage;
      mobileHasMoreRef.current = nextPage < result.meta.totalPages;
    } catch (err: any) {
      setMobileLoadError(true);
      toast.error(err?.message || 'Không thể tải thêm phòng.');
    } finally {
      setMobileLoadingMore(false);
    }
  }, [isMobile, mobileLoadingMore, pageSize, search]);

  useEffect(() => {
    if (!isMobile || !mobileSentinelRef.current || !mobileScrollRef.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void loadMoreMobile(); }, { root: mobileScrollRef.current, rootMargin: '160px' });
    observer.observe(mobileSentinelRef.current);
    return () => observer.disconnect();
  }, [isMobile, loadMoreMobile]);

  const openRoom = (room?: Room) => {
    setRoomEdit(room || null);
    setRoomForm(room ? { ...room, building_id: typeof room.building_id === 'object' ? room.building_id._id : room.building_id, room_name: room.room_name || room.room_code } : { ...roomDefaults, building_id: buildings[0]?._id || '' });
    setRoomOpen(true);
  };
  const openArea = (building?: Building) => {
    setBuildingEdit(building || null);
    setBuildingForm(building ? { ...building } : { ...buildingDefaults });
    setAreaFormOpen(Boolean(building));
    setAreaOpen(true);
  };
  const startCreateArea = () => { setBuildingEdit(null); setBuildingForm({ ...buildingDefaults }); setAreaFormOpen(true); };

  const saveRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = toRoomMutationPayload(roomForm);
      if (roomEdit) await dormitoryApi.rooms.update(roomEdit._id, payload); else await dormitoryApi.rooms.create(payload);
      toast.success(roomEdit ? 'Đã cập nhật phòng' : 'Đã thêm phòng');
      setRoomOpen(false);
      await load(true);
    } catch (err: any) { toast.error(err?.message || 'Không thể lưu phòng.'); } finally { setSaving(false); }
  };
  const saveArea = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
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

  const removeSelectedRooms = async () => {
    if (bulkDeleting || selected.length === 0) return;
    setBulkDeleting(true);
    const selectedIds = [...selected];
    const results = await Promise.allSettled(selectedIds.map(id => dormitoryApi.rooms.delete(id)));
    const deletedIds = selectedIds.filter((_, index) => results[index].status === 'fulfilled');
    const failedIds = selectedIds.filter((_, index) => results[index].status === 'rejected');
    const failedCount = results.length - deletedIds.length;
    if (deletedIds.length > 0) {
      await load(true);
      setSelected(failedIds);
    } else {
      setSelected(failedIds);
    }
    if (failedCount === 0) toast.success(`Đã xóa ${deletedIds.length} phòng`);
    else if (deletedIds.length > 0) toast.warning(`Đã xóa ${deletedIds.length} phòng, ${failedCount} phòng không thể xóa`);
    else toast.error('Không thể xóa các phòng đã chọn.');
    setBulkDeleting(false);
  };

  const allSelected = rooms.length > 0 && rooms.every(room => selected.includes(room._id));
  const toggleAll = (checked: boolean) => setSelected(checked ? rooms.map(room => room._id) : []);
  const field = (label: string, key: string, type = 'text', required = false) => <Input label={label} type={type} required={required} value={roomForm[key] ?? ''} onChange={e => setRoomForm(value => ({ ...value, [key]: key === 'room_code' ? e.target.value.toUpperCase() : e.target.value }))} />;
  const areaField = (label: string, key: string, type = 'text', required = false, multiline = false) => <Input label={label} type={type} multiline={multiline} required={required} value={buildingForm[key] ?? ''} onChange={e => setBuildingForm(value => ({ ...value, [key]: key === 'building_code' ? e.target.value.toUpperCase() : e.target.value }))} />;

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
    <div className="flex shrink-0 items-center justify-start gap-1 overflow-x-auto scrollbar-none py-0.5 w-full flex-nowrap">
      <Research aria-label="Tìm kiếm phòng" placeholder="Tìm mã hoặc tên phòng..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} containerClassName="hidden sm:flex w-[280px] shrink-0" />
      <button className="flex sm:hidden h-9 w-9 items-center justify-center rounded-xl border border-white/80 bg-white/50" aria-label="Tìm kiếm"><Search size={15} /></button>
      <div className="ml-auto flex shrink-0 gap-2">{canCreateRoom && <Button variant="outline" aria-label="Thêm phòng" title="Thêm phòng" onClick={() => openRoom()} className="h-9 rounded-xl px-3"><Plus size={15} /><span>Thêm phòng</span></Button>} {(canCreateBuilding || canUpdateBuilding || canDeleteBuilding) && <Button variant="outline" aria-label="Quản lý khu vực" title="Quản lý khu vực" onClick={() => { setAreaFormOpen(false); setAreaOpen(true); }} className="h-9 w-9 rounded-xl p-0"><Building2 size={15} /></Button>}<Button variant="outline" aria-label="Tải lại danh sách" title="Tải lại" onClick={() => void load(true)} className="h-9 w-9 rounded-xl p-0"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /></Button></div>
    </div>

    {canDeleteRoom && <FloatingActionBar selectedCount={selected.length} onClear={() => setSelected([])} itemLabel="phòng" actions={<button type="button" aria-label="Xóa phòng đã chọn" disabled={bulkDeleting} onClick={() => setBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"><Trash2 size={14} />Xóa</button>} />}
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-sm shadow-slate-300/40 backdrop-blur-md [&_table]:text-xs [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-2.5">
      <ResponsiveDataView data={rooms} columns={columns} isLoading={loading} keyExtractor={room => room._id} mobileScrollRef={mobileScrollRef} hidePaginationOnMobile mobileFooter={<div ref={mobileSentinelRef} className="flex min-h-12 items-center justify-center py-3 text-xs text-slate-500">{mobileLoadingMore ? 'Đang tải thêm...' : mobileLoadError ? <button type="button" className="text-blue-600 underline" onClick={() => void loadMoreMobile()}>Thử lại</button> : !mobileHasMoreRef.current && rooms.length ? 'Đã hiển thị tất cả phòng.' : null}</div>} selection={{ selectedKeys: selected, onSelectRow: (key, checked) => setSelected(ids => checked ? [...ids, key] : ids.filter(id => id !== key)), onSelectAll: toggleAll, allSelected }} emptyState={<div className="p-8 text-center text-sm text-slate-500">{error || 'Chưa có phòng nào'}</div>} pagination={<CustomPagination totalItems={meta.total} pageSize={pageSize} currentPage={page} onPageChange={next => { setPage(next); setSelected([]); }} onPageSizeChange={size => { setPage(1); setPageSize(size); setSelected([]); }} pageSizeOptions={pageSizeOptions} isLoading={loading} label="phòng" />} />
    </div>

    <Dialog open={roomOpen} onOpenChange={setRoomOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl"><DialogHeader className="border-b border-white/50 pb-3"><DialogTitle>{roomEdit ? 'Sửa phòng' : 'Thêm phòng'}</DialogTitle></DialogHeader><form onSubmit={saveRoom} className="grid gap-4 py-4 sm:grid-cols-2">{field('Mã phòng', 'room_code', 'text', true)}{field('Tên phòng', 'room_name', 'text', true)}<div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Khu vực</label><Select value={roomForm.building_id} onValueChange={value => setRoomForm(current => ({ ...current, building_id: value }))}><SelectTrigger><SelectValue placeholder="Chọn khu vực" /></SelectTrigger><SelectContent>{buildings.map(building => <SelectItem key={building._id} value={building._id}>{building.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Loại phòng</label><Select value={roomForm.room_type} onValueChange={value => setRoomForm(current => ({ ...current, room_type: value }))}><SelectTrigger><SelectValue placeholder="Chọn loại phòng" /></SelectTrigger><SelectContent><SelectItem value="Thường">Thường</SelectItem><SelectItem value="Máy lạnh">Máy lạnh</SelectItem></SelectContent></Select></div>{field('Tổng số giường', 'bed_count', 'number', true)}{field('Giá phòng', 'room_price', 'number', true)}<div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Trạng thái</label><Select value={roomForm.status} onValueChange={value => setRoomForm(current => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Trống', 'Đầy', 'Khóa', 'Bảo trì'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div className="sm:col-span-2"><Input label="Mô tả" multiline rows={3} value={roomForm.description ?? ''} onChange={event => setRoomForm(current => ({ ...current, description: event.target.value }))} /></div><DialogFooter className="col-span-full border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => setRoomOpen(false)}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu phòng'}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={areaOpen} onOpenChange={setAreaOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl"><DialogHeader className="border-b border-white/50 pb-3"><DialogTitle>Quản lý khu vực</DialogTitle></DialogHeader><div className="space-y-3 py-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-600">Danh sách khu vực</p>{canCreateBuilding && <Button variant="outline" size="icon" aria-label="Thêm khu vực" title="Thêm khu vực" onClick={startCreateArea} className="h-9 w-9 rounded-xl border border-white/80 bg-white/50 p-0 text-slate-700 hover:bg-white/80 shrink-0"><Plus size={15} /></Button>}</div>{buildings.length === 0 ? <p className="rounded-xl border border-white/60 bg-white/40 p-6 text-center text-sm text-slate-500">Chưa có khu vực nào.</p> : <div className="space-y-2">{buildings.map(building => <div key={building._id} className="flex items-center justify-between rounded-xl border border-white/70 bg-white/45 px-3 py-2"><div><p className="font-semibold text-slate-800">{building.name}</p><p className="text-xs text-slate-500">{building.building_code}</p></div><div className="flex gap-1">{canUpdateBuilding && <button aria-label={`Sửa khu vực ${building.name}`} onClick={() => openArea(building)} className="rounded-xl p-1.5 text-blue-600 hover:bg-blue-50"><Pencil size={15} /></button>}{canDeleteBuilding && <button aria-label={`Xóa khu vực ${building.name}`} onClick={() => setBuildingToDelete(building)} className="rounded-xl p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>}</div></div>)}</div>}{areaFormOpen && <form onSubmit={saveArea} className="grid gap-4 border-t border-white/60 pt-4 sm:grid-cols-2">{areaField('Mã khu vực', 'building_code', 'text', true)}{areaField('Tên khu vực', 'name', 'text', true)}{areaField('Địa chỉ', 'address')}<div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Trạng thái</label><Select value={buildingForm.status} onValueChange={value => setBuildingForm(current => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Trống">Trống</SelectItem><SelectItem value="Đầy">Đầy</SelectItem></SelectContent></Select></div>{areaField('Mô tả', 'description', 'text', false, true)}<DialogFooter className="col-span-full border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => { setAreaFormOpen(false); setBuildingEdit(null); }}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : buildingEdit ? 'Lưu khu vực' : 'Thêm khu vực'}</Button></DialogFooter></form>}</div></DialogContent></Dialog>

    <Dialog open={Boolean(bedRoom)} onOpenChange={open => !open && setBedRoom(null)}><DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl"><DialogHeader><DialogTitle>Quản lý giường {bedRoom?.room_code}</DialogTitle></DialogHeader><div className="space-y-3">{bedsLoading ? <p className="py-6 text-center text-sm text-slate-500">Đang tải giường...</p> : beds.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Phòng chưa có giường.</p> : <div className="space-y-2">{beds.map(bed => <div key={bed._id} className="flex items-center justify-between rounded-xl border border-white/70 bg-white/50 px-3 py-2"><div><p className="font-semibold text-slate-800">{bed.bed_code}</p><p className="text-xs text-slate-500">{bed.position || 'Chưa có vị trí'} · {bed.status}</p></div><div className="flex gap-1">{canUpdateBed && bed.status !== 'Đang sử dụng' && bed.status !== 'Đã nghỉ' && <button type="button" className="rounded-lg px-2 py-1 text-xs text-amber-700 hover:bg-amber-50" onClick={() => void changeBedStatus(bed, bed.status === 'Bảo trì' ? 'Trống' : 'Bảo trì')}>{bed.status === 'Bảo trì' ? 'Mở lại' : 'Bảo trì'}</button>}{canDeleteBed && (bed.status === 'Trống' || bed.status === 'Đã nghỉ') && <button type="button" disabled={deletingBedId === bed._id} className="rounded-lg px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50" onClick={() => void removeBed(bed)}>{deletingBedId === bed._id ? 'Đang xóa...' : 'Xóa'}</button>}</div></div>)}</div>}</div></DialogContent></Dialog>

    <ConfirmModal isOpen={Boolean(roomToDelete)} onClose={() => setRoomToDelete(null)} onConfirm={removeRoom} title="Xóa phòng" message={roomToDelete ? `Bạn có chắc chắn muốn xóa phòng ${roomToDelete.room_code}?` : ''} confirmLabel="Xóa phòng" variant="danger" />
    <ConfirmModal isOpen={Boolean(buildingToDelete)} onClose={() => setBuildingToDelete(null)} onConfirm={removeBuilding} title="Xóa khu vực" message={buildingToDelete ? `Bạn có chắc chắn muốn xóa khu vực ${buildingToDelete.name}?` : ''} confirmLabel="Xóa khu vực" variant="danger" />
    <ConfirmModal isOpen={bulkDeleteOpen} onClose={() => !bulkDeleting && setBulkDeleteOpen(false)} onConfirm={async () => { await removeSelectedRooms(); setBulkDeleteOpen(false); }} title="Xóa phòng đã chọn" message={`Bạn có chắc chắn muốn xóa ${selected.length} phòng đã chọn? Các phòng đang được sử dụng có thể bị từ chối.`} confirmLabel="Xóa phòng" variant="danger" />
  </main>;
}
