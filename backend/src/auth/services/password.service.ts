import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument, UserStatus } from '../schemas/user.schema';
import { PasswordResetToken, PasswordResetTokenDocument } from '../schemas/password-reset-token.schema';
import { ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from '../dto/auth.dto';
import { MailService } from '../../core/mail/mail.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PasswordResetToken.name) private passwordResetTokenModel: Model<PasswordResetTokenDocument>,
    private mailService: MailService,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (!user) return { message: 'Password reset link sent' };

    await this.passwordResetTokenModel.deleteMany({ user_id: user._id });
    const token = uuidv4();
    await this.passwordResetTokenModel.create({
      user_id: user._id,
      token,
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    });

    // Tạm thời bỏ qua gửi mail nếu chưa cấu hình SMTP
    // await this.mailService.sendPasswordResetEmail(dto.email, token);

    console.log(`\n[DEV] Link reset mật khẩu cho ${dto.email}:`);
    console.log(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}\n`);

    return { message: 'Password reset link sent (Check server console)', userId: user._id };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.passwordResetTokenModel.findOne({ token: dto.token });
    if (!resetToken) throw new BadRequestException('Token không hợp lệ');

    if (new Date() > new Date(resetToken.expires_at)) {
      await this.passwordResetTokenModel.deleteOne({ _id: resetToken._id });
      throw new BadRequestException('Token đã hết hạn');
    }

    const password_hash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await this.userModel.updateOne(
      { _id: resetToken.user_id },
      { pw_hash: password_hash, failed_login_attempts: 0, status: UserStatus.ACTIVE, locked_until: null },
    );

    await this.passwordResetTokenModel.deleteOne({ _id: resetToken._id });
    return { userId: resetToken.user_id };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const passwordHash = user.pw_hash || (user as any).password_hash;
    const isOldPasswordValid = await bcrypt.compare(dto.old_password, passwordHash || '');
    if (!isOldPasswordValid) throw new BadRequestException('Mật khẩu cũ không đúng');

    user.pw_hash = await bcrypt.hash(dto.new_password, BCRYPT_ROUNDS);
    await user.save();
    return { userId: user._id };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
