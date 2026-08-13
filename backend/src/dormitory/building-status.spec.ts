import { planBuildingStatusMigration } from '../../scripts/migrate-dormitory-building-status';

describe('building status contract', () => {
  it('reports only the approved values and maps Active', () => {
    expect(planBuildingStatusMigration([{ _id: '1', status: 'Active' }, { _id: '2', status: 'Trống' }])).toMatchObject({ canExecute: true, counts: { Active: 1, 'Trống': 1 } });
  });
  it('blocks unapproved legacy values without coercion', () => {
    expect(planBuildingStatusMigration([{ _id: '1', status: 'Inactive' }, { _id: '2', status: 'Maintenance' }])).toMatchObject({ canExecute: false, unapproved: ['Inactive', 'Maintenance'] });
  });
});
