import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { CriteriaService } from './src/criteria/criteria.service';
import { CriterionDocument } from './src/criteria/schemas/criterion.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const criteriaService = app.get(CriteriaService);
  const criterionModel = app.get<Model<CriterionDocument>>('CriterionModel');

  const criteria = await criteriaService.findAll();
  console.log(`Found ${criteria.length} criteria`);

  let count = 0;
  for (const c of criteria) {
    if (!c.criterion_code) {
      const code = `LEGACY-${c._id.toString().slice(-6)}`;
      await criterionModel.findByIdAndUpdate(c._id, { criterion_code: code });
      console.log(`Updated ${c.criterion_name} -> code: ${code}`);
      count++;
    }
  }

  console.log(`Migration completed: updated ${count} records.`);
  await app.close();
}

bootstrap();
