import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { hasGoogleOAuth } from '../requireAuth.js';
import { establishSession } from '../establishSession.js';
import { issueAppToken } from '../apiTokenAuth.js';
import { isDbEmailAllowed, isEmailAllowed, isOpenSignup } from '../../logics/allowedEmails.js';
import { spracheAusHeader, type CareSprache } from '../../logics/careSuggestionData.js';
import { sendMailToUser, type MailSender } from '../../logics/mail.js';
import { renderMailHtml } from '../../logics/mailTemplate.js';
import {
	buildMagicLinkUrl,
	consumeLoginToken,
	createLoginToken,
	isCodeChallenge,
	isMagicLinkEnabled,
	matchesCodeChallenge,
} from '../../logics/magicLink.js';
import { upsertOAuthUser } from '../../logics/oauthUser.js';
import { User } from '../../models/index.js';
import type { components } from '../../api';

type AuthProvidersDto = components['schemas']['AuthProviders'];
type MagicLinkRequestDto = components['schemas']['MagicLinkRequest'];
type MagicLinkVerifyRequestDto = components['schemas']['MagicLinkVerifyRequest'];
type AppTokenDto = components['schemas']['AppToken'];

const NOT_CONFIGURED = 'Anmeldung per E-Mail-Link ist nicht konfiguriert (SMTP/PUBLIC_BASE_URL fehlen).';

// Immer dieselbe Antwort, egal ob die Adresse zugelassen ist oder gedrosselt wurde — sonst ließen
// sich zugelassene Adressen über die Antwort ausspähen.
const ACCEPTED = 'Falls die Adresse zugelassen ist, ist ein Anmeldelink unterwegs.';

const MAIL: Record<
	CareSprache,
	{ subject: string; anrede: string; hinweis: string; hinweise: string[]; button: string }
> = {
	de: {
		subject: 'Dein Anmeldelink für Balamentum',
		anrede: 'Hallo,',
		hinweis: 'mit diesem Link meldest du dich bei Balamentum an:',
		hinweise: [
			'Der Link ist 15 Minuten gültig und funktioniert genau einmal.',
			'Falls du keinen Link angefordert hast, kannst du diese Mail ignorieren.',
		],
		button: 'Anmelden',
	},
	en: {
		subject: 'Your sign-in link for Balamentum',
		anrede: 'Hello,',
		hinweis: 'use this link to sign in to Balamentum:',
		hinweise: [
			'The link is valid for 15 minutes and works exactly once.',
			'If you did not request a link, you can ignore this email.',
		],
		button: 'Sign in',
	},
};

/**
 * Magic-Link-Login per E-Mail (zweiter Anmeldeweg neben Google). Hängt wie `authRouter` an der
 * Wurzel unter `/auth/*`, der dort registrierte Auth-Limiter greift damit auch hier.
 * `mailSender` ist injizierbar (Default: nodemailer), Muster `createMailRouter`.
 */
