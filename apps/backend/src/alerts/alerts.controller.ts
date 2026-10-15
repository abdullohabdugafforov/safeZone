import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { listAlertsQuerySchema, type Alert, type ListAlertsQuery } from '@safekid/shared';

import { UserAuth } from '../auth/guards.js';
import { CurrentUser, type AuthUser } from '../auth/principal.js';
import { UuidParam } from '../common/params.js';
import { ZodQuery } from '../common/zod.pipe.js';
import { toAlertDto } from './alert.mapper.js';
import { AlertsService } from './alerts.service.js';

@Controller('alerts')
@UserAuth()
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @ZodQuery(listAlertsQuerySchema) query: ListAlertsQuery,
  ): Promise<Alert[]> {
    return (await this.alerts.list(user.id, query)).map(toAlertDto);
  }

  @Post(':alertId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@CurrentUser() user: AuthUser, @UuidParam('alertId') alertId: string): Promise<void> {
    return this.alerts.markRead(user.id, alertId);
  }
}
