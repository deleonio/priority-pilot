import { createHash, randomBytes } from 'node:crypto';
import { UniqueConstraintError } from 'sequelize';
import { allowEmail } from './allowedEmails.js';
import { sendAccountAccessMail } from './accessMail.js';
import { sendMailToUser, type MailSender } from './mail.js';
import { isMagicLinkEnabled, publicBaseUrl } from './magicLink.js';
import { spracheVon, type CareSprache } from './careSuggestionData.js';
import WaitlistEntry, { newReferralCode } from '../models/waitlistEntry.js';

/**
 * Warteliste mit Referral-Rang (ADR 0019, #1982): Eintrag, Rangformel und Admin-Freischaltung.
 * Rangformel: Position = Rang in der Sortierung (Anzahl geworbener Anmeldungen absteigend,
 * Anmeldezeitpunkt aufsteigend) — eine neue geworbene Anmeldung verbessert die Position des
 * Werbenden sofort. Freischalten legt eine DB-Zulassung (`AllowedEmail`, origin `'warteliste'`)
 * an, worauf `isDbEmailAllowed` die Adresse annimmt; `WaitlistEntry.status` ist reine Anzeige.
 * E-Mails werden normalisiert (trim + lowercase) wie in allowedEmails.ts.
 * Double-Opt-in gegen Bots: Mit konfiguriertem Mailversand zählt ein Eintrag erst nach Klick auf den
 * Bestätigungs-Link (`confirmedAt`) im Rang, bei Empfehlungen und in der Admin-Liste. Ohne
 * Mailversand (Dev/E2E) gilt ein Eintrag sofort als bestätigt.
 */

/** Signalisiert eine ungültige E-Mail — die Route übersetzt das in 400. */
export class InvalidWaitlistEmailError extends Error {}

export type WaitlistPosition = {
	/** 1-basierte Position im aktuellen Rang. */
	position: number;
	/** Persönlicher Empfehlungs-Code (Bestandteil des Empfehlungs-Links). */
	referralCode: string;
	/** Gesamtzahl der bestätigten Einträge — Kontext für die Positions-Anzeige („Position 3 von 87“). */
	total: number;
};

/** `confirmationPending`: die Bestätigungs-Mail ist (ggf.) unterwegs, Position und Code erst nach dem Klick. */
export type WaitlistJoinResult = ({ confirmationPending: false } & WaitlistPosition) | { confirmationPending: true };

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

