import { Inject, Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '@safekid/shared';

import { APP_CONFIG } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { SmsProvider } from './sms.provider.js';

const BASE_URL = 'https://notify.eskiz.uz/api';

/**
 * Eskiz.uz adapter. NOT yet verified against a live account: confirm endpoints,
 * sender id and message template approval before enabling in production.
 */
@Injectable()
export class EskizSmsProvider extends SmsProvider {
  private readonly logger = new Logger('EskizSms');
  private token: string | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: Env) {
    super();
  }

  async send(to: string, text: string): Promise<void> {
    let res = await this.post(to, text);
    if (res.status === 401) {
      this.token = null;
      res = await this.post(to, text);
    }
    if (!res.ok) {
      this.logger.error(`SMS to ${maskPhone(to)} failed with HTTP ${res.status}`);
      throw new Error('SMS delivery failed');
    }
  }

  private async post(to: string, text: string): Promise<Response> {
    const body = new FormData();
    body.set('mobile_phone', to.replace(/^\+/, ''));
    body.set('message', text);
    body.set('from', this.config.ESKIZ_SENDER ?? '4546');
    return fetch(`${BASE_URL}/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.getToken()}` },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  }

  private async getToken(): Promise<string> {
    if (this.token) return this.token;
    const body = new FormData();
    body.set('email', this.config.ESKIZ_EMAIL ?? '');
    body.set('password', this.config.ESKIZ_PASSWORD ?? '');
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Eskiz login failed with HTTP ${res.status}`);
    const json = (await res.json()) as { data?: { token?: string } };
    if (!json.data?.token) throw new Error('Eskiz login returned no token');
    this.token = json.data.token;
    return this.token;
  }
}
