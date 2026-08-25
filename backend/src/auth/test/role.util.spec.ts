import { getEffectivePermissions } from '../utils/role.util';

describe('getEffectivePermissions', () => {
  it('returns the deduplicated union of assigned roles', () => {
    const permissions = getEffectivePermissions({
      role: { _id: 'primary', permissions: ['CLASS_READ', 'CLASS_UPDATE'] },
      roles: [
        { _id: 'primary', permissions: ['CLASS_READ', 'CLASS_UPDATE'] },
        { _id: 'secondary', permissions: ['CLASS_UPDATE', 'CLASS_DELETE'] },
      ],
    });

    expect(permissions).toEqual(['CLASS_READ', 'CLASS_UPDATE', 'CLASS_DELETE']);
  });

  it('does not infer CRUD permissions from a page or view permission', () => {
    expect(
      getEffectivePermissions({
        roles: [{ _id: 'role-1', permissions: ['STUDENT_PAGE', 'CLASS_READ'] }],
      }),
    ).toEqual(['STUDENT_PAGE', 'CLASS_READ']);
  });
});
