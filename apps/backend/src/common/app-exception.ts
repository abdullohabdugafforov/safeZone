import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@safekid/shared';

/** Domain error with a stable machine-readable code (see packages/shared errors). */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    readonly details?: unknown,
  ) {
    super(message, status);
  }

  static notFound(what = 'Resource'): AppException {
    return new AppException('NOT_FOUND', `${what} not found`, HttpStatus.NOT_FOUND);
  }

  static forbidden(message = 'Access denied'): AppException {
    return new AppException('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }

  static unauthorized(message = 'Authentication required'): AppException {
    return new AppException('UNAUTHORIZED', message, HttpStatus.UNAUTHORIZED);
  }

  static rateLimited(retryAfterSeconds: number): AppException {
    return new AppException('RATE_LIMITED', 'Too many requests', HttpStatus.TOO_MANY_REQUESTS, {
      retryAfterSeconds,
    });
  }
}
