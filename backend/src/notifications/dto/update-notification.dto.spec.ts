import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateNotificationDto } from './update-notification.dto';

describe('UpdateNotificationDto', () => {
  it('should allow valid targetRole values', async () => {
    const dto = plainToInstance(UpdateNotificationDto, {
      title: 'Valid Title',
      targetRole: 'student',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject invalid targetRole values', async () => {
    const dto = plainToInstance(UpdateNotificationDto, {
      title: 'Valid Title',
      targetRole: 'invalid-role',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('targetRole');
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should allow targetRole to be omitted', async () => {
    const dto = plainToInstance(UpdateNotificationDto, {
      title: 'Valid Title',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});
