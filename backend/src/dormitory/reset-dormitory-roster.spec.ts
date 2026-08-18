import { RESET_CONFIRMATION, assertDevelopmentTarget } from '../../scripts/reset-dormitory-roster';

describe('development roster reset guard', () => {
  const base = { NODE_ENV: 'development', DORMITORY_RESET_ENV: 'development', MONGO_URI: 'mongodb://localhost:27017/manager_point_dev', DORMITORY_RESET_CONFIRMATION: RESET_CONFIRMATION };

  it('accepts only a positively identified development target', () => {
    expect(assertDevelopmentTarget(base)).toEqual({ host: 'localhost', database: 'manager_point_dev' });
  });

  it.each([
    { NODE_ENV: 'production' },
    { DORMITORY_RESET_ENV: 'staging' },
    { MONGO_URI: 'mongodb://localhost:27017/manager_point' },
    { DORMITORY_RESET_CONFIRMATION: 'RESET' },
  ])('rejects unsafe target overrides', (override) => {
    expect(() => assertDevelopmentTarget({ ...base, ...override })).toThrow();
  });
});
