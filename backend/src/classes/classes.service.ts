import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Class, ClassDocument } from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { isStudent } from '../auth/utils/role.util';

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
  ) {}

  private isTeacher(requester?: any) {
    const role = (requester?.roleName || '').toLowerCase();
    return role.includes('teacher') || role.includes('advisor');
  }

  async create(createClassDto: CreateClassDto): Promise<Class> {
    const newClass = new this.classModel(createClassDto);
    return newClass.save();
  }

  async findAll(requester?: any): Promise<Class[]> {
    if (requester && isStudent(requester) && requester.userId) {
      const studentModel = this.classModel.db.model('Student');
      const student = await studentModel.findOne({ user_id: new Types.ObjectId(requester.userId) }).exec();
      if (!student || !student.class_id) return [];
      return this.classModel
        .find({ _id: student.class_id })
        .populate('dept_id', 'name code')
        .populate('advisor_id', 'user_name email')
        .exec();
    }

    const filter = this.isTeacher(requester)
      ? { advisor_id: requester.userId }
      : {};

    return this.classModel
      .find(filter)
      .populate('dept_id', 'name code')
      .populate('advisor_id', 'user_name email')
      .exec();
  }

  async findOne(id: string, requester?: any): Promise<Class> {
    if (requester && isStudent(requester) && requester.userId) {
      const studentModel = this.classModel.db.model('Student');
      const student = await studentModel.findOne({ user_id: new Types.ObjectId(requester.userId) }).exec();
      if (!student || student.class_id?.toString() !== id) {
        throw new ForbiddenException('Bạn không có quyền truy cập thông tin của lớp học khác.');
      }
    }

    const query = this.isTeacher(requester)
      ? this.classModel.findOne({ _id: id, advisor_id: requester.userId })
      : this.classModel.findById(id);
    const classEntity = await query
      .populate('dept_id', 'name code')
      .populate('advisor_id', 'user_name email')
      .exec();

    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }
    return classEntity;
  }

  async update(id: string, updateClassDto: UpdateClassDto): Promise<Class> {
    const updatedClass = await this.classModel
      .findByIdAndUpdate(id, updateClassDto, { returnDocument: 'after' })
      .populate('dept_id', 'name code')
      .populate('advisor_id', 'user_name email')
      .exec();

    if (!updatedClass) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }
    return updatedClass;
  }

  async remove(id: string): Promise<Class> {
    const deletedClass = await this.classModel.findByIdAndDelete(id).exec();
    if (!deletedClass) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }
    return deletedClass;
  }

  async getClassSummary(requester?: any): Promise<any[]> {
    const classes = await this.findAll(requester);
    const studentModel = this.classModel.db.model('Student');
    
    const summaries = await Promise.all(classes.map(async (cls: any) => {
      const [studentCount, avatarsRaw] = await Promise.all([
        studentModel.countDocuments({ class_id: cls._id }).exec(),
        studentModel
          .find({ class_id: cls._id })
          .select('_id full_name student_code')
          .limit(3)
          .lean()
          .exec()
      ]);
      
      const avatars = avatarsRaw.map((s: any) => ({
        _id: s._id,
        full_name: s.full_name,
        student_code: s.student_code
      }));
      
      return {
        classId: cls._id.toString(),
        studentCount,
        avatars
      };
    }));
    
    return summaries;
  }
}
