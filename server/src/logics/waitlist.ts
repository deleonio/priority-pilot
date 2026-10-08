import { UniqueConstraintError } from 'sequelize';
import { allowEmail } from './allowedEmails.js';
import { sendAccountAccessMail } from './accessMail.js';
import type { MailSender } from './mail.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import WaitlistEntry, { newReferralCode } from '../models/waitlistEntry.js';

/**
 * Warteliste mit Referral-Rang (ADR 0019, #1982): Eintrag, Rangformel und Admin-Freischaltung.
 * Rangformel: Position = Rang in der Sortierung (Anzahl geworbener Anmeldungen absteigend,
 * Anmeldezeitpunkt aufsteigend) — eine neue geworbene Anmeldung verbessert die Position des
 * Werbenden sofort. Freischalten legt eine DB-Zulassung (`AllowedEmail`, origin `'warteliste'`)
 * an, worauf `isDbEmailAllowed` die Adresse annimmt; `WaitlistEntry.status` ist reine Anzeige.
 * E-Mails werden normalisiert (trim + lowercase) wie in allowedEmails.ts.
 */

/** Signalisiert eine ungültige E-Mail — die Route übersetzt das in 400. */
export class InvalidWaitlistEmailError extends Error {}

export type WaitlistJoinResult = {
	/** 1-basierte Position im aktuellen Rang. */
	position: number;
	/** Persönlicher Empfehlungs-Code (Bestandteil des Empfehlungs-Links). */
	referralCode: string;
	/** Gesamtzahl der Einträge — Kontext für die Positions-Anzeige („Position 3 von 87“). */
	total: number;
};

