import { NotificationLog } from '../models/index.js';
import { sendPushToUser, type PushPayload, type PushSender } from './push.js';

/**
 * Gemeinsamer Dedupe-Helfer für fachliche Push-Trigger: prüft vor dem Versand, ob für `kind` +
 * `dedupeKey` bereits ein {@link NotificationLog}-Eintrag existiert, sendet sonst über
 * {@link sendPushToUser} und protokolliert die Zustellung. Der Log-Eintrag entsteht nur bei
 * `sent > 0` — sonst würde ein Schlüssel ohne zustellbare Subscription dauerhaft blockieren.
 * Gebündelte Sends je Nutzer (z. B. `dueTaskReminders`) protokollieren weiterhin bulk-weise im
 * Aufrufer; der Helfer deckt den Einzelfall ab.
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const sendDedupedPush = async (
	userId: number | undefined,
	kind: string,
	dedupeKey: string,
	payload: PushPayload,
	send?: PushSender,
): Promise<{ sent: number; removed: number }> => {
	if (await NotificationLog.findOne({ where: { kind, dedupeKey } })) {
		return { sent: 0, removed: 0 };
	}
	const { sent, removed } = await sendPushToUser(userId, payload, send);
	if (sent > 0) {
		await NotificationLog.create({ userId, kind, dedupeKey, sentAt: new Date() });
	}
	return { sent, removed };
};
