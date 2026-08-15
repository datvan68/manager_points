import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApplicantProfileDto } from './applicant-profile.dto';

describe('ApplicantProfileDto.citizen_id_issue_date', () => {
  const errorsFor = async (value: string) =>
    validate(plainToInstance(ApplicantProfileDto, { citizen_id_issue_date: value }));

  it('accepts a past date', async () => {
    expect(await errorsFor('2020-01-15')).toHaveLength(0);
  });

  it('accepts the current local calendar date', async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(await errorsFor(today)).toHaveLength(0);
  });

  it('rejects a future date', async () => {
    expect(await errorsFor('2999-12-31')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'citizen_id_issue_date',
          constraints: expect.objectContaining({ isNotFutureDate: expect.any(String) }),
        }),
      ]),
    );
  });

  it('rejects malformed or impossible dates', async () => {
    expect((await errorsFor('2024-02-30')).length).toBeGreaterThan(0);
    expect((await errorsFor('not-a-date')).length).toBeGreaterThan(0);
  });
});
