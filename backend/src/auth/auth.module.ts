import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { PasswordService } from './services/password.service';
import { RbacService } from './services/rbac.service';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User, UserSchema } from './schemas/user.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';
import {
  PasswordResetToken,
  PasswordResetTokenSchema,
} from './schemas/password-reset-token.schema';
import {
  PasswordResetRequest,
  PasswordResetRequestSchema,
} from './schemas/password-reset-request.schema';
import { LoginLog, LoginLogSchema } from './schemas/login-log.schema';
import { Role, RoleSchema } from './schemas/role.schema';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import {
  PermissionGroup,
  PermissionGroupSchema,
} from './schemas/permission-group.schema';
import {
  RoutePermission,
  RoutePermissionSchema,
} from './schemas/route-permission.schema';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') || 'your_secret_key_here',
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
      { name: PasswordResetRequest.name, schema: PasswordResetRequestSchema },
      { name: LoginLog.name, schema: LoginLogSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: PermissionGroup.name, schema: PermissionGroupSchema },
      { name: RoutePermission.name, schema: RoutePermissionSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Class.name, schema: ClassSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    RbacService,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    TokenService,
    PasswordService,
    RbacService,
    JwtStrategy,
    PassportModule,
    MongooseModule,
  ],
})
export class AuthModule {}
