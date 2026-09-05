export type BatchStatus = 'completed' | 'partial' | 'interrupted';

export type BatchProgress<R, T> = {
  processed: number;
  total: number;
  status: 'processing' | BatchStatus;
  acknowledged: readonly R[];
  unconfirmed: readonly T[];
  unsent: readonly T[];
};

export type BatchRunResult<R, T> = {
  status: BatchStatus;
  processed: number;
  total: number;
  acknowledged: readonly R[];
  unconfirmed: readonly T[];
  unsent: readonly T[];
  error?: unknown;
};

export async function runRosterBatches<T, R>(
  items: readonly T[],
  size: number,
  send: (batch: readonly T[], index: number) => Promise<R>,
  onProgress?: (progress: BatchProgress<R, T>) => void,
  isPartial?: (response: R) => boolean,
): Promise<BatchRunResult<R, T>> {
  if (!Number.isInteger(size) || size < 1) throw new Error('Batch size must be a positive integer.');
  const frozen = Object.freeze(items.slice());
  const acknowledged: R[] = [];
  const unsent: T[] = [];
  let hasPartialResponse = false;
  const report = (processed: number, status: BatchProgress<R, T>['status'], unconfirmed: readonly T[] = []) => {
    onProgress?.({
      processed,
      total: frozen.length,
      status,
      acknowledged: Object.freeze(acknowledged.slice()),
      unconfirmed: Object.freeze(unconfirmed.slice()),
      unsent: Object.freeze(unsent.slice()),
    });
  };
  for (let offset = 0; offset < frozen.length; offset += size) {
    const batch = Object.freeze(frozen.slice(offset, offset + size));
    report(offset, 'processing');
    try {
      const response = await send(batch, offset / size);
      acknowledged.push(response);
      hasPartialResponse = hasPartialResponse || Boolean(isPartial?.(response));
    } catch (error) {
      unsent.push(...frozen.slice(offset + batch.length));
      report(offset, 'interrupted', batch);
      return {
        status: 'interrupted',
        processed: offset,
        total: frozen.length,
        acknowledged: Object.freeze(acknowledged.slice()),
        unconfirmed: Object.freeze(batch.slice()),
        unsent: Object.freeze(unsent.slice()),
        error,
      };
    }
    const terminal = offset + batch.length === frozen.length;
    report(offset + batch.length, terminal ? (hasPartialResponse ? 'partial' : 'completed') : 'processing');
  }
  return {
    status: hasPartialResponse ? 'partial' : 'completed',
    processed: frozen.length,
    total: frozen.length,
    acknowledged: Object.freeze(acknowledged.slice()),
    unconfirmed: [],
    unsent: Object.freeze(unsent.slice()),
  };
}
