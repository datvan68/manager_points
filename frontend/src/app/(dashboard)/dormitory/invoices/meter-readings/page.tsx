'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Zap,
  Droplets,
  RefreshCw,
  Building as BuildingIcon,
  Check,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  dormitoryApi,
  UtilityConfig,
  RoomMeterReadingItem,
} from '@/api/dormitory-api';
import { toast } from 'sonner';
import { CustomCalendar } from '@/components/calendar/CustomCalendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function formatMoney(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0đ';
  return `${Number(amount).toLocaleString('vi-VN')}đ`;
}

function formatBillingMonth(billingMonth?: string): string {
  if (billingMonth && /^\d{4}-\d{2}$/.test(billingMonth)) {
    const [year, month] = billingMonth.split('-');
    return `${month}/${year}`;
  }
  return billingMonth || '—';
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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [config, setConfig] = useState<UtilityConfig | null>(null);
  const [rooms, setRooms] = useState<RoomMeterReadingItem[]>([]);
  const [cardsState, setCardsState] = useState<Record<string, CardState>>({});

  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

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

  // Hàm thực hiện tự động lưu chỉ số phòng
  const triggerAutoSave = useCallback(
    async (roomId: string, elec: number, water: number, isExempt?: boolean, notes?: string) => {
      const room = rooms.find((r) => r.room_id === roomId);
      if (!room) return;

      try {
        setCardsState((prev) => ({
          ...prev,
          [roomId]: { ...prev[roomId], saving: true, error: undefined },
        }));

        const res = await dormitoryApi.invoices.saveBulkMeterReadings({
          billing_month: billingMonth,
          readings: [
            {
              room_id: roomId,
              electricity_reading: elec,
              water_reading: water,
              is_exempt: isExempt,
              notes: notes,
            },
          ],
        });

        const resultItem = res.results?.[0];
        if (resultItem?.success && resultItem.invoice) {
          toast.success(`Đã lưu chỉ số phòng ${room.room?.room_name || room.room?.room_code}`);
          setRooms((prev) =>
            prev.map((r) =>
              r.room_id === roomId
                ? {
                    ...r,
                    status: 'recorded',
                    invoice_id: resultItem.invoice?._id,
                    invoice_code: resultItem.invoice?.invoice_code,
                    invoice_status: resultItem.invoice?.status,
                    total_amount: resultItem.invoice?.total_amount,
                    is_exempt: resultItem.invoice?.is_exempt,
                    current_readings: {
                      electricity: elec,
                      water: water,
                    },
                  }
                : r,
            ),
          );
          setCardsState((prev) => ({
            ...prev,
            [roomId]: {
              ...prev[roomId],
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
            [roomId]: {
              ...prev[roomId],
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
          [roomId]: {
            ...prev[roomId],
            saving: false,
            error: errorMsg,
          },
        }));
      }
    },
    [rooms, billingMonth],
  );

  // Cập nhật giá trị nhập của một card & kích hoạt auto-save (debounce)
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
      const nextState = {
        ...current,
        [field]: value,
        dirty: true,
        error: undefined,
      };

      const room = rooms.find((r) => r.room_id === roomId);
      if (room && (field === 'electricity_reading' || field === 'water_reading')) {
        const prevElec = room.previous_readings?.electricity || 0;
        const prevWater = room.previous_readings?.water || 0;
        const currElecStr = field === 'electricity_reading' ? value : nextState.electricity_reading;
        const currWaterStr = field === 'water_reading' ? value : nextState.water_reading;

        if (currElecStr !== '' && currWaterStr !== '') {
          const currElec = parseFloat(currElecStr);
          const currWater = parseFloat(currWaterStr);
          if (
            !isNaN(currElec) &&
            !isNaN(currWater) &&
            currElec >= prevElec &&
            currWater >= prevWater &&
            currElec >= 0 &&
            currWater >= 0
          ) {
            if (debounceTimers.current[roomId]) {
              clearTimeout(debounceTimers.current[roomId]);
            }
            debounceTimers.current[roomId] = setTimeout(() => {
              triggerAutoSave(roomId, currElec, currWater, nextState.is_exempt, nextState.notes);
            }, 800);
          }
        }
      }

      return {
        ...prev,
        [roomId]: nextState,
      };
    });
  }

  // Kích hoạt auto-save ngay khi rời ô nhập (onBlur)
  function handleInputBlur(roomId: string) {
    const room = rooms.find((r) => r.room_id === roomId);
    const state = cardsState[roomId];
    if (!room || !state || !state.dirty) return;

    const prevElec = room.previous_readings?.electricity || 0;
    const prevWater = room.previous_readings?.water || 0;
    const currElecStr = state.electricity_reading;
    const currWaterStr = state.water_reading;

    if (currElecStr !== '' && currWaterStr !== '') {
      const currElec = parseFloat(currElecStr);
      const currWater = parseFloat(currWaterStr);
      if (
        !isNaN(currElec) &&
        !isNaN(currWater) &&
        currElec >= prevElec &&
        currWater >= prevWater &&
        currElec >= 0 &&
        currWater >= 0
      ) {
        if (debounceTimers.current[roomId]) {
          clearTimeout(debounceTimers.current[roomId]);
          delete debounceTimers.current[roomId];
        }
        triggerAutoSave(roomId, currElec, currWater, state.is_exempt, state.notes);
      }
    }
  }

  const recordedCount = useMemo(() => {
    return rooms.filter((r) => r.status === 'recorded').length;
  }, [rooms]);

  const totalCount = rooms.length;
  const progressPercent = totalCount > 0 ? Math.round((recordedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Header tinh gọn & Toolbar & Tiến độ */}
      <div className="rounded-2xl border border-white/75 bg-white/45 backdrop-blur-md p-4 sm:p-5 shadow-sm shadow-slate-300/30 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Nút quay lại & Tiêu đề */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dormitory/invoices')}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/50 backdrop-blur-sm border border-white/70 text-[#1E293B] hover:bg-white/80 hover:text-[#1A73E8] hover:scale-[1.02] transition-all duration-150 shadow-sm shadow-slate-300/30 cursor-pointer"
              title="Quay lại danh sách hóa đơn"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E293B] tracking-tight flex items-center gap-2">
              <Zap size={22} className="text-amber-500" />
              Ghi chỉ số điện - nước KTX
            </h1>
          </div>

          {/* Chọn kỳ thu & Tải lại */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[#1E293B] whitespace-nowrap">
                Kỳ thu:
              </label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/50 backdrop-blur-sm border border-white/70 text-sm text-[#1E293B] hover:bg-white/80 transition-all duration-150 font-medium cursor-pointer"
                    title="Chọn kỳ thu (Lịch)"
                    aria-label="Chọn kỳ thu"
                  >
                    <CalendarIcon size={15} className="text-[#1A73E8]" />
                    <span>{formatBillingMonth(billingMonth)}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="z-[100] w-auto border-none bg-transparent p-0 shadow-none" align="start">
                  <CustomCalendar
                    startDate={billingMonth ? new Date(`${billingMonth}-01T00:00:00`) : null}
                    endDate={null}
                    onRangeSelect={(start) => {
                      const y = start.getFullYear();
                      const m = String(start.getMonth() + 1).padStart(2, '0');
                      setBillingMonth(`${y}-${m}`);
                    }}
                    onRangeConfirm={(start) => {
                      const y = start.getFullYear();
                      const m = String(start.getMonth() + 1).padStart(2, '0');
                      setBillingMonth(`${y}-${m}`);
                      setCalendarOpen(false);
                    }}
                    onCancel={() => setCalendarOpen(false)}
                    onConfirm={() => setCalendarOpen(false)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/50 backdrop-blur-sm border border-white/70 text-[#1E293B] hover:bg-white/80 hover:text-[#1A73E8] hover:scale-[1.02] transition-all duration-150 shadow-sm shadow-slate-300/30 disabled:opacity-50 cursor-pointer"
              title="Tải lại dữ liệu"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Tiến độ ghi chỉ số */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1E293B]">
              Tiến độ: {recordedCount} / {totalCount} phòng ({progressPercent}%)
            </span>
            <span className="font-medium text-[#64748B]">
              {progressPercent === 100 ? 'Đã hoàn thành' : `Còn ${totalCount - recordedCount} phòng`}
            </span>
          </div>
          <div className="w-full bg-slate-200/60 h-2 rounded-xl overflow-hidden">
            <div
              className="bg-[#1A73E8] h-full rounded-xl transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Danh sách Thẻ phòng */}
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

            return (
              <div
                key={room.room_id}
                data-testid={`room-card-${room.room_id}`}
                className={`rounded-2xl p-5 shadow-sm shadow-slate-300/30 backdrop-blur-md transition-all duration-150 hover:bg-white/60 border ${
                  cardState.error
                    ? 'border-rose-500/30 bg-rose-500/5 ring-1 ring-rose-500/20'
                    : cardState.saving
                    ? 'border-blue-500/30 bg-blue-500/5 ring-1 ring-blue-500/20'
                    : isRecorded && !cardState.dirty
                    ? 'border-emerald-500/30 bg-white/50'
                    : 'border-white/75 bg-white/45'
                }`}
              >
                {/* Header Thẻ phòng: Tên phòng & Trạng thái */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-white/60">
                  <div className="font-bold text-[#1E293B] text-base">
                    {roomName}
                  </div>

                  <div className="flex items-center gap-2">
                    {cardState.saving ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-700 border border-blue-500/20 animate-pulse">
                        <RefreshCw size={13} className="animate-spin" /> Đang lưu...
                      </span>
                    ) : isRecorded && !cardState.dirty ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 shadow-2xs">
                        <CheckCircle size={13} /> Đã lưu {room.invoice_code ? `(${room.invoice_code})` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20 shadow-2xs">
                        Chưa lưu
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
                          onBlur={() => handleInputBlur(room.room_id)}
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
                          onBlur={() => handleInputBlur(room.room_id)}
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
                  </div>
                </div>

                {/* Footer Thẻ: Tổng tiền & Trạng thái lưu */}
                <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-white/60 mt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#64748B] font-medium">Tổng tiền dự tính:</span>
                    <span className="text-base font-bold text-[#1A73E8]">
                      {formatMoney(preview.totalAmount)}
                    </span>
                  </div>

                  {cardState.error ? (
                    <div className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle size={14} />
                      <span>{cardState.error}</span>
                    </div>
                  ) : cardState.saving ? (
                    <div className="text-xs text-blue-600 flex items-center gap-1 animate-pulse">
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Đang tự động lưu...</span>
                    </div>
                  ) : cardState.dirty ? (
                    <span className="text-xs text-amber-600 font-medium">Chưa lưu</span>
                  ) : isRecorded ? (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <Check size={13} /> Đã lưu
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
