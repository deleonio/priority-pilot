import { User } from '../models/index.js';
import { readGitSha } from './appInfo.js';
import { isMailConfigured, sendMailToUser, type MailSender } from './mail.js';

/**
 * Status-Mail beim Serverstart: in Produktion mit konfiguriertem SMTP erhält jeder Admin-Nutzer
 * (Rolle `admin`) nach erfolgreichem Start eine kurze Mail mit Commit-SHA, Zeitpunkt und
 * Node-Version — so ist nach einem Deploy (PM2-Reload) oder Crash-Restart sichtbar, welcher Stand
 * läuft. Gated auf `NODE_ENV === 'production'` + {@link isMailConfigured}: in Dev (nodemon
 * startet bei jeder Speicherung neu) und in der Test-Suite wird nie gesendet. Bewusste
 * Entscheidungen: keine Rücksicht auf Notification-Preferences (reine Betriebsmeldung an Admins,
 * kein fachlicher Trigger) und keine Drossel — je Neustart (auch Crash-Restart) geht eine Mail.
 */

/** Kurze Anzeige-Form der Commit-SHA (oder „unbekannt", solange deploy.yml nichts gestempelt hat). */
const shortSha = (): string => {
	const sha = readGitSha();
	return sha === 'unbekannt' ? sha : sha.slice(0, 12);
};

/**
 * Verschickt die Status-Mail an alle Admin-Nutzer und liefert die Anzahl erfolgreicher Sendungen.
 *
 * @param send injizierbarer Versand (#1426-Muster, siehe `logics/mail.ts`); Tests reichen einen
 *   Mock herein — ohne Injektion sendet der nodemailer-Transport.
 */
export const sendStartupStatusMail = async (send?: MailSender): Promise<number> => {
	if (process.env.NODE_ENV !== 'production' || !isMailConfigured()) {
		return 0;
	}
	const admins = await User.findAll({ where: { role: 'admin' } });
	const sha = shortSha();
	const startedAt = new Date().toLocaleString('de-DE');
	let sent = 0;
	for (const admin of admins) {
		const delivered = await sendMailToUser(
			{ email: admin.email },
			{
				subject: `Priority Pilot neu gestartet (${sha})`,
				text: [
					'Der Server wurde soeben neu gestartet.',
					'',
					`Commit: ${sha}`,
					`Zeitpunkt: ${startedAt}`,
					`Node: ${process.version}`,
					'',
				].join('\n'),
			},
			send,
		);
		if (delivered) {
			sent += 1;
		}
	}
	return sent;
};
