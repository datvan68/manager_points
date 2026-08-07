'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { dormitoryApi, UnclassifiedRegistration } from '@/api/dormitory-api';
import { toast } from 'sonner';

export default function UnclassifiedStudentsPage() {
  const [items, setItems] = useState<UnclassifiedRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const load = useCallback(async () => {
    try { setLoading(true); setItems((await dormitoryApi.registrations.getUnclassified({ search, limit: 50 })).data); }
    catch (error: any) { toast.error(error?.message || 'Không thể tải danh sách chưa phân loại'); }
    finally { setLoading(false); }
  }, [search]);
  useEffect(() => { load(); }, [load]);
  return <main className="space-y-6 p-4 md:p-6">
    <div className="flex items-center justify-between gap-3 flex-wrap"><div><h1 className="text-xl font-bold text-gray-800">Chưa phân loại</h1><p className="text-sm text-gray-500">Đăng ký KTX chưa có mã sinh viên hoặc lớp</p></div><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên, điện thoại, email..." className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" /></div></div>
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {loading ? <div className="p-8 text-center text-gray-400">Đang tải...</div> : items.length === 0 ? <div className="p-8 text-center text-gray-400">Không có đăng ký chưa phân loại</div> : <div className="divide-y divide-gray-100">{items.map(item => <div key={item._id} className="p-4 flex items-start gap-3"><div className="p-2 rounded-lg bg-amber-50 text-amber-600"><Users size={18} /></div><div className="min-w-0"><p className="font-medium text-gray-800">{item.full_name}</p><p className="text-sm text-gray-500">{item.phone_number} · {item.email || 'Chưa có email'}</p><p className="text-xs text-gray-400 mt-1">{item.public_registration_code} · {item.room_code || 'Chưa chọn phòng'} · {item.status}</p></div></div>)}</div>}
    </div>
  </main>;
}
