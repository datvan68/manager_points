import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getConnectionToken } from '@nestjs/mongoose';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection = app.get(getConnectionToken());
  
  const summaryPointModel = connection.model('SummaryPoint');
  const paths = summaryPointModel.schema.paths;
  
  for (const [path, schemaType] of Object.entries(paths)) {
    const st = schemaType as any;
    console.log(`Path: ${path}, Type: ${st.instance}`);
    if (st.instance === 'Array' || st.instance === 'DocumentArray') {
        const caster = st.caster;
        if (caster) {
            console.log(`  Array of: ${caster.instance}`);
            if (caster.schema) {
                console.log(`  Embedded Schema Paths:`, Object.keys(caster.schema.paths));
            }
        }
    }
  }
  
  await app.close();
}
bootstrap();
