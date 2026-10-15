import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  addDeviceControlListener,
  DeviceControl,
  type PermissionStatus,
} from '@modules/device-control';

/** Live permission status: refreshed on mount, when returning from system settings, and on native events. */
export function useDevicePermissions() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const refresh = useCallback(async () => setStatus(await DeviceControl.getPermissionStatus()), []);

  useEffect(() => {
    void refresh();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const native = addDeviceControlListener('onPermissionsChanged', ({ permissions }) =>
      setStatus(permissions),
    );
    return () => {
      appState.remove();
      native?.remove();
    };
  }, [refresh]);

  return { status, refresh };
}
