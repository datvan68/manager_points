export type BatchStatus = 'completed' | 'partial' | 'interrupted';

export type BatchProgress<R, T> = { processed: number; total: number; status: 'processing' | BatchStatus; acknowledged: R[]; unconfirmed?: T[]; unsent?: T[] };

export async function runRosterBatches<T, R>(items: T[], size: number, send: (batch: T[], index: number) => Promise<R>, onProgress?: (progress: BatchProgress<R, T>) => void) {
  if (!Number.isInteger(size) || size < 1) throw new Error('Batch size must be a positive integer.');
  const frozen = items.slice();
  const acknowledged: R[] = [];
  const unsent: T[] = [];
  for (let offset = 0; offset < frozen.length; offset += size) {
    const batch = frozen.slice(offset, offset + size);
    onProgress?.({ processed: offset, total: frozen.length, status: 'processing', acknowledged: [...acknowledged], unconfirmed: [], unsent: [...unsent] });
    try {
      acknowledged.push(await send(batch, offset / size));
    } catch (error) {
      unsent.push(...frozen.slice(offset + batch.length));
      onProgress?.({ processed: offset, total: frozen.length, status: 'interrupted', acknowledged, unconfirmed: batch, unsent });
      return { status: 'interrupted' as const, processed: offset, total: frozen.length, acknowledged, unconfirmed: batch, unsent, error };
    }
    onProgress?.({ processed: offset + batch.length, total: frozen.length, status: offset + batch.length === frozen.length ? 'completed' : 'processing', acknowledged: [...acknowledged], unconfirmed: [], unsent: [...unsent] });
  }
  return { status: 'completed' as const, processed: frozen.length, total: frozen.length, acknowledged, unconfirmed: [], unsent };
}
