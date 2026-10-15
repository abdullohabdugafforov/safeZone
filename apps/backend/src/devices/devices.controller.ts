import { Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import {
  deviceAlertBodySchema,
  heartbeatBodySchema,
  pushTokenBodySchema,
  putInstalledAppsBodySchema,
  type Device,
  type DeviceAlertBody,
  type HeartbeatBody,
  type HeartbeatResponse,
  type InstalledApp,
  type PushTokenBody,
  type PutInstalledAppsBody,
} from '@safekid/shared';

import { DeviceAuth, UserAuth } from '../auth/guards.js';
import { CurrentDevice, CurrentUser, type AuthDevice, type AuthUser } from '../auth/principal.js';
import { UuidParam } from '../common/params.js';
import { ZodBody } from '../common/zod.pipe.js';
import { toDeviceDto, toInstalledAppDto } from './device.mapper.js';
import { DevicesService } from './devices.service.js';

/** Parent-facing device endpoints. */
@Controller()
@UserAuth()
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get('children/:childId/devices')
  async list(
    @CurrentUser() user: AuthUser,
    @UuidParam('childId') childId: string,
  ): Promise<Device[]> {
    return (await this.devices.listForChild(user.id, childId)).map(toDeviceDto);
  }

  @Get('devices/:deviceId')
  async get(
    @CurrentUser() user: AuthUser,
    @UuidParam('deviceId') deviceId: string,
  ): Promise<Device> {
    return toDeviceDto(await this.devices.get(user.id, deviceId));
  }

  @Get('devices/:deviceId/apps')
  async apps(
    @CurrentUser() user: AuthUser,
    @UuidParam('deviceId') deviceId: string,
  ): Promise<InstalledApp[]> {
    return (await this.devices.apps(user.id, deviceId)).map(toInstalledAppDto);
  }

  @Delete('devices/:deviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlink(@CurrentUser() user: AuthUser, @UuidParam('deviceId') deviceId: string): Promise<void> {
    return this.devices.unlink(user.id, deviceId);
  }
}

/** Endpoints called by the child device itself. */
@Controller('device')
@DeviceAuth()
export class DeviceSelfController {
  constructor(private readonly devices: DevicesService) {}

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  heartbeat(
    @CurrentDevice() device: AuthDevice,
    @ZodBody(heartbeatBodySchema) body: HeartbeatBody,
  ): Promise<HeartbeatResponse> {
    return this.devices.heartbeat(device, body);
  }

  @Put('apps')
  @HttpCode(HttpStatus.NO_CONTENT)
  apps(
    @CurrentDevice() device: AuthDevice,
    @ZodBody(putInstalledAppsBodySchema) body: PutInstalledAppsBody,
  ): Promise<void> {
    return this.devices.replaceApps(device, body.apps);
  }

  @Put('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  pushToken(
    @CurrentDevice() device: AuthDevice,
    @ZodBody(pushTokenBodySchema) body: PushTokenBody,
  ): Promise<void> {
    return this.devices.setPushToken(device, body.token);
  }

  @Post('alerts')
  @HttpCode(HttpStatus.NO_CONTENT)
  alert(
    @CurrentDevice() device: AuthDevice,
    @ZodBody(deviceAlertBodySchema) body: DeviceAlertBody,
  ): Promise<void> {
    return this.devices.reportAlert(device, body);
  }
}
