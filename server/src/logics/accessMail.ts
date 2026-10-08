import type { CareSprache } from './careSuggestionData.js';
import { sendMailToUser, type MailSender } from './mail.js';
import { buildMagicLinkUrl, createLoginToken, isMagicLinkEnabled } from './magicLink.js';

/**
 * Zugangs-Mail an eine frisch freigeschaltete Adresse (#1983, AK4/AK5): Die Benachrichtigung über
 * Einladung oder Delegation ist eine E-Mail mit direktem Konto-Zugang nach dem Magic-Link-Muster
 * (`buildMagicLinkUrl`) — beschreibender Linktext statt nackter URL (BITV 2.4.4, KI-UX-Block),
 * Tonalität nach docs/fuersorge-tonalitaet.md. Versand nur, wenn Magic-Link konfiguriert ist;
 * Transportfehler schluckt `sendMailToUser` selbst. `send` ist injizierbar (Muster `MailSender`
 * in mail.ts), Tests prüfen hieran Versand und Link.
 */
export interface AccessMailContext {
	/** Betreff nennt Absender/Kontext (KI-UX), damit die Mail nicht als Spam wirkt. */
	subject: string;
	/** Anlass-Zeilen zwischen Anrede und Zugangslink (ohne „Hallo," — das ergänzt der Baustein). */
	lines: string[];
	/** Sprache der festen Bausteine; Default `de`. */
	sprache?: CareSprache;
}

/** Feste Bausteine der Zugangs-Mail je Sprache (Anrede, Linkhinweis, Schluss). */
const BAUSTEINE: Record<CareSprache, { anrede: string; link: string; schluss: string }> = {
	de: {
		anrede: 'Hallo,',
		link: 'Konto öffnen und Passwort setzen (der Link gilt 15 Minuten und funktioniert genau einmal):',
		schluss: 'Falls du das nicht erwartet hast, kannst du diese Mail ignorieren.',
	},
	en: {
		anrede: 'Hello,',
		link: 'Open your account and set a password (the link is valid for 15 minutes and works exactly once):',
		schluss: 'If you did not expect this, you can ignore this email.',
	},
};

export const sendAccountAccessMail = async (
	email: string,
	context: AccessMailContext,
	send?: MailSender,
): Promise<boolean> => {
	const bausteine = BAUSTEINE[context.sprache ?? 'de'];
	if (!isMagicLinkEnabled()) {
		return false;
	}
	const token = await createLoginToken(email);
	if (token === null) {
		return false;
	}
	return sendMailToUser(
		{ email },
		{
			subject: context.subject,
			text: [
				bausteine.anrede,
				'',
				...context.lines,
				'',
				bausteine.link,
				buildMagicLinkUrl(token),
				'',
				bausteine.schluss,
			].join('\n'),
		},
		send,
	);
};

/** Obergrenze an Zugangs-Mails an unbekannte Adressen je auslösendem Nutzer und 24 h (#2041). */
const ACCESS_MAIL_DAILY_LIMIT = 10;
const ACCESS_MAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Gleitendes Fenster im Speicher (Muster aiQuotaMeter.ts, keine Tabelle): Zeitstempel je Nutzer. */
const accessMailSends = new Map<number, number[]>();

/**
 * Belegt einen Slot im Tageskontingent des Nutzers (#2041). `false` = Grenze erreicht, die Mail
 * entfällt; Einladung/Delegation und Freischaltung laufen trotzdem. Ein Neustart setzt den Zähler zurück.
 */
export const claimAccessMailSlot = (userId: number, now: number = Date.now()): boolean => {
	const recent = (accessMailSends.get(userId) ?? []).filter((at) => now - at < ACCESS_MAIL_WINDOW_MS);
	if (recent.length >= ACCESS_MAIL_DAILY_LIMIT) {
		accessMailSends.set(userId, recent);
		return false;
	}
	recent.push(now);
	accessMailSends.set(userId, recent);
	return true;
};
