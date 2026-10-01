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
}

export const sendAccountAccessMail = async (
	email: string,
	context: AccessMailContext,
	send?: MailSender,
): Promise<boolean> => {
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
				'Hallo,',
				'',
				...context.lines,
				'',
				'Konto öffnen und Passwort setzen (der Link gilt 15 Minuten und funktioniert genau einmal):',
				buildMagicLinkUrl(token),
				'',
				'Falls du das nicht erwartet hast, kannst du diese Mail ignorieren.',
			].join('\n'),
		},
		send,
	);
};
