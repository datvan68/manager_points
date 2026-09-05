import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReconcileRosterDto } from './reconcile-roster.dto';

describe('ReconcileRosterDto', () => {
  const errorsFor = async (payload: Record<string, unknown>) =>
    validate(plainToInstance(ReconcileRosterDto, payload));

  it('accepts an empty semester-independent payload', async () => {
    expect(await errorsFor({})).toHaveLength(0);
  });

  it('accepts a valid limit and cursor without requiring semester_id', async () => {
    expect(
      await errorsFor({
        after_id: '507f1f77bcf86cd799439011',
        limit: 100,
      }),
    ).toHaveLength(0);
  });

  it.each([
    ['invalid cursor', { after_id: 'not-an-object-id' }],
    ['limit below 1', { limit: 0 }],
    ['limit above 100', { limit: 101 }],
  ])('rejects %s', async (_label, payload) => {
    expect(await errorsFor(payload)).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: expect.any(String) })]),
    );
  });
});
