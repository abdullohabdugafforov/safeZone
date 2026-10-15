import {
  HttpStatus,
  Injectable,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';

import { AppException } from '../common/app-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { bearerToken, type AuthedRequest } from './principal.js';
import { TokenService } from './token.service.js';

/** Requires a parent user access token. */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = bearerToken(req);
    if (!token) throw AppException.unauthorized();
    req.user = { id: await this.tokens.verifyAccess(token, 'user') };
    return true;
  }
}

/** Requires a device access token for a device that is still linked. */
@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = bearerToken(req);
    if (!token) throw AppException.unauthorized();
    const deviceId = await this.tokens.verifyAccess(token, 'device');
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, status: true, childId: true, child: { select: { familyId: true } } },
    });
    if (!device || device.status !== 'active') {
      throw new AppException(
        'DEVICE_UNLINKED',
        'Device is no longer linked',
        HttpStatus.UNAUTHORIZED,
      );
    }
    req.device = { id: device.id, childId: device.childId, familyId: device.child.familyId };
    return true;
  }
}

export const UserAuth = () => UseGuards(UserAuthGuard);
export const DeviceAuth = () => UseGuards(DeviceAuthGuard);
