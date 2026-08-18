import { BadRequestException, Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RoomsService } from '../services/rooms.service';
import { BedsService } from '../services/beds.service';
import { PublicRegisterDto } from '../dto/public-register.dto';
import { DormitoryRosterService } from '../services/dormitory-roster.service';
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
    private readonly rosterService: DormitoryRosterService,
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
      semester: parts[0] || '',
      academic_year: parts.slice(1).join('-').replace(/\s/g, ''),
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
        room_code: room.room_code,
        building: room.building_id,
        room_type: room.room_type,
        bed_count: room.bed_count,
        max_students: (room as any).max_students,
        current_students: (room as any).current_students,
        available_bed_count: room.available_bed_count,
        room_price: room.room_price,
        amenities: room.amenities,
        status: room.status,
        description: room.description,
      },
      beds: beds.map((b) => ({
        bed_code: b.bed_code,
        position: b.position,
        status: b.status,
      })),
    };
  }

  /**
   * Public registration via QR scan — no auth, minimal info
   */
  @Post('register')
  async publicRegister(@Body() dto: PublicRegisterDto) {
    const room = dto.qr_room_id ? await this.roomsService.findByQrId(dto.qr_room_id) : null;
    const result = await this.rosterService.createPublic({
      full_name: dto.full_name,
      phone_number: dto.phone_number,
      date_of_birth: dto.date_of_birth,
      gender: dto.gender,
      student_code: dto.student_code,
      room_type: (dto.gender === 'Female' ? (dto.room_type || room?.room_type || 'Thường') : (room?.room_type || dto.room_type || 'Thường')) as 'Thường' | 'Máy lạnh',
      notes: dto.notes,
      applicant_profile: dto.applicant_profile,
    }, room);
    return { success: true, message: 'Đăng ký thành công!', roster_entry_code: result.roster_entry_code };
  }
}
