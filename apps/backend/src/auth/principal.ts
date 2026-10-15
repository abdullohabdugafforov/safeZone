import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
}

export interface AuthDevice {
  id: string;
  childId: string;
  familyId: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
  device?: AuthDevice;
}

/** Parent user set by UserAuthGuard. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) throw new Error('CurrentUser used without UserAuthGuard');
  return user;
});

/** Child device set by DeviceAuthGuard. */
export const CurrentDevice = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthDevice => {
    const device = ctx.switchToHttp().getRequest<AuthedRequest>().device;
    if (!device) throw new Error('CurrentDevice used without DeviceAuthGuard');
    return device;
  },
);

/** Client IP (honours TRUST_PROXY). */
export const ClientIp = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<Request>().ip ?? null,
);

export function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}
