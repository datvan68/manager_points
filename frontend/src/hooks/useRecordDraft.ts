import { useCallback, useEffect, useRef, useState } from 'react';

export const RECORD_DRAFT_VERSION = 1;

export type RecordDraftForm = 'student' | 'class';

interface RecordDraftEnvelope<T> {
  version: number;
  userId: string;
  form: RecordDraftForm;
  data: T;
}

interface UseRecordDraftOptions<T> {
  form: RecordDraftForm;
  userId?: string | null;
  enabled?: boolean;
  validate: (value: unknown) => value is T;
}

export function getRecordDraftStorageKey(form: RecordDraftForm, userId: string): string {
  return `record-draft:v${RECORD_DRAFT_VERSION}:${userId}:${form}`;
}

export function useRecordDraft<T>({
  form,
  userId,
  enabled = true,
  validate,
}: UseRecordDraftOptions<T>) {
  const [draft, setDraft] = useState<T | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const validateRef = useRef(validate);
  validateRef.current = validate;

  useEffect(() => {
    setDraft(null);
    if (!enabled || !userId || typeof window === 'undefined') {
      setHydrated(true);
      return;
    }

    const key = getRecordDraftStorageKey(form, userId);
    try {
      const raw = window.sessionStorage.getItem(key);
      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<RecordDraftEnvelope<T>>;
      if (
        parsed.version !== RECORD_DRAFT_VERSION ||
        parsed.userId !== userId ||
        parsed.form !== form ||
        !validateRef.current(parsed.data)
      ) {
        window.sessionStorage.removeItem(key);
      } else {
        setDraft(parsed.data);
      }
    } catch {
      window.sessionStorage.removeItem(key);
    } finally {
      setHydrated(true);
    }
  }, [enabled, form, userId]);

  const saveDraft = useCallback((data: T) => {
    if (!enabled || !userId || typeof window === 'undefined') return;
    const envelope: RecordDraftEnvelope<T> = {
      version: RECORD_DRAFT_VERSION,
      userId,
      form,
      data,
    };
    try {
      window.sessionStorage.setItem(getRecordDraftStorageKey(form, userId), JSON.stringify(envelope));
    } catch {
      // Storage can be unavailable or full; the form must remain usable.
    }
  }, [enabled, form, userId]);

  const clearDraft = useCallback(() => {
    if (!userId || typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(getRecordDraftStorageKey(form, userId));
    } catch {
      // Storage can be unavailable; there is nothing else to clear.
    }
  }, [form, userId]);

  return { draft, hydrated, saveDraft, clearDraft };
}
