import { BadRequestException, Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RoomsService } from '../services/rooms.service';
import { BedsService } from '../services/beds.service';
import { PublicRegisterDto } from '../dto/public-register.dto';
import {
  PublicRegistration,
  PublicRegistrationDocument,
} from '../schemas/public-registration.schema';
import { v4 as uuidv4 } from 'uuid';
import { SemestersService } from '../../semesters/semesters.service';

/**
 * Public controller for QR-based room info and registration
 * No authentication required
 */
@ApiTags('Dormitory - Public QR')
@Controller('dormitory/public')
export class DormitoryQrController {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly bedsService: BedsService,
    @InjectModel(PublicRegistration.name)
    private publicRegModel: Model<PublicRegistrationDocument>,
    private readonly semestersService: SemestersService,
  ) {}

  @Get('semester')
  async getActiveSemester() {
    const active = (await this.semestersService.findAll()).filter((item) => item.status === 'active');
    if (active.length !== 1) {
      throw new BadRequestException(active.length ? 'Có nhiều học kỳ active. Vui lòng liên hệ quản trị viên.' : 'Chưa có học kỳ active.');
    }
    const parts = active[0].semester_name.split(/\s*-\s*/);
    return {
      semester_name: active[0].semester_name,
      ky_hoc: parts[0] || '',
      nam_hoc: parts.slice(1).join('-').replace(/\s/g, ''),
    };
  }

  /**
   * UC15: Get room info by QR code ID (no auth required)
   */
  @Get('room/:qrId')
  async getRoomByQr(@Param('qrId') qrId: string) {
    const room = await this.roomsService.findByQrId(qrId);
    const beds = await this.bedsService.findByRoom((room as any)._id.toString());

    return {
      room: {
        _id: (room as any)._id,
        ma_phong: room.ma_phong,
        building: room.building_id,
        tang: room.tang,
        loai_phong: room.loai_phong,
        so_giuong: room.so_giuong,
        so_giuong_trong: room.so_giuong_trong,
        gia_phong: room.gia_phong,
        tien_ich: room.tien_ich,
        trang_thai: room.trang_thai,
        mo_ta: room.mo_ta,
      },
      beds: beds.map((b) => ({
        ma_giuong: b.ma_giuong,
        vi_tri: b.vi_tri,
        trang_thai: b.trang_thai,
      })),
    };
  }

  /**
   * Public registration via QR scan — no auth, minimal info
   */
  @Post('register')
  async publicRegister(@Body() dto: PublicRegisterDto) {
    const room = dto.qr_room_id ? await this.roomsService.findByQrId(dto.qr_room_id) : null;
    if (!room && (!dto.ngay_sinh || !dto.gioi_tinh)) throw new BadRequestException('Vui lòng nhập ngày sinh và giới tính.');
    const active = (await this.semestersService.findAll()).filter((item) => item.status === 'active');
    if (active.length !== 1) throw new BadRequestException('Không thể xác định học kỳ active.');

    // Check for duplicate phone number with pending registration
    const existing = await this.publicRegModel.findOne({
      so_dien_thoai: dto.so_dien_thoai,
      trang_thai: 'Chờ xác nhận',
    });
    if (existing) {
      return {
        success: false,
        code: 'DUPLICATE_PHONE',
        message: 'Số điện thoại này đã có đơn đăng ký đang chờ xác nhận.',
        ma_dk: existing.ma_dk_public,
      };
    }

    const building = room?.building_id as any;
    const semesterParts = active[0].semester_name.split(/\s*-\s*/);

    const registration = new this.publicRegModel({
      ma_dk_public: `PUB-${uuidv4().substring(0, 8).toUpperCase()}`,
      ho_ten: dto.ho_ten,
      so_dien_thoai: dto.so_dien_thoai,
      email: dto.email || '',
      ma_sinh_vien: dto.ma_sinh_vien || '',
      ngay_sinh: dto.ngay_sinh || '',
      gioi_tinh: dto.gioi_tinh || 'Other',
      room_id: room ? (room as any)._id : undefined,
      ma_phong: room?.ma_phong || '',
      ten_toa_nha: building?.ten || '',
      loai_phong: dto.gioi_tinh === 'Female' ? (dto.loai_phong || 'Thường') : room?.loai_phong || 'Thường',
      ky_hoc: semesterParts[0] || '',
      nam_hoc: semesterParts.slice(1).join('-').replace(/\s/g, ''),
      doi_tuong_uu_tien: 'Không',
      ghi_chu: dto.ghi_chu || '',
      trang_thai: 'Chờ xác nhận',
      nguon: 'QR_SCAN',
    });

    const saved = await registration.save();

    return {
      success: true,
      message: 'Đăng ký thành công! Chúng tôi sẽ liên hệ bạn qua số điện thoại đã cung cấp.',
      ma_dk: saved.ma_dk_public,
    };
  }
}
