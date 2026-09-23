import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { hasGoogleOAuth } from '../requireAuth.js';
import { establishSession } from '../establishSession.js';
import { isEmailAllowed } from '../../logics/allowedEmails.js';
import { sendMailToUser, type MailSender } from '../../logics/mail.js';
import { buildMagicLinkUrl, consumeLoginToken, createLoginToken, isMagicLinkEnabled } from '../../logics/magicLink.js';
import { upsertOAuthUser } from '../../logics/oauthUser.js';
import type { components } from '../../api';

type AuthProvidersDto = components['schemas']['AuthProviders'];
type MagicLinkRequestDto = components['schemas']['MagicLinkRequest'];
type MagicLinkVerifyRequestDto = components['schemas']['MagicLinkVerifyRequest'];

const NOT_CONFIGURED = 'Anmeldung per E-Mail-Link ist nicht konfiguriert (SMTP/PUBLIC_BASE_URL fehlen).';

// Immer dieselbe Antwort, egal ob die Adresse zugelassen ist oder gedrosselt wurde — sonst ließen
// sich zugelassene Adressen über die Antwort ausspähen.
const ACCEPTED = 'Falls die Adresse zugelassen ist, ist ein Anmeldelink unterwegs.';

const mailText = (link: string): string =>
	[
		'Hallo,',
		'',
		'mit diesem Link meldest du dich bei Balamentum an:',
		link,
		'',
		'Der Link ist 15 Minuten gültig und funktioniert genau einmal.',
		'Falls du keinen Link angefordert hast, kannst du diese Mail ignorieren.',
	].join('\n');

/**
 * Magic-Link-Login per E-Mail (zweiter Anmeldeweg neben Google). Hängt wie `authRouter` an der
 * Wurzel unter `/auth/*`, der dort registrierte Auth-Limiter greift damit auch hier.
 * `mailSender` ist injizierbar (Default: nodemailer), Muster `createMailRouter`.
 */
export const createMagicLinkRouter = (mailSender?: MailSender) => {
	const router = Router();

	// GET /auth/providers — welche Anmeldewege die Login-Seite anbieten soll.
	router.get('/auth/providers', (_req, res: Response<AuthProvidersDto>) => {
		res.json({ google: hasGoogleOAuth(), magicLink: isMagicLinkEnabled() });
	});

	// POST /auth/magic-link — Link anfordern. 202 für jede syntaktisch gültige Adresse.
	router.post('/auth/magic-link', async (req: Request, res: Response<ErrorDto>) => {
		if (!isMagicLinkEnabled()) {
			sendError(res, 503, NOT_CONFIGURED);
			return;
		}
		const { email } = (req.body ?? {}) as Partial<MagicLinkRequestDto>;
		const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
		if (!normalizedEmail.includes('@') || normalizedEmail.length > 254) {
			sendError(res, 400, 'Bitte gib eine gültige E-Mail-Adresse an.');
			return;
		}

		if (isEmailAllowed(normalizedEmail)) {
			const token = await createLoginToken(normalizedEmail);
			if (token) {
				await sendMailToUser(
					{ email: normalizedEmail },
					{ subject: 'Dein Anmeldelink für Balamentum', text: mailText(buildMagicLinkUrl(token)) },
					mailSender,
				);
			}
		}
		res.status(202).json({ message: ACCEPTED });
	});

	// POST /auth/magic-link/verify — Token einlösen und anmelden. Bewusst POST: Mail-Scanner rufen
	// Links per GET vorab auf und würden den Token sonst entwerten.
	router.post('/auth/magic-link/verify', async (req: Request, res: Response<ErrorDto>) => {
		if (!isMagicLinkEnabled()) {
			sendError(res, 503, NOT_CONFIGURED);
			return;
		}
		const { token } = (req.body ?? {}) as Partial<MagicLinkVerifyRequestDto>;
		const email = typeof token === 'string' && token !== '' ? await consumeLoginToken(token) : null;
		// Allowlist erneut prüfen: Sie kann sich zwischen Anfordern und Einlösen geändert haben.
		if (!email || !isEmailAllowed(email)) {
			sendError(res, 400, 'Der Anmeldelink ist abgelaufen oder wurde schon benutzt.');
			return;
		}

		// Ohne Profildaten: Name und Avatar eines Bestandsnutzers (z. B. aus Google) bleiben stehen.
		const user = await upsertOAuthUser({ email });
		establishSession(req, user, (sessionErr) => {
			if (sessionErr) {
				sendError(res, 500, 'Session-Fehler.');
				return;
			}
			res.status(204).end();
		});
	});

	return router;
};
