'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Zap,
  Droplets,
  Users,
  Save,
  RefreshCw,
  Building as BuildingIcon,
  Check,
} from 'lucide-react';
import {
  dormitoryApi,
  UtilityConfig,
  RoomMeterReadingItem,
} from '@/api/dormitory-api';
import { toast } from 'sonner';

function formatMoney(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0đ';
  return `${Number(amount).toLocaleString('vi-VN')}đ`;
}

interface CardState {
  electricity_reading: string;
  water_reading: string;
  is_exempt?: boolean;
  notes?: string;
  saving?: boolean;
  error?: string;
  dirty?: boolean;
}

export default function MeterReadingsPage() {
  const router = useRouter();

  const defaultMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [billingMonth, setBillingMonth] = useState(defaultMonth);
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);

  const [config, setConfig] = useState<UtilityConfig | null>(null);
  const [rooms, setRooms] = useState<RoomMeterReadingItem[]>([]);
  const [cardsState, setCardsState] = useState<Record<string, CardState>>({});

  // Tải danh sách phòng và cấu hình cho kỳ thu
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dormitoryApi.invoices.getMeterReadings(billingMonth);
      setConfig(res.config || null);
      setRooms(res.rooms || []);

      // Khởi tạo state cho các card
      const initialCards: Record<string, CardState> = {};
      (res.rooms || []).forEach((r) => {
        initialCards[r.room_id] = {
          electricity_reading:
            r.current_readings?.electricity !== undefined
              ? String(r.current_readings.electricity)
              : '',
          water_reading:
            r.current_readings?.water !== undefined
              ? String(r.current_readings.water)
              : '',
          is_exempt: Boolean(r.is_exempt),
          notes: r.notes || '',
          dirty: false,
        };
      });
      setCardsState(initialCards);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải danh sách ghi chỉ số điện nước');
    } finally {
      setLoading(false);
    }
  }, [billingMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cảnh báo khi rời trang nếu còn thay đổi chưa lưu
  const hasUnsavedChanges = useMemo(() => {
    return Object.values(cardsState).some((c) => c.dirty);
  }, [cardsState]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Cập nhật giá trị nhập của một card
  function handleInputChange(
    roomId: string,
    field: 'electricity_reading' | 'water_reading' | 'notes' | 'is_exempt',
    value: any,
  ) {
    setCardsState((prev) => {
      const current = prev[roomId] || {
        electricity_reading: '',
        water_reading: '',
        dirty: false,
      };
      return {
        ...prev,
        [roomId]: {
          ...current,
          [field]: value,
          dirty: true,
          error: undefined,
        },
      };
    });
  }

  // Tính toán xem trước cho một card
  function getCardPreview(room: RoomMeterReadingItem, state?: CardState) {
    const occupantCount = room.occupant_count || 0;
    const isExempt = state?.is_exempt ?? room.is_exempt ?? false;

    const prevElec = room.previous_readings?.electricity || 0;
    const prevWater = room.previous_readings?.water || 0;

    const elecQuotaPer = config?.electricity?.quota_per_person ?? 15;
    const elecPrice = config?.electricity?.unit_price ?? 2500;

    const waterQuotaPer = config?.water?.quota_per_person ?? 4;
    const waterPrice = config?.water?.unit_price ?? 10000;

    const currElecStr = state?.electricity_reading ?? '';
    const currWaterStr = state?.water_reading ?? '';

    const hasElec = currElecStr !== '';
    const hasWater = currWaterStr !== '';

    const currElec = parseFloat(currElecStr);
    const currWater = parseFloat(currWaterStr);

    const elecInvalid = hasElec && (isNaN(currElec) || currElec < prevElec || currElec < 0);
    const waterInvalid = hasWater && (isNaN(currWater) || currWater < prevWater || currWater < 0);

    const elecConsumption = hasElec && !elecInvalid ? Math.max(0, currElec - prevElec) : 0;
    const elecQuotaTotal = occupantCount * elecQuotaPer;
    const elecExcess = Math.max(0, elecConsumption - elecQuotaTotal);
    const elecAmount = isExempt ? 0 : elecExcess * elecPrice;

    const waterConsumption = hasWater && !waterInvalid ? Math.max(0, currWater - prevWater) : 0;
    const waterQuotaTotal = occupantCount * waterQuotaPer;
    const waterExcess = Math.max(0, waterConsumption - waterQuotaTotal);
    const waterAmount = isExempt ? 0 : waterExcess * waterPrice;

    const totalAmount = isExempt ? 0 : elecAmount + waterAmount;

    return {
      prevElec,
      prevWater,
      currElec,
      currWater,
      hasElec,
      hasWater,
      elecInvalid,
      waterInvalid,
      elecConsumption,
      elecQuotaTotal,
      elecExcess,
      elecAmount,
      waterConsumption,
      waterQuotaTotal,
      waterExcess,
      waterAmount,
      totalAmount,
      readyToSave: hasElec && hasWater && !elecInvalid && !waterInvalid,
    };
  }

  // Lưu chỉ số của 1 phòng
  async function handleSaveSingle(room: RoomMeterReadingItem) {
    const state = cardsState[room.room_id];
    const preview = getCardPreview(room, state);

    if (!preview.hasElec || !preview.hasWater) {
      setCardsState((prev) => ({
        ...prev,
        [room.room_id]: {
          ...prev[room.room_id],
          error: 'Vui lòng nhập đầy đủ cả số điện mới và số nước mới',
        },
      }));
      return;
    }

    if (preview.elecInvalid) {
      setCardsState((prev) => ({
        ...prev,
        [room.room_id]: {
          ...prev[room.room_id],
          error: 'Chỉ số điện mới không được nhỏ hơn chỉ số cũ',
        },
      }));
      return;
    }

    if (preview.waterInvalid) {
      setCardsState((prev) => ({
        ...prev,
        [room.room_id]: {
          ...prev[room.room_id],
          error: 'Chỉ số nước mới không được nhỏ hơn chỉ số cũ',
        },
      }));
      return;
    }

    try {
      setCardsState((prev) => ({
        ...prev,
        [room.room_id]: { ...prev[room.room_id], saving: true, error: undefined },
      }));

      const res = await dormitoryApi.invoices.saveBulkMeterReadings({
        billing_month: billingMonth,
        readings: [
          {
            room_id: room.room_id,
            electricity_reading: preview.currElec,
            water_reading: preview.currWater,
            is_exempt: state?.is_exempt,
            notes: state?.notes,
          },
        ],
      });

      const resultItem = res.results?.[0];
      if (resultItem?.success && resultItem.invoice) {
        toast.success(`Đã lưu chỉ số phòng ${room.room?.room_name || room.room?.room_code}`);
        // Cập nhật room trong list
        setRooms((prev) =>
          prev.map((r) =>
            r.room_id === room.room_id
              ? {
                  ...r,
                  status: 'recorded',
                  invoice_id: resultItem.invoice?._id,
                  invoice_code: resultItem.invoice?.invoice_code,
                  invoice_status: resultItem.invoice?.status,
                  total_amount: resultItem.invoice?.total_amount,
                  is_exempt: resultItem.invoice?.is_exempt,
                  current_readings: {
                    electricity: preview.currElec,
                    water: preview.currWater,
                  },
                }
              : r,
          ),
        );
        setCardsState((prev) => ({
          ...prev,
          [room.room_id]: {
            ...prev[room.room_id],
            saving: false,
            dirty: false,
            error: undefined,
          },
        }));
      } else {
        const errorMsg = resultItem?.error || 'Lỗi khi lưu chỉ số phòng';
        toast.error(errorMsg);
        setCardsState((prev) => ({
          ...prev,
          [room.room_id]: {
            ...prev[room.room_id],
            saving: false,
            error: errorMsg,
          },
        }));
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Lỗi lưu chỉ số phòng';
      toast.error(errorMsg);
      setCardsState((prev) => ({
        ...prev,
        [room.room_id]: {
          ...prev[room.room_id],
          saving: false,
          error: errorMsg,
        },
      }));
    }
  }

  // Lưu tất cả các card hợp lệ
  async function handleSaveAll() {
    const validReadings: Array<{
      room_id: string;
      electricity_reading: number;
      water_reading: number;
      is_exempt?: boolean;
      notes?: string;
    }> = [];

    const roomsToSave: RoomMeterReadingItem[] = [];

    rooms.forEach((room) => {
      const state = cardsState[room.room_id];
      const preview = getCardPreview(room, state);
      if (preview.readyToSave && (state?.dirty || room.status === 'unrecorded')) {
        validReadings.push({
          room_id: room.room_id,
          electricity_reading: preview.currElec,
          water_reading: preview.currWater,
          is_exempt: state?.is_exempt,
          notes: state?.notes,
        });
        roomsToSave.push(room);
      }
    });

    if (validReadings.length === 0) {
      toast.info('Không có phòng nào có chỉ số mới hợp lệ cần lưu');
      return;
    }

    try {
      setSavingAll(true);
      const res = await dormitoryApi.invoices.saveBulkMeterReadings({
        billing_month: billingMonth,
        readings: validReadings,
      });

      let successCount = 0;
      let failCount = 0;

      const updatedRooms = [...rooms];
      const updatedCards = { ...cardsState };

      (res.results || []).forEach((resultItem) => {
        const roomIdx = updatedRooms.findIndex((r) => r.room_id === resultItem.room_id);
        if (resultItem.success && resultItem.invoice) {
          successCount++;
          if (roomIdx !== -1) {
            const r = updatedRooms[roomIdx];
            const state = updatedCards[r.room_id];
            updatedRooms[roomIdx] = {
              ...r,
              status: 'recorded',
              invoice_id: resultItem.invoice._id,
              invoice_code: resultItem.invoice.invoice_code,
              invoice_status: resultItem.invoice.status,
              total_amount: resultItem.invoice.total_amount,
              is_exempt: resultItem.invoice.is_exempt,
              current_readings: {
                electricity: parseFloat(state?.electricity_reading || '0'),
                water: parseFloat(state?.water_reading || '0'),
              },
            };
          }
          if (updatedCards[resultItem.room_id]) {
            updatedCards[resultItem.room_id] = {
              ...updatedCards[resultItem.room_id],
              dirty: false,
              error: undefined,
            };
          }
        } else {
          failCount++;
          if (updatedCards[resultItem.room_id]) {
            updatedCards[resultItem.room_id] = {
              ...updatedCards[resultItem.room_id],
              error: resultItem.error || 'Lỗi lưu chỉ số',
            };
          }
        }
      });

      setRooms(updatedRooms);
      setCardsState(updatedCards);

      if (successCount > 0 && failCount === 0) {
        toast.success(`Đã lưu thành công chỉ số cho ${successCount} phòng`);
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`Đã lưu ${successCount} phòng, có ${failCount} phòng gặp lỗi`);
      } else {
        toast.error(`Không thể lưu ${failCount} phòng. Vui lòng kiểm tra lỗi tại từng thẻ`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi lưu chỉ số hàng loạt');
    } finally {
      setSavingAll(false);
    }
  }

  const recordedCount = useMemo(() => {
    return rooms.filter((r) => r.status === 'recorded').length;
  }, [rooms]);

  const totalCount = rooms.length;
  const progressPercent = totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Header và Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-4 rounded-2xl border border-white/75 bg-white/45 backdrop-blur-md p-4 sm:p-5 shadow-sm shadow-slate-300/30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dormitory/invoices')}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/50 backdrop-blur-sm border border-white/70 text-[#1E293B] hover:bg-white/80 hover:text-[#1A73E8] hover:scale-[1.02] transition-all duration-150 shadow-sm shadow-slate-300/30"
            title="Quay lại danh sách hóa đơn"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight flex items-center gap-2">
              <Zap size={22} className="text-amber-500" />
              Ghi chỉ số điện - nước KTX
            </h1>
            <p className="text-xs font-medium text-[#64748B] mt-0.5">
              Ghi chỉ số công-tơ cho các phòng trong kỳ, hệ thống tự động tính tiền và hạn thu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Chọn kỳ thu */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#1E293B] whitespace-nowrap">
              Kỳ thu:
            </label>
            <input
              type="month"
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/50 backdrop-blur-sm border border-white/70 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30 transition-all duration-150 font-medium"
            />
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/50 backdrop-blur-sm border border-white/70 text-[#1E293B] hover:bg-white/80 hover:text-[#1A73E8] hover:scale-[1.02] transition-all duration-150 shadow-sm shadow-slate-300/30 disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Nút lưu tất cả */}
          <button
            onClick={handleSaveAll}
            disabled={savingAll || loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A73E8] text-white rounded-xl text-sm font-medium hover:bg-[#1557B0] hover:scale-[1.01] transition-all duration-150 shadow-sm shadow-blue-500/20 disabled:opacity-50"
          >
            <Save size={16} /> {savingAll ? 'Đang lưu...' : 'Lưu tất cả hợp lệ'}
          </button>
        </div>
      </div>

      {/* Tiến độ ghi chỉ số */}
      <div className="rounded-2xl border border-white/75 bg-white/45 backdrop-blur-md p-4 shadow-sm shadow-slate-300/30 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#1E293B]">
            Tiến độ ghi chỉ số kỳ {billingMonth}
          </span>
          <span className="font-bold text-[#1A73E8]">
            {recordedCount} / {totalCount} phòng ({progressPercent}%)
          </span>
        </div>
        <div className="w-full bg-slate-200/60 h-2.5 rounded-xl overflow-hidden">
          <div
            className="bg-[#1A73E8] h-full rounded-xl transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Danh sách Thẻ đứng (Vertical Room Cards - AC-02, AC-02a) */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/75 bg-white/45 p-6 shadow-sm shadow-slate-300/30 backdrop-blur-md animate-pulse space-y-4">
              <div className="h-6 bg-slate-200/60 rounded-xl w-1/4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-24 bg-slate-100/70 rounded-xl" />
                <div className="h-24 bg-slate-100/70 rounded-xl" />
              </div>
            </div>
          ))
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-white/75 bg-white/45 p-12 text-center text-[#64748B] shadow-sm shadow-slate-300/30 backdrop-blur-md">
            <BuildingIcon size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Không tìm thấy phòng nào trong hệ thống</p>
          </div>
        ) : (
          rooms.map((room) => {
            const cardState = cardsState[room.room_id] || {
              electricity_reading: '',
              water_reading: '',
            };
            const preview = getCardPreview(room, cardState);
            const isRecorded = room.status === 'recorded';
            const roomName = room.room?.room_name || room.room?.room_code || 'Phòng';
            const buildingName =
              typeof room.room?.building_id === 'object'
                ? room.room?.building_id?.name || room.room?.building_id?.building_code
                : '';

            return (
              <div
                key={room.room_id}
                data-testid={`room-card-${room.room_id}`}
                className={`rounded-2xl p-5 shadow-sm shadow-slate-300/30 backdrop-blur-md transition-all duration-150 hover:bg-white/60 hover:scale-[1.005] border ${
                  cardState.error
                    ? 'border-rose-500/30 bg-rose-500/5 ring-1 ring-rose-500/20'
                    : cardState.dirty
                    ? 'border-blue-500/30 bg-blue-500/5 ring-1 ring-blue-500/20'
                    : isRecorded
                    ? 'border-emerald-500/30 bg-white/50'
                    : 'border-white/75 bg-white/45'
                }`}
              >
                {/* Header Thẻ phòng */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-white/60">
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-[#1E293B] text-base">
                      {roomName} {buildingName ? `(${buildingName})` : ''}
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-500/10 text-[#1E293B] border border-slate-500/20">
                      <Users size={13} /> {room.occupant_count} người ở
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isRecorded ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 shadow-2xs">
                        <CheckCircle size={13} /> Đã ghi {room.invoice_code ? `(${room.invoice_code})` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20 shadow-2xs">
                        Chưa ghi
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Thẻ: 2 Cụm thông số Điện và Nước */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                  {/* Cụm Điện */}
                  <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800 text-sm">
                        <Zap size={16} className="text-amber-600" />
                        Điện (kWh)
                      </div>
                      <div className="text-xs font-semibold text-amber-700">
                        Thành tiền: {formatMoney(preview.elecAmount)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#64748B] mb-1">
                          Chỉ số cũ (kWh)
                        </label>
                        <input
                          type="number"
                          disabled
                          value={preview.prevElec}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200/80 text-sm bg-slate-100/80 text-[#64748B] cursor-not-allowed font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#1E293B] mb-1">
                          Số điện mới <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          aria-label={`Số điện mới ${roomName}`}
                          placeholder="Nhập số mới"
                          value={cardState.electricity_reading}
                          onChange={(e) =>
                            handleInputChange(room.room_id, 'electricity_reading', e.target.value)
                          }
                          className={`w-full px-2.5 py-1.5 rounded-xl border text-sm text-[#1E293B] bg-white/80 font-medium focus:outline-none transition-all duration-150 ${
                            preview.elecInvalid ? 'border-red-500 ring-1 ring-red-400' : 'border-slate-200/80 focus:ring-2 focus:ring-[#1A73E8]/30'
                          }`}
                        />
                      </div>
                    </div>

                    {preview.elecInvalid && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle size={13} /> Chỉ số mới không được nhỏ hơn chỉ số cũ ({preview.prevElec})
                      </p>
                    )}

                    <div className="text-[11px] text-[#64748B] flex flex-wrap gap-x-3 gap-y-0.5 bg-white/80 p-2 rounded-xl border border-amber-500/15">
                      <span>Tiêu thụ: <b>{preview.elecConsumption} kWh</b></span>
                      <span>Định mức: <b>{preview.elecQuotaTotal} kWh</b></span>
                      <span>Vượt: <b>{preview.elecExcess} kWh</b></span>
                    </div>
                  </div>

                  {/* Cụm Nước */}
                  <div className="border border-sky-500/20 bg-sky-500/5 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-sky-800 text-sm">
                        <Droplets size={16} className="text-sky-600" />
                        Nước (m³)
                      </div>
                      <div className="text-xs font-semibold text-sky-700">
                        Thành tiền: {formatMoney(preview.waterAmount)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-[#64748B] mb-1">
                          Chỉ số cũ (m³)
                        </label>
                        <input
                          type="number"
                          disabled
                          value={preview.prevWater}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200/80 text-sm bg-slate-100/80 text-[#64748B] cursor-not-allowed font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#1E293B] mb-1">
                          Số nước mới <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          aria-label={`Số nước mới ${roomName}`}
                          placeholder="Nhập số mới"
                          value={cardState.water_reading}
                          onChange={(e) =>
                            handleInputChange(room.room_id, 'water_reading', e.target.value)
                          }
                          className={`w-full px-2.5 py-1.5 rounded-xl border text-sm text-[#1E293B] bg-white/80 font-medium focus:outline-none transition-all duration-150 ${
                            preview.waterInvalid ? 'border-red-500 ring-1 ring-red-400' : 'border-slate-200/80 focus:ring-2 focus:ring-[#1A73E8]/30'
                          }`}
                        />
                      </div>
                    </div>

                    {preview.waterInvalid && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle size={13} /> Chỉ số mới không được nhỏ hơn chỉ số cũ ({preview.prevWater})
                      </p>
                    )}

                    <div className="text-[11px] text-[#64748B] flex flex-wrap gap-x-3 gap-y-0.5 bg-white/80 p-2 rounded-xl border border-sky-500/15">
                      <span>Tiêu thụ: <b>{preview.waterConsumption} m³</b></span>
                      <span>Định mức: <b>{preview.waterQuotaTotal} m³</b></span>
                      <span>Vượt: <b>{preview.waterExcess} m³</b></span>
                    </div>
                  </div>
                </div>

                {/* Footer Thẻ: Tổng tiền & Nút Lưu phòng */}
                <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-white/60 mt-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-[#64748B] block font-medium">Tổng tiền dự tính:</span>
                      <span className="text-base font-bold text-[#1A73E8]">
                        {formatMoney(preview.totalAmount)}
                      </span>
                    </div>

                    {cardState.error && (
                      <div className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle size={14} />
                        <span>{cardState.error}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSaveSingle(room)}
                      disabled={cardState.saving || !preview.readyToSave}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#1A73E8] text-white rounded-xl text-xs font-semibold hover:bg-[#1557B0] hover:scale-[1.01] transition-all duration-150 shadow-sm shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check size={14} />
                      {cardState.saving ? 'Đang lưu...' : isRecorded ? 'Cập nhật' : 'Lưu phòng này'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Bar khi có thay đổi chưa lưu */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-40 border border-white/20 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-xs font-medium">Có thay đổi chỉ số chưa lưu</div>
          <button
            onClick={handleSaveAll}
            disabled={savingAll}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1A73E8] text-white rounded-xl text-xs font-semibold hover:bg-[#1557B0] hover:scale-[1.01] transition-all duration-150 shadow"
          >
            <Save size={14} /> {savingAll ? 'Đang lưu...' : 'Lưu tất cả hợp lệ'}
          </button>
        </div>
      )}
    </div>
  );
}
