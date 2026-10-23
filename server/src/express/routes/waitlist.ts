import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { spracheAusHeader } from '../../logics/careSuggestionData.js';
import type { MailSender } from '../../logics/mail.js';
import { confirmWaitlistEntry, InvalidWaitlistEmailError, joinWaitlist } from '../../logics/waitlist.js';
import { sendError } from '../http-error.js';
import { THROTTLED_MESSAGE } from './rateLimit.js';

// Engeres Limit als der allgemeine Auth-Limiter: Jeder Eintrag kann eine Mail an eine fremde
// Adresse auslösen. Nur in Produktion aktiv — Dev/E2E wären sonst gedrosselt.
const waitlistLimiter = rateLimit({
	windowMs: 60 * 60_000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: THROTTLED_MESSAGE,
	skip: () => process.env.NODE_ENV !== 'production',
});

/**
 * Warteliste des Launch-Zugangs (#1982, ADR 0019). Öffentlich und sessionlos; hängt wie
 * `authRouter` an der Wurzel unter `/auth/*`, der dort registrierte Auth-Limiter greift damit auch
 * hier. `mailSender` ist injizierbar (Muster `createMagicLinkRouter`).
 */
export const createWaitlistRouter = (mailSender?: MailSender) => {
	const router = Router();

	// POST /auth/waitlist — trägt eine Adresse ein und löst die Bestätigungs-Mail aus (Double-Opt-in).
	// Idempotent — wiederholter Aufruf derselben Adresse legt kein Duplikat an. `website` ist ein
	// Honeypot-Feld: Menschen sehen es nicht, Bots füllen es — die Anfrage wird dann folgenlos quittiert.
	router.post('/auth/waitlist', waitlistLimiter, async (req, res) => {
		const { email, ref, website } = (req.body ?? {}) as { email?: string; ref?: string; website?: string };
		if (typeof website === 'string' && website !== '') {
			res.json({ confirmationPending: true });
			return;
		}
		try {
			res.json(await joinWaitlist(String(email ?? ''), ref, spracheAusHeader(req.get('accept-language')), mailSender));
		} catch (err) {
			if (err instanceof InvalidWaitlistEmailError) {
				sendError(res, 400, 'Bitte gib eine gültige E-Mail-Adresse an.');
				return;
			}
			throw err;
		}
	});

	// POST /auth/waitlist/confirm — löst den Token aus der Bestätigungs-Mail ein; liefert Position und Code.
	router.post('/auth/waitlist/confirm', waitlistLimiter, async (req, res) => {
		const { token } = (req.body ?? {}) as { token?: string };
		const result = typeof token === 'string' && token !== '' ? await confirmWaitlistEntry(token) : null;
		if (result === null) {
			sendError(res, 400, 'Der Bestätigungslink ist ungültig.');
			return;
		}
		res.json({ confirmationPending: false, ...result });
	});

	return router;
};
