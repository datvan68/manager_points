
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

    async create(createClassDto: CreateClassDto): Promise<Class> {
        const { departmentId, ...rest } = createClassDto;
        const newClass = new this.classModel({
            ...rest,
            department: departmentId,
        });
        return newClass.save();
    }

    async findAll(): Promise<Class[]> {
        return this.classModel.find().populate('department', 'name code').exec();
    }

    async findOne(id: string): Promise<Class> {
        const classEntity = await this.classModel.findById(id).populate('department', 'name code').exec();
        if (!classEntity) {
            throw new NotFoundException(`Class with ID ${id} not found`);
        }
        return classEntity;
    }

    async update(id: string, updateClassDto: UpdateClassDto): Promise<Class> {
        const { departmentId, ...rest } = updateClassDto;
        const updateData: any = { ...rest };
        if (departmentId) {
            updateData.department = departmentId;
        }

        const updatedClass = await this.classModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .populate('department', 'name code')
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
