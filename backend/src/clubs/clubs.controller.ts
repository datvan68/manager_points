import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync } from 'fs';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission, checkAnyPermission } from '../auth/guards/check-permission.guard';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import {
  AddClubMemberDto,
  UpdateClubMemberDto,
  ApproveMemberDto,
  JoinClubDto,
} from './dto/club-member.dto';

@ApiTags('Clubs')
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Post()
  @UseGuards(checkPermission('CLUB_CREATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo câu lạc bộ mới' })
  create(@Body() dto: CreateClubDto, @Request() req: any) {
    return this.clubsService.create(dto, req.user.userId || req.user._id || req.user.id);
  }

  @Post('media/upload')
  @UseGuards(checkAnyPermission('CLUB_CREATE', 'CLUB_UPDATE'))
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = uuidv4();
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Chỉ chấp nhận file ảnh (PNG, JPEG, WebP)'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload cover hoặc logo cho câu lạc bộ' })
  uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @Body('kind') bodyKind?: 'cover' | 'logo',
    @Query('kind') queryKind?: 'cover' | 'logo',
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hợp lệ');
    }
    const kind = bodyKind || queryKind || 'cover';
    return {
      url: `/uploads/${file.filename}`,
      file_name: file.filename,
      mime_type: file.mimetype,
      size: file.size,
      kind,
    };
  }

  @Get()
  @UseGuards(checkPermission('CLUB_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách tất cả câu lạc bộ' })
  findAll(@Request() req: any) {
    return this.clubsService.findAll(req.user);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'CLB của sinh viên đang đăng nhập' })
  getMyClubs(@Request() req: any) {
    const studentIdOrUserId = req.user.studentId || req.user.userId || req.user._id || req.user.id;
    return this.clubsService.getMyClubs(studentIdOrUserId);
  }

  @Get('favorites/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách ID câu lạc bộ đã yêu thích của tôi' })
  getMyFavoriteClubIds(@Request() req: any) {
    const userId = req.user.userId || req.user._id || req.user.id;
    return this.clubsService.getMyFavoriteClubIds(userId);
  }

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Yêu thích câu lạc bộ' })
  favoriteClub(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId || req.user._id || req.user.id;
    return this.clubsService.favoriteClub(id, userId);
  }

  @Delete(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy yêu thích câu lạc bộ' })
  unfavoriteClub(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.userId || req.user._id || req.user.id;
    return this.clubsService.unfavoriteClub(id, userId);
  }

  @Get(':id')
  @UseGuards(checkPermission('CLUB_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chi tiết câu lạc bộ' })
  findOne(@Param('id') id: string) {
    return this.clubsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(checkPermission('CLUB_UPDATE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin CLB' })
  update(@Param('id') id: string, @Body() dto: UpdateClubDto) {
    return this.clubsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(checkPermission('CLUB_DELETE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vô hiệu hóa CLB (soft delete)' })
  remove(@Param('id') id: string) {
    return this.clubsService.remove(id);
  }

  // ── Member endpoints ──

  @Get(':id/members')
  @UseGuards(checkPermission('CLUB_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách thành viên CLB' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'semester_id', required: false })
  findMembers(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('semester_id') semester_id?: string,
  ) {
    return this.clubsService.findMembers(id, { status, semester_id });
  }

  @Post(':id/members')
  @UseGuards(checkPermission('CLUB_MEMBER_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm thành viên vào CLB' })
  addMember(@Param('id') id: string, @Body() dto: AddClubMemberDto) {
    return this.clubsService.addMember(id, dto);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sinh viên tự đăng ký tham gia CLB' })
  joinClub(
    @Param('id') id: string,
    @Body() dto: JoinClubDto,
    @Request() req: any,
  ) {
    const studentId = req.user.studentId || req.user._id;
    return this.clubsService.joinClub(id, studentId, dto);
  }

  @Patch(':id/members/:memberId')
  @UseGuards(checkPermission('CLUB_MEMBER_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật vai trò/trạng thái thành viên' })
  updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateClubMemberDto,
  ) {
    return this.clubsService.updateMember(id, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(checkPermission('CLUB_MEMBER_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa thành viên khỏi CLB' })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.clubsService.removeMember(id, memberId);
  }

  @Post(':id/members/:memberId/approve')
  @UseGuards(checkPermission('CLUB_MEMBER_MANAGE'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Duyệt/từ chối đăng ký thành viên' })
  approveMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: ApproveMemberDto,
    @Request() req: any,
  ) {
    return this.clubsService.approveMember(
      id,
      memberId,
      dto,
      req.user.userId || req.user._id || req.user.id,
    );
  }

  @Get(':id/stats')
  @UseGuards(checkPermission('CLUB_READ'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thống kê CLB' })
  getClubStats(@Param('id') id: string) {
    return this.clubsService.getClubStats(id);
  }
}
