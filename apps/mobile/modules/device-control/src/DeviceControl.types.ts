import type {
  InstalledApp,
  PermissionKind,
  PermissionState,
  PermissionStatus,
  PolicyDocument,
} from '@safekid/shared';

export type { InstalledApp, PermissionKind, PermissionState, PermissionStatus, PolicyDocument };

/**
 * What this platform/OS can do. Screens adapt to capabilities instead of
 * checking `Platform.OS`, so iOS (FamilyControls) can plug in later.
 */
export interface Capabilities {
  /** Permissions this platform needs for enforcement, in the order the wizard asks for them. */
  requiredPermissions: PermissionKind[];
  /** Can list installed apps (Android). iOS uses an opaque picker instead. */
  canListInstalledApps: boolean;
  /** Can prevent uninstalling the app (Android Device Admin). */
  canProtectUninstall: boolean;
}

/** Credentials issued at pairing. Owned by native code (it refreshes them) once handed over. */
export interface DeviceCredentials {
  apiUrl: string;
  deviceId: string;
  accessToken: string;
  refreshToken: string;
}

export interface AppliedPolicy {
  version: number;
  document: PolicyDocument;
}

export interface EnforcementStatus {
  /** Credentials are stored and the background service is running. */
  running: boolean;
  appliedPolicyVersion: number | null;
  permissions: PermissionStatus;
}

export type DeviceControlEvents = {
  /** Emitted when a permission changes (e.g. the child disables accessibility). */
  onPermissionsChanged: (event: { permissions: PermissionStatus }) => void;
  /** Emitted after native code applied a newer policy. */
  onPolicyApplied: (event: { version: number }) => void;
  /** Credentials were rejected by the server (device unlinked). */
  onUnlinked: () => void;
};

export interface DeviceControlApi {
  getCapabilities(): Capabilities;
  getPermissionStatus(): Promise<PermissionStatus>;
  /** Opens the system flow for the permission. Resolves when the flow was launched, not granted. */
  requestPermission(permission: PermissionKind): Promise<void>;
  /** Opens this app's page in system settings (restricted settings, OEM background toggles). */
  openAppSettings(): Promise<void>;

  setDeviceCredentials(credentials: DeviceCredentials): Promise<void>;
  clearDeviceCredentials(): Promise<void>;
  /** Fresh device access token (native refreshes as needed); null if not linked/unlinked. */
  getAccessToken(): Promise<string | null>;

  /** Stores the policy for offline enforcement and applies it immediately. */
  applyPolicy(policy: AppliedPolicy): Promise<void>;
  /** Pulls state from the server now (policy + commands), same as a push "sync". */
  syncNow(): Promise<void>;
  getInstalledApps(): Promise<InstalledApp[]>;

  startEnforcement(): Promise<void>;
  getStatus(): Promise<EnforcementStatus>;
}
