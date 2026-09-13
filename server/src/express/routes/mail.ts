import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError } from '../http-error.js';
import { requireRole } from '../requireAuth.js';
import { isMailConfigured, sendMailToUser, type MailSender } from '../../logics/mail.js';
import type { components } from '../../api';

type TestMailResultDto = components['schemas']['TestMailResult'];
type ErrorDto = components['schemas']['Error'];

/**
 * Baut den Mail-Router. `mailSender` ist injizierbar (Default: nodemailer in {@link sendMailToUser}),
 * damit Tests den SMTP-Versand ohne echten Mailserver ersetzen können (Vorbild: `routes/push.ts`).
 */
export const createMailRouter = (mailSender?: MailSender) => {
	const router = Router();

	// POST /mail/test — Testmail an die E-Mail-Adresse des angemeldeten Admins (#1426). Nur für
	// Admins (Vorbild: `routes/admin.ts` `requireRole('admin')`). 503, wenn SMTP nicht konfiguriert
	// ist; 502, wenn der Transport wirft (Meldung ohne SMTP_USER/SMTP_PASSWORD).
	router.post('/mail/test', requireRole('admin'), async (req: Request, res: Response<TestMailResultDto | ErrorDto>) => {
		if (!isMailConfigured()) {
			sendError(res, 503, 'SMTP ist nicht konfiguriert (SMTP_HOST/MAIL_FROM fehlen).');
			return;
		}
		const email = req.session?.user?.email;
		if (!email) {
			sendError(res, 401, 'Nicht eingeloggt.');
			return;
		}
		const sent = await sendMailToUser(
			{ email },
			{ subject: 'Testmail', text: 'Dies ist eine Testmail von Priority Pilot.' },
			mailSender,
		);
		if (!sent) {
			sendError(res, 502, 'Testmail konnte nicht versendet werden (SMTP-Transport fehlgeschlagen).');
			return;
		}
		res.json({ sent: true });
	});

	return router;
};
