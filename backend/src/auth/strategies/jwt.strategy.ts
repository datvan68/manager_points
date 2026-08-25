import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { ImpersonationService } from '../services/impersonation.service';
import { getAssignedRoles, getEffectivePermissions } from '../utils/role.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private impersonationService: ImpersonationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'your_secret_key_here',
    });
  }

  async validate(payload: {
    user_id: string;
    actor_user_id?: string;
    impersonation_session_id?: string;
  }) {
    if (payload.impersonation_session_id || payload.actor_user_id) {
      if (!payload.impersonation_session_id || !payload.actor_user_id) {
        throw new UnauthorizedException('Phiên truy cập không hợp lệ');
      }
      await this.impersonationService.validateSession(
        payload.impersonation_session_id,
        payload.user_id,
        payload.actor_user_id,
      );
    }
    const user = await this.userModel
      .findById(payload.user_id)
      .populate({
        path: 'role',
        populate: { path: 'permissions' },
      })
      .populate({
        path: 'roles',
        populate: { path: 'permissions' },
      })
      .select('-pw_hash');

    if (!user) {
      if (payload.impersonation_session_id) {
        await this.impersonationService
          .release(payload.impersonation_session_id, 'target_not_found')
          .catch(() => undefined);
      }
      throw new UnauthorizedException('Token không hợp lệ');
    }

    if (user.status !== 'active') {
      if (payload.impersonation_session_id) {
        await this.impersonationService
          .release(payload.impersonation_session_id, 'target_inactive')
          .catch(() => undefined);
      }
      throw new UnauthorizedException(
        'Tài khoản đã bị khóa hoặc chưa kích hoạt',
      );
    }

    const role = user.role as any;
    const roles = getAssignedRoles(user);
    const permissions = getEffectivePermissions(user);

    return {
      userId: payload.user_id,
      username: user.user_name,
      email: user.email,
      roleName: role?.name || 'User',
      roleCode: role?.role_code || 'USER',
      roles,
      roleCodes: roles.map((assignedRole: any) => assignedRole.role_code),
      permissions: permissions,
      ...(payload.impersonation_session_id
        ? {
            actorUserId: payload.actor_user_id,
            impersonationSessionId: payload.impersonation_session_id,
          }
        : {}),
    };
  }
}
