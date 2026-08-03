import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-center">
      <div className="max-w-md">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Không tìm thấy trang</h1>
        <p className="mt-3 text-base text-slate-600">Đường dẫn bạn truy cập không tồn tại hoặc đã được thay đổi.</p>
        <Link href="/" className="mt-6 inline-flex rounded-full bg-[#1a73e8] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#155fc0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] focus-visible:ring-offset-2">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
