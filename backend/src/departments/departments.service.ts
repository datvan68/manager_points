import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name)
    private departmentModel: Model<DepartmentDocument>,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto): Promise<Department> {
    const createdDepartment = new this.departmentModel(createDepartmentDto);
    return createdDepartment.save();
  }

  async findAll(): Promise<Department[]> {
    return this.departmentModel.find().exec();
  }

  async findOne(id: string): Promise<Department> {
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
    const updatedDepartment = await this.departmentModel
      .findByIdAndUpdate(id, updateDepartmentDto, { returnDocument: 'after' })
      .exec();
    if (!updatedDepartment) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }
    return updatedDepartment;
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
