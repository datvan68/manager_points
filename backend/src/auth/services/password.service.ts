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
} from '../dto/auth.dto';
import { MailService } from '../../core/mail/mail.service';
import { TokenService } from './token.service';

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
    private mailService: MailService,
    private tokenService: TokenService,
  ) {}

  private checkRateLimit(key: string, maxAttempts = 5, durationMs = 15 * 60 * 1000): boolean {
    const now = Date.now();
    const limit = this.forgotPasswordRateLimit.get(key);

    if (!limit) {
      this.forgotPasswordRateLimit.set(key, { attempts: 1, blockedUntil: now + durationMs });
      return true;
    }

    if (now > limit.blockedUntil) {
      this.forgotPasswordRateLimit.set(key, { attempts: 1, blockedUntil: now + durationMs });
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
      throw new BadRequestException('Bạn đã gửi yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.');
    }

    const user = await this.userModel.findOne({ email });
    const neutralMessage = 'Nếu email tồn tại, hệ thống đã gửi liên kết đặt lại mật khẩu.';

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
      console.error(`❌ Mail delivery error for reset password request. Email Hash: ${emailHash}`);
    });

    return {
      message: neutralMessage,
      userId: user._id,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hashedToken = crypto.createHash('sha256').update(dto.token).digest('hex');
    const resetToken = await this.passwordResetTokenModel.findOne({
      token: hashedToken,
    });
    if (!resetToken) throw new BadRequestException('Token không hợp lệ hoặc đã được sử dụng');

    if (new Date() > new Date(resetToken.expires_at)) {
      await this.passwordResetTokenModel.deleteOne({ _id: resetToken._id });
      throw new BadRequestException('Token đã hết hạn');
    }

    // Check if user still exists
    const user = await this.userModel.findById(resetToken.user_id);
    if (!user) {
      await this.passwordResetTokenModel.deleteOne({ _id: resetToken._id });
      throw new BadRequestException('Token không hợp lệ hoặc người dùng không còn tồn tại');
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
      throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu cũ');
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
}
