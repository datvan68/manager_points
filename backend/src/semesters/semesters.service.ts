import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Semester, SemesterDocument } from './schemas/semester.schema';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';

@Injectable()
export class SemestersService {
  constructor(
    @InjectModel(Semester.name) private readonly semesterModel: Model<SemesterDocument>,
  ) {}

  async create(createSemesterDto: CreateSemesterDto): Promise<Semester> {
    const createdSemester = new this.semesterModel(createSemesterDto);
    return createdSemester.save();
  }

  async findAll(): Promise<Semester[]> {
    return this.semesterModel.find().exec();
  }

  async findOne(id: string): Promise<Semester> {
    const semester = await this.semesterModel.findById(id).exec();
    if (!semester) {
      throw new NotFoundException(`Semester with ID ${id} not found`);
    }
    return semester;
  }

  async update(id: string, updateSemesterDto: UpdateSemesterDto): Promise<Semester> {
    const updatedSemester = await this.semesterModel
      .findByIdAndUpdate(id, updateSemesterDto, { returnDocument: 'after' })
      .exec();
    if (!updatedSemester) {
      throw new NotFoundException(`Semester with ID ${id} not found`);
    }
    return updatedSemester;
  }

  async remove(id: string): Promise<Semester> {
    const deletedSemester = await this.semesterModel.findByIdAndDelete(id).exec();
    if (!deletedSemester) {
      throw new NotFoundException(`Semester with ID ${id} not found`);
    }
    return deletedSemester;
  }
}
