'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Building2,
  DoorOpen,
  BedDouble,
  Wifi,
  Snowflake,
  ShowerHead,
  CheckCircle,
  XCircle,
  Wrench,
  Info,
  UserPlus,
  ClipboardCheck,
  X,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RoomPublicInfo {
  room: {
    ma_phong: string;
    building: { ma_toa_nha: string; ten: string; dia_chi?: string } | null;
    tang: number;
    loai_phong: string;
    so_giuong: number;
    so_giuong_trong: number;
    gia_phong: number;
    tien_ich: string[];
    trang_thai: string;
    mo_ta?: string;
  };
  beds: {
    ma_giuong: string;
    vi_tri?: string;
    trang_thai: string;
  }[];
}

const amenityIcons: Record<string, any> = {
  'Điều hòa': Snowflake,
  'Wifi': Wifi,
  'Nóng lạnh': ShowerHead,
};

const bedStatusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  'Trống': { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  'Đang sử dụng': { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200' },
  'Bảo trì': { icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200' },
};

export default function PublicRoomPage() {
  const params = useParams();
  const qrId = params?.qrId as string;
  const [data, setData] = useState<RoomPublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regSuccess, setRegSuccess] = useState<{ ma_dk: string } | null>(null);
  const [regForm, setRegForm] = useState({
    ho_ten: '',
    so_dien_thoai: '',
    email: '',
    ma_sinh_vien: '',
    doi_tuong_uu_tien: 'Không',
    ghi_chu: '',
  });

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!qrId) return;
    setRegSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/dormitory/public/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...regForm,
          qr_room_id: qrId,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setRegSuccess({ ma_dk: result.ma_dk });
      } else {
        alert(result.message || 'Đã có lỗi xảy ra');
      }
    } catch {
      alert('Không thể gửi đăng ký. Vui lòng thử lại.');
    } finally {
      setRegSubmitting(false);
    }
  }

  useEffect(() => {
    if (!qrId) return;
    fetch(`${API_BASE}/dormitory/public/room/${qrId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Không tìm thấy phòng');
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [qrId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Đang tải thông tin phòng...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm w-full">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-800 mb-2">Không tìm thấy phòng</h1>
          <p className="text-sm text-gray-500">{error || 'Mã QR không hợp lệ hoặc phòng đã bị xóa.'}</p>
        </div>
      </div>
    );
  }

  const { room, beds } = data;
  const building = room.building as any;
  const availableBeds = beds.filter((b) => b.trang_thai === 'Trống').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <DoorOpen size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{room.ma_phong}</h1>
              <p className="text-blue-100 text-sm">{room.loai_phong} • Tầng {room.tang}</p>
            </div>
          </div>
          {building && (
            <div className="flex items-center gap-2 mt-3 text-blue-100 text-sm">
              <Building2 size={14} />
              <span>{building.ten} {building.dia_chi ? `— ${building.dia_chi}` : ''}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 pb-8 space-y-4">
        {/* Price Card */}
        <div className="bg-white rounded-2xl shadow-lg p-5 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Giá phòng / kỳ</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {room.gia_phong?.toLocaleString('vi-VN')}
                <span className="text-base font-normal text-gray-400"> đ</span>
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              room.trang_thai === 'Trống' ? 'bg-green-100 text-green-700' :
              room.trang_thai === 'Đầy' ? 'bg-red-100 text-red-700' :
              room.trang_thai === 'Bảo trì' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {room.trang_thai}
            </div>
          </div>
        </div>

        {/* Room Info */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Info size={16} className="text-blue-500" />
            Thông tin phòng
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Tổng giường</p>
              <p className="text-xl font-bold text-gray-800">{room.so_giuong}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-600">Còn trống</p>
              <p className="text-xl font-bold text-green-700">{availableBeds}</p>
            </div>
          </div>
          {room.mo_ta && (
            <p className="text-sm text-gray-500 mt-3">{room.mo_ta}</p>
          )}
        </div>

        {/* Amenities */}
        {room.tien_ich?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-3">Tiện ích</h2>
            <div className="flex flex-wrap gap-2">
              {room.tien_ich.map((t, i) => {
                const Icon = amenityIcons[t] || CheckCircle;
                return (
                  <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
                    <Icon size={14} />
                    {t}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Beds Status */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <BedDouble size={16} className="text-blue-500" />
            Trạng thái giường ({beds.length})
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {beds.map((bed, i) => {
              const config = bedStatusConfig[bed.trang_thai] || bedStatusConfig['Trống'];
              const Icon = config.icon;
              return (
                <div key={i} className={`rounded-xl p-3 border ${config.bg}`}>
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={config.color} />
                    <div>
                      <p className="font-medium text-sm text-gray-800">{bed.ma_giuong}</p>
                      <p className="text-xs text-gray-500">{bed.trang_thai}</p>
                    </div>
                  </div>
                  {bed.vi_tri && <p className="text-xs text-gray-400 mt-1">{bed.vi_tri}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Register Button */}
        {room.trang_thai !== 'Khóa' && room.trang_thai !== 'Bảo trì' && availableBeds > 0 && (
          <button
            onClick={() => setShowRegister(true)}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-semibold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <UserPlus size={20} />
            Đăng ký ở phòng này
          </button>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pt-2">
          <p>Hệ thống Quản lý KTX — Manager Points</p>
          <p className="mt-1">Quét mã QR trên phòng để xem thông tin</p>
        </div>
      </div>

      {/* Registration Modal */}
      {showRegister && !regSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-800">Đăng ký ở KTX</h2>
              <button onClick={() => setShowRegister(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Room summary */}
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-100">
              <p className="text-sm text-blue-700 font-medium">Phòng {room.ma_phong} — {building?.ten || ''}</p>
              <p className="text-xs text-blue-500">Tầng {room.tang} • {room.loai_phong} • {room.gia_phong?.toLocaleString('vi-VN')}đ/kỳ</p>
            </div>

            <form onSubmit={handleRegister} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên <span className="text-red-500">*</span></label>
                <input type="text" required value={regForm.ho_ten} onChange={e => setRegForm(f => ({ ...f, ho_ten: e.target.value }))}
                  placeholder="Nguyễn Văn A" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label>
                <input type="tel" required value={regForm.so_dien_thoai} onChange={e => setRegForm(f => ({ ...f, so_dien_thoai: e.target.value }))}
                  placeholder="0912345678" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={regForm.email} onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã sinh viên <span className="text-gray-400 text-xs">(nếu có)</span></label>
                <input type="text" value={regForm.ma_sinh_vien} onChange={e => setRegForm(f => ({ ...f, ma_sinh_vien: e.target.value }))}
                  placeholder="SV001" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đối tượng ưu tiên</label>
                <select value={regForm.doi_tuong_uu_tien} onChange={e => setRegForm(f => ({ ...f, doi_tuong_uu_tien: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent bg-white">
                  <option value="Không">Không</option>
                  <option value="Chính sách">Chính sách</option>
                  <option value="Xa nhà">Xa nhà</option>
                  <option value="Học lực giỏi">Học lực giỏi</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea value={regForm.ghi_chu} onChange={e => setRegForm(f => ({ ...f, ghi_chu: e.target.value }))}
                  placeholder="Yêu cầu đặc biệt, thời gian liên hệ phù hợp..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent" rows={2} />
              </div>

              <button type="submit" disabled={regSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {regSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang gửi...</>
                ) : (
                  <><UserPlus size={18} /> Gửi đăng ký</>
                )}
              </button>

              <p className="text-[11px] text-gray-400 text-center">Không yêu cầu CCCD. Chúng tôi sẽ liên hệ qua số điện thoại.</p>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {regSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardCheck size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Đăng ký thành công!</h2>
            <p className="text-sm text-gray-500 mb-4">Mã đăng ký của bạn:</p>
            <div className="bg-blue-50 rounded-xl px-4 py-3 mb-4">
              <p className="text-xl font-bold text-blue-700 font-mono">{regSuccess.ma_dk}</p>
            </div>
            <p className="text-xs text-gray-400 mb-6">Vui lòng lưu mã này. Chúng tôi sẽ liên hệ bạn qua số điện thoại đã cung cấp để xác nhận.</p>
            <button onClick={() => { setRegSuccess(null); setShowRegister(false); }}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors">
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
