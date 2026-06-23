import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CriteriaService } from './criteria.service';
import { CriteriaController } from './criteria.controller';
import { Criterion, CriterionSchema } from './schemas/criterion.schema';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Criterion.name, schema: CriterionSchema },
    ]),
    CategoriesModule,
  ],
  controllers: [CriteriaController],
  providers: [CriteriaService],
  exports: [CriteriaService],
})
export class CriteriaModule {}
