/** Sends text messages. Implementations are selected by SMS_PROVIDER. */
export abstract class SmsProvider {
  /** @param to phone in E.164 */
  abstract send(to: string, text: string): Promise<void>;
}
