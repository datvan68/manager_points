import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, UserDocument, UserStatus } from '../schemas/user.schema';
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from '../schemas/password-reset-token.schema';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  PasswordResetRequestDto,
  PasswordResetResendDto,
  PasswordResetVerifyDto,
  PasswordResetCompleteDto,
} from '../dto/auth.dto';
import { MailService } from '../../core/mail/mail.service';
import { TokenService } from './token.service';
import { ConfigService } from '@nestjs/config';
import { OtpUtil } from '../utils/otp.util';
import {
  PasswordResetRequest,
  PasswordResetRequestDocument,
} from '../schemas/password-reset-request.schema';

const BCRYPT_ROUNDS = 12;

interface RateLimitInfo {
  attempts: number;
  blockedUntil: number;
}

@Injectable()
export class PasswordService {
  private forgotPasswordRateLimit = new Map<string, RateLimitInfo>();

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PasswordResetToken.name)
    private passwordResetTokenModel: Model<PasswordResetTokenDocument>,
    @InjectModel(PasswordResetRequest.name)
    private passwordResetRequestModel: Model<PasswordResetRequestDocument>,
    private mailService: MailService,
    private tokenService: TokenService,
    private configService: ConfigService,
  ) {}

  private checkRateLimit(
    key: string,
    maxAttempts = 5,
    durationMs = 15 * 60 * 1000,
  ): boolean {
    const now = Date.now();
    const limit = this.forgotPasswordRateLimit.get(key);

    if (!limit) {
      this.forgotPasswordRateLimit.set(key, {
        attempts: 1,
        blockedUntil: now + durationMs,
      });
      return true;
    }

    if (now > limit.blockedUntil) {
      this.forgotPasswordRateLimit.set(key, {
        attempts: 1,
        blockedUntil: now + durationMs,
      });
      return true;
    }

    if (limit.attempts >= maxAttempts) {
      return false;
    }

    limit.attempts += 1;
    this.forgotPasswordRateLimit.set(key, limit);
    return true;
  }

  async forgotPassword(dto: ForgotPasswordDto, ip: string) {
    const inputKey = dto.email.trim().toLowerCase();
    const isStudentCode = /^\d+$/.test(inputKey);
    const email = isStudentCode ? `${inputKey}@school.edu.vn` : inputKey;
    const emailHash = crypto.createHash('sha256').update(email).digest('hex');

    // Check Rate limits (IP and Email Hash)
    const ipKey = `ip:${ip}`;
    const emailKey = `email:${emailHash}`;

    if (!this.checkRateLimit(ipKey) || !this.checkRateLimit(emailKey)) {
      throw new BadRequestException(
        'Bạn đã gửi yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.',
      );
    }

    const user = await this.userModel.findOne({ email });
    const neutralMessage =
      'Nếu email tồn tại, hệ thống đã gửi liên kết đặt lại mật khẩu.';

    if (!user) {
      return { message: neutralMessage };
    }

    await this.passwordResetTokenModel.deleteMany({ user_id: user._id });

    // Generate secure token with high entropy
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    await this.passwordResetTokenModel.create({
      user_id: user._id,
      token: hashedToken,
      expires_at: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
    });

    // Send email asynchronously to avoid timing attack / error leaks
    this.mailService.sendPasswordResetEmail(user.email, token).catch(() => {
      console.error(
        `❌ Mail delivery error for reset password request. Email Hash: ${emailHash}`,
      );
    });

    return {
      message: neutralMessage,
      userId: user._id,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');
    const resetToken = await this.passwordResetTokenModel.findOne({
      token: hashedToken,
    });
    if (!resetToken)
      throw new BadRequestException('Token không hợp lệ hoặc đã được sử dụng');

    if (new Date() > new Date(resetToken.expires_at)) {
      await this.passwordResetTokenModel.deleteOne({ _id: resetToken._id });
      throw new BadRequestException('Token đã hết hạn');
    }

    // Check if user still exists
    const user = await this.userModel.findById(resetToken.user_id);
    if (!user) {
      await this.passwordResetTokenModel.deleteOne({ _id: resetToken._id });
      throw new BadRequestException(
        'Token không hợp lệ hoặc người dùng không còn tồn tại',
      );
    }

    const password_hash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await this.userModel.updateOne(
      { _id: resetToken.user_id },
      {
        pw_hash: password_hash,
        failed_login_attempts: 0,
        status: UserStatus.ACTIVE,
        locked_until: null,
      },
    );

    // Revoke all refresh tokens for security
    await this.tokenService.revokeAllUserTokens(resetToken.user_id.toString());
    await this.passwordResetTokenModel.deleteOne({ _id: resetToken._id });
    return { userId: resetToken.user_id };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('Người dùng không tồn tại');

    const passwordHash = user.pw_hash || (user as any).password_hash;
    const isOldPasswordValid = await bcrypt.compare(
      dto.old_password,
      passwordHash || '',
    );
    if (!isOldPasswordValid)
      throw new BadRequestException('Mật khẩu cũ không đúng');

    const isOldAndNewSame = await bcrypt.compare(
      dto.new_password,
      passwordHash || '',
    );
    if (isOldAndNewSame) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng với mật khẩu cũ',
      );
    }

    user.pw_hash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await user.save();

    // Revoke all refresh tokens for security
    await this.tokenService.revokeAllUserTokens(userId);
    return { userId: user._id };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // --- OTP Flow Methods ---

  async requestPasswordReset(dto: PasswordResetRequestDto, ip: string) {
    const inputKey = dto.email.trim().toLowerCase();
    const isStudentCode = /^\d+$/.test(inputKey);
    const email = isStudentCode ? `${inputKey}@school.edu.vn` : inputKey;
    const emailHash = crypto.createHash('sha256').update(email).digest('hex');
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    const maxIpLimits =
      this.configService.get<number>('PASSWORD_RESET_IP_LIMIT') || 10;
    const maxEmailLimits =
      this.configService.get<number>('PASSWORD_RESET_EMAIL_LIMIT') || 3;

    if (
      !this.checkRateLimit(`ip:${ipHash}`, maxIpLimits) ||
      !this.checkRateLimit(`email:${emailHash}`, maxEmailLimits)
    ) {
      throw new BadRequestException(
        'Bạn đã gửi yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.',
      );
    }

    const neutralMessage = 'Nếu email tồn tại, hệ thống đã gửi OTP xác nhận.';

    const user = await this.userModel.findOne({ email });
    if (!user) {
      return {
        message: neutralMessage,
        requestId: new Types.ObjectId().toString(),
        resendAfter: 60,
      };
    }

    const otp = OtpUtil.generateOtp();
    const otpSecret =
      this.configService.get<string>('OTP_SECRET') || 'default_otp_secret';

    // Invalidate old active requests
    await this.passwordResetRequestModel.updateMany(
      { user_id: user._id, invalidated_at: null, used_at: null },
      { $set: { invalidated_at: new Date() } },
    );

    const reqDoc = new this.passwordResetRequestModel({
      user_id: user._id,
      normalized_email: email,
      otp_attempts: 0,
      max_otp_attempts: this.configService.get<number>('OTP_MAX_ATTEMPTS') || 5,
      resend_count: 0,
      requester_ip_hash: ipHash,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    });

    const savedReq = await reqDoc.save();
    const requestId = savedReq._id.toString();

    const otpHash = OtpUtil.hashOtp(requestId, otp, otpSecret);
    savedReq.otp_hash = otpHash;
    const expiresInSeconds =
      this.configService.get<number>('OTP_EXPIRES_IN_SECONDS') || 300;
    const cooldownSeconds =
      this.configService.get<number>(
        'PASSWORD_RESET_RESEND_COOLDOWN_SECONDS',
      ) || 60;

    savedReq.otp_expires_at = new Date(Date.now() + expiresInSeconds * 1000);
    savedReq.resend_available_at = new Date(
      Date.now() + cooldownSeconds * 1000,
    );
    await savedReq.save();

    this.mailService.sendPasswordResetOtpEmail(user.email, otp).catch(() => {
      console.error(
        `❌ Mail delivery error for reset password request. Email Hash: ${emailHash}`,
      );
    });

    return {
      message: neutralMessage,
      requestId,
      resendAfter: cooldownSeconds,
    };
  }

  async resendPasswordResetOtp(dto: PasswordResetResendDto) {
    const reqDoc = await this.passwordResetRequestModel.findById(dto.requestId);
    if (
      !reqDoc ||
      reqDoc.invalidated_at ||
      reqDoc.used_at ||
      reqDoc.verified_at
    ) {
      throw new BadRequestException('Yêu cầu không hợp lệ hoặc đã hết hạn.');
    }

    const maxResends =
      this.configService.get<number>('PASSWORD_RESET_MAX_RESENDS') || 3;
    if (reqDoc.resend_count >= maxResends) {
      throw new BadRequestException('Đã vượt quá số lần gửi lại OTP.');
    }

    if (reqDoc.resend_available_at && new Date() < reqDoc.resend_available_at) {
      throw new BadRequestException('Vui lòng đợi trước khi gửi lại OTP.');
    }

    const otp = OtpUtil.generateOtp();
    const otpSecret =
      this.configService.get<string>('OTP_SECRET') || 'default_otp_secret';
    const otpHash = OtpUtil.hashOtp(reqDoc._id.toString(), otp, otpSecret);

    const expiresInSeconds =
      this.configService.get<number>('OTP_EXPIRES_IN_SECONDS') || 300;
    const cooldownSeconds =
      this.configService.get<number>(
        'PASSWORD_RESET_RESEND_COOLDOWN_SECONDS',
      ) || 60;

    reqDoc.otp_hash = otpHash;
    reqDoc.otp_expires_at = new Date(Date.now() + expiresInSeconds * 1000);
    reqDoc.resend_available_at = new Date(Date.now() + cooldownSeconds * 1000);
    reqDoc.resend_count += 1;
    await reqDoc.save();

    const user = await this.userModel.findById(reqDoc.user_id);
    if (user) {
      this.mailService.sendPasswordResetOtpEmail(user.email, otp).catch(() => {
        // ignore
      });
    }

    return { message: 'Đã gửi lại OTP', resendAfter: cooldownSeconds };
  }

  async verifyPasswordResetOtp(dto: PasswordResetVerifyDto) {
    const reqDoc = await this.passwordResetRequestModel.findById(dto.requestId);
    if (!reqDoc || reqDoc.invalidated_at || reqDoc.used_at) {
      throw new BadRequestException('Yêu cầu không hợp lệ hoặc đã hết hạn.');
    }

    if (reqDoc.verified_at) {
      throw new BadRequestException('OTP đã được xác minh.');
    }

    if (!reqDoc.otp_expires_at || new Date() > reqDoc.otp_expires_at) {
      throw new BadRequestException('OTP đã hết hạn.');
    }

    if (reqDoc.otp_attempts >= reqDoc.max_otp_attempts) {
      reqDoc.invalidated_at = new Date();
      await reqDoc.save();
      throw new BadRequestException('Bạn đã nhập sai OTP quá nhiều lần.');
    }

    const otpSecret =
      this.configService.get<string>('OTP_SECRET') || 'default_otp_secret';
    const expectedHash = OtpUtil.hashOtp(
      reqDoc._id.toString(),
      dto.code,
      otpSecret,
    );

    if (
      !reqDoc.otp_hash ||
      !OtpUtil.timingSafeEqual(reqDoc.otp_hash, expectedHash)
    ) {
      reqDoc.otp_attempts += 1;
      await reqDoc.save();
      throw new BadRequestException('Mã OTP không chính xác.');
    }

    // Success
    reqDoc.verified_at = new Date();
    const resetToken = OtpUtil.generateResetToken();
    const resetTokenHash = OtpUtil.hashResetToken(resetToken);
    reqDoc.reset_token_hash = resetTokenHash;
    const tokenExpires =
      this.configService.get<number>(
        'PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS',
      ) || 600;
    reqDoc.reset_token_expires_at = new Date(Date.now() + tokenExpires * 1000);
    reqDoc.otp_hash = null; // Clean up
    await reqDoc.save();

    return { resetToken };
  }

  async completePasswordReset(dto: PasswordResetCompleteDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp.');
    }

    const resetTokenHash = OtpUtil.hashResetToken(dto.resetToken);
    const reqDoc = await this.passwordResetRequestModel.findOne({
      reset_token_hash: resetTokenHash,
    });

    if (!reqDoc || reqDoc.invalidated_at || reqDoc.used_at) {
      throw new BadRequestException('Token không hợp lệ hoặc đã được sử dụng.');
    }

    if (
      !reqDoc.reset_token_expires_at ||
      new Date() > reqDoc.reset_token_expires_at
    ) {
      throw new BadRequestException('Token đã hết hạn.');
    }

    const user = await this.userModel.findById(reqDoc.user_id);
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại.');
    }

    const password_hash = await this.hashPassword(dto.newPassword);
    await this.userModel.updateOne(
      { _id: user._id },
      {
        pw_hash: password_hash,
        failed_login_attempts: 0,
        status: UserStatus.ACTIVE,
        locked_until: null,
      },
    );

    reqDoc.used_at = new Date();
    reqDoc.reset_token_hash = null;
    await reqDoc.save();

    await this.passwordResetRequestModel.updateMany(
      {
        user_id: user._id,
        invalidated_at: null,
        used_at: null,
        _id: { $ne: reqDoc._id },
      },
      { $set: { invalidated_at: new Date() } },
    );

    await this.tokenService.revokeAllUserTokens(user._id.toString());

    return { message: 'Đặt lại mật khẩu thành công.' };
  }
}
