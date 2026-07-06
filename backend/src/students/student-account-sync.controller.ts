import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { StudentsService } from './students.service';

@Controller('system/student-account-sync')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StudentAccountSyncController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('preview')
  @Permissions('STUDENT_ACCOUNT_SYNC_PREVIEW')
  async previewSync() {
    return this.studentsService.syncLegacyStudentsAccounts('preview');
  }

  @Post('apply')
  @Permissions('STUDENT_ACCOUNT_SYNC_APPLY')
  async applySync(@Body() body: { confirmation: string }) {
    if (body.confirmation !== 'SYNC_STUDENT_ACCOUNTS') {
      throw new BadRequestException(
        'Confirmation text is invalid. Must be "SYNC_STUDENT_ACCOUNTS".',
      );
    }
    return this.studentsService.syncLegacyStudentsAccounts('apply');
  }
}