/** Bestätigte Einträge im Rang, Position 1-basiert; referralCount = geworbene bestätigte Anmeldungen. */
const rankedEntries = async (): Promise<(WaitlistEntry & { position: number; referralCount: number })[]> => {
	const entries = (await WaitlistEntry.findAll()).filter((entry) => entry.confirmedAt !== null);
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

/** Obergrenze an Bestätigungs-Mails je Adresse (ein Intervall) und insgesamt je 24 h gegen Mail-Flut durch Bots. */
const CONFIRM_MAIL_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CONFIRM_MAIL_DAILY_LIMIT = 300;
const confirmMailSends: number[] = [];

/** Gleitendes Fenster im Speicher (Muster `claimAccessMailSlot`): `false` = Tagesgrenze erreicht, die Mail entfällt. */
const hasConfirmMailCapacity = (now: number = Date.now()): boolean => {
	while (confirmMailSends.length > 0 && now - confirmMailSends[0] >= CONFIRM_MAIL_INTERVAL_MS) {
		confirmMailSends.shift();
	}
	return confirmMailSends.length < CONFIRM_MAIL_DAILY_LIMIT;
};

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const CONFIRM_MAIL = {
	de: {
		subject: 'Balamentum: Bitte bestätige deinen Wartelisten-Eintrag',
		text: (confirmLink: string, referralLink: string) =>
			[
				'Hallo,',
				'',
				'bitte bestätige deinen Eintrag auf der Warteliste von Balamentum:',
				confirmLink,
				'',
				'Danach zählt dein Platz. Mit diesem Link lädst du Freundinnen und Freunde ein — je mehr sich darüber anmelden, desto weiter rückst du auf:',
				referralLink,
				'',
				'Falls du dich nicht eingetragen hast, kannst du diese Mail ignorieren.',
			].join('\n'),
	},
	en: {
		subject: 'Balamentum: Please confirm your waitlist entry',
		text: (confirmLink: string, referralLink: string) =>
			[
				'Hello,',
				'',
				'please confirm your entry on the Balamentum waitlist:',
				confirmLink,
				'',
				'Your spot counts after that. Use this link to invite friends — the more of them sign up through it, the further you move up:',
				referralLink,
				'',
				'If you did not sign up, you can ignore this email.',
			].join('\n'),
	},
};

/**
 * Schickt die Bestätigungs-Mail mit frischem Token; höchstens eine je Adresse und 24 h, dazu die globale
 * Tagesgrenze. Beides wird nur bei erfolgreichem Versand gebucht, ein Fehlschlag erlaubt den nächsten Versuch.
 */
const sendConfirmationMail = async (entry: WaitlistEntry, send?: MailSender): Promise<void> => {
	const sentAt = entry.confirmMailSentAt?.getTime();
	if (sentAt !== undefined && Date.now() - sentAt < CONFIRM_MAIL_INTERVAL_MS) {
		return;
	}
	if (!hasConfirmMailCapacity()) {
		return;
	}
	const token = randomBytes(32).toString('base64url');
	await entry.update({ confirmTokenHash: hashToken(token) });
	const mail = CONFIRM_MAIL[spracheVon(entry.sprache)];
	const sent = await sendMailToUser(
		{ email: entry.email },
		{
			subject: mail.subject,
			text: mail.text(
				`${publicBaseUrl()}/app/?waitlist=${encodeURIComponent(token)}`,
				`${publicBaseUrl()}/app/?ref=${entry.referralCode}`,
			),
		},
		send,
	);
	if (sent) {
		confirmMailSends.push(Date.now());
		await entry.update({ confirmMailSentAt: new Date() });
	}
};

/**
 * Trägt eine Adresse ein (idempotent): existiert der Eintrag bereits, wird keine zweite Zeile
 * angelegt und `referredByCode` bleibt unverändert — ein mitgeschickter eigener Code kann so
 * niemals als Selbst-Empfehlung zählen. Ein unbekannter Code wird still ignoriert. Mit Mailversand
 * antwortet die Funktion immer mit `confirmationPending` (auch für bestätigte Adressen, damit sich
 * fremde Einträge nicht auslesen lassen); Position und Code liefert erst {@link confirmWaitlistEntry}.
 */
export const joinWaitlist = async (
	rawEmail: string,
	rawRef?: string,
	sprache?: CareSprache,
	send?: MailSender,
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

	if (!isMagicLinkEnabled()) {
		if (entry.confirmedAt === null) {
			await entry.update({ confirmedAt: new Date() });
		}
		return { confirmationPending: false, ...(await positionOf(entry)) };
	}
	await sendConfirmationMail(entry, send);
	return { confirmationPending: true };
};

/** Position und Code eines bestätigten Eintrags im aktuellen Rang. */
const positionOf = async (entry: WaitlistEntry): Promise<WaitlistPosition> => {
	const ranked = await rankedEntries();
	const own = ranked.find((candidate) => candidate.id === entry.id);
	return { position: own?.position ?? ranked.length, referralCode: entry.referralCode, total: ranked.length };
};

/** Bestätigt den Eintrag zum Token aus der Mail (idempotent); `null` bei unbekanntem Token. */
export const confirmWaitlistEntry = async (token: string): Promise<WaitlistPosition | null> => {
	const entry = await WaitlistEntry.findOne({ where: { confirmTokenHash: hashToken(token) } });
	if (entry === null) {
		return null;
	}
	if (entry.confirmedAt === null) {
		await entry.update({ confirmedAt: new Date() });
	}
	return positionOf(entry);
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
