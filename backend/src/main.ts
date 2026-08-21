import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import * as express from 'express';
import { join } from 'path';
import { performance } from 'node:perf_hooks';

async function bootstrap() {
  const bootstrapStartedAt = performance.now();
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = (
    process.env.CORS_ORIGINS ||
    process.env.FRONTEND_URL ||
    ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction && allowedOrigins.length === 0) {
    throw new Error(
      'FRONTEND_URL or CORS_ORIGINS must be configured in production',
    );
  }

  const app = await NestFactory.create(AppModule);
  console.log(
    `[startup] Nest application created in ${Math.round(performance.now() - bootstrapStartedAt)}ms`,
  );
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));
  const trustedProxyHops = isProduction
    ? Number.parseInt(process.env.TRUSTED_PROXY_HOPS || '1', 10)
    : 0;
  app.getHttpAdapter().getInstance().set('trust proxy', trustedProxyHops);

  // Bounded legacy compatibility middleware for /uploads
  app.use('/uploads', (req: any, res: any, next: any) => {
    const filename = req.path.replace(/^\/+/, '');
    if (filename.startsWith('invoice-proof-')) {
      return res.status(403).json({
        statusCode: 403,
        message: 'Truy cập ảnh chứng từ yêu cầu xác thực qua API',
      });
    }
    if (filename.startsWith('invoice-transfer-qr-')) {
      return res.redirect(301, `/api/media/public/dormitory-qr/${filename}`);
    }
    // Allow public activity assets during migration window if present
    const legacyPath = join(__dirname, '..', 'uploads', filename);
    res.sendFile(legacyPath, (err: any) => {
      if (err) {
        res.status(404).json({ statusCode: 404, message: 'Tệp tin không tồn tại' });
      }
    });
  });



  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );

  // Cookie Parser
  app.use(cookieParser());

  // Compression
  app.use(compression());

  const corsOrigin = isProduction
    ? (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      }
    : true;

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerEnabled =
    !isProduction || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Manager Point API')
      .setDescription('The Manager Point API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);
    console.log(
      `[startup] Swagger document created in ${Math.round(performance.now() - bootstrapStartedAt)}ms`,
    );
  }

  await app.listen(process.env.PORT ?? 8001, '0.0.0.0');
  console.log(
    `[startup] HTTP listener ready in ${Math.round(performance.now() - bootstrapStartedAt)}ms`,
  );
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
