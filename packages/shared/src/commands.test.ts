import { commandAckBodySchema, createCommandBodySchema } from './commands';
import { fromPushData, toPushData } from './realtime';

describe('createCommandBodySchema', () => {
  it('accepts known commands', () => {
    expect(createCommandBodySchema.safeParse({ type: 'SYNC_NOW', payload: {} }).success).toBe(true);
  });

  it('rejects unknown commands and extra payload keys', () => {
    expect(createCommandBodySchema.safeParse({ type: 'WIPE', payload: {} }).success).toBe(false);
    expect(createCommandBodySchema.safeParse({ type: 'SYNC_NOW', payload: { x: 1 } }).success).toBe(
      false,
    );
  });
});

describe('commandAckBodySchema', () => {
  it('requires an error message on failure', () => {
    expect(commandAckBodySchema.safeParse({ status: 'failed' }).success).toBe(false);
    expect(commandAckBodySchema.safeParse({ status: 'failed', error: 'boom' }).success).toBe(true);
  });
});

describe('push data', () => {
  it('round-trips events through string-only FCM data', () => {
    const event = {
      type: 'device.updated',
      deviceId: '7f9c1b1e-3c1a-4d8e-9a55-3a0c2f0c8b11',
    } as const;
    expect(fromPushData(toPushData(event))).toEqual(event);
  });

  it('ignores unknown messages', () => {
    expect(fromPushData({ type: 'nope' })).toBeNull();
  });
});
