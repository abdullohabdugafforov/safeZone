import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  otpRequestBodySchema,
  otpVerifyBodySchema,
  refreshBodySchema,
  type AuthResponse,
  type OtpRequestResponse,
  type RefreshBody,
  type TokenPair,
} from '@safekid/shared';
import type { z } from 'zod';

import { ZodBody } from '../common/zod.pipe.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { ClientIp } from './principal.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly otp: OtpService,
  ) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(
    @ZodBody(otpRequestBodySchema) body: z.output<typeof otpRequestBodySchema>,
    @ClientIp() ip: string | null,
  ): Promise<OtpRequestResponse> {
    return this.otp.request(body.phone, ip);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(
    @ZodBody(otpVerifyBodySchema) body: z.output<typeof otpVerifyBodySchema>,
    @ClientIp() ip: string | null,
  ): Promise<AuthResponse> {
    return this.auth.login(body.phone, body.code, ip);
  }

  /** Rotates a user or device refresh token. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @ZodBody(refreshBodySchema) body: RefreshBody,
    @ClientIp() ip: string | null,
  ): Promise<TokenPair> {
    return this.auth.refresh(body.refreshToken, ip);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@ZodBody(refreshBodySchema) body: RefreshBody): Promise<void> {
    return this.auth.logout(body.refreshToken);
  }
}
