'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { dormitoryApi, UnclassifiedRegistration } from '@/api/dormitory-api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function UnclassifiedStudentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<UnclassifiedRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ total: number; totalPages: number }>({ total: 0, totalPages: 0 });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const result = await dormitoryApi.registrations.getUnclassified({ search: search.trim() || undefined, page, limit: 20 });
      setItems(result.data);
      setMeta({ total: result.meta.total, totalPages: result.meta.totalPages });
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải danh sách chưa phân loại');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  return (
    <main className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto bg-transparent p-4 custom-scrollbar sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" aria-label="Quay lại danh sách lớp" onClick={() => router.back()} className="h-9 w-9 rounded-xl border-white/80 bg-white/60 p-0"><ArrowLeft size={16} /></Button>
          <div><h1 className="text-xl font-black tracking-tight text-slate-900">Chưa phân loại</h1><p className="text-sm text-slate-500">Danh sách đăng ký chưa liên kết sinh viên hoặc lớp</p></div>
        </div>
        <div className="relative w-full sm:w-80"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên, điện thoại, email..." aria-label="Tìm kiếm chưa phân loại" className="h-10 w-full rounded-xl border border-white/80 bg-white/60 pl-9 pr-3 text-sm text-slate-700 outline-none backdrop-blur-md focus:ring-2 focus:ring-blue-500/20" /></div>
      </header>

      <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/70 bg-white/45 shadow-sm backdrop-blur-md">
        {loading ? <div className="p-10 text-center text-sm text-slate-500">Đang tải...</div> : items.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Không có đăng ký chưa phân loại</div> : <>
          <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-white/70 bg-white/40 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">HỌ VÀ TÊN</th><th className="px-4 py-3">NGÀY SINH</th><th className="px-4 py-3">LIÊN HỆ</th><th className="px-4 py-3">PHÒNG</th><th className="px-4 py-3">TRẠNG THÁI</th></tr></thead><tbody className="divide-y divide-white/60">{items.map(item => <tr key={item._id} className="hover:bg-white/40"><td className="px-4 py-3 font-semibold text-slate-800">{item.full_name}<div className="text-xs font-normal text-slate-400">{item.public_registration_code}</div></td><td className="px-4 py-3 text-slate-600">{item.date_of_birth || '—'}</td><td className="px-4 py-3 text-slate-600">{item.phone_number}<div className="text-xs text-slate-400">{item.email || 'Chưa có email'}</div></td><td className="px-4 py-3 text-slate-600">{item.room_code || 'Chưa chọn phòng'}</td><td className="px-4 py-3"><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Chưa phân loại</span></td></tr>)}</tbody></table></div>
          <div className="divide-y divide-white/60 md:hidden">{items.map(item => <article key={item._id} className="flex gap-3 p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Users size={17} /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-slate-800">{item.full_name}</h2><span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">Chưa phân loại</span></div><p className="mt-1 text-xs text-slate-500">{item.phone_number} · {item.email || 'Chưa có email'}</p><p className="mt-1 text-xs text-slate-400">{item.room_code || 'Chưa chọn phòng'} · {item.public_registration_code}</p></div></article>)}</div>
          <div className="flex items-center justify-between border-t border-white/60 px-4 py-3 text-xs text-slate-500"><span>{meta.total} bản ghi</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Trước</Button><span className="px-2 py-1">{page}/{Math.max(1, meta.totalPages)}</span><Button type="button" variant="outline" size="sm" disabled={page >= meta.totalPages || loading} onClick={() => setPage(value => value + 1)}>Sau</Button></div></div>
        </>}
      </section>
    </main>
  );
}
