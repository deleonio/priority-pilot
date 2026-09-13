import nodemailer from 'nodemailer';

/**
 * SMTP-Mail-Versand (#1426) — zweiter Benachrichtigungskanal neben Web-Push (`logics/push.ts`).
 * Konfiguration ausschließlich über die Umgebung (serverweite Infrastruktur, kein Admin-UI,
 * kein Secret in der DB — Spiegel des VAPID-Musters in `push.ts`).
 */

interface MailPayload {
	to: string;
	subject: string;
	text: string;
}

/**
 * Signatur des eigentlichen Versands — injizierbar, damit Tests den SMTP-Transport ohne echten
 * Mailserver ersetzen können (Vorbild: {@link PushSender} in `logics/push.ts:27`).
 */
export type MailSender = (payload: MailPayload) => Promise<void>;

/** Ob SMTP konfiguriert ist (Pflichtwerte: Host + Absender). Steuert das 503-Gate von `POST /mail/test`. */
export const isMailConfigured = (): boolean => !!(process.env.SMTP_HOST?.trim() && process.env.MAIL_FROM?.trim());

/**
 * Standard-Versand über nodemailer. Wird nur erreicht, wenn kein Test-Sender injiziert ist;
 * die aufrufenden Endpunkte/Trigger haben SMTP zuvor über {@link isMailConfigured} abgesichert.
 */
const defaultSender: MailSender = async ({ to, subject, text }) => {
	const transport = nodemailer.createTransport({
		host: process.env.SMTP_HOST?.trim(),
		port: Number(process.env.SMTP_PORT?.trim() || 587),
		secure: process.env.SMTP_SECURE?.trim() === 'true',
		auth: process.env.SMTP_USER?.trim()
			? { user: process.env.SMTP_USER?.trim(), pass: process.env.SMTP_PASSWORD?.trim() }
			: undefined,
	});
	await transport.sendMail({ from: process.env.MAIL_FROM?.trim(), to, subject, text });
};

/** Empfänger (Ausschnitt) — Nutzer ohne `email` werden übersprungen. */
interface MailRecipient {
	email: string | null;
}

/**
 * Verschickt eine Mail an einen Nutzer. Nutzer ohne `email` werden übersprungen (kein Fehler,
 * kein Log). Ein Fehler des Transports wird protokolliert — **ohne** `SMTP_USER`/`SMTP_PASSWORD`
 * im Log-Text — und nicht erneut geworfen, damit der Aufrufer (Push-Versand, Scheduler-Lauf)
 * unberührt bleibt (Spiegel {@link sendPushToUser}). Der Rückgabewert zeigt an, ob der Versand
 * erfolgreich war (Aufrufer entscheiden damit z. B. über `POST /mail/test`s Statuscode oder über
 * `pushSent + mailSent > 0` bei den fachlichen Triggern).
 *
 * @param send injizierbarer Versand (Default: nodemailer); Tests reichen einen Mock herein.
 */
export const sendMailToUser = async (
	user: MailRecipient,
	payload: { subject: string; text: string },
	send: MailSender = defaultSender,
): Promise<boolean> => {
	if (!user.email) {
		return false;
	}
	try {
		await send({ to: user.email, subject: payload.subject, text: payload.text });
		return true;
	} catch {
		// Bewusst KEINE Fehlerdetails loggen (könnten Transport-Meldungen mit Zugangsdaten enthalten) —
		// nur die Tatsache des Fehlschlags, ohne SMTP_USER/SMTP_PASSWORD.
		console.warn('Mail-Versand fehlgeschlagen.');
		return false;
	}
};
