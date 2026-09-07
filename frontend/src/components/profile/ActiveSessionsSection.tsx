'use client';

import { useCallback, useEffect, useState } from 'react';
import { authApi, type ActiveSession } from '@/api/auth-api';
import { useAuth } from '@/providers/auth-provider';

export function ActiveSessionsSection() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try { setSessions(await authApi.listSessions()); }
    catch { setError('Không thể tải các phiên đăng nhập. Vui lòng thử lại.'); }
  }, []);
  useEffect(() => { if (user && !user.impersonation) void load(); }, [user?.id, user?.impersonation?.id, load]);
  if (!user || user.impersonation) return null;
  const revoke = async (session?: ActiveSession) => {
    setBusy(true); setError('');
    try {
      if (session) await authApi.revokeSession(session.id); else await authApi.revokeOtherSessions();
      if (session?.current) await logout(); else await load();
    } catch { setError('Chưa thể kết thúc phiên. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-white/70 bg-white/40 p-5 shadow-sm" aria-label="Thiết bị đăng nhập">
    <h2 className="text-lg font-semibold text-slate-800">Thiết bị đăng nhập</h2>
    <p className="my-2 text-sm text-slate-600">Mỗi trình duyệt có một phiên riêng. Kết thúc phiên sẽ đăng xuất các tab dùng phiên đó.</p>
    {error && <p role="alert">{error} <button onClick={load} className="underline">Thử lại</button></p>}
    <ul className="divide-y divide-slate-200">
      {sessions.map(session => <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div><p>{session.device_label} {session.current && <strong>— Phiên hiện tại</strong>}</p>
          <p className="text-xs text-slate-600">Đăng nhập: {new Date(session.created_at).toLocaleString('vi-VN')}. Hoạt động: {new Date(session.last_active_at).toLocaleString('vi-VN')}</p></div>
        <button disabled={busy} onClick={() => void revoke(session)} className="rounded-xl border px-3 py-2 text-sm disabled:opacity-50">Kết thúc phiên</button>
      </li>)}
    </ul>
    <button disabled={busy || !sessions.some(s => !s.current)} onClick={() => void revoke()} className="mt-3 rounded-xl bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50">Đăng xuất các thiết bị khác</button>
  </section>;
}
