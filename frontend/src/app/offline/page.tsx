export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">HSSV</p>
        <h1 className="mt-3 text-2xl font-bold">Bạn đang ngoại tuyến</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Không thể tải trang này khi chưa có kết nối mạng. Hãy kiểm tra kết nối rồi thử lại.
        </p>
        <a
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          href="/"
        >
          Thử lại
        </a>
      </section>
    </main>
  )
}
