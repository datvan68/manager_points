'use client';
import { RouteGuard } from '@/components/guards/RouteGuard';
import TimetableLookup from '@/components/timetable/TimetableLookup';
export default function TimetablePage() { return <RouteGuard><main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5"><div><h1 className="text-2xl font-black text-slate-800">Thời khóa biểu</h1><p className="mt-1 text-sm text-slate-500">Tra cứu lịch học theo dữ liệu nhà trường.</p></div><TimetableLookup /></div></main></RouteGuard>; }
