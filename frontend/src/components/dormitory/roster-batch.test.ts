import { describe, expect, it, vi } from 'vitest';
import { runRosterBatches } from './roster-batch';

describe('runRosterBatches', () => {
  it('freezes input and reports progress only after acknowledgements', async () => {
    const input = [1, 2, 3, 4, 5];
    const progress: Array<{ processed: number; status: string }> = [];
    const send = vi.fn(async (batch: number[]) => batch.join(','));
    const result = await runRosterBatches(input, 2, send, state => progress.push({ processed: state.processed, status: state.status }));

    input.splice(0, input.length);
    expect(send.mock.calls.map(([batch]) => batch)).toEqual([[1, 2], [3, 4], [5]]);
    expect(result).toMatchObject({ status: 'completed', processed: 5, total: 5, unsent: [] });
    expect(progress.map(item => item.processed)).toEqual([0, 2, 2, 4, 4, 5]);
    expect(progress.at(-1)?.status).toBe('completed');
  });

  it('keeps the rejected batch unconfirmed and does not replay it', async () => {
    const send = vi.fn().mockResolvedValueOnce('ok').mockRejectedValueOnce(new Error('network'));
    const result = await runRosterBatches(['a', 'b', 'c'], 2, send);

    expect(result.status).toBe('interrupted');
    expect(result.processed).toBe(2);
    expect(result.unconfirmed).toEqual(['c']);
    expect(result.unsent).toEqual([]);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
