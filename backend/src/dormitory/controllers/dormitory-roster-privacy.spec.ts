jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
import { DormitoryQrController } from './dormitory-qr.controller';

describe('public roster privacy boundary', () => {
  it('does not return student PII or existence when a public code is submitted', async () => {
    const rosterService: any = {
      createPublic: jest.fn().mockResolvedValue({ roster_entry_code: 'DK-1', student_id: '507f1f77bcf86cd799439011', full_name: 'Nguyễn Văn A', date_of_birth: '2004-01-02', gender: 'Male', student_code: 'SV001' }),
    };
    const controller = new DormitoryQrController({ findByQrId: jest.fn() } as any, {} as any, rosterService, {} as any);
    const result = await controller.publicRegister({ full_name: 'Nguyễn Văn A', phone_number: '0912345678', student_code: 'SV001', date_of_birth: '2004-01-02', gender: 'Male', room_type: 'Thường' } as any);
    expect(result).toEqual({ success: true, message: 'Đăng ký thành công!', roster_entry_code: 'DK-1' });
    expect(result).not.toHaveProperty('student_id');
    expect(result).not.toHaveProperty('full_name');
    expect(result).not.toHaveProperty('student_code');
  });
});
