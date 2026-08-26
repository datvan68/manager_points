import { SemestersService } from './semesters.service';

describe('SemestersService', () => {
  const session = { withTransaction: jest.fn(async (work) => work()), endSession: jest.fn() };

  function createModel() {
    const Model: any = jest.fn().mockImplementation((dto) => ({ ...dto, save: jest.fn().mockResolvedValue({ ...dto }) }));
    Model.db = { startSession: jest.fn().mockResolvedValue(session) };
    Model.updateMany = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });
    Model.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'b', status: 'active' }) });
    return Model;
  }

  beforeEach(() => jest.clearAllMocks());

  it('deactivates every other active semester before creating an active semester', async () => {
    const model = createModel();
    await new SemestersService(model).create({ semester_name: 'B', start_date: '2026-01-01', end_date: '2026-06-01', status: 'active' });

    expect(model.updateMany).toHaveBeenCalledWith({ status: 'active' }, { $set: { status: 'inactive' } }, { session });
  });

  it('treats an omitted create status as active because the schema has an active default', async () => {
    const model = createModel();
    await new SemestersService(model).create({ semester_name: 'B', start_date: '2026-01-01', end_date: '2026-06-01' });

    expect(model.updateMany).toHaveBeenCalledWith({ status: 'active' }, { $set: { status: 'inactive' } }, { session });
  });

  it('deactivates every other active semester before activating an existing semester', async () => {
    const model = createModel();
    await new SemestersService(model).update('b', { status: 'active' });

    expect(model.updateMany).toHaveBeenCalledWith({ _id: { $ne: 'b' }, status: 'active' }, { $set: { status: 'inactive' } }, { session });
  });
});