export type WaitlistRankedEntry = {
	id: number;
	email: string;
	status: 'waiting' | 'activated';
	position: number;
	referralCount: number;
	accessMailStatus: 'sent' | 'failed' | null;
	createdAt: string;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Alle Einträge im Rang, Position 1-basiert; referralCount = geworbene Anmeldungen des Eintrags. */
const rankedEntries = async (): Promise<(WaitlistEntry & { position: number; referralCount: number })[]> => {
	const entries = await WaitlistEntry.findAll();
	const referralCount = new Map<string, number>();
	for (const entry of entries) {
		if (entry.referredByCode !== null) {
			referralCount.set(entry.referredByCode, (referralCount.get(entry.referredByCode) ?? 0) + 1);
		}
	}
	return entries
		.map((entry) => ({
			entry,
			count: referralCount.get(entry.referralCode) ?? 0,
		}))
		.sort((a, b) => b.count - a.count || a.entry.createdAt.getTime() - b.entry.createdAt.getTime())
		.map(({ entry, count }, index) => Object.assign(entry, { position: index + 1, referralCount: count }));
};

/**
 * Trägt eine Adresse ein (idempotent): existiert der Eintrag bereits, wird keine zweite Zeile
 * angelegt und `referredByCode` bleibt unverändert — ein mitgeschickter eigener Code kann so
 * niemals als Selbst-Empfehlung zählen. Ein unbekannter Code wird still ignoriert.
 */
export const joinWaitlist = async (
	rawEmail: string,
	rawRef?: string,
	sprache?: CareSprache,
): Promise<WaitlistJoinResult> => {
	const email = normalizeEmail(String(rawEmail ?? ''));
	if (!EMAIL_RE.test(email)) {
		throw new InvalidWaitlistEmailError();
	}

	const existing = await WaitlistEntry.findOne({ where: { email } });
	// Erneuter Eintrag: die zuletzt genutzte Sprache gilt für die spätere Freischalt-Mail.
	if (existing && sprache !== undefined && existing.sprache !== (sprache === 'en' ? 'en' : null)) {
		await existing.update({ sprache: sprache === 'en' ? 'en' : null });
	}
	const entry = existing ?? (await createEntry(email, await resolveReferrer(rawRef, email), sprache));

	const ranked = await rankedEntries();
	const own = ranked.find((candidate) => candidate.id === entry.id);
	return {
		position: own?.position ?? ranked.length,
		referralCode: entry.referralCode,
		total: ranked.length,
	};
};

/** Liefert den Code des Werbers, wenn der Code existiert und nicht der eigene ist; sonst null. */
const resolveReferrer = async (rawRef: string | undefined, email: string): Promise<string | null> => {
	if (typeof rawRef !== 'string' || rawRef === '') {
		return null;
	}
	const referrer = await WaitlistEntry.findOne({ where: { referralCode: rawRef } });
	return referrer !== null && referrer.email !== email ? referrer.referralCode : null;
};

/** findOne→create mit UniqueConstraintError-Retry: zwei parallele Anmeldungen derselben Adresse. */
const createEntry = async (
	email: string,
	referredByCode: string | null,
	sprache?: CareSprache,
): Promise<WaitlistEntry> => {
	try {
		return await WaitlistEntry.create({
			email,
			referralCode: newReferralCode(),
			referredByCode,
			sprache: sprache === 'en' ? 'en' : null,
		});
	} catch (err) {
		if (err instanceof UniqueConstraintError) {
			const existing = await WaitlistEntry.findOne({ where: { email } });
			if (existing) {
				return existing;
			}
		}
		throw err;
	}
};

/** Admin-Sicht: komplette Warteliste im Rang (List-DTO, #1982 AK3/AK4). */
export const listWaitlistRanked = async (): Promise<WaitlistRankedEntry[]> =>
	(await rankedEntries()).map(({ id, email, status, position, referralCount, accessMailStatus, createdAt }) => ({
		id,
		email,
		status,
		position,
		referralCount,
		accessMailStatus,
		createdAt: createdAt.toISOString(),
	}));

/**
 * Verschickt die Freischalt-Mail mit Login-Link (#2305) und hält das Ergebnis am Eintrag fest.
 * Das Tageskontingent `claimAccessMailSlot` gilt hier bewusst nicht; ein Fehlschlag (Transport
 * oder fehlendes Magic-Link-Setup) lässt die Freischaltung wirksam.
 */
const sendActivationMail = async (entry: WaitlistEntry, send?: MailSender): Promise<'sent' | 'failed'> => {
	const sprache = spracheVon(entry.sprache);
	const sent = await sendAccountAccessMail(
		entry.email,
		sprache === 'en'
			? {
					subject: 'Balamentum: You now have access',
					lines: ['you have been let in from the waiting list — you can start using Balamentum now.'],
					sprache,
				}
			: {
					subject: 'Balamentum: Du bist freigeschaltet',
					lines: ['du bist von der Warteliste freigeschaltet — du kannst Balamentum jetzt nutzen.'],
				},
		send,
	);
	const accessMailStatus = sent ? 'sent' : 'failed';
	await entry.update({ accessMailStatus });
	return accessMailStatus;
};

/**
 * Schaltet einen einzelnen Eintrag frei (idempotent) und verschickt die Freischalt-Mail; bei
 * bereits versendeter Mail (`sent`) kein Zweitversand. `null`, wenn die Id unbekannt ist.
 */
export const activateWaitlistEntry = async (
	id: number,
	send?: MailSender,
): Promise<{ status: 'activated'; accessMailStatus: 'sent' | 'failed' } | null> => {
	const entry = await WaitlistEntry.findByPk(id);
	if (entry === null) {
		return null;
	}
	if (entry.status !== 'activated') {
		await entry.update({ status: 'activated' });
	}
	await allowEmail(entry.email, 'warteliste');
	const accessMailStatus = entry.accessMailStatus === 'sent' ? 'sent' : await sendActivationMail(entry, send);
	return { status: 'activated', accessMailStatus };
};

/**
 * Schaltet die Top-N-Einträge nach Position frei („Welle“). Bereits freigeschaltete belegen
 * ihren Platz in den Top N weiterhin (die Welle rückt nicht nach), zählen aber nicht erneut —
 * `activatedCount` meldet nur die neu freigeschalteten Einträge.
 */
export const activateTopWaitlist = async (count: number, send?: MailSender): Promise<number> => {
	const top = (await rankedEntries()).slice(0, count);
	const waiting = top.filter((entry) => entry.status === 'waiting');
	if (waiting.length === 0) {
		return 0;
	}
	const [affected] = await WaitlistEntry.update(
		{ status: 'activated' },
		{ where: { id: waiting.map((entry) => entry.id) } },
	);
	// Sequentiell statt Promise.all: findOrCreate öffnet je eine Transaktion, und die Tests
	// laufen auf einer einzigen In-Memory-SQLite-Verbindung (Muster wie admin.ts-Subquery-Hinweis).
	for (const entry of waiting) {
		await allowEmail(entry.email, 'warteliste');
		await sendActivationMail(entry, send);
	}
	return affected;
};
