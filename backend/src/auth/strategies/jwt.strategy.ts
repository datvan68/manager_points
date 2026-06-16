import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'your_secret_key_here',
    });
  }

  async validate(payload: { user_id: string }) {
    const user = await this.userModel
      .findById(payload.user_id)
      .populate({
        path: 'role',
        populate: { path: 'permissions' },
      })
      .select('-pw_hash');

    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Tài khoản đã bị khóa hoặc chưa kích hoạt');
    }

    const role = user.role as any;
    const permissions = role?.permissions?.map((p: any) => p.code) || [];

    return {
      userId: payload.user_id,
      username: user.user_name,
      email: user.email,
      roleName: role?.name || 'User',
      roleCode: role?.role_code || 'USER',
      permissions: permissions,
    };
  }
}
