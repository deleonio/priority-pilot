import { createHash } from 'node:crypto';
import { Op } from 'sequelize';
import { NotificationLog } from '../models/index.js';
import { sendPushToUser, type PushPayload, type PushSender } from './push.js';
import { istServiceKind, passtImBudget, protokolliereBudget, tagVon } from './pushBudget.js';

/**
 * Budget-Tor und Versand in einem (#2853, Konzept §4): ein fachlicher Push bei erschöpftem
 * Tagesbudget wird verdrängt (kein Versand, kein Fach-Log, kein Budget-Marker), Service-Kinds
 * umgehen das Tor; nach Zustellung entsteht der Budget-Marker, und die Payload trägt den
 * Gruppen-Tag des Kinds.
 */
const versende = async (
	userId: number | undefined,
	kind: string,
	fachSchluessel: string,
	payload: PushPayload,
	send: PushSender | undefined,
	sentAt: Date,
	protokolliere: () => Promise<void>,
): Promise<{ sent: number; removed: number }> => {
	if (!(await passtImBudget(userId, kind, sentAt))) {
		return { sent: 0, removed: 0 };
	}
	const { sent, removed } = await sendPushToUser(userId, { ...payload, tag: tagVon(kind) }, send);
	if (sent > 0) {
		await protokolliere();
		if (!istServiceKind(kind)) {
			await protokolliereBudget(userId, fachSchluessel, sentAt);
		}
	}
	return { sent, removed };
};

/**
 * Gemeinsamer Dedupe-Helfer für fachliche Push-Trigger: prüft vor dem Versand, ob für `kind` +
 * `dedupeKey` bereits ein {@link NotificationLog}-Eintrag existiert, sendet sonst über
 * {@link sendPushToUser} und protokolliert die Zustellung. Der Log-Eintrag entsteht nur bei
 * `sent > 0` — sonst würde ein Schlüssel ohne zustellbare Subscription dauerhaft blockieren.
 * Gebündelte Sends je Nutzer (z. B. `geo-background-job`) nutzen die Geschwister
 * {@link sendDedupedPushBulk}.
 *
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 * @param sentAt Protokoll-Zeitpunkt; Scheduler-Läufe reichen ihren Tick durch — auch das
 *   Push-Budget (#2853) folgt dem lokalen Kalendertag dieses Zeitpunkts.
 */
export const sendDedupedPush = async (
	userId: number | undefined,
	kind: string,
	dedupeKey: string,
	payload: PushPayload,
	send?: PushSender,
	sentAt: Date = new Date(),
): Promise<{ sent: number; removed: number }> => {
	if (await NotificationLog.findOne({ where: { kind, dedupeKey } })) {
		return { sent: 0, removed: 0 };
	}
	return versende(userId, kind, dedupeKey, payload, send, sentAt, async () => {
		await NotificationLog.create({ userId, kind, dedupeKey, sentAt });
	});
};

/**
 * Bulk-Geschwister von {@link sendDedupedPush} für gebündelte Sends je Nutzer (z. B.
 * `geo-background-job`): ein `findAll`-Vorcheck über alle Schlüssel (statt
 * `findOne` je Schlüssel), ein gemeinsamer Versand, danach ein `bulkCreate` mit
 * `ignoreDuplicates` je noch offenem Schlüssel. Protokolliert wie der Einzelfall nur bei
 * `sent > 0`; Zustellung über andere Kanäle (Mail-Fallback) kennt es nicht — deren
 * Protokollierung bleibt beim Aufrufer.
 *
 * @param dedupeKeys Schlüssel der offenen Meldungen; bereits gesendete hat der Aufrufer beim
 *   Sammeln aussortiert — der Vorcheck hier ist die Race-Absicherung zwischen parallelen Läufen.
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 * @param sentAt Protokoll-Zeitpunkt; Scheduler-Läufe reichen ihren Tick durch — `geo-background-job`
 *   dedupet über `sentAt` (24-h-Fenster), nicht nur über den fenster-scoped Schlüssel; auch das
 *   Budget folgt dem lokalen Kalendertag dieses Zeitpunkts.
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
	// Budget-Schlüssel aus den Fach-Schlüsseln; gehasht, weil `dedupeKey` auf 255 Zeichen begrenzt ist.
	const fachSchluessel =
		pending.length === 1
			? (pending[0] ?? '')
			: createHash('sha256').update(pending.join('|')).digest('hex').slice(0, 20);
	return versende(userId, kind, fachSchluessel, payload, send, sentAt, async () => {
		await NotificationLog.bulkCreate(
			pending.map((dedupeKey) => ({ userId, kind, dedupeKey, sentAt })),
			{ ignoreDuplicates: true },
		);
	});
};
