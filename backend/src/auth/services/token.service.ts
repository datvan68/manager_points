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
import { ImpersonationService } from './impersonation.service';

const REMEMBERED_REFRESH_DAYS = 30;

@Injectable()
export class TokenService {
  constructor(
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshTokenDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private impersonationService: ImpersonationService,
  ) {}

  async createRefreshToken(
    userId: Types.ObjectId,
    expirationDays: number,
    remember: boolean = false,
    impersonation?: {
      sessionId: Types.ObjectId;
      actorUserId: Types.ObjectId;
      expiresAt: Date;
    },
  ) {
    const token = uuidv4();
    await this.refreshTokenModel.create({
      user_id: userId,
      token,
      expires_at:
        impersonation?.expiresAt ||
        new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000),
      remember,
      impersonation_session_id: impersonation?.sessionId || null,
      actor_user_id: impersonation?.actorUserId || null,
    });
    return token;
  }

  async refreshToken(token: string) {
    let storedToken = await this.refreshTokenModel.findOne({ token });
    if (!storedToken) {
      throw new UnauthorizedException('Phiên làm việc không tồn tại');
    }

    const user = await this.userModel.findById(storedToken.user_id).exec();
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException(
        'Tài khoản đã bị khóa hoặc chưa kích hoạt',
      );
    }

    if (storedToken.is_revoked) {
      if (!storedToken.impersonation_session_id) {
        const graceResult = await this.graceRefreshResult(storedToken);
        if (graceResult) {
          return graceResult;
        }
      }

      if (storedToken.impersonation_session_id) {
        const sessionId = storedToken.impersonation_session_id.toString();
        await this.impersonationService
          .release(sessionId, 'refresh_token_reuse')
          .catch(() => undefined);
        await this.revokeAllImpersonationTokens(sessionId);
      } else {
        await this.revokeAllUserTokens(storedToken.user_id.toString());
      }
      throw new UnauthorizedException(
        'Cảnh báo bảo mật: Token đã được sử dụng. Vui lòng đăng nhập lại.',
      );
    }

    if (new Date() > new Date(storedToken.expires_at)) {
      await this.refreshTokenModel.deleteOne({ _id: storedToken._id });
      throw new UnauthorizedException('Phiên làm việc đã hết hạn');
    }

    const payload = await this.accessPayloadForToken(storedToken);
    const new_refresh_token = uuidv4();

    const nextExpiresAt = storedToken.remember
      ? new Date(Date.now() + REMEMBERED_REFRESH_DAYS * 24 * 60 * 60 * 1000)
      : storedToken.expires_at;

    const claimedToken = await this.refreshTokenModel.findOneAndUpdate(
      { _id: storedToken._id, token, is_revoked: false },
      { $set: { is_revoked: true, replaced_by: new_refresh_token } },
      { new: true },
    );

    if (!claimedToken) {
      const latestToken = await this.refreshTokenModel.findOne({
        _id: storedToken._id,
        token,
      });
      if (latestToken?.is_revoked && !latestToken.impersonation_session_id) {
        const graceResult = await this.graceRefreshResult(latestToken);
        if (graceResult) {
          return graceResult;
        }
      }
      if (latestToken?.is_revoked) {
        storedToken = latestToken;
      }

      if (storedToken.impersonation_session_id) {
        const sessionId = storedToken.impersonation_session_id.toString();
        await this.impersonationService
          .release(sessionId, 'refresh_token_reuse')
          .catch(() => undefined);
        await this.revokeAllImpersonationTokens(sessionId);
      } else {
        await this.revokeAllUserTokens(storedToken.user_id.toString());
      }
      throw new UnauthorizedException(
        'Cảnh báo bảo mật: Token đã được sử dụng. Vui lòng đăng nhập lại.',
      );
    }

    try {
      await this.refreshTokenModel.create({
        user_id: storedToken.user_id,
        token: new_refresh_token,
        expires_at: nextExpiresAt,
        remember: storedToken.remember, // Inherit from old token
        impersonation_session_id: storedToken.impersonation_session_id || null,
        actor_user_id: storedToken.actor_user_id || null,
      });
    } catch {
      throw new UnauthorizedException('Phiên làm việc không thể được gia hạn');
    }

    const access_token = this.jwtService.sign(payload);
    return {
      access_token,
      refresh_token: new_refresh_token,
      expires_at: nextExpiresAt,
      remember: storedToken.remember,
    };
  }

  private async graceRefreshResult(storedToken: RefreshTokenDocument) {
    const gracePeriodMs = 60000; // 60s grace period
    const timeSinceRevocation =
      Date.now() - new Date(storedToken.updatedAt).getTime();

    if (timeSinceRevocation >= gracePeriodMs || !storedToken.replaced_by) {
      return null;
    }

    const replacedToken = await this.refreshTokenModel.findOne({
      token: storedToken.replaced_by,
    });
    if (
      !replacedToken ||
      replacedToken.is_revoked ||
      new Date() > new Date(replacedToken.expires_at)
    ) {
      return null;
    }

    const payload = await this.accessPayloadForToken(replacedToken);
    const access_token = this.jwtService.sign(payload);
    return {
      access_token,
      refresh_token: replacedToken.token,
      expires_at: replacedToken.expires_at,
      remember: replacedToken.remember,
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

  async revokeAllImpersonationTokens(sessionId: string) {
    if (!Types.ObjectId.isValid(sessionId)) return;
    await this.refreshTokenModel.updateMany(
      { impersonation_session_id: new Types.ObjectId(sessionId) },
      { $set: { is_revoked: true } },
    );
  }

  async findToken(token: string) {
    return this.refreshTokenModel.findOne({ token });
  }

  generateAccessToken(payload: any) {
    return this.jwtService.sign(payload);
  }

  private async accessPayloadForToken(token: RefreshTokenDocument) {
    const payload: {
      user_id: string;
      actor_user_id?: string;
      impersonation_session_id?: string;
    } = { user_id: token.user_id.toString() };

    if (token.impersonation_session_id) {
      const actorUserId = token.actor_user_id?.toString();
      if (!actorUserId) {
        throw new UnauthorizedException('Phiên truy cập không hợp lệ');
      }
      await this.impersonationService.validateSession(
        token.impersonation_session_id.toString(),
        token.user_id.toString(),
        actorUserId,
      );
      payload.actor_user_id = actorUserId;
      payload.impersonation_session_id =
        token.impersonation_session_id.toString();
    }
    return payload;
  }
}
