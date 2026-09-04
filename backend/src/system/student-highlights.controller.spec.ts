import { SystemController } from './system.controller';

describe('SystemController student highlights', () => {
  it('passes the authenticated requester and validated query to the service', async () => {
    const service = { getStudentHighlights: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, hasMore: false, semesterId: null }) } as any;
    const controller = new SystemController(service);
    const query = { category: 'discipline', page: 1, limit: 20 } as any;
    const requester = { userId: 'user-1', roleName: 'Teacher' } as any;
    await expect(controller.getStudentHighlights(query, { user: requester } as any)).resolves.toEqual(expect.objectContaining({ total: 0, hasMore: false }));
    expect(service.getStudentHighlights).toHaveBeenCalledWith(requester, query);
  });
});