export const createMagicLinkRouter = (mailSender?: MailSender) => {
	const router = Router();

	// GET /auth/providers — welche Anmeldewege die Login-Seite anbieten soll.
	router.get('/auth/providers', (_req, res: Response<AuthProvidersDto>) => {
		const google = hasGoogleOAuth();
		res.json({
			google,
			magicLink: isMagicLinkEnabled(),
			reviewAccess: Boolean(process.env.PLAY_REVIEW_PASSWORD),
			// Für die native Google-Anmeldung der App (ADR 0023); die Client-ID ist öffentlich.
			...(google ? { googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() } : {}),
		});
	});

	// POST /auth/magic-link — Link anfordern. 202 für jede syntaktisch gültige Adresse.
	router.post('/auth/magic-link', async (req: Request, res: Response<ErrorDto>) => {
		if (!isMagicLinkEnabled()) {
			sendError(res, 503, NOT_CONFIGURED);
			return;
		}
		const { email, codeChallenge } = (req.body ?? {}) as Partial<MagicLinkRequestDto>;
		const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
		if (!normalizedEmail.includes('@') || normalizedEmail.length > 254) {
			sendError(res, 400, 'Bitte gib eine gültige E-Mail-Adresse an.');
			return;
		}
		// App-Links nur mit PKCE-Challenge (#2563): Ein über das Custom Scheme abgefangener Token wäre
		// sonst einlösbar. 400 statt stiller 202 — die Prüfung hängt nur an der Eingabe, nicht an der
		// Allowlist, und verrät daher keine zugelassenen Adressen.
		const clientChannel = req.get('X-Client-Channel');
		if (clientChannel === 'play' && !isCodeChallenge(codeChallenge)) {
			sendError(res, 400, 'Die App muss eine gültige codeChallenge mitschicken.');
			return;
		}

		// Bei offener Registrierung wählt ein unauthentifizierter Absender den Empfänger — anders als
		// bei Google, wo der Nutzer selbst seine (von Google verifizierte) Adresse eintippt. Ohne
		// diese Einschränkung würde der Server Mails an beliebige Fremdadressen verschicken.
		const mayReceiveLink = isOpenSignup()
			? (await User.count({ where: { email: normalizedEmail } })) > 0
			: (await isDbEmailAllowed(normalizedEmail)) || isEmailAllowed(normalizedEmail);

		if (mayReceiveLink) {
			const token = await createLoginToken(normalizedEmail, clientChannel === 'play' ? codeChallenge : null);
			if (token) {
				// Nicht abwarten: die Antwortzeit darf zugelassene Adressen nicht von nicht
				// zugelassenen/gedrosselten unterscheidbar machen (Zeitkanal). `sendMailToUser`
				// fängt Fehler bereits selbst ab.
				const sprache = spracheAusHeader(req.get('accept-language'));
				const mail = MAIL[sprache];
				const link = buildMagicLinkUrl(token, clientChannel);
				const mailHtml = renderMailHtml({
					heading: mail.subject,
					intro: `${mail.anrede} ${mail.hinweis}`,
					button: { label: mail.button, url: link },
					paragraphs: mail.hinweise,
					lang: sprache,
				});
				void sendMailToUser(
					{ email: normalizedEmail },
					{
						subject: mail.subject,
						text: [mail.anrede, '', mail.hinweis, link, '', ...mail.hinweise].join('\n'),
						html: mailHtml.html,
						attachments: mailHtml.attachments,
					},
					mailSender,
				);
			}
		}
		res.status(202).json({ message: ACCEPTED });
	});

	// POST /auth/magic-link/verify — Token einlösen und anmelden. Bewusst POST: Mail-Scanner rufen
	// Links per GET vorab auf und würden den Token sonst entwerten. Im Kanal `play` antwortet die Route
	// statt mit Session-Cookie mit einem App-Token (#2377).
	router.post('/auth/magic-link/verify', async (req: Request, res: Response<AppTokenDto | ErrorDto>) => {
		if (!isMagicLinkEnabled()) {
			sendError(res, 503, NOT_CONFIGURED);
			return;
		}
		const { token, codeVerifier } = (req.body ?? {}) as Partial<MagicLinkVerifyRequestDto>;
		const isApp = req.get('X-Client-Channel') === 'play';
		const consumed = typeof token === 'string' && token !== '' ? await consumeLoginToken(token) : null;
		// PKCE (#2563): Ein gebundener Token gilt nur in der App mit passendem Verifier. Ein Fehlversuch
		// verbraucht ihn trotzdem — ein abgefangener Token bekommt genau einen Versuch.
		const bound = consumed?.codeChallenge;
		const email = consumed && (!bound || (isApp && matchesCodeChallenge(bound, codeVerifier))) ? consumed.email : null;
		// Allowlist erneut prüfen: Sie kann sich zwischen Anfordern und Einlösen geändert haben.
		if (!email || (!(await isDbEmailAllowed(email)) && !isEmailAllowed(email))) {
			sendError(res, 400, 'Der Anmeldelink ist abgelaufen oder wurde schon benutzt.');
			return;
		}

		// Ohne Profildaten: Name und Avatar eines Bestandsnutzers (z. B. aus Google) bleiben stehen.
		const user = await upsertOAuthUser({ email });
		if (isApp) {
			res.json({ token: await issueAppToken(user.id) });
			return;
		}
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
