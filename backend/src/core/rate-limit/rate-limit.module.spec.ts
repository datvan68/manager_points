import { Test } from '@nestjs/testing';
import { RedisToken } from '@nestjs-redis/client';
import { RateLimitModule } from './rate-limit.module';

describe('RateLimitModule', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('resolves the Redis client inside the production throttler context', async () => {
    process.env.NODE_ENV = 'production';

    const moduleRef = await Test.createTestingModule({
      imports: [RateLimitModule.register()],
    })
      .overrideProvider(RedisToken())
      .useValue({ close: jest.fn() })
      .compile();

    await moduleRef.close();
  });
});
