'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Building2, Plus, Pencil, Trash2, Search, QrCode, ExternalLink, Download, Printer } from 'lucide-react';
import { dormitoryApi, Building, Room } from '@/api/dormitory-api';
import { toast } from 'sonner';
import QRCodeLib from 'qrcode';

export default function BuildingsPage() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Building | null>(null);
  const [form, setForm] = useState({ ma_toa_nha: '', ten: '', dia_chi: '', so_tang: 1, mo_ta: '' });
  const [qrRoom, setQrRoom] = useState<Room | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Generate QR code when room is selected
  useEffect(() => {
    if (!qrRoom?.ma_qr) { setQrDataUrl(''); return; }
    const publicUrl = `${window.location.origin}/public/room/${qrRoom.ma_qr}`;
    QRCodeLib.toDataURL(publicUrl, {
      errorCorrectionLevel: 'H', // 30% error correction - scannable even if partially damaged
      type: 'image/png',
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url: string) => setQrDataUrl(url))
      .catch(() => toast.error('Không thể tạo mã QR'));
  }, [qrRoom]);

  function downloadQr() {
    if (!qrDataUrl || !qrRoom) return;
    const link = document.createElement('a');
    link.download = `QR-${qrRoom.ma_phong}.png`;
    link.href = qrDataUrl;
    link.click();
  }

  function printQr() {
    if (!qrDataUrl || !qrRoom) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR Phòng ${qrRoom.ma_phong}</title>
      <style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;margin:0}
      img{width:280px;height:280px} h1{font-size:24px;margin:16px 0 4px} p{font-size:14px;color:#666;margin:0}</style></head>
      <body><h1>Phòng ${qrRoom.ma_phong}</h1><p>Quét mã QR để xem thông tin phòng</p>
      <img src="${qrDataUrl}" /><p style="margin-top:8px;font-size:11px;color:#999">${window.location.origin}/public/room/${qrRoom.ma_qr}</p>
      <script>setTimeout(()=>{window.print();window.close()},500)<\/script></body></html>
    `);
    win.document.close();
  }

  const loadBuildings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dormitoryApi.buildings.getAll({ search });
      setBuildings(res.data);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải danh sách khu vực');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadBuildings(); }, [loadBuildings]);

  useEffect(() => {
    if (selectedBuilding) {
      dormitoryApi.rooms.getAll({ building_id: selectedBuilding, limit: 100 })
        .then(res => setRooms(res.data))
        .catch(() => setRooms([]));
    } else {
      setRooms([]);
    }
  }, [selectedBuilding]);

  function openCreate() {
    setEditItem(null);
    setForm({ ma_toa_nha: '', ten: '', dia_chi: '', so_tang: 1, mo_ta: '' });
    setShowForm(true);
  }

  function openEdit(b: Building) {
    setEditItem(b);
    setForm({ ma_toa_nha: b.ma_toa_nha, ten: b.ten, dia_chi: b.dia_chi || '', so_tang: b.so_tang, mo_ta: b.mo_ta || '' });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editItem) {
        await dormitoryApi.buildings.update(editItem._id, form);
        toast.success('Cập nhật khu vực thành công');
      } else {
        await dormitoryApi.buildings.create(form);
        toast.success('Thêm khu vực thành công');
      }
      setShowForm(false);
      loadBuildings();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi lưu khu vực');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bạn có chắc muốn xóa khu vực này?')) return;
    try {
      await dormitoryApi.buildings.delete(id);
      toast.success('Xóa khu vực thành công');
      loadBuildings();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xóa khu vực');
    }
  }

  const statusColor: Record<string, string> = {
    'Trống': 'bg-green-100 text-green-700',
    'Đầy': 'bg-red-100 text-red-700',
    'Khóa': 'bg-gray-100 text-gray-700',
    'Bảo trì': 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-800">Khu vực & Phòng</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm khu vực..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            />
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={16} /> Thêm khu vực
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Buildings List */}
        <div className="lg:col-span-1 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
                <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
            ))
          ) : buildings.length === 0 ? (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
              <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Chưa có khu vực nào</p>
            </div>
          ) : (
            buildings.map(b => (
              <div
                key={b._id}
                onClick={() => setSelectedBuilding(b._id)}
                className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all ${
                  selectedBuilding === b._id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{b.ten}</h3>
                    <p className="text-xs text-gray-400 mt-1">Mã: {b.ma_toa_nha} • {b.so_tang} tầng</p>
                    {b.dia_chi && <p className="text-xs text-gray-400">{b.dia_chi}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={e => { e.stopPropagation(); openEdit(b); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600">
                      <Pencil size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(b._id); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rooms in selected building */}
        <div className="lg:col-span-2">
          {selectedBuilding ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-700">Danh sách phòng</h2>
              </div>
              {rooms.length === 0 ? (
                <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
                  <p className="text-gray-400 text-sm">Chưa có phòng nào trong khu vực này</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rooms.map(room => (
                    <div key={room._id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-800">{room.ma_phong}</h3>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setQrRoom(room)} className="p-1 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="Xem QR">
                            <QrCode size={14} />
                          </button>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[room.trang_thai] || 'bg-gray-100 text-gray-600'}`}>
                            {room.trang_thai}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Tầng {room.tang} • {room.loai_phong}</p>
                        <p>Giường: {room.so_giuong_trong}/{room.so_giuong} trống</p>
                        <p>Giá: {room.gia_phong?.toLocaleString('vi-VN')}đ/kỳ</p>
                        {room.tien_ich?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {room.tien_ich.map((t, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
              <Building2 size={48} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400">Chọn khu vực để xem danh sách phòng</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editItem ? 'Cập nhật khu vực' : 'Thêm khu vực mới'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã khu vực</label>
                <input type="text" required value={form.ma_toa_nha} onChange={e => setForm(f => ({ ...f, ma_toa_nha: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" disabled={!!editItem} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên khu vực</label>
                <input type="text" required value={form.ten} onChange={e => setForm(f => ({ ...f, ten: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input type="text" value={form.dia_chi} onChange={e => setForm(f => ({ ...f, dia_chi: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tầng</label>
                <input type="number" min={1} value={form.so_tang} onChange={e => setForm(f => ({ ...f, so_tang: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea value={form.mo_ta} onChange={e => setForm(f => ({ ...f, mo_ta: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" rows={2} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Hủy</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{editItem ? 'Cập nhật' : 'Thêm mới'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal — Standard ISO/IEC 18004, Error Correction Level H */}
      {qrRoom && qrDataUrl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setQrRoom(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl text-center" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-1">QR Phòng {qrRoom.ma_phong}</h2>
            <p className="text-xs text-gray-400 mb-4">Quét bằng camera điện thoại để mở trang thông tin phòng</p>
            
            {/* QR Image — high contrast black/white for maximum scan compatibility */}
            <div className="bg-white p-3 rounded-xl border-2 border-gray-100 inline-block mb-3">
              <img
                src={qrDataUrl}
                alt={`QR ${qrRoom.ma_phong}`}
                width={240}
                height={240}
                className="mx-auto"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            
            {/* URL display */}
            <div className="text-[11px] text-gray-400 mb-4 break-all bg-gray-50 rounded-lg p-2 font-mono">
              {window.location.origin}/public/room/{qrRoom.ma_qr}
            </div>
            
            {/* Actions */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={downloadQr} className="flex flex-col items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Download size={16} />
                Tải ảnh
              </button>
              <button onClick={printQr} className="flex flex-col items-center gap-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Printer size={16} />
                In QR
              </button>
              <a
                href={`/public/room/${qrRoom.ma_qr}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                <ExternalLink size={16} />
                Xem trang
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
