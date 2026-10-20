import type { Alert } from '@safekid/shared';
import type { TFunction } from 'i18next';
import {
  Clock,
  EyeSlash,
  ProhibitInset,
  ShieldSlash,
  Trash,
  WifiSlash,
  type Icon,
} from 'phosphor-react-native';

/** Human sentence for an alert, e.g. "Ali tried to open the uninstall screen. It was blocked." */
export function alertText(alert: Alert, childName: string, t: TFunction): string {
  const details = alert.details as { permission?: string; target?: string };
  return t(`alerts.type.${alert.type}`, {
    child: childName,
    permission: details.permission ? t(`disclosure.${details.permission}.title`) : '',
    target: details.target ? t(`alerts.target.${details.target}`) : '',
  });
}

export function alertIcon(alert: Alert): Icon {
  switch (alert.type) {
    case 'PERMISSION_REVOKED':
    case 'ENFORCEMENT_STOPPED':
      return EyeSlash;
    case 'DEVICE_ADMIN_DISABLE_REQUESTED':
    case 'DEVICE_ADMIN_DISABLED':
      return ShieldSlash;
    case 'TAMPER_ATTEMPT':
      return ProhibitInset;
    case 'HEARTBEAT_LOST':
      return WifiSlash;
    case 'APP_REMOVED_SUSPECTED':
      return Trash;
    default:
      return Clock;
  }
}
