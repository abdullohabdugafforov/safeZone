import { Body, HttpStatus, Query, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { AppException } from './app-exception.js';

export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException('VALIDATION_FAILED', 'Invalid request', HttpStatus.BAD_REQUEST, {
        issues: result.error.issues.map(({ path, message, code }) => ({ path, message, code })),
      });
    }
    return result.data;
  }
}

/** `@ZodBody(schema) body: z.output<typeof schema>` — validates and parses the request body. */
export const ZodBody = (schema: z.ZodType) => Body(new ZodValidationPipe(schema));

export const ZodQuery = (schema: z.ZodType) => Query(new ZodValidationPipe(schema));
