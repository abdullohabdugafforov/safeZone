import {
  createPairingRequestResponseSchema,
  pairingClaimResponseSchema,
  pairingRequestStatusResponseSchema,
  type CreatePairingRequestBody,
  type DeviceInfo,
} from '@safekid/shared';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { DeviceControl } from '@modules/device-control';
import { secureStorage } from '@/lib/secure-storage';

import { api } from './index';
import type { AuthProvider } from './client';

/** Device credentials are owned by the native module; it refreshes them. */
export const deviceAuth: AuthProvider = {
  getAccessToken: () => DeviceControl.getAccessToken(),
  refresh: () => DeviceControl.getAccessToken(),
};

export const childApi = {
  createPairingRequest: (body: CreatePairingRequestBody) =>
    api.post('/pairing/requests', { body, schema: createPairingRequestResponseSchema }),
  pairingStatus: (requestId: string, claimSecret: string) =>
    api.post(`/pairing/requests/${requestId}/status`, {
      body: { claimSecret },
      schema: pairingRequestStatusResponseSchema,
    }),
  claim: (requestId: string, claimSecret: string) =>
    api.post(`/pairing/requests/${requestId}/claim`, {
      body: { claimSecret },
      schema: pairingClaimResponseSchema,
    }),
};

export function currentDeviceInfo(): DeviceInfo {
  const constants = Platform.constants as {
    Model?: string;
    Brand?: string;
    Release?: string | number;
  };
  const model = [constants.Brand, constants.Model].filter(Boolean).join(' ') || 'Unknown';
  return {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    model: model.slice(0, 100),
    osVersion: String(constants.Release ?? Platform.Version).slice(0, 50),
    appVersion: Constants.expoConfig?.version ?? '0.0.0',
  };
}

/** An in-flight pairing request survives app restarts. */
export interface PendingPairing {
  requestId: string;
  claimSecret: string;
  expiresAt: string;
}

const PENDING_KEY = 'safekid.pairing.v1';

export const pendingPairing = {
  get: () => secureStorage.get<PendingPairing>(PENDING_KEY),
  set: (value: PendingPairing) => secureStorage.set(PENDING_KEY, value),
  clear: () => secureStorage.remove(PENDING_KEY),
};
