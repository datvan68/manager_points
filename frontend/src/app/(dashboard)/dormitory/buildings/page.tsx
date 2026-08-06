'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ExternalLink, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Building, Room, dormitoryApi } from '@/api/dormitory-api';
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

const roomDefaults = { ma_phong: '', ten_phong: '', building_id: '', tang: 1, loai_phong: 'Thường', so_giuong: 1, gia_phong: 0, trang_thai: 'Trống', mo_ta: '' };
const buildingDefaults = { ma_toa_nha: '', ten: '', dia_chi: '', so_tang: 1, trang_thai: 'Active', mo_ta: '' };
const pageSizeOptions = [20, 40, 50, 100];
type FormValue = Record<string, any>;
const formatRoomPrice = (value: unknown) => `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} VNĐ`;

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
    setRoomForm(room ? { ...room, building_id: typeof room.building_id === 'object' ? room.building_id._id : room.building_id, ten_phong: room.ten_phong || room.ma_phong } : { ...roomDefaults, building_id: buildings[0]?._id || '' });
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
      const payload = { ...roomForm, so_giuong: Number(roomForm.so_giuong), tang: Number(roomForm.tang), gia_phong: Number(roomForm.gia_phong) };
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
      if (buildingEdit) await dormitoryApi.buildings.update(buildingEdit._id, buildingForm); else await dormitoryApi.buildings.create(buildingForm);
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
  const field = (label: string, key: string, type = 'text', required = false) => <Input label={label} type={type} required={required} value={roomForm[key] ?? ''} onChange={e => setRoomForm(value => ({ ...value, [key]: e.target.value }))} />;
  const areaField = (label: string, key: string, type = 'text', required = false, multiline = false) => <Input label={label} type={type} multiline={multiline} required={required} value={buildingForm[key] ?? ''} onChange={e => setBuildingForm(value => ({ ...value, [key]: e.target.value }))} />;

  const columns: ResponsiveColumn<Room>[] = useMemo(() => [
    { key: 'ma_phong', header: 'Mã phòng', priority: 'primary' },
    { key: 'ten_phong', header: 'Tên phòng', priority: 'secondary', render: (value, room) => value || room.ma_phong },
    { key: 'loai_phong', header: 'Loại phòng', render: value => String(value || 'Thường') },
    { key: 'so_giuong', header: 'Giường', render: value => String(value ?? 0) },
    { key: 'total_students', header: 'Số sinh viên', render: value => String(value ?? 0) },
    { key: 'gia_phong', header: 'Giá phòng', render: value => formatRoomPrice(value) },
    { key: 'actions', header: 'Thao tác', priority: 'action', className: 'text-right', render: (_, room) => <div className="flex items-center justify-end gap-1"><a aria-label={`Mở QR phòng ${room.ma_phong}`} title="Mở trang phòng" href={room.url_xem_nhanh || `/public/room/${room.ma_qr}`} target="_blank" rel="noreferrer" className="rounded-xl p-1.5 text-slate-500 hover:bg-blue-50"><ExternalLink size={15} /></a>{canUpdateRoom && <button aria-label={`Sửa phòng ${room.ma_phong}`} title="Sửa" onClick={() => openRoom(room)} className="rounded-xl p-1.5 text-blue-600 hover:bg-blue-50"><Pencil size={15} /></button>}{canDeleteRoom && <button aria-label={`Xóa phòng ${room.ma_phong}`} title="Xóa" onClick={() => setRoomToDelete(room)} className="rounded-xl p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>}</div> },
  ], [canDeleteRoom, canUpdateRoom]);

  return <main className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6">
    <div className="flex shrink-0 items-center justify-start gap-1 overflow-x-auto scrollbar-none py-0.5 w-full flex-nowrap">
      <Research aria-label="Tìm kiếm phòng" placeholder="Tìm mã hoặc tên phòng..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} containerClassName="hidden sm:flex w-[280px] shrink-0" />
      <button className="flex sm:hidden h-9 w-9 items-center justify-center rounded-xl border border-white/80 bg-white/50" aria-label="Tìm kiếm"><Search size={15} /></button>
      <div className="ml-auto flex shrink-0 gap-2">{canCreateRoom && <Button variant="outline" aria-label="Thêm phòng" title="Thêm phòng" onClick={() => openRoom()} className="h-9 rounded-xl px-3"><Plus size={15} /><span>Thêm phòng</span></Button>} {(canCreateBuilding || canUpdateBuilding || canDeleteBuilding) && <Button variant="outline" aria-label="Quản lý khu vực" title="Quản lý khu vực" onClick={() => { setAreaFormOpen(false); setAreaOpen(true); }} className="h-9 w-9 rounded-xl p-0"><Building2 size={15} /></Button>}<Button variant="outline" aria-label="Tải lại danh sách" title="Tải lại" onClick={() => void load(true)} className="h-9 w-9 rounded-xl p-0"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /></Button></div>
    </div>

    {canDeleteRoom && <FloatingActionBar selectedCount={selected.length} onClear={() => setSelected([])} itemLabel="phòng" actions={<button type="button" aria-label="Xóa phòng đã chọn" disabled={bulkDeleting} onClick={() => setBulkDeleteOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"><Trash2 size={14} />Xóa</button>} />}
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-sm shadow-slate-300/40 backdrop-blur-md">
      <ResponsiveDataView data={rooms} columns={columns} isLoading={loading} keyExtractor={room => room._id} mobileScrollRef={mobileScrollRef} hidePaginationOnMobile mobileFooter={<div ref={mobileSentinelRef} className="flex min-h-12 items-center justify-center py-3 text-xs text-slate-500">{mobileLoadingMore ? 'Đang tải thêm...' : mobileLoadError ? <button type="button" className="text-blue-600 underline" onClick={() => void loadMoreMobile()}>Thử lại</button> : !mobileHasMoreRef.current && rooms.length ? 'Đã hiển thị tất cả phòng.' : null}</div>} selection={{ selectedKeys: selected, onSelectRow: (key, checked) => setSelected(ids => checked ? [...ids, key] : ids.filter(id => id !== key)), onSelectAll: toggleAll, allSelected }} emptyState={<div className="p-8 text-center text-sm text-slate-500">{error || 'Chưa có phòng nào'}</div>} pagination={<CustomPagination totalItems={meta.total} pageSize={pageSize} currentPage={page} onPageChange={next => { setPage(next); setSelected([]); }} onPageSizeChange={size => { setPage(1); setPageSize(size); setSelected([]); }} pageSizeOptions={pageSizeOptions} isLoading={loading} label="phòng" />} />
    </div>

    <Dialog open={roomOpen} onOpenChange={setRoomOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl"><DialogHeader className="border-b border-white/50 pb-3"><DialogTitle>{roomEdit ? 'Sửa phòng' : 'Thêm phòng'}</DialogTitle></DialogHeader><form onSubmit={saveRoom} className="grid gap-4 py-4 sm:grid-cols-2">{field('Mã phòng', 'ma_phong', 'text', true)}{field('Tên phòng', 'ten_phong', 'text', true)}<div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Khu vực</label><Select value={roomForm.building_id} onValueChange={value => setRoomForm(current => ({ ...current, building_id: value }))}><SelectTrigger><SelectValue placeholder="Chọn khu vực" /></SelectTrigger><SelectContent>{buildings.map(building => <SelectItem key={building._id} value={building._id}>{building.ten}</SelectItem>)}</SelectContent></Select></div>{field('Tầng', 'tang', 'number', true)}<div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Loại phòng</label><Select value={roomForm.loai_phong} onValueChange={value => setRoomForm(current => ({ ...current, loai_phong: value }))}><SelectTrigger><SelectValue placeholder="Chọn loại phòng" /></SelectTrigger><SelectContent><SelectItem value="Thường">Thường</SelectItem><SelectItem value="Máy lạnh">Máy lạnh</SelectItem></SelectContent></Select></div>{field('Tổng số giường', 'so_giuong', 'number', true)}{field('Giá phòng', 'gia_phong', 'number', true)}<div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Trạng thái</label><Select value={roomForm.trang_thai} onValueChange={value => setRoomForm(current => ({ ...current, trang_thai: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Trống', 'Đầy', 'Khóa', 'Bảo trì'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div className="sm:col-span-2"><Input label="Mô tả" multiline rows={3} value={roomForm.mo_ta ?? ''} onChange={event => setRoomForm(current => ({ ...current, mo_ta: event.target.value }))} /></div><DialogFooter className="col-span-full border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => setRoomOpen(false)}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu phòng'}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={areaOpen} onOpenChange={setAreaOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border border-white/80 bg-gradient-to-br from-[#EBF2FA] to-[#DCE6F1] p-6 shadow-2xl"><DialogHeader className="border-b border-white/50 pb-3"><DialogTitle>Quản lý khu vực</DialogTitle></DialogHeader><div className="space-y-3 py-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-600">Danh sách khu vực</p>{canCreateBuilding && <Button size="sm" onClick={startCreateArea}><Plus size={15} />Thêm khu vực</Button>}</div>{buildings.length === 0 ? <p className="rounded-xl border border-white/60 bg-white/40 p-6 text-center text-sm text-slate-500">Chưa có khu vực nào.</p> : <div className="space-y-2">{buildings.map(building => <div key={building._id} className="flex items-center justify-between rounded-xl border border-white/70 bg-white/45 px-3 py-2"><div><p className="font-semibold text-slate-800">{building.ten}</p><p className="text-xs text-slate-500">{building.ma_toa_nha} · {building.so_tang} tầng</p></div><div className="flex gap-1">{canUpdateBuilding && <button aria-label={`Sửa khu vực ${building.ten}`} onClick={() => openArea(building)} className="rounded-xl p-1.5 text-blue-600 hover:bg-blue-50"><Pencil size={15} /></button>}{canDeleteBuilding && <button aria-label={`Xóa khu vực ${building.ten}`} onClick={() => setBuildingToDelete(building)} className="rounded-xl p-1.5 text-red-600 hover:bg-red-50"><Trash2 size={15} /></button>}</div></div>)}</div>}{areaFormOpen && <form onSubmit={saveArea} className="grid gap-4 border-t border-white/60 pt-4 sm:grid-cols-2">{areaField('Mã khu vực', 'ma_toa_nha', 'text', true)}{areaField('Tên khu vực', 'ten', 'text', true)}{areaField('Địa chỉ', 'dia_chi')}{areaField('Số tầng', 'so_tang', 'number', true)}<div className="space-y-1.5"><label className="px-1 text-[13px] font-bold text-[#1E293B]">Trạng thái</label><Select value={buildingForm.trang_thai} onValueChange={value => setBuildingForm(current => ({ ...current, trang_thai: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Maintenance">Maintenance</SelectItem></SelectContent></Select></div>{areaField('Mô tả', 'mo_ta', 'text', false, true)}<DialogFooter className="col-span-full border-t border-white/50 pt-4"><Button type="button" variant="outline" onClick={() => { setAreaFormOpen(false); setBuildingEdit(null); }}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : buildingEdit ? 'Lưu khu vực' : 'Thêm khu vực'}</Button></DialogFooter></form>}</div></DialogContent></Dialog>

    <ConfirmModal isOpen={Boolean(roomToDelete)} onClose={() => setRoomToDelete(null)} onConfirm={removeRoom} title="Xóa phòng" message={roomToDelete ? `Bạn có chắc chắn muốn xóa phòng ${roomToDelete.ma_phong}?` : ''} confirmLabel="Xóa phòng" variant="danger" />
    <ConfirmModal isOpen={Boolean(buildingToDelete)} onClose={() => setBuildingToDelete(null)} onConfirm={removeBuilding} title="Xóa khu vực" message={buildingToDelete ? `Bạn có chắc chắn muốn xóa khu vực ${buildingToDelete.ten}?` : ''} confirmLabel="Xóa khu vực" variant="danger" />
    <ConfirmModal isOpen={bulkDeleteOpen} onClose={() => !bulkDeleting && setBulkDeleteOpen(false)} onConfirm={async () => { await removeSelectedRooms(); setBulkDeleteOpen(false); }} title="Xóa phòng đã chọn" message={`Bạn có chắc chắn muốn xóa ${selected.length} phòng đã chọn? Các phòng đang được sử dụng có thể bị từ chối.`} confirmLabel="Xóa phòng" variant="danger" />
  </main>;
}
