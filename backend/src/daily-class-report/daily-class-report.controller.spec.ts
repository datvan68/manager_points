import { DailyClassReportController } from './daily-class-report.controller';

describe('DailyClassReportController', () => {
  const service = {
    create: jest.fn(),
    importClassRecords: jest.fn(),
    findAll: jest.fn(),
    findDeleted: jest.fn(),
    findOne: jest.fn(),
    findByClassId: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
    forceRemove: jest.fn(),
    bulkRemove: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('passes requester context to class-report reads', async () => {
    const controller = new DailyClassReportController(service as any);
    service.findAll.mockResolvedValue([]);
    service.findOne.mockResolvedValue(null);
    const requester = { userId: 'user-1', permissions: ['READ_CLASS_RECORD'] };

    await controller.findAll({ user: requester }, '2', '10', 'class-1');
    await controller.findOne('report-1', { user: requester });

    expect(service.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10, classId: 'class-1' }),
      requester,
    );
    expect(service.findOne).toHaveBeenCalledWith('report-1', requester);
  });

  it('uses the matching permission operation for writes', async () => {
    const controller = new DailyClassReportController(service as any);
    const requester = { userId: 'user-1' };
    const dto = {} as any;

    await controller.create(dto, { user: requester });
    await controller.update('report-1', dto, { user: requester });
    await controller.remove('report-1', { user: requester });
    await controller.restore('report-1', { user: requester });
    await controller.forceRemove('report-1', { user: requester });
    await controller.bulkDelete({ ids: ['report-1'] }, { user: requester });

    expect(service.create).toHaveBeenCalledWith(dto, requester);
    expect(service.update).toHaveBeenCalledWith('report-1', dto, requester);
    expect(service.remove).toHaveBeenCalledWith('report-1', requester);
    expect(service.restore).toHaveBeenCalledWith('report-1', requester);
    expect(service.forceRemove).toHaveBeenCalledWith('report-1', requester);
    expect(service.bulkRemove).toHaveBeenCalledWith(['report-1'], requester);
  });
});
