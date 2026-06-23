jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
import { Test, TestingModule } from '@nestjs/testing';
import { PasswordService } from '../services/password.service';
import { getModelToken } from '@nestjs/mongoose';
import { MailService } from '../../core/mail/mail.service';
import { TokenService } from '../services/token.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OtpUtil } from '../utils/otp.util';

describe('PasswordService - OTP Flow', () => {
  let service: PasswordService;
  
  const mockUserModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
  };

  const mockPasswordResetTokenModel = {
    deleteMany: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    deleteOne: jest.fn(),
  };

  const mockPasswordResetRequestModel = {
    updateMany: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
  };

  const mockMailService = {
    sendPasswordResetOtpEmail: jest.fn().mockResolvedValue(true),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  };

  const mockTokenService = {
    revokeAllUserTokens: jest.fn().mockResolvedValue(true),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        OTP_SECRET: 'test-secret',
        OTP_EXPIRES_IN_SECONDS: 300,
        OTP_MAX_ATTEMPTS: 5,
        PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS: 600,
        PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: 60,
        PASSWORD_RESET_MAX_RESENDS: 3,
        PASSWORD_RESET_IP_LIMIT: 10,
        PASSWORD_RESET_EMAIL_LIMIT: 3,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: getModelToken('PasswordResetToken'), useValue: mockPasswordResetTokenModel },
        { provide: getModelToken('PasswordResetRequest'), useValue: mockPasswordResetRequestModel },
        { provide: MailService, useValue: mockMailService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
    jest.clearAllMocks();
  });

  describe('requestPasswordReset (OTP)', () => {
    it('should return neutral response for existing and non-existing emails', async () => {
      // Setup Mocking for Save
      const mockSave = jest.fn().mockImplementation(function() {
        if (!this._id) this._id = new Types.ObjectId();
        return Promise.resolve(this);
      });
      const MockRequestDoc: any = function (data: any) {
        Object.assign(this, data);
        this.save = mockSave;
      };
      MockRequestDoc.updateMany = mockPasswordResetRequestModel.updateMany;
      MockRequestDoc.findOne = mockPasswordResetRequestModel.findOne;
      MockRequestDoc.findById = mockPasswordResetRequestModel.findById;
      mockPasswordResetRequestModel.updateMany.mockResolvedValue({ modifiedCount: 0 });
      (service as any).passwordResetRequestModel = MockRequestDoc;

      mockUserModel.findOne.mockResolvedValue(null);
      const resNonExist = await service.requestPasswordReset({ email: 'nonexist@example.com' }, '127.0.0.1');
      expect(resNonExist.message).toBe('Nếu email tồn tại, hệ thống đã gửi OTP xác nhận.');

      mockUserModel.findOne.mockResolvedValue({ _id: new Types.ObjectId(), email: 'exist@example.com' });
      const resExist = await service.requestPasswordReset({ email: 'exist@example.com' }, '127.0.0.1');
      expect(resExist.message).toBe('Nếu email tồn tại, hệ thống đã gửi OTP xác nhận.');
      expect(resExist.resendAfter).toBe(60);
      expect(mockMailService.sendPasswordResetOtpEmail).toHaveBeenCalled();
    });

    it('should normalize email with uppercase and spaces', async () => {
      const mockSave = jest.fn().mockImplementation(function() {
        if (!this._id) this._id = new Types.ObjectId();
        return Promise.resolve(this);
      });
      const MockRequestDoc: any = function(data: any) {
        Object.assign(this, data);
        this.save = mockSave;
      };
      MockRequestDoc.updateMany = mockPasswordResetRequestModel.updateMany;
      MockRequestDoc.findOne = mockPasswordResetRequestModel.findOne;
      MockRequestDoc.findById = mockPasswordResetRequestModel.findById;
      (service as any).passwordResetRequestModel = MockRequestDoc;
      mockUserModel.findOne.mockResolvedValue({ _id: new Types.ObjectId(), email: 'TEST@example.com' });
      
      await service.requestPasswordReset({ email: '  TEST@Example.com  ' }, '127.0.0.1');
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should map student code to school email', async () => {
      const mockSave = jest.fn().mockImplementation(function() {
        if (!this._id) this._id = new Types.ObjectId();
        return Promise.resolve(this);
      });
      const MockRequestDoc: any = function(data: any) {
        Object.assign(this, data);
        this.save = mockSave;
      };
      MockRequestDoc.updateMany = mockPasswordResetRequestModel.updateMany;
      MockRequestDoc.findOne = mockPasswordResetRequestModel.findOne;
      MockRequestDoc.findById = mockPasswordResetRequestModel.findById;
      (service as any).passwordResetRequestModel = MockRequestDoc;
      mockUserModel.findOne.mockResolvedValue({ _id: new Types.ObjectId(), email: '123456@school.edu.vn' });
      
      await service.requestPasswordReset({ email: '123456' }, '127.0.0.1');
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: '123456@school.edu.vn' });
    });

    it('should block if rate limit is exceeded', async () => {
      // Mocking limits
      const ip = '192.168.1.1';
      const email = 'spam@example.com';
      for (let i = 0; i < 10; i++) {
        // Will pass 10 times for IP
        await service.requestPasswordReset({ email: `spam${i}@example.com` }, ip).catch(() => {});
      }
      
      await expect(service.requestPasswordReset({ email }, ip)).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendPasswordResetOtp', () => {
    it('should block resend if cooldown not expired', async () => {
      mockPasswordResetRequestModel.findById.mockResolvedValue({
        _id: new Types.ObjectId(),
        invalidated_at: null,
        used_at: null,
        verified_at: null,
        resend_count: 0,
        resend_available_at: new Date(Date.now() + 60 * 1000) // Cooldown active
      });

      await expect(service.resendPasswordResetOtp({ requestId: new Types.ObjectId().toString() }))
        .rejects.toThrow(BadRequestException);
    });

    it('should create new OTP and invalidate old when resend succeeds', async () => {
      const reqDoc = {
        _id: new Types.ObjectId(),
        invalidated_at: null,
        used_at: null,
        verified_at: null,
        resend_count: 0,
        resend_available_at: new Date(Date.now() - 1000), // Cooldown expired
        user_id: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true)
      };
      mockPasswordResetRequestModel.findById.mockResolvedValue(reqDoc);
      mockUserModel.findById.mockResolvedValue({ email: 'test@example.com' });

      const res = await service.resendPasswordResetOtp({ requestId: reqDoc._id.toString() });
      expect(res.message).toBe('Đã gửi lại OTP');
      expect(reqDoc.resend_count).toBe(1);
      expect(reqDoc.save).toHaveBeenCalled();
      expect(mockMailService.sendPasswordResetOtpEmail).toHaveBeenCalled();
    });
  });

  describe('verifyPasswordResetOtp', () => {
    it('should verify correct OTP and return reset token', async () => {
      const requestId = new Types.ObjectId().toString();
      const code = '123456';
      const expectedHash = OtpUtil.hashOtp(requestId, code, 'test-secret');

      const reqDoc = {
        _id: requestId,
        invalidated_at: null,
        used_at: null,
        verified_at: null,
        otp_expires_at: new Date(Date.now() + 10000),
        otp_attempts: 0,
        max_otp_attempts: 5,
        otp_hash: expectedHash,
        save: jest.fn().mockResolvedValue(true)
      };
      mockPasswordResetRequestModel.findById.mockResolvedValue(reqDoc);

      const res = await service.verifyPasswordResetOtp({ requestId, code });
      expect(res.resetToken).toBeDefined();
      expect(reqDoc.verified_at).toBeDefined();
      expect(reqDoc.otp_hash).toBeNull();
      expect(reqDoc.reset_token_hash).toBeDefined();
    });

    it('should block if OTP is incorrect and increment attempts', async () => {
      const requestId = new Types.ObjectId().toString();
      const expectedHash = OtpUtil.hashOtp(requestId, '123456', 'test-secret');

      const reqDoc = {
        _id: requestId,
        invalidated_at: null,
        used_at: null,
        verified_at: null,
        otp_expires_at: new Date(Date.now() + 10000),
        otp_attempts: 0,
        max_otp_attempts: 5,
        otp_hash: expectedHash,
        save: jest.fn().mockResolvedValue(true)
      };
      mockPasswordResetRequestModel.findById.mockResolvedValue(reqDoc);

      await expect(service.verifyPasswordResetOtp({ requestId, code: '000000' }))
        .rejects.toThrow(BadRequestException);
      expect(reqDoc.otp_attempts).toBe(1);
    });

    it('should block and invalidate after 5 failed attempts', async () => {
      const requestId = new Types.ObjectId().toString();
      const expectedHash = OtpUtil.hashOtp(requestId, '123456', 'test-secret');

      const reqDoc = {
        _id: requestId,
        invalidated_at: null,
        used_at: null,
        verified_at: null,
        otp_expires_at: new Date(Date.now() + 10000),
        otp_attempts: 5,
        max_otp_attempts: 5,
        otp_hash: expectedHash,
        save: jest.fn().mockResolvedValue(true)
      };
      mockPasswordResetRequestModel.findById.mockResolvedValue(reqDoc);

      await expect(service.verifyPasswordResetOtp({ requestId, code: '000000' }))
        .rejects.toThrow('Bạn đã nhập sai OTP quá nhiều lần.');
      expect(reqDoc.invalidated_at).toBeDefined();
    });

    it('should block expired OTP', async () => {
      const reqDoc = {
        _id: new Types.ObjectId(),
        invalidated_at: null,
        used_at: null,
        verified_at: null,
        otp_expires_at: new Date(Date.now() - 1000), // Expired
      };
      mockPasswordResetRequestModel.findById.mockResolvedValue(reqDoc);

      await expect(service.verifyPasswordResetOtp({ requestId: reqDoc._id.toString(), code: '123456' }))
        .rejects.toThrow('OTP đã hết hạn.');
    });
  });

  describe('completePasswordReset', () => {
    it('should reject if newPassword and confirmPassword do not match', async () => {
      await expect(service.completePasswordReset({
        resetToken: 'some-token',
        newPassword: 'Password1!',
        confirmPassword: 'Password2!'
      })).rejects.toThrow('Mật khẩu xác nhận không khớp.');
    });

    it('should reject if token is invalid or used', async () => {
      mockPasswordResetRequestModel.findOne.mockResolvedValue(null);
      await expect(service.completePasswordReset({
        resetToken: 'some-token',
        newPassword: 'Password1!',
        confirmPassword: 'Password1!'
      })).rejects.toThrow('Token không hợp lệ hoặc đã được sử dụng.');
    });

    it('should successfully update password, revoke tokens and mark as used', async () => {
      const user_id = new Types.ObjectId();
      const reqDoc = {
        _id: new Types.ObjectId(),
        user_id,
        invalidated_at: null,
        used_at: null,
        reset_token_expires_at: new Date(Date.now() + 10000),
        save: jest.fn().mockResolvedValue(true)
      };
      mockPasswordResetRequestModel.findOne.mockResolvedValue(reqDoc);
      mockUserModel.findById.mockResolvedValue({ _id: user_id });

      const res = await service.completePasswordReset({
        resetToken: 'valid-token',
        newPassword: 'Password1!',
        confirmPassword: 'Password1!'
      });

      expect(res.message).toBe('Đặt lại mật khẩu thành công.');
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: user_id },
        expect.objectContaining({ failed_login_attempts: 0 })
      );
      expect(reqDoc.used_at).toBeDefined();
      expect(reqDoc.reset_token_hash).toBeNull();
      expect(mockTokenService.revokeAllUserTokens).toHaveBeenCalledWith(user_id.toString());
      expect(mockPasswordResetRequestModel.updateMany).toHaveBeenCalledWith(
        { user_id, invalidated_at: null, used_at: null, _id: { $ne: reqDoc._id } },
        { $set: { invalidated_at: expect.any(Date) } }
      );
    });

    it('should block if complete is called without verify (token not found)', async () => {
      mockPasswordResetRequestModel.findOne.mockResolvedValue(null);
      await expect(service.completePasswordReset({
        resetToken: 'invalid-token',
        newPassword: 'Password1!',
        confirmPassword: 'Password1!'
      })).rejects.toThrow('Token không hợp lệ hoặc đã được sử dụng.');
    });
  });
});
