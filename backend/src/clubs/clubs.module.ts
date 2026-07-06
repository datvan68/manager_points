import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubsService } from './clubs.service';
import { ClubsController } from './clubs.controller';
import { Club, ClubSchema } from './schemas/club.schema';
import { ClubMember, ClubMemberSchema } from './schemas/club-member.schema';
import { ClubFavorite, ClubFavoriteSchema } from './schemas/club-favorite.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Club.name, schema: ClubSchema },
      { name: ClubMember.name, schema: ClubMemberSchema },
      { name: ClubFavorite.name, schema: ClubFavoriteSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [ClubsController],
  providers: [ClubsService],
  exports: [ClubsService, MongooseModule],
})
export class ClubsModule {}
