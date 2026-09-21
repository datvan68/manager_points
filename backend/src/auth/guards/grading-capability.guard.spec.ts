import { ExecutionContext } from '@nestjs/common';
import { checkGradingCapability } from './grading-capability.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('grading capability guard', () => {
  beforeEach(() => {
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  const context = (user: any) => ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as ExecutionContext;

  it('allows a custom grader only with page and grade permissions', async () => {
    const Guard = checkGradingCapability('grade');
    const guard = new Guard() as any;

    await expect(guard.canActivate(context({
      roleName: 'Custom',
      permissions: ['GRADING_PAGE', 'GRADING_SCORE_GRADE'],
    }))).resolves.toBe(true);
  });

  it('does not let a grader approve or a page-only role grade', async () => {
    const Guard = checkGradingCapability('approve');
    const guard = new Guard() as any;

    await expect(guard.canActivate(context({
      roleName: 'Custom Grader',
      permissions: ['GRADING_PAGE', 'GRADING_SCORE_GRADE'],
    }))).rejects.toMatchObject({ response: { requiredCapability: 'approve' } });
    await expect(guard.canActivate(context({
      roleName: 'Page Only',
      permissions: ['GRADING_PAGE'],
    }))).rejects.toMatchObject({ response: { requiredCapability: 'approve' } });
  });

  it('denies evaluation-detail reads to page-only or unrelated authenticated roles', async () => {
    const Guard = checkGradingCapability('read');
    const guard = new Guard() as any;

    await expect(guard.canActivate(context({
      roleName: 'Page Only',
      permissions: ['GRADING_PAGE'],
    }))).rejects.toMatchObject({ response: { requiredCapability: 'read' } });
    await expect(guard.canActivate(context({
      roleName: 'Unrelated',
      permissions: ['STUDENT_READ'],
    }))).rejects.toMatchObject({ response: { requiredCapability: 'read' } });
  });
});
