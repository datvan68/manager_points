import { collisionForDocument, operationPath, transformedIndexKey } from '../../scripts/migrate-dormitory-naming';
import { DORMITORY_FIELD_RENAMES } from '../../scripts/dormitory-field-map';

describe('dormitory naming migration', () => {
  it('detects top-level collisions before writes', () => {
    const buildingRename = DORMITORY_FIELD_RENAMES.find((item) => item.legacy === 'ma_toa_nha')!;
    expect(collisionForDocument({ ma_toa_nha: 'A', building_code: 'B' }, buildingRename)).toBe(true);
    expect(collisionForDocument({ ma_toa_nha: 'A' }, buildingRename)).toBe(false);
  });

  it('renames nested preference keys without changing the parent path', () => {
    const nested = DORMITORY_FIELD_RENAMES.find((item) => item.collection === 'registrations.preference' && item.legacy === 'loai_phong')!;
    expect(operationPath(nested)).toEqual({ from: 'preference.loai_phong', to: 'preference.room_type' });
    expect(operationPath(nested, true)).toEqual({ from: 'preference.room_type', to: 'preference.loai_phong' });
    expect(collisionForDocument({ preference: { loai_phong: 'Máy lạnh', room_type: 'Thường' } }, nested)).toBe(true);
  });

  it('transforms affected index keys while preserving relationship keys', () => {
    expect(transformedIndexKey('beds', { ma_giuong: 1, room_id: 1 })).toEqual({ bed_code: 1, room_id: 1 });
  });
});
