import { EvaluationPeriodsService } from './evaluation-periods.service';

describe('EvaluationPeriodsService', () => {
  it('upserts one history snapshot when closing an already closed period', async () => {
    const period = { _id: '507f1f77bcf86cd799439011', status: 'closed', save: jest.fn().mockResolvedValue({}) } as any;
    const periodModel = { findById: jest.fn().mockResolvedValue(period) } as any;
    const lockedSummary = {
      student_id: '507f1f77bcf86cd799439012', semester_id: '507f1f77bcf86cd799439013', period_id: '507f1f77bcf86cd799439011',
      total_score: 8, grading: 'Tốt', rank_tier: 'gold', rank_label: 'Gold', rank_locked_at: null,
    };
    const query = { lean: () => ({ exec: jest.fn().mockResolvedValue([lockedSummary]) }) };
    const summaryPointModel = { find: jest.fn().mockReturnValueOnce(query).mockReturnValueOnce({ select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue([{ student_id: '507f1f77bcf86cd799439012' }]) }) }) }) } as any;
    const updateOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) });
    const studentModel = { updateOne } as any;
    const service = new EvaluationPeriodsService(periodModel, summaryPointModel, studentModel);

    await service.update('507f1f77bcf86cd799439011', { status: 'closed' });

    expect(updateOne).toHaveBeenCalledTimes(1);
    expect(updateOne.mock.calls[0][1][0]).toEqual(expect.objectContaining({ $set: expect.objectContaining({ training_point_history: expect.any(Object) }) }));
  });
});
