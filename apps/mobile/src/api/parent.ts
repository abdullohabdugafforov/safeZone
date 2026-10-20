import {
  approvePairingResponseSchema,
  alertSchema,
  authResponseSchema,
  childSchema,
  commandSchema,
  deviceSchema,
  familySchema,
  installedAppSchema,
  otpRequestResponseSchema,
  pairingCodeResponseSchema,
  pairingRequestSchema,
  policyEnvelopeSchema,
  userSchema,
  type ApprovePairingBody,
  type CreateChildBody,
  type CreateCommandBody,
  type PolicyDocument,
} from '@safekid/shared';
import { z } from 'zod';

import { api, parentAuth } from './index';

const auth = parentAuth;

/** Typed parent-side API. Every response is validated against the shared schemas. */
export const parentApi = {
  requestOtp: (phone: string) =>
    api.post('/auth/otp/request', { body: { phone }, schema: otpRequestResponseSchema }),
  verifyOtp: (phone: string, code: string) =>
    api.post('/auth/otp/verify', { body: { phone, code }, schema: authResponseSchema }),
  logout: (refreshToken: string) => api.post('/auth/logout', { body: { refreshToken } }),
  me: () => api.get('/me', { auth, schema: userSchema }),
  updateMe: (body: { name?: string; locale?: 'uz' | 'ru' | 'en' }) =>
    api.patch('/me', { auth, body, schema: userSchema }),

  families: () => api.get('/families/mine', { auth, schema: z.array(familySchema) }),
  children: (familyId: string) =>
    api.get(`/families/${familyId}/children`, { auth, schema: z.array(childSchema) }),
  createChild: (familyId: string, body: CreateChildBody) =>
    api.post(`/families/${familyId}/children`, { auth, body, schema: childSchema }),
  child: (childId: string) => api.get(`/children/${childId}`, { auth, schema: childSchema }),
  deleteChild: (childId: string) => api.delete(`/children/${childId}`, { auth }),

  createPairingCode: (familyId: string, childId?: string) =>
    api.post(`/families/${familyId}/pairing-codes`, {
      auth,
      body: childId ? { childId } : {},
      schema: pairingCodeResponseSchema,
    }),
  revokePairingCode: (codeId: string) => api.delete(`/pairing-codes/${codeId}`, { auth }),
  pendingPairingRequests: () =>
    api.get('/pairing/requests', { auth, schema: z.array(pairingRequestSchema) }),
  approvePairing: (requestId: string, body: ApprovePairingBody) =>
    api.post(`/pairing/requests/${requestId}/approve`, {
      auth,
      body,
      schema: approvePairingResponseSchema,
    }),
  rejectPairing: (requestId: string) => api.post(`/pairing/requests/${requestId}/reject`, { auth }),

  devices: (childId: string) =>
    api.get(`/children/${childId}/devices`, { auth, schema: z.array(deviceSchema) }),
  deviceApps: (deviceId: string) =>
    api.get(`/devices/${deviceId}/apps`, { auth, schema: z.array(installedAppSchema) }),
  unlinkDevice: (deviceId: string) => api.delete(`/devices/${deviceId}`, { auth }),
  sendCommand: (deviceId: string, body: CreateCommandBody) =>
    api.post(`/devices/${deviceId}/commands`, { auth, body, schema: commandSchema }),

  policy: (childId: string) =>
    api.get(`/children/${childId}/policy`, { auth, schema: policyEnvelopeSchema }),
  updatePolicy: (childId: string, baseVersion: number, document: PolicyDocument) =>
    api.put(`/children/${childId}/policy`, {
      auth,
      body: { baseVersion, document },
      schema: policyEnvelopeSchema,
    }),
  lock: (childId: string, until?: string) =>
    api.post(`/children/${childId}/lock`, {
      auth,
      body: until ? { until } : {},
      schema: policyEnvelopeSchema,
    }),
  unlock: (childId: string) =>
    api.post(`/children/${childId}/unlock`, { auth, schema: policyEnvelopeSchema }),

  alerts: (unreadOnly = false) =>
    api.get(`/alerts${unreadOnly ? '?unreadOnly=true' : ''}`, {
      auth,
      schema: z.array(alertSchema),
    }),
  markAlertRead: (alertId: string) => api.post(`/alerts/${alertId}/read`, { auth }),
};

export const queryKeys = {
  families: ['families'] as const,
  children: (familyId: string) => ['children', familyId] as const,
  child: (childId: string) => ['child', childId] as const,
  devices: (childId: string) => ['devices', childId] as const,
  deviceApps: (deviceId: string) => ['deviceApps', deviceId] as const,
  policy: (childId: string) => ['policy', childId] as const,
  pairingRequests: ['pairingRequests'] as const,
  alerts: ['alerts'] as const,
  unreadAlerts: ['alerts', 'unread'] as const,
};
