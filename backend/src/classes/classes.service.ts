import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Class, ClassDocument } from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

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
}
