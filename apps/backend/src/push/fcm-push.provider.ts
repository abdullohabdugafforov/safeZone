import { readFileSync } from 'node:fs';

import { Logger } from '@nestjs/common';
import type { Messaging } from 'firebase-admin/messaging';

import { PushProvider, type PushMessage, type PushResult } from './push.provider.js';

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** Firebase Cloud Messaging via firebase-admin (loaded only when selected). */
export class FcmPushProvider extends PushProvider {
  private readonly logger = new Logger('FcmPush');

  private constructor(private readonly messaging: Messaging) {
    super();
  }

  static async create(serviceAccountPath: string): Promise<FcmPushProvider> {
    const { cert, initializeApp } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    const app = initializeApp({ credential: cert(serviceAccount) }, 'safekid');
    return new FcmPushProvider(getMessaging(app));
  }

  async send({ token, data, highPriority }: PushMessage): Promise<PushResult> {
    try {
      await this.messaging.send({
        token,
        data,
        android: { priority: highPriority ? 'high' : 'normal', ttl: 60 * 60 * 1000 },
        apns: {
          headers: { 'apns-priority': highPriority ? '10' : '5', 'apns-push-type': 'background' },
          payload: { aps: { contentAvailable: true } },
        },
      });
      return 'sent';
    } catch (error) {
      const code = (error as { code?: string }).code ?? 'unknown';
      if (INVALID_TOKEN_CODES.has(code)) return 'invalid-token';
      this.logger.warn(`FCM send failed: ${code}`);
      return 'failed';
    }
  }
}
