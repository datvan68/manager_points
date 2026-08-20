'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search,
  CheckCircle,
  Plus,
  SlidersHorizontal,
  FileText,
  X,
  Upload,
  AlertCircle,
  Eye,
  Zap,
  Droplets,
  Calendar,
  Users,
  DollarSign,
} from 'lucide-react';
import {
  dormitoryApi,
  DormInvoice,
  Room,
  CreateMonthlyInvoiceInput,
  UpdateMonthlyInvoiceInput,
} from '@/api/dormitory-api';
import { toast } from 'sonner';

// Helper format tiền tệ
function formatMoney(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0đ';
  return `${Number(amount).toLocaleString('vi-VN')}đ`;
}

// Helper format kỳ thu
function formatBillingMonth(billingMonth?: string, billingPeriod?: string): string {
  if (billingMonth && /^\d{4}-\d{2}$/.test(billingMonth)) {
    const [year, month] = billingMonth.split('-');
    return `${month}/${year}`;
  }
  if (billingPeriod) {
    const match = /^T(\d{2})\/(\d{4})$/.exec(billingPeriod);
    if (match) return `${match[1]}/${match[2]}`;
    return billingPeriod;
  }
  return '—';
}

// Helper format ngày
function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN');
  } catch {
    return '—';
  }
}

