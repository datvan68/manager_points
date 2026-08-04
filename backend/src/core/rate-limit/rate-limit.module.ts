import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule, RedisToken } from '@nestjs-redis/client';
import {
  RedisThrottlerStorage,
  ThrottlerAlgorithm,
} from '@nestjs-redis/throttler-storage';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  RATE_LIMIT_DEFAULTS,
  isProductionRateLimitStore,
} from './rate-limit.constants';

function trustedClient(req: Record<string, any>): string {
  const ip = typeof req.ip === 'string' ? req.ip : '0.0.0.0';
  return ip.replace(/^::ffff:/, '').toLowerCase();
}

@Global()
@Module({})
export class RateLimitModule {
  static register(): DynamicModule {
    const production = isProductionRateLimitStore();
    const redisImports = production
      ? [
          RedisModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              isGlobal: true,
              options: {
                url:
                  config.get<string>('REDIS_URL') ||
                  `redis://${config.get<string>('REDIS_HOST', 'localhost')}:${config.get<number>('REDIS_PORT', 6379)}`,
                password: config.get<string>('REDIS_PASSWORD') || undefined,
              },
            }),
          }),
        ]
      : [];

    const throttlerImports = production
      ? [
          ...redisImports,
          ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [RedisToken()],
            useFactory: (redis: any) => ({
              throttlers: [
                RATE_LIMIT_DEFAULTS.burst,
                RATE_LIMIT_DEFAULTS.sustained,
              ],
              storage: new RedisThrottlerStorage(
                redis,
                ThrottlerAlgorithm.SlidingWindowCounter,
              ),
              getTracker: trustedClient,
              skipIf: (context: any) => {
                const path = context.switchToHttp().getRequest().path;
                return path === '/health' || path === '/metrics';
              },
              errorMessage: 'Too many requests',
              setHeaders: true,
            }),
          }),
        ]
      : [
          ThrottlerModule.forRoot({
            throttlers: [
              RATE_LIMIT_DEFAULTS.burst,
              RATE_LIMIT_DEFAULTS.sustained,
            ],
            getTracker: trustedClient,
            skipIf: (context) => {
              const path = context.switchToHttp().getRequest().path;
              return path === '/health' || path === '/metrics';
            },
            errorMessage: 'Too many requests',
            setHeaders: true,
          }),
        ];

    Logger.log(
      production
        ? 'Rate limiter using required Redis storage'
        : 'Rate limiter using explicit in-memory storage',
      RateLimitModule.name,
    );

    return {
      module: RateLimitModule,
      imports: throttlerImports,
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
      exports: [ThrottlerModule],
    };
  }
}
