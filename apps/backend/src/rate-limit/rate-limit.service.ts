import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { AppException } from '../common/app-exception.js';
import { REDIS } from '../redis/redis.module.js';

export interface RateLimitRule {
  /** Unique key, e.g. `otp:phone:+99890...`. */
  key: string;
  limit: number;
  windowSeconds: number;
}

/** Fixed-window counters in Redis. */
@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Counts a hit for every rule; throws RATE_LIMITED if any rule is exceeded. */
  async consume(...rules: RateLimitRule[]): Promise<void> {
    for (const rule of rules) {
      const key = `rl:${rule.key}`;
      const [[, count], [, ttl]] = (await this.redis.multi().incr(key).ttl(key).exec()) as [
        [null, number],
        [null, number],
      ];
      if (ttl < 0) await this.redis.expire(key, rule.windowSeconds);
      if (count > rule.limit) {
        throw AppException.rateLimited(ttl > 0 ? ttl : rule.windowSeconds);
      }
    }
  }

  /** Cooldown lock: succeeds once per window, otherwise throws with the remaining time. */
  async cooldown(key: string, seconds: number): Promise<void> {
    const ok = await this.redis.set(`cd:${key}`, '1', 'EX', seconds, 'NX');
    if (ok === null) {
      const ttl = await this.redis.ttl(`cd:${key}`);
      throw AppException.rateLimited(ttl > 0 ? ttl : seconds);
    }
  }
}
