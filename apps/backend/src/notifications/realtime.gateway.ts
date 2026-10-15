import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, type OnGatewayConnection } from '@nestjs/websockets';
import { REALTIME_NAMESPACE, type RealtimeEvent } from '@safekid/shared';
import type { Namespace, Socket } from 'socket.io';

import { TokenService } from '../auth/token.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const REALTIME_EVENT = 'event';

/**
 * Socket.IO channel for hints while the app is in the foreground. Clients
 * authenticate with their access token in `handshake.auth.token`; parents join
 * their family rooms, devices their own room. Events carry ids only.
 */
@WebSocketGateway({ namespace: REALTIME_NAMESPACE, cors: { origin: false } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer() private readonly server?: Namespace;

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token: unknown = client.handshake.auth?.token;
    const rooms = typeof token === 'string' ? await this.roomsFor(token) : null;
    if (!rooms) {
      client.emit('error', { code: 'UNAUTHORIZED' });
      client.disconnect(true);
      return;
    }
    await client.join(rooms);
    client.emit('ready');
  }

  emitToFamily(familyId: string, event: RealtimeEvent): void {
    this.server?.to(`family:${familyId}`).emit(REALTIME_EVENT, event);
  }

  emitToDevice(deviceId: string, event: RealtimeEvent): void {
    this.server?.to(`device:${deviceId}`).emit(REALTIME_EVENT, event);
  }

  private async roomsFor(token: string): Promise<string[] | null> {
    try {
      const userId = await this.tokens.verifyAccess(token, 'user');
      const memberships = await this.prisma.familyMember.findMany({
        where: { userId },
        select: { familyId: true },
      });
      return memberships.map((m) => `family:${m.familyId}`);
    } catch {
      // not a user token; try device
    }
    try {
      const deviceId = await this.tokens.verifyAccess(token, 'device');
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
        select: { status: true },
      });
      return device?.status === 'active' ? [`device:${deviceId}`] : null;
    } catch {
      this.logger.debug('Rejected realtime connection with invalid token');
      return null;
    }
  }
}
