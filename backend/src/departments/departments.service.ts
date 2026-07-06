import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Class, ClassDocument } from '../classes/schemas/class.schema';
import { isTeacher } from '../auth/utils/role.util';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name)
    private departmentModel: Model<DepartmentDocument>,
    @InjectModel(Class.name)
    private classModel: Model<ClassDocument>,
  ) {}

  private handleDuplicateCodeError(error: any): never {
    if (error?.code === 11000 && error?.keyPattern?.code) {
      const duplicateCode = error?.keyValue?.code || 'provided';
      throw new ConflictException(
        `Department with code ${duplicateCode} already exists`,
      );
    }

    throw error;
  }

  private async getTeacherDepartmentIds(requester?: any) {
    if (!isTeacher(requester) || !requester?.userId) return null;
    if (!Types.ObjectId.isValid(requester.userId)) return [];

    const classes = await this.classModel
      .find({ advisor_id: requester.userId })
      .select('dept_id')
      .lean()
      .exec();

    return Array.from(
      new Set(
        classes
          .map((cls: any) => cls.dept_id?.toString?.() || cls.dept_id)
          .filter(Boolean),
      ),
    );
  }

  async create(createDepartmentDto: CreateDepartmentDto): Promise<Department> {
    try {
      const createdDepartment = new this.departmentModel(createDepartmentDto);
      return await createdDepartment.save();
    } catch (error) {
      this.handleDuplicateCodeError(error);
    }
  }

  async findAll(requester?: any): Promise<Department[]> {
    const teacherDepartmentIds = await this.getTeacherDepartmentIds(requester);
    const filter = teacherDepartmentIds
      ? { _id: { $in: teacherDepartmentIds } }
      : {};

    return this.departmentModel.find(filter).exec();
  }

  async findOne(id: string, requester?: any): Promise<Department> {
    const teacherDepartmentIds = await this.getTeacherDepartmentIds(requester);
    if (
      teacherDepartmentIds &&
      !teacherDepartmentIds.some((deptId) => deptId === id)
    ) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    const department = await this.departmentModel.findById(id).exec();
    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }
    return department;
  }

  async update(
    id: string,
    updateDepartmentDto: UpdateDepartmentDto,
  ): Promise<Department> {
    try {
      const updatedDepartment = await this.departmentModel
        .findByIdAndUpdate(id, updateDepartmentDto, { returnDocument: 'after' })
        .exec();
      if (!updatedDepartment) {
        throw new NotFoundException(`Department with ID ${id} not found`);
      }
      return updatedDepartment;
    } catch (error) {
      this.handleDuplicateCodeError(error);
    }
  }

  async remove(id: string): Promise<Department> {
    const deletedDepartment = await this.departmentModel
      .findByIdAndDelete(id)
      .exec();
    if (!deletedDepartment) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }
    return deletedDepartment;
  }
}
