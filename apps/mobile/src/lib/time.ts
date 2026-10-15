import type { TFunction } from 'i18next';

/** Short "5 min ago" style label (Intl.RelativeTimeFormat is not reliable on Hermes). */
export function timeAgo(iso: string, t: TFunction, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  return t('time.daysAgo', { count: Math.floor(hours / 24) });
}

/** "HH:mm" in local time. */
export function clockTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "m:ss" countdown. */
export function countdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Device counts as online if it sent a heartbeat within ~1.5 heartbeat intervals. */
export function isOnline(lastHeartbeatAt: string | null, now = Date.now()): boolean {
  return lastHeartbeatAt !== null && now - Date.parse(lastHeartbeatAt) < 20 * 60_000;
}
