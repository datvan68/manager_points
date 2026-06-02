import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CriteriaService } from './criteria.service';
import { CriteriaController } from './criteria.controller';
import { Criterion, CriterionSchema } from './schemas/criterion.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Criterion.name, schema: CriterionSchema },
    ]),
  ],
  controllers: [CriteriaController],
  providers: [CriteriaService],
  exports: [CriteriaService],
})
export class CriteriaModule {}
