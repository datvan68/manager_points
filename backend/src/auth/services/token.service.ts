import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../schemas/refresh-token.schema';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class TokenService {
  constructor(
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async createRefreshToken(userId: Types.ObjectId, expirationDays: number, remember: boolean = false) {
    const token = uuidv4();
    await this.refreshTokenModel.create({
      user_id: userId,
      token,
      expires_at: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000),
      remember,
    });
    return token;
  }

  async refreshToken(token: string) {
    const storedToken = await this.refreshTokenModel.findOne({ token });
    if (!storedToken) {
      throw new UnauthorizedException('Phiên làm việc không tồn tại');
    }

    const user = await this.userModel.findById(storedToken.user_id).exec();
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Tài khoản đã bị khóa hoặc chưa kích hoạt');
    }

    if (storedToken.is_revoked) {
      const gracePeriodMs = 10000; // 10s grace period
      const timeSinceRevocation = Date.now() - new Date(storedToken.updatedAt).getTime();
      
      if (timeSinceRevocation < gracePeriodMs && storedToken.replaced_by) {
        const replacedToken = await this.refreshTokenModel.findOne({ token: storedToken.replaced_by });
        if (replacedToken && !replacedToken.is_revoked && new Date() <= new Date(replacedToken.expires_at)) {
          const payload = { user_id: replacedToken.user_id.toString() };
          const access_token = this.jwtService.sign(payload);
          return { 
            access_token, 
            refresh_token: replacedToken.token,
            expires_at: replacedToken.expires_at,
            remember: replacedToken.remember,
          };
        }
      }

      await this.revokeAllUserTokens(storedToken.user_id.toString());
      throw new UnauthorizedException(
        'Cảnh báo bảo mật: Token đã được sử dụng. Vui lòng đăng nhập lại.',
      );
    }

    if (new Date() > new Date(storedToken.expires_at)) {
      await this.refreshTokenModel.deleteOne({ _id: storedToken._id });
      throw new UnauthorizedException('Phiên làm việc đã hết hạn');
    }

    const payload = { user_id: storedToken.user_id.toString() };
    const access_token = this.jwtService.sign(payload);
    const new_refresh_token = uuidv4();

    storedToken.is_revoked = true;
    storedToken.replaced_by = new_refresh_token;
    await storedToken.save();

    await this.refreshTokenModel.create({
      user_id: storedToken.user_id,
      token: new_refresh_token,
      expires_at: storedToken.expires_at,
      remember: storedToken.remember, // Inherit from old token
    });

    return { 
      access_token, 
      refresh_token: new_refresh_token,
      expires_at: storedToken.expires_at,
      remember: storedToken.remember,
    };
  }

  async revokeAllUserTokens(userId: string) {
    await this.refreshTokenModel.updateMany(
      { user_id: new Types.ObjectId(userId) },
      { $set: { is_revoked: true } },
    );
  }

  async revokeToken(token: string) {
    await this.refreshTokenModel.updateOne(
      { token },
      { $set: { is_revoked: true } },
    );
  }

  async findToken(token: string) {
    return this.refreshTokenModel.findOne({ token });
  }

  generateAccessToken(payload: any) {
    return this.jwtService.sign(payload);
  }
}
