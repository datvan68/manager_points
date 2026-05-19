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
        const newClass = new this.classModel(createClassDto);
        return newClass.save();
    }

    async findAll(): Promise<Class[]> {
        return this.classModel
            .find()
            .populate('dept_id', 'name code')
            .populate('user_id', 'username email')
            .exec();
    }

    async findOne(id: string): Promise<Class> {
        const classEntity = await this.classModel
            .findById(id)
            .populate('dept_id', 'name code')
            .populate('user_id', 'username email')
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
            .populate('user_id', 'username email')
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