// Chuẩn hóa trạng thái hiển thị (chỉ có Chưa thu hoặc Đã thu)
function getDisplayStatus(status?: string): 'Chưa thu' | 'Đã thu' {
  if (status === 'Đã thu' || status === 'Đã thanh toán') return 'Đã thu';
  return 'Chưa thu';
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<DormInvoice[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'Tất cả' | 'Chưa thu' | 'Đã thu'>('Tất cả');
  const [filterMonth, setFilterMonth] = useState('');
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState<any>(null);

  // Modal Nâng cao (Tạo / Sửa đợt thu phòng)
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<DormInvoice | null>(null);
  const [roomLoading, setRoomLoading] = useState(false);
  const [advancedSubmitting, setAdvancedSubmitting] = useState(false);

  const defaultMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const defaultReadingDate = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  }, []);

  const [advancedForm, setAdvancedForm] = useState({
    room_id: '',
    billing_month: defaultMonth,
    reading_date: defaultReadingDate,
    occupant_count: 0,
    electricity: {
      previous_reading: 0,
      current_reading: 0,
      quota_per_person: 15,
      unit_price: 2500,
    },
    water: {
      previous_reading: 0,
      current_reading: 0,
      quota_per_person: 4,
      unit_price: 10000,
    },
    payment_start_date: defaultReadingDate,
    due_date: defaultDueDate,
    is_exempt: false,
    notes: '',
  });

  // Modal Thu tiền (Xác nhận thanh toán kèm upload chứng từ)
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<DormInvoice | null>(null);
  const [payMethod, setPayMethod] = useState<'Tiền mặt' | 'Chuyển khoản' | 'Cổng thanh toán'>('Chuyển khoản');
  const [payNotes, setPayNotes] = useState('');
  const [payProofFile, setPayProofFile] = useState<File | null>(null);
  const [payProofPreview, setPayProofPreview] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Modal Xem chứng từ thanh toán
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<DormInvoice | null>(null);

  // Load danh sách phòng
  useEffect(() => {
    dormitoryApi.rooms
      .getAll({ limit: 200 })
      .then((res) => setRooms(res.data || []))
      .catch(() => {});
  }, []);

  // Load danh sách hóa đơn
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 50 };
      if (filterStatus === 'Chưa thu') params.status = 'Chưa thu';
      else if (filterStatus === 'Đã thu') params.status = 'Đã thu';
      if (filterMonth) params.billing_month = filterMonth;
      if (search) params.search = search;

      const res = await dormitoryApi.invoices.getAll(params);
      setInvoices(res.data || []);
      setMeta(res.meta);
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi tải danh sách hóa đơn');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterMonth, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Tính toán xem trước ở client cho Modal Nâng cao
  const previewCalc = useMemo(() => {
    const occ = Number(advancedForm.occupant_count) || 0;
    const isExempt = advancedForm.is_exempt;

    // Điện
    const elecPrev = Number(advancedForm.electricity.previous_reading) || 0;
    const elecCurr = Number(advancedForm.electricity.current_reading) || 0;
    const elecQuotaPer = Number(advancedForm.electricity.quota_per_person) || 0;
    const elecPrice = Number(advancedForm.electricity.unit_price) || 0;

    const elecConsumption = Math.max(elecCurr - elecPrev, 0);
    const elecQuotaTotal = occ * elecQuotaPer;
    const elecExcess = Math.max(elecConsumption - elecQuotaTotal, 0);
    const elecAmount = isExempt ? 0 : elecExcess * elecPrice;

    // Nước
    const waterPrev = Number(advancedForm.water.previous_reading) || 0;
    const waterCurr = Number(advancedForm.water.current_reading) || 0;
    const waterQuotaPer = Number(advancedForm.water.quota_per_person) || 0;
    const waterPrice = Number(advancedForm.water.unit_price) || 0;

    const waterConsumption = Math.max(waterCurr - waterPrev, 0);
    const waterQuotaTotal = occ * waterQuotaPer;
    const waterExcess = Math.max(waterConsumption - waterQuotaTotal, 0);
    const waterAmount = isExempt ? 0 : waterExcess * waterPrice;

    const totalAmount = isExempt ? 0 : elecAmount + waterAmount;

    return {
      electricity: {
        consumption: elecConsumption,
        quota_total: elecQuotaTotal,
        excess: elecExcess,
        amount: elecAmount,
        invalid: elecCurr < elecPrev,
      },
      water: {
        consumption: waterConsumption,
        quota_total: waterQuotaTotal,
        excess: waterExcess,
        amount: waterAmount,
        invalid: waterCurr < waterPrev,
      },
      totalAmount,
    };
  }, [advancedForm]);

  // Khi chọn phòng trong Modal Nâng cao, tự động lấy thông tin người ở và chỉ số cũ
  async function handleSelectRoom(roomId: string) {
    setAdvancedForm((prev) => ({ ...prev, room_id: roomId }));
    if (!roomId) return;
    try {
      setRoomLoading(true);
      const info = await dormitoryApi.invoices.getRoomInfo(roomId, advancedForm.billing_month);
      setAdvancedForm((prev) => ({
        ...prev,
        occupant_count: info.occupant_count || 0,
        electricity: {
          ...prev.electricity,
          previous_reading: info.last_readings?.electricity || 0,
          current_reading: Math.max(prev.electricity.current_reading, info.last_readings?.electricity || 0),
        },
        water: {
          ...prev.water,
          previous_reading: info.last_readings?.water || 0,
          current_reading: Math.max(prev.water.current_reading, info.last_readings?.water || 0),
        },
      }));
    } catch {
      // Ignored
    } finally {
      setRoomLoading(false);
    }
  }

  // Mở modal tạo mới đợt thu
  function openCreateModal() {
    setEditingInvoice(null);
    setAdvancedForm({
      room_id: rooms[0]?._id || '',
      billing_month: defaultMonth,
      reading_date: defaultReadingDate,
      occupant_count: 0,
      electricity: {
        previous_reading: 0,
        current_reading: 0,
        quota_per_person: 15,
        unit_price: 2500,
      },
      water: {
        previous_reading: 0,
        current_reading: 0,
        quota_per_person: 4,
        unit_price: 10000,
      },
      payment_start_date: defaultReadingDate,
      due_date: defaultDueDate,
      is_exempt: false,
      notes: '',
    });
    if (rooms[0]?._id) {
      handleSelectRoom(rooms[0]._id);
    }
    setAdvancedModalOpen(true);
  }

  // Mở modal chỉnh sửa thông số Nâng cao
  function openEditModal(inv: DormInvoice) {
    setEditingInvoice(inv);
    const roomId = typeof inv.room_id === 'object' ? inv.room_id?._id : inv.room_id;
    setAdvancedForm({
      room_id: roomId || '',
      billing_month: inv.billing_month || defaultMonth,
      reading_date: inv.reading_date ? new Date(inv.reading_date).toISOString().split('T')[0] : defaultReadingDate,
      occupant_count: inv.occupant_count || 0,
      electricity: {
        previous_reading: inv.electricity?.previous_reading || 0,
        current_reading: inv.electricity?.current_reading || 0,
        quota_per_person: inv.electricity?.quota_per_person || 15,
        unit_price: inv.electricity?.unit_price || 2500,
      },
      water: {
        previous_reading: inv.water?.previous_reading || 0,
        current_reading: inv.water?.current_reading || 0,
        quota_per_person: inv.water?.quota_per_person || 4,
        unit_price: inv.water?.unit_price || 10000,
      },
      payment_start_date: inv.payment_start_date ? new Date(inv.payment_start_date).toISOString().split('T')[0] : defaultReadingDate,
      due_date: inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : defaultDueDate,
      is_exempt: Boolean(inv.is_exempt),
      notes: inv.notes || '',
    });
    setAdvancedModalOpen(true);
  }

  // Lưu form Nâng cao
  async function handleSaveAdvanced(e: React.FormEvent) {
    e.preventDefault();
    if (!advancedForm.room_id) {
      toast.error('Vui lòng chọn phòng');
      return;
    }
    if (previewCalc.electricity.invalid) {
      toast.error('Chỉ số điện mới không được nhỏ hơn chỉ số cũ');
      return;
    }
    if (previewCalc.water.invalid) {
      toast.error('Chỉ số nước mới không được nhỏ hơn chỉ số cũ');
      return;
    }
    if (advancedForm.payment_start_date && advancedForm.due_date && advancedForm.due_date < advancedForm.payment_start_date) {
      toast.error('Hạn kết thúc thu phải sau hoặc bằng ngày bắt đầu thu');
      return;
    }

    try {
      setAdvancedSubmitting(true);
      if (editingInvoice) {
        const dto: UpdateMonthlyInvoiceInput = {
          reading_date: advancedForm.reading_date,
          occupant_count: Number(advancedForm.occupant_count),
          electricity: advancedForm.electricity,
          water: advancedForm.water,
          is_exempt: advancedForm.is_exempt,
          payment_start_date: advancedForm.payment_start_date,
          due_date: advancedForm.due_date,
          notes: advancedForm.notes,
        };
        await dormitoryApi.invoices.updateMonthly(editingInvoice._id, dto);
        toast.success('Cập nhật thông số hóa đơn thành công');
      } else {
        const dto: CreateMonthlyInvoiceInput = {
          room_id: advancedForm.room_id,
          billing_month: advancedForm.billing_month,
          reading_date: advancedForm.reading_date,
          occupant_count: Number(advancedForm.occupant_count),
          electricity: advancedForm.electricity,
          water: advancedForm.water,
          is_exempt: advancedForm.is_exempt,
          payment_start_date: advancedForm.payment_start_date,
          due_date: advancedForm.due_date,
          notes: advancedForm.notes,
        };
        await dormitoryApi.invoices.createMonthly(dto);
        toast.success('Lập đợt thu điện - nước thành công');
      }
      setAdvancedModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi lưu hóa đơn');
    } finally {
      setAdvancedSubmitting(false);
    }
  }

  // Mở modal Thu tiền
  function openPayModal(inv: DormInvoice) {
    setPayingInvoice(inv);
    setPayMethod('Chuyển khoản');
    setPayNotes('');
    setPayProofFile(null);
    setPayProofPreview(null);
    setPayModalOpen(true);
  }

  // Handle chọn file ảnh chứng từ
  function handleProofFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error('Chỉ chấp nhận file ảnh JPEG, PNG hoặc WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dung lượng file tối đa là 5MB');
      return;
    }
    setPayProofFile(file);
    const url = URL.createObjectURL(file);
    setPayProofPreview(url);
  }

  // Xác nhận thu tiền
  async function handleConfirmPay(e: React.FormEvent) {
    e.preventDefault();
    if (!payingInvoice) return;
    try {
      setPaySubmitting(true);
      let proofMeta: any = undefined;
      if (payProofFile) {
        proofMeta = await dormitoryApi.invoices.uploadProof(payProofFile);
      }
      await dormitoryApi.invoices.pay(payingInvoice._id, {
        payment_method: payMethod,
        notes: payNotes || undefined,
        payment_proof: proofMeta,
      });
      toast.success('Xác nhận thu tiền thành công');
      setPayModalOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi xác nhận thu tiền');
    } finally {
      setPaySubmitting(false);
    }
  }

  // Mở modal xem chứng từ
  function openProofModal(inv: DormInvoice) {
    setViewingInvoice(inv);
    setProofModalOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header và Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Hóa đơn điện - nước KTX</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Quản lý đợt thu tiền điện - nước theo phòng, tự động tính theo số người và định mức
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Search box */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm mã HĐ, tên phòng..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>

          {/* Lọc kỳ thu */}
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Lọc theo kỳ thu"
          />

          {/* Lọc trạng thái (Chỉ Chưa thu / Đã thu) */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Tất cả">Tất cả trạng thái</option>
            <option value="Chưa thu">Chưa thu</option>
            <option value="Đã thu">Đã thu</option>
          </select>

          {/* Nút Lập đợt thu mới */}
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
          >
            <Plus size={16} /> Lập đợt thu
          </button>
        </div>
      </div>

      {/* Bảng hiển thị 7 cột chuẩn (AC-02) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left font-semibold text-gray-700">Phòng</th>
                <th className="p-3 text-left font-semibold text-gray-700">Kỳ thu</th>
                <th className="p-3 text-right font-semibold text-gray-700">Tiền điện</th>
                <th className="p-3 text-right font-semibold text-gray-700">Tiền nước</th>
                <th className="p-3 text-right font-semibold text-gray-700">Tổng tiền</th>
                <th className="p-3 text-left font-semibold text-gray-700">Trạng thái</th>
                <th className="p-3 text-center font-semibold text-gray-700">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="p-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-400">
                    <FileText size={36} className="mx-auto mb-2 opacity-40" />
                    Không có hóa đơn nào phù hợp
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const displayStatus = getDisplayStatus(inv.status);
                  const roomName =
                    typeof inv.room_id === 'object' && inv.room_id
                      ? `${inv.room_id.room_name || inv.room_id.room_code || 'Phòng'}${
                          inv.room_id.building_id?.name ? ` (${inv.room_id.building_id.name})` : ''
                        }`
                      : '—';

                  const elecAmount = inv.electricity?.amount ?? 0;
                  const waterAmount = inv.water?.amount ?? 0;

                  return (
                    <tr key={inv._id} className="border-b border-gray-50 hover:bg-gray-50/60 transition">
                      {/* 1. Phòng */}
                      <td className="p-3 font-medium text-gray-800">
                        <div>{roomName}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{inv.invoice_code}</div>
                      </td>

                      {/* 2. Kỳ thu */}
                      <td className="p-3 text-gray-600 font-medium">
                        {formatBillingMonth(inv.billing_month, inv.billing_period)}
                      </td>

                      {/* 3. Tiền điện */}
                      <td className="p-3 text-right text-gray-700">
                        {formatMoney(elecAmount)}
                        {inv.electricity?.consumption !== undefined && (
                          <div className="text-[11px] text-gray-400">
                            {inv.electricity.consumption} kWh
                          </div>
                        )}
                      </td>

                      {/* 4. Tiền nước */}
                      <td className="p-3 text-right text-gray-700">
                        {formatMoney(waterAmount)}
                        {inv.water?.consumption !== undefined && (
                          <div className="text-[11px] text-gray-400">
                            {inv.water.consumption} m³
                          </div>
                        )}
                      </td>

                      {/* 5. Tổng tiền */}
                      <td className="p-3 text-right font-bold text-blue-700">
                        {formatMoney(inv.total_amount)}
                        {inv.is_exempt && (
                          <div className="text-[10px] text-amber-600 font-normal">Miễn thu</div>
                        )}
                      </td>

                      {/* 6. Trạng thái (Chỉ Chưa thu hoặc Đã thu) */}
                      <td className="p-3">
                        {displayStatus === 'Đã thu' ? (
                          <button
                            onClick={() => openProofModal(inv)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition cursor-pointer"
                            title="Bấm để xem chứng từ thanh toán"
                          >
                            <CheckCircle size={13} />
                            Đã thu
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            Chưa thu
                          </span>
                        )}
                      </td>

                      {/* 7. Thao tác */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {displayStatus === 'Chưa thu' ? (
                            <>
                              <button
                                onClick={() => openEditModal(inv)}
                                className="p-1.5 rounded-lg text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition"
                                title="Chỉnh sửa thông số (Nâng cao)"
                              >
                                <SlidersHorizontal size={16} />
                              </button>
                              <button
                                onClick={() => openPayModal(inv)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition shadow-sm"
                                title="Thu tiền hóa đơn"
                              >
                                <CheckCircle size={14} /> Thu tiền
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openProofModal(inv)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition"
                              title="Xem chứng từ"
                            >
                              <Eye size={14} /> Xem chứng từ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {meta && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500 flex justify-between items-center">
            <span>
              Hiển thị {invoices.length} / {meta.total} hóa đơn
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL NÂNG CAO (Lập đợt thu / Chỉnh sửa thông số) */}
      {/* ========================================================================= */}
      {advancedModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => !advancedSubmitting && setAdvancedModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-5 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-lg">
                <SlidersHorizontal size={20} />
                <h2>
                  {editingInvoice
                    ? 'Chỉnh sửa thông số hóa đơn (Nâng cao)'
                    : 'Lập đợt thu điện - nước (Nâng cao)'}
                </h2>
              </div>
              <button
                onClick={() => setAdvancedModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdvanced} className="space-y-4">
              {/* Phòng và Kỳ thu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Phòng <span className="text-red-500">*</span>
                  </label>
                  <select
                    disabled={Boolean(editingInvoice) || roomLoading}
                    value={advancedForm.room_id}
                    onChange={(e) => handleSelectRoom(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white disabled:bg-gray-100"
                  >
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.room_name || r.room_code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Kỳ thu (Tháng/Năm) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    disabled={Boolean(editingInvoice)}
                    value={advancedForm.billing_month}
                    onChange={(e) => setAdvancedForm((f) => ({ ...f, billing_month: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* Số người ở & Ngày chốt chỉ số */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <Users size={14} className="text-slate-500" />
                    Số người ở tại lúc chốt
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={advancedForm.occupant_count}
                    onChange={(e) =>
                      setAdvancedForm((f) => ({
                        ...f,
                        occupant_count: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                  <span className="text-[11px] text-gray-400">
                    Lấy tự động từ Danh sách KTX (có thể điều chỉnh)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <Calendar size={14} className="text-slate-500" />
                    Ngày chốt chỉ số <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={advancedForm.reading_date}
                    onChange={(e) => setAdvancedForm((f) => ({ ...f, reading_date: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* Cụm thông số Điện */}
              <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 text-sm">
                    <Zap size={16} className="text-amber-600" />
                    Thông số Điện
                  </div>
                  <div className="text-xs font-semibold text-amber-800">
                    Thành tiền: {formatMoney(previewCalc.electricity.amount)}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Chỉ số cũ</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.electricity.previous_reading}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          electricity: {
                            ...f.electricity,
                            previous_reading: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Chỉ số mới</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.electricity.current_reading}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          electricity: {
                            ...f.electricity,
                            current_reading: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        }))
                      }
                      className={`w-full px-2.5 py-1.5 border rounded-lg text-sm bg-white ${
                        previewCalc.electricity.invalid ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Định mức/người (kWh)</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.electricity.quota_per_person}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          electricity: {
                            ...f.electricity,
                            quota_per_person: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Đơn giá (đ/kWh)</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.electricity.unit_price}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          electricity: {
                            ...f.electricity,
                            unit_price: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>

                {previewCalc.electricity.invalid && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle size={13} /> Chỉ số mới không được nhỏ hơn chỉ số cũ
                  </p>
                )}

                <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-4 gap-y-1 bg-white/70 p-2 rounded-lg border border-amber-100">
                  <span>Tiêu thụ: <b>{previewCalc.electricity.consumption} kWh</b></span>
                  <span>Định mức phòng: <b>{previewCalc.electricity.quota_total} kWh</b></span>
                  <span>Vượt định mức: <b>{previewCalc.electricity.excess} kWh</b></span>
                </div>
              </div>

              {/* Cụm thông số Nước */}
              <div className="border border-sky-200 bg-sky-50/40 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-sky-900 text-sm">
                    <Droplets size={16} className="text-sky-600" />
                    Thông số Nước
                  </div>
                  <div className="text-xs font-semibold text-sky-800">
                    Thành tiền: {formatMoney(previewCalc.water.amount)}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Chỉ số cũ</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.water.previous_reading}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          water: {
                            ...f.water,
                            previous_reading: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Chỉ số mới</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.water.current_reading}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          water: {
                            ...f.water,
                            current_reading: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        }))
                      }
                      className={`w-full px-2.5 py-1.5 border rounded-lg text-sm bg-white ${
                        previewCalc.water.invalid ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Định mức/người (m³)</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.water.quota_per_person}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          water: {
                            ...f.water,
                            quota_per_person: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-1">Đơn giá (đ/m³)</label>
                    <input
                      type="number"
                      min="0"
                      value={advancedForm.water.unit_price}
                      onChange={(e) =>
                        setAdvancedForm((f) => ({
                          ...f,
                          water: {
                            ...f.water,
                            unit_price: Math.max(0, parseFloat(e.target.value) || 0),
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>

                {previewCalc.water.invalid && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle size={13} /> Chỉ số mới không được nhỏ hơn chỉ số cũ
                  </p>
                )}

                <div className="text-[11px] text-gray-500 flex flex-wrap gap-x-4 gap-y-1 bg-white/70 p-2 rounded-lg border border-sky-100">
                  <span>Tiêu thụ: <b>{previewCalc.water.consumption} m³</b></span>
                  <span>Định mức phòng: <b>{previewCalc.water.quota_total} m³</b></span>
                  <span>Vượt định mức: <b>{previewCalc.water.excess} m³</b></span>
                </div>
              </div>

              {/* Hạn thu & Cờ Không thu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Bắt đầu thu
                  </label>
                  <input
                    type="date"
                    value={advancedForm.payment_start_date}
                    onChange={(e) => setAdvancedForm((f) => ({ ...f, payment_start_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Hạn kết thúc thu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={advancedForm.due_date}
                    onChange={(e) => setAdvancedForm((f) => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Checkbox Miễn thu / Không thu */}
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="is_exempt"
                  checked={advancedForm.is_exempt}
                  onChange={(e) => setAdvancedForm((f) => ({ ...f, is_exempt: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_exempt" className="text-xs font-medium text-gray-700 cursor-pointer">
                  <b>Không thu đợt này</b> (Vẫn lưu chỉ số công-tơ, tổng tiền phải thu = 0đ)
                </label>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={advancedForm.notes}
                  onChange={(e) => setAdvancedForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Ghi chú về đợt thu, sự cố công tơ..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Hộp tổng kết tiền xem trước */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-800 font-medium">Tổng tiền phải thu dự tính</div>
                  <div className="text-xl font-black text-blue-900 mt-0.5">
                    {formatMoney(previewCalc.totalAmount)}
                  </div>
                </div>
                <div className="text-right text-[11px] text-blue-700 space-y-0.5">
                  <div>Điện: {formatMoney(previewCalc.electricity.amount)}</div>
                  <div>Nước: {formatMoney(previewCalc.water.amount)}</div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={advancedSubmitting}
                  onClick={() => setAdvancedModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={advancedSubmitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                >
                  {advancedSubmitting ? 'Đang lưu...' : editingInvoice ? 'Cập nhật' : 'Tạo đợt thu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL THU TIỀN (Xác nhận thanh toán & upload chứng từ) */}
      {/* ========================================================================= */}
      {payModalOpen && payingInvoice && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !paySubmitting && setPayModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Xác nhận thu tiền</h2>
              <button
                onClick={() => setPayModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl space-y-1 text-xs text-gray-600">
              <div>
                Phòng:{' '}
                <b>
                  {typeof payingInvoice.room_id === 'object'
                    ? payingInvoice.room_id?.room_name || payingInvoice.room_id?.room_code
                    : '—'}
                </b>
              </div>
              <div>
                Kỳ thu: <b>{formatBillingMonth(payingInvoice.billing_month, payingInvoice.billing_period)}</b>
              </div>
              <div>
                Số tiền: <b className="text-emerald-700 text-sm">{formatMoney(payingInvoice.total_amount)}</b>
              </div>
            </div>

            <form onSubmit={handleConfirmPay} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Phương thức thanh toán <span className="text-red-500">*</span>
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Chuyển khoản">Chuyển khoản</option>
                  <option value="Tiền mặt">Tiền mặt</option>
                  <option value="Cổng thanh toán">Cổng thanh toán</option>
                </select>
              </div>

              {/* Upload ảnh chứng từ */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ảnh chứng từ thanh toán (tuỳ chọn)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-3 text-center hover:border-blue-400 transition bg-slate-50">
                  <input
                    type="file"
                    id="proof_upload"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleProofFileChange}
                    className="hidden"
                  />
                  <label htmlFor="proof_upload" className="cursor-pointer block">
                    {payProofPreview ? (
                      <div className="space-y-2">
                        <img
                          src={payProofPreview}
                          alt="Chứng từ"
                          className="max-h-36 mx-auto rounded-lg shadow-sm object-contain"
                        />
                        <span className="text-xs text-blue-600 hover:underline block">
                          Chọn ảnh khác
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1 py-2">
                        <Upload size={24} className="mx-auto text-gray-400" />
                        <div className="text-xs text-gray-600 font-medium">Bấm để tải ảnh chứng từ</div>
                        <div className="text-[10px] text-gray-400">PNG, JPG, WebP tối đa 5MB</div>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ghi chú thanh toán</label>
                <textarea
                  rows={2}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Mã giao dịch, thông tin người nộp..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={paySubmitting}
                  onClick={() => setPayModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
                >
                  {paySubmitting ? 'Đang xử lý...' : 'Xác nhận thu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL XEM CHỨNG TỪ (Khi click Đã thu hoặc nút Xem chứng từ) */}
      {/* ========================================================================= */}
      {proofModalOpen && viewingInvoice && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setProofModalOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setProofModalOpen(false)}
          tabIndex={-1}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Chi tiết chứng từ thanh toán</h2>
                <span className="text-xs text-emerald-700 font-medium">Trạng thái: Đã thu</span>
              </div>
              <button
                onClick={() => setProofModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* Thông tin thanh toán */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div>
                <span className="text-gray-500 block">Phòng</span>
                <span className="font-semibold text-gray-800">
                  {typeof viewingInvoice.room_id === 'object'
                    ? viewingInvoice.room_id?.room_name || viewingInvoice.room_id?.room_code
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Kỳ thu</span>
                <span className="font-semibold text-gray-800">
                  {formatBillingMonth(viewingInvoice.billing_month, viewingInvoice.billing_period)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Tổng tiền</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {formatMoney(viewingInvoice.total_amount)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Phương thức</span>
                <span className="font-semibold text-gray-800">
                  {viewingInvoice.payment_method || 'Chuyển khoản'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Ngày thu</span>
                <span className="font-semibold text-gray-800">
                  {formatDate(viewingInvoice.paid_at)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Người xác nhận</span>
                <span className="font-semibold text-gray-800">
                  {viewingInvoice.confirmed_by_id?.full_name ||
                    viewingInvoice.confirmed_by_id?.user_name ||
                    'Quản lý KTX'}
                </span>
              </div>
              {viewingInvoice.notes && (
                <div className="col-span-2 pt-1 border-t border-slate-200">
                  <span className="text-gray-500 block">Ghi chú:</span>
                  <span className="text-gray-700">{viewingInvoice.notes}</span>
                </div>
              )}
            </div>

            {/* Ảnh chứng từ */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Ảnh chứng từ đính kèm
              </label>
              {viewingInvoice.payment_proof?.url ? (
                <div className="space-y-2">
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-black/5 flex items-center justify-center p-2">
                    <img
                      src={viewingInvoice.payment_proof.url}
                      alt="Chứng từ thanh toán"
                      className="max-h-72 w-auto object-contain rounded-lg shadow-sm"
                    />
                  </div>
                  <div className="text-right">
                    <a
                      href={viewingInvoice.payment_proof.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      <Eye size={12} /> Xem ảnh kích thước đầy đủ
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-6 border border-dashed border-gray-200 rounded-xl text-center text-gray-400 bg-gray-50">
                  <FileText size={28} className="mx-auto mb-1 opacity-30" />
                  <p className="text-xs">Chưa có ảnh chứng từ thanh toán cho hóa đơn này</p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setProofModalOpen(false)}
                className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
