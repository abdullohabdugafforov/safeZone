import { Global, Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DeviceAuthGuard, UserAuthGuard } from './guards.js';
import { OtpService } from './otp.service.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService, UserAuthGuard, DeviceAuthGuard],
  exports: [TokenService, UserAuthGuard, DeviceAuthGuard],
})
export class AuthModule {}
