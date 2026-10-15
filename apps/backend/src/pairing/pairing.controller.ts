import { Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  approvePairingBodySchema,
  claimSecretBodySchema,
  createPairingCodeBodySchema,
  createPairingRequestBodySchema,
  type ApprovePairingBody,
  type ApprovePairingResponse,
  type ClaimSecretBody,
  type CreatePairingCodeBody,
  type CreatePairingRequestResponse,
  type PairingClaimResponse,
  type PairingCodeResponse,
  type PairingRequest,
  type PairingRequestStatusResponse,
} from '@safekid/shared';
import type { z } from 'zod';

import { UserAuth } from '../auth/guards.js';
import { ClientIp, CurrentUser, type AuthUser } from '../auth/principal.js';
import { UuidParam } from '../common/params.js';
import { ZodBody } from '../common/zod.pipe.js';
import { toPairingRequestDto } from './pairing.mapper.js';
import { PairingService } from './pairing.service.js';

@Controller()
export class PairingController {
  constructor(private readonly pairing: PairingService) {}

  // --- parent ---

  @Post('families/:familyId/pairing-codes')
  @UserAuth()
  createCode(
    @CurrentUser() user: AuthUser,
    @UuidParam('familyId') familyId: string,
    @ZodBody(createPairingCodeBodySchema) body: CreatePairingCodeBody,
  ): Promise<PairingCodeResponse> {
    return this.pairing.createCode(user.id, familyId, body.childId);
  }

  @Delete('pairing-codes/:codeId')
  @UserAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeCode(@CurrentUser() user: AuthUser, @UuidParam('codeId') codeId: string): Promise<void> {
    return this.pairing.revokeCode(user.id, codeId);
  }

  @Get('pairing/requests')
  @UserAuth()
  async pending(@CurrentUser() user: AuthUser): Promise<PairingRequest[]> {
    return (await this.pairing.listPending(user.id)).map(toPairingRequestDto);
  }

  @Post('pairing/requests/:requestId/approve')
  @UserAuth()
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() user: AuthUser,
    @UuidParam('requestId') requestId: string,
    @ZodBody(approvePairingBodySchema) body: ApprovePairingBody,
  ): Promise<ApprovePairingResponse> {
    return this.pairing.approve(user.id, requestId, body);
  }

  @Post('pairing/requests/:requestId/reject')
  @UserAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  reject(@CurrentUser() user: AuthUser, @UuidParam('requestId') requestId: string): Promise<void> {
    return this.pairing.reject(user.id, requestId);
  }

  // --- child device (unauthenticated; the claim secret proves ownership) ---

  @Post('pairing/requests')
  createRequest(
    @ZodBody(createPairingRequestBodySchema) body: z.output<typeof createPairingRequestBodySchema>,
    @ClientIp() ip: string | null,
  ): Promise<CreatePairingRequestResponse> {
    return this.pairing.createRequest(body, ip);
  }

  @Post('pairing/requests/:requestId/status')
  @HttpCode(HttpStatus.OK)
  async status(
    @UuidParam('requestId') requestId: string,
    @ZodBody(claimSecretBodySchema) body: ClaimSecretBody,
  ): Promise<PairingRequestStatusResponse> {
    return { status: await this.pairing.status(requestId, body.claimSecret) };
  }

  @Post('pairing/requests/:requestId/claim')
  @HttpCode(HttpStatus.OK)
  claim(
    @UuidParam('requestId') requestId: string,
    @ZodBody(claimSecretBodySchema) body: ClaimSecretBody,
    @ClientIp() ip: string | null,
  ): Promise<PairingClaimResponse> {
    return this.pairing.claim(requestId, body.claimSecret, ip);
  }
}
