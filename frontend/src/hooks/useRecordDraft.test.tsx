import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { getRecordDraftStorageKey, useRecordDraft } from './useRecordDraft';

type Draft = { value: string; selected: string[] };
const validate = (value: unknown): value is Draft => {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<Draft>;
  return typeof draft.value === 'string'
    && Array.isArray(draft.selected)
    && draft.selected.every(item => typeof item === 'string');
};

describe('useRecordDraft', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips a draft after remount and clears it', async () => {
    const first = renderHook(() => useRecordDraft({ form: 'student', userId: 'user-a', validate }));
    await waitFor(() => expect(first.result.current.hydrated).toBe(true));

    act(() => first.result.current.saveDraft({ value: 'note', selected: ['student-1'] }));
    first.unmount();

    const second = renderHook(() => useRecordDraft({ form: 'student', userId: 'user-a', validate }));
    await waitFor(() => expect(second.result.current.draft).toEqual({ value: 'note', selected: ['student-1'] }));
    act(() => second.result.current.clearDraft());
    expect(sessionStorage.getItem(getRecordDraftStorageKey('student', 'user-a'))).toBeNull();
  });

  it('rejects malformed JSON and isolates users and form types', async () => {
    const studentKey = getRecordDraftStorageKey('student', 'user-a');
    sessionStorage.setItem(studentKey, '{bad-json');
    const malformed = renderHook(() => useRecordDraft({ form: 'student', userId: 'user-a', validate }));
    await waitFor(() => expect(malformed.result.current.hydrated).toBe(true));
    expect(malformed.result.current.draft).toBeNull();
    expect(sessionStorage.getItem(studentKey)).toBeNull();

    const first = renderHook(() => useRecordDraft({ form: 'student', userId: 'user-a', validate }));
    act(() => first.result.current.saveDraft({ value: 'private', selected: [] }));
    const otherUser = renderHook(() => useRecordDraft({ form: 'student', userId: 'user-b', validate }));
    const otherForm = renderHook(() => useRecordDraft({ form: 'class', userId: 'user-a', validate }));
    await waitFor(() => {
      expect(otherUser.result.current.hydrated).toBe(true);
      expect(otherForm.result.current.hydrated).toBe(true);
    });
    expect(otherUser.result.current.draft).toBeNull();
    expect(otherForm.result.current.draft).toBeNull();
  });

  it('does not read or write when disabled', async () => {
    sessionStorage.setItem(getRecordDraftStorageKey('student', 'user-a'), JSON.stringify({ value: 'old' }));
    const result = renderHook(() => useRecordDraft({ form: 'student', userId: 'user-a', enabled: false, validate }));
    await waitFor(() => expect(result.result.current.hydrated).toBe(true));
    act(() => result.result.current.saveDraft({ value: 'new', selected: [] }));
    expect(result.result.current.draft).toBeNull();
    expect(sessionStorage.getItem(getRecordDraftStorageKey('student', 'user-a'))).toContain('old');
  });
});
