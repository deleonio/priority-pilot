import { Op } from 'sequelize';
import { NotificationLog } from '../models/index.js';
import { sendPushToUser, type PushPayload, type PushSender } from './push.js';

/**
 * Gemeinsamer Dedupe-Helfer für fachliche Push-Trigger: prüft vor dem Versand, ob für `kind` +
 * `dedupeKey` bereits ein {@link NotificationLog}-Eintrag existiert, sendet sonst über
 * {@link sendPushToUser} und protokolliert die Zustellung. Der Log-Eintrag entsteht nur bei
 * `sent > 0` — sonst würde ein Schlüssel ohne zustellbare Subscription dauerhaft blockieren.
 * Gebündelte Sends je Nutzer (z. B. `dueTaskReminders`) nutzen die Geschwister
 * {@link sendDedupedPushBulk}.
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

/**
 * Bulk-Geschwister von {@link sendDedupedPush} für gebündelte Sends je Nutzer (z. B.
 * `dueTaskReminders`, `geo-background-job`): ein `findAll`-Vorcheck über alle Schlüssel (statt
 * `findOne` je Schlüssel), ein gemeinsamer Versand, danach ein `bulkCreate` mit
 * `ignoreDuplicates` je noch offenem Schlüssel. Protokolliert wie der Einzelfall nur bei
 * `sent > 0`; Zustellung über andere Kanäle (Mail-Fallback) kennt es nicht — deren
 * Protokollierung bleibt beim Aufrufer.
 *
 * @param dedupeKeys Schlüssel der offenen Meldungen; bereits gesendete hat der Aufrufer beim
 *   Sammeln aussortiert — der Vorcheck hier ist die Race-Absicherung zwischen parallelen Läufen.
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 * @param sentAt Protokoll-Zeitpunkt; Scheduler-Läufe reichen ihren Tick durch — `geo-background-job`
 *   dedupet über `sentAt` (24-h-Fenster), nicht nur über den fenster-scoped Schlüssel.
 */
export const sendDedupedPushBulk = async (
	userId: number | undefined,
	kind: string,
	dedupeKeys: string[],
	payload: PushPayload,
	send?: PushSender,
	sentAt: Date = new Date(),
): Promise<{ sent: number; removed: number }> => {
	if (dedupeKeys.length === 0) {
		return { sent: 0, removed: 0 };
	}
	const sentKeys = new Set(
		(await NotificationLog.findAll({ where: { kind, dedupeKey: { [Op.in]: dedupeKeys } } })).map(
			(row) => row.dedupeKey,
		),
	);
	const pending = dedupeKeys.filter((key) => !sentKeys.has(key));
	if (pending.length === 0) {
		return { sent: 0, removed: 0 };
	}
	const { sent, removed } = await sendPushToUser(userId, payload, send);
	if (sent > 0) {
		await NotificationLog.bulkCreate(
			pending.map((dedupeKey) => ({ userId, kind, dedupeKey, sentAt })),
			{ ignoreDuplicates: true },
		);
	}
	return { sent, removed };
};
