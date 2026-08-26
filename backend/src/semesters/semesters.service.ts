import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Semester, SemesterDocument } from './schemas/semester.schema';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';

@Injectable()
export class SemestersService {
  constructor(
    @InjectModel(Semester.name)
    private readonly semesterModel: Model<SemesterDocument>,
  ) {}

  async create(createSemesterDto: CreateSemesterDto): Promise<Semester> {
    return this.withTransaction(async (session) => {
      // The schema defaults an omitted status to active, so preserve the same invariant here.
      if (!createSemesterDto.status || createSemesterDto.status === 'active') {
        await this.semesterModel.updateMany(
          { status: 'active' },
          { $set: { status: 'inactive' } },
          { session },
        ).exec();
      }
      const createdSemester = new this.semesterModel(createSemesterDto);
      return createdSemester.save({ session });
    });
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

  async update(
    id: string,
    updateSemesterDto: UpdateSemesterDto,
  ): Promise<Semester> {
    return this.withTransaction(async (session) => {
      if (updateSemesterDto.status === 'active') {
        await this.semesterModel.updateMany(
          { _id: { $ne: id }, status: 'active' },
          { $set: { status: 'inactive' } },
          { session },
        ).exec();
      }
      const updatedSemester = await this.semesterModel
        .findByIdAndUpdate(id, updateSemesterDto, { returnDocument: 'after', session })
        .exec();
      if (!updatedSemester) {
        throw new NotFoundException(`Semester with ID ${id} not found`);
      }
      return updatedSemester;
    });
  }

  private async withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.semesterModel.db.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async remove(id: string): Promise<Semester> {
    const deletedSemester = await this.semesterModel
      .findByIdAndDelete(id)
      .exec();
    if (!deletedSemester) {
      throw new NotFoundException(`Semester with ID ${id} not found`);
    }
    return deletedSemester;
  }
}
