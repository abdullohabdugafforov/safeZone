import { requireOptionalNativeModule } from 'expo';

import type { DeviceControlApi, DeviceControlEvents } from './src/DeviceControl.types';

export * from './src/DeviceControl.types';

type NativeDeviceControl = DeviceControlApi & {
  addListener<E extends keyof DeviceControlEvents>(
    event: E,
    listener: DeviceControlEvents[E],
  ): { remove(): void };
};

const native = requireOptionalNativeModule<NativeDeviceControl>('DeviceControl');

/** True when the native module is present in this build (Android dev/prod builds). */
export const isDeviceControlAvailable = native !== null;

function requireNative(): NativeDeviceControl {
  if (!native)
    throw new Error('DeviceControl native module is not available on this platform/build');
  return native;
}

/** Platform-agnostic facade over the native device-control module. */
export const DeviceControl: DeviceControlApi = {
  getCapabilities: () =>
    native?.getCapabilities() ?? {
      requiredPermissions: [],
      canListInstalledApps: false,
      canProtectUninstall: false,
    },
  getPermissionStatus: async () => (native ? native.getPermissionStatus() : {}),
  requestPermission: (permission) => requireNative().requestPermission(permission),
  openAppSettings: () => requireNative().openAppSettings(),
  setDeviceCredentials: (credentials) => requireNative().setDeviceCredentials(credentials),
  clearDeviceCredentials: async () => native?.clearDeviceCredentials(),
  getAccessToken: async () => (native ? native.getAccessToken() : null),
  applyPolicy: (policy) => requireNative().applyPolicy(policy),
  syncNow: async () => native?.syncNow(),
  getInstalledApps: async () => (native ? native.getInstalledApps() : []),
  startEnforcement: () => requireNative().startEnforcement(),
  getStatus: async () =>
    native ? native.getStatus() : { running: false, appliedPolicyVersion: null, permissions: {} },
};

export function addDeviceControlListener<E extends keyof DeviceControlEvents>(
  event: E,
  listener: DeviceControlEvents[E],
): { remove(): void } | null {
  return native?.addListener(event, listener) ?? null;
}
