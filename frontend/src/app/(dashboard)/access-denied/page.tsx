'use client';

import { ArrowLeft, Home, ShieldX } from 'lucide-react';
import Link from 'next/link';

export default function AccessDeniedPage() {
  return (
    <main className="flex-1 overflow-auto p-6">
      <div className="mx-auto flex min-h-full w-full max-w-2xl items-center justify-center">
        <section className="w-full rounded-2xl border border-white/80 bg-white/80 p-8 text-center shadow-xl shadow-slate-300/30 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <ShieldX className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Không được truy cập</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">Bạn không thuộc KTX</p>
          <Link
            href="/"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Về trang chủ
            <Home className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </main>
  );
}
