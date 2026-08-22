'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, LogOut } from 'lucide-react';
import { tokenStorage, type ImpersonationResponse } from '@/api/auth-api';
import {
  createSecureNonce,
  getImpersonationChannelName,
  IMPERSONATION_HANDOFF_TIMEOUT_MS,
  isValidImpersonationNonce,
  replaceWindowLocation,
  type ImpersonationChannelMessage,
} from '@/lib/impersonation-channel';
import { isStudentRole, isTeacherRole } from '@/utils/role.util';

function isValidPayload(payload: ImpersonationResponse): boolean {
  return Boolean(
    payload?.access_token
      && payload.user?.id
      && payload.impersonation?.id
      && payload.impersonation?.expires_at,
  );
}

export default function AccessPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Clear copied credentials before any bootstrap validation can return.
    tokenStorage.clearTabAuth();

    if (typeof BroadcastChannel === 'undefined') {
      setErrorMessage('Trình duyệt không hỗ trợ mở phiên truy cập an toàn.');
      return;
    }

    const channelNonce = new URLSearchParams(window.location.hash.slice(1)).get('channel');
    if (!isValidImpersonationNonce(channelNonce)) {
      setErrorMessage('Liên kết truy cập không hợp lệ.');
      return;
    }

    let childSessionId: string;
    try {
      childSessionId = createSecureNonce();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Không thể tạo phiên truy cập an toàn.');
      return;
    }

    // Defensive cleanup for browsers that copied sessionStorage despite noopener.
    // This never touches the administrator's shared localStorage session ID.
    tokenStorage.setTabSessionId(childSessionId);

    const channel = new BroadcastChannel(getImpersonationChannelName(channelNonce));
    let terminal = false;
    let timeoutId: number | undefined;
    const terminateHandoff = (clearAuth: boolean): boolean => {
      if (terminal) return false;
      terminal = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (clearAuth) tokenStorage.clearTabAuth();
      return true;
    };

    timeoutId = window.setTimeout(() => {
      if (!terminateHandoff(true)) return;
      setErrorMessage('Phiên kết nối đã hết thời gian chờ. Vui lòng đóng cửa sổ và thử lại.');
    }, IMPERSONATION_HANDOFF_TIMEOUT_MS + 1_000);

    channel.onmessage = (event: MessageEvent<ImpersonationChannelMessage>) => {
      if (terminal) return;
      const message = event.data;
      if (message?.type === 'ERROR') {
        if (!terminateHandoff(true)) return;
        setErrorMessage(message.message);
        channel.postMessage({ type: 'ACK' } satisfies ImpersonationChannelMessage);
        return;
      }
      if (message?.type !== 'SUCCESS') return;

      if (!isValidPayload(message.payload)) {
        if (!terminateHandoff(true)) return;
        setErrorMessage('Dữ liệu phiên truy cập không hợp lệ.');
        channel.postMessage({ type: 'ACK' } satisfies ImpersonationChannelMessage);
        return;
      }

      if (!terminateHandoff(false)) return;
      tokenStorage.setAccessToken(message.payload.access_token);
      tokenStorage.setUser({
        ...message.payload.user,
        impersonation: message.payload.impersonation,
      });
      channel.postMessage({ type: 'ACK' } satisfies ImpersonationChannelMessage);

      const defaultRoute = isStudentRole(message.payload.user) || isTeacherRole(message.payload.user)
        ? '/students/tasks'
        : '/';
      replaceWindowLocation(defaultRoute);
    };

    channel.postMessage({ type: 'READY', sessionId: childSessionId } satisfies ImpersonationChannelMessage);

    return () => {
      window.clearTimeout(timeoutId);
      channel.close();
    };
  }, []);

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/80 p-8 text-center shadow-xl shadow-slate-300/30 backdrop-blur-md">
      {errorMessage ? (
        <>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-slate-900">Không thể truy cập tài khoản</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{errorMessage}</p>
          <button
            type="button"
            onClick={() => window.close()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700"
          >
            <LogOut className="h-4 w-4" />
            Đóng cửa sổ
          </button>
        </>
      ) : (
        <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-600" />
          <h1 className="mt-4 text-lg font-bold text-slate-900">Đang mở phiên truy cập</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">Vui lòng giữ cửa sổ này mở trong giây lát.</p>
        </>
      )}
    </div>
  );
}
