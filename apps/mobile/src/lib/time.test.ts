import { countdown, isOnline, timeAgo } from './time';

const t = ((key: string, opts?: { count?: number }) => `${key}:${opts?.count ?? ''}`) as never;
const now = Date.parse('2026-10-15T12:00:00Z');

describe('time helpers', () => {
  it('formats relative times', () => {
    expect(timeAgo('2026-10-15T11:59:40Z', t, now)).toBe('time.justNow:');
    expect(timeAgo('2026-10-15T11:55:00Z', t, now)).toBe('time.minutesAgo:5');
    expect(timeAgo('2026-10-15T09:00:00Z', t, now)).toBe('time.hoursAgo:3');
    expect(timeAgo('2026-10-13T12:00:00Z', t, now)).toBe('time.daysAgo:2');
  });

  it('formats countdowns', () => {
    expect(countdown(600_000)).toBe('10:00');
    expect(countdown(61_500)).toBe('1:02');
    expect(countdown(-5)).toBe('0:00');
  });

  it('detects online devices', () => {
    expect(isOnline(null, now)).toBe(false);
    expect(isOnline('2026-10-15T11:58:30Z', now)).toBe(true);
    expect(isOnline('2026-10-15T11:50:00Z', now)).toBe(false);
  });
});
