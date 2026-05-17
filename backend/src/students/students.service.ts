
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Student, StudentDocument } from './schemas/student.schema';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
  ) {}

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    const { classId, ...rest } = createStudentDto;
    const newStudent = new this.studentModel({
      ...rest,
      class: classId,
    });
    return newStudent.save();
  }

  async createBulk(createStudentDtos: CreateStudentDto[]) {
    const students = createStudentDtos.map(dto => {
        const { classId, ...rest } = dto;
        return {
            ...rest,
            class: classId,
            // Assuming we validate existence of course, etc. elsewhere or let Mongo handle it
        };
    });
    // insertMany validates schema by default
    return this.studentModel.insertMany(students);
  }

  async findAll(): Promise<Student[]> {
    return this.studentModel.find()
      .populate({
        path: 'class',
        populate: { path: 'dept_id', select: 'name code' }
      })
      .exec();
  }

  async findOne(id: string): Promise<Student> {
    const student = await this.studentModel.findById(id)
      .populate({
          path: 'class',
          populate: { path: 'dept_id', select: 'name code' }
      })
      .exec();
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return student;
  }

  async findByStudentId(studentId: string): Promise<Student> {
    const student = await this.studentModel.findOne({ studentId }).exec();
    if (!student) {
      throw new NotFoundException(`Student with studentId ${studentId} not found`);
    }
    return student;
  }

  async update(id: string, updateStudentDto: UpdateStudentDto): Promise<Student> {
    const { classId, ...rest } = updateStudentDto;
    const updateData: any = { ...rest };
    if (classId) {
      updateData.class = classId;
    }
    
    const updatedStudent = await this.studentModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
      
    if (!updatedStudent) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return updatedStudent;
  }

  async remove(id: string): Promise<Student> {
    const deletedStudent = await this.studentModel.findByIdAndDelete(id).exec();
    if (!deletedStudent) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return deletedStudent;
  }
}
