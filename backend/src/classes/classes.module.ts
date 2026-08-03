import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { Class, ClassSchema } from './schemas/class.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Class.name, schema: ClassSchema },
      { name: Student.name, schema: StudentSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
