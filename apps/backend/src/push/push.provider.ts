export interface PushMessage {
  token: string;
  /** FCM data payload (string values only). Data-only so the app decides what to do. */
  data: Record<string, string>;
  /** High priority wakes a dozing Android device; use for child-device sync hints. */
  highPriority: boolean;
}

export type PushResult = 'sent' | 'invalid-token' | 'failed';

/** Sends push messages. Implementations are selected by PUSH_PROVIDER. */
export abstract class PushProvider {
  abstract send(message: PushMessage): Promise<PushResult>;
}
