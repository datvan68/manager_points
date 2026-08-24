import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsArray,
  IsOptional,
  IsMongoId,
  Matches,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'nguyenvana' })
  @IsString()
  @IsNotEmpty({ message: 'Username không được để trống' })
  user_name: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message:
      'Mật khẩu phải chứa ít nhất 1 chữ thường, 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt',
  })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  @IsNotEmpty({ message: 'Email hoặc Mã sinh viên không được để trống' })
  email: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  remember?: boolean;
}

export class CreateImpersonationDto {
  @ApiProperty({ example: '65f1c2d3e4f5678901234567' })
  @IsMongoId({ message: 'ID người dùng không hợp lệ' })
  @IsNotEmpty({ message: 'ID người dùng không được để trống' })
  target_user_id: string;

  @ApiProperty({ example: 'account_tab_01_abcd' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,64}$/, {
    message: 'ID phiên đăng nhập không hợp lệ',
  })
  session_id: string;
}

export class CancelImpersonationDto {
  @ApiProperty({ example: 'account_tab_01_abcd' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,64}$/, {
    message: 'ID phiên đăng nhập không hợp lệ',
  })
  session_id: string;
}

export class TerminateImpersonationDto {
  @ApiProperty({ example: '65f1c2d3e4f5678901234567' })
  @IsMongoId({ message: 'ID người dùng không hợp lệ' })
  @IsNotEmpty({ message: 'ID người dùng không được để trống' })
  target_user_id: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-uuid' })
  @IsString()
  @IsNotEmpty({ message: 'Token không được để trống' })
  token: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message:
      'Mật khẩu mới phải chứa ít nhất 1 chữ thường, 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt',
  })
  new_password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldpassword123' })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu cũ không được để trống' })
  old_password: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message:
      'Mật khẩu mới phải chứa ít nhất 1 chữ thường, 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt',
  })
  new_password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'refresh-token-string' })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token không được để trống' })
  refresh_token: string;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Manager' })
  @IsString()
  @IsNotEmpty({ message: 'Tên vai trò không được để trống' })
  name: string;

  @ApiProperty({ example: 'MANAGER' })
  @IsString()
  @IsNotEmpty({ message: 'Mã vai trò không được để trống' })
  role_code: string;

  @ApiProperty({ example: 'Quản lý nhân sự' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['65f1...'] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class UpdateRoleDto {
  @ApiProperty({ example: 'Manager updated' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'MANAGER' })
  @IsString()
  @IsOptional()
  role_code?: string;

  @ApiProperty({ example: 'Cập nhật mô tả' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['65f1...'] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class AssignRoleDto {
  @ApiProperty({ example: '65f1...' })
  @IsMongoId()
  @IsNotEmpty({ message: 'RoleId không được để trống' })
  role_id: string;
}

export class CreatePermissionDto {
  @ApiProperty({ example: 'STUDENT_READ' })
  @IsString()
  @IsNotEmpty({ message: 'Mã quyền không được để trống' })
  code: string;

  @ApiProperty({ example: 'Xem sinh viên' })
  @IsString()
  @IsNotEmpty({ message: 'Tên quyền không được để trống' })
  name: string;

  @ApiProperty({ example: 'Quản lý sinh viên' })
  @IsString()
  @IsNotEmpty({ message: 'Module không được để trống' })
  module: string;

  @ApiProperty({ example: 'Cho phép xem danh sách sinh viên' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '65f1...' })
  @IsMongoId()
  @IsOptional()
  groupId?: string;
}

export class UpdatePermissionDto {
  @ApiProperty({ example: 'STUDENT_READ_UPDATED' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ example: 'Xem sinh viên (Cập nhật)' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Hệ thống' })
  @IsString()
  @IsOptional()
  module?: string;

  @ApiProperty({ example: 'Mô tả mới' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '65f1...' })
  @IsMongoId()
  @IsOptional()
  groupId?: string;
}

export class CreatePermissionGroupDto {
  @ApiProperty({ example: 'G_ACADEMIC' })
  @IsString()
  @IsNotEmpty({ message: 'Mã nhóm quyền không được để trống' })
  code: string;

  @ApiProperty({ example: 'Quản lý Đào tạo' })
  @IsString()
  @IsNotEmpty({ message: 'Tên nhóm quyền không được để trống' })
  name: string;

  @ApiProperty({ example: 'Các quyền liên quan đến đào tạo và học tập' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['65f1...'] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class UpdatePermissionGroupDto {
  @ApiProperty({ example: 'G_ACADEMIC_UPDATED' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ example: 'Cập nhật tên nhóm' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Cập nhật mô tả' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['65f1...'] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  permissions?: string[];

  @ApiProperty({ example: 'Active' })
  @IsString()
  @IsOptional()
  status?: string;
}

// ─── ROUTE PERMISSION DTOs ────────────────────────

export class CreateRoutePermissionDto {
  @ApiProperty({ example: '/students' })
  @IsString()
  @IsNotEmpty({ message: 'Route path không được để trống' })
  route_path: string;

  @ApiProperty({ example: 'Quản lý sinh viên' })
  @IsString()
  @IsNotEmpty({ message: 'Tên route không được để trống' })
  route_name: string;

  @ApiProperty({ example: 'Trang quản lý danh sách sinh viên' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['65f1...'] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  permissions?: string[];

  @ApiProperty({ example: 'all', enum: ['all', 'any'] })
  @IsString()
  @IsOptional()
  check_type?: string;

  @ApiProperty({ example: true })
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ example: 'page', enum: ['page', 'api', 'feature'] })
  @IsString()
  @IsOptional()
  type?: string;
}

export class UpdateRoutePermissionDto {
  @ApiProperty({ example: '/students' })
  @IsString()
  @IsOptional()
  route_path?: string;

  @ApiProperty({ example: 'Quản lý sinh viên' })
  @IsString()
  @IsOptional()
  route_name?: string;

  @ApiProperty({ example: 'Cập nhật mô tả' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['65f1...'] })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  permissions?: string[];

  @ApiProperty({ example: 'all', enum: ['all', 'any'] })
  @IsString()
  @IsOptional()
  check_type?: string;

  @ApiProperty({ example: true })
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ example: 'page', enum: ['page', 'api', 'feature'] })
  @IsString()
  @IsOptional()
  type?: string;
}

export class UpdateUserDto {
  @ApiProperty({ example: 'nguyenvanb', required: false })
  @IsString()
  @IsOptional()
  user_name?: string;

  @ApiProperty({ example: 'user_new@example.com', required: false })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsOptional()
  email?: string;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive', 'locked'],
    required: false,
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: '65f1...', required: false })
  @IsMongoId()
  @IsOptional()
  role_id?: string;

  @ApiProperty({ example: '0987654321', required: false })
  @IsString()
  @IsOptional()
  phone_number?: string;

  @ApiProperty({ example: 'Academic', required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ example: '2000-01-01', required: false })
  @IsOptional()
  date_birth?: Date;

  @ApiProperty({ example: 'newpassword123', required: false })
  @IsString()
  @IsOptional()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  password?: string;

  @ApiProperty({ example: ['65f1...'], required: false })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  advisor_class_ids?: string[];
}

export class UpdateMeDto {
  @ApiProperty({ example: 'nguyenvanb', required: false })
  @IsString()
  @IsOptional()
  user_name?: string;

  @ApiProperty({ example: '0987654321', required: false })
  @IsString()
  @IsOptional()
  phone_number?: string;

  @ApiProperty({ example: 'Academic', required: false })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiProperty({ example: '2000-01-01', required: false })
  @IsString()
  @IsOptional()
  date_birth?: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'nguyenvana' })
  @IsString()
  @IsNotEmpty({ message: 'Username không được để trống' })
  user_name: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password: string;

  @ApiProperty({ example: '65f1...' })
  @IsMongoId({ message: 'role_id không hợp lệ' })
  @IsNotEmpty({ message: 'role_id không được để trống' })
  role_id: string;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive', 'locked'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'locked'])
  status?: string;

  @ApiProperty({ example: ['65f1...'], required: false })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  advisor_class_ids?: string[];
}

export class BulkCreateUserItemDto {
  @ApiProperty({ example: 'nguyenvana' })
  @IsString()
  @IsNotEmpty({ message: 'Username không được để trống' })
  user_name: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ example: '12345678', required: false })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password?: string;

  @ApiProperty({ example: '65f1...' })
  @IsMongoId({ message: 'role_id không hợp lệ' })
  @IsNotEmpty({ message: 'role_id không được để trống' })
  role_id: string;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive', 'locked'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'locked'])
  status?: string;

  @ApiProperty({ example: '65f1...', required: false })
  @IsOptional()
  @IsMongoId({ message: 'advisor_class_id không hợp lệ' })
  advisor_class_id?: string;

  @ApiProperty({ example: ['65f1...'], required: false })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'advisor_class_ids không hợp lệ' })
  advisor_class_ids?: string[];
}

export class BulkCreateUsersDto {
  @ApiProperty({ example: '12345678', required: false })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Mật khẩu chung phải có ít nhất 8 ký tự' })
  commonPassword?: string;

  @ApiProperty({ type: [BulkCreateUserItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreateUserItemDto)
  users: BulkCreateUserItemDto[];
}

export class PasswordResetRequestDto {
  @ApiProperty({ example: 'user@example.com hoặc mã sinh viên' })
  @IsString()
  @IsNotEmpty({ message: 'Email hoặc mã sinh viên không được để trống' })
  email: string;
}

export class PasswordResetResendDto {
  @ApiProperty({ example: 'req-uuid' })
  @IsString()
  @IsNotEmpty({ message: 'Request ID không được để trống' })
  requestId: string;
}

export class PasswordResetVerifyDto {
  @ApiProperty({ example: 'req-uuid' })
  @IsString()
  @IsNotEmpty({ message: 'Request ID không được để trống' })
  requestId: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty({ message: 'Mã OTP không được để trống' })
  @Matches(/^\d{6}$/, { message: 'OTP phải gồm đúng 6 chữ số' })
  code: string;
}

export class PasswordResetCompleteDto {
  @ApiProperty({ example: 'reset-token-string' })
  @IsString()
  @IsNotEmpty({ message: 'Reset token không được để trống' })
  resetToken: string;

  @ApiProperty({ example: 'Newpassword@123' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message:
      'Mật khẩu mới phải chứa ít nhất 1 chữ thường, 1 chữ hoa, 1 chữ số và 1 ký tự đặc biệt',
  })
  newPassword: string;

  @ApiProperty({ example: 'Newpassword@123' })
  @IsString()
  @IsNotEmpty({ message: 'Xác nhận mật khẩu không được để trống' })
  confirmPassword: string;
}
