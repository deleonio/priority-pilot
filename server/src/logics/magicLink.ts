import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Op } from 'sequelize';
import { LoginToken } from '../models/index.js';
import { isMailConfigured } from './mail.js';

/**
 * Magic-Link-Login per E-Mail — zweiter Anmeldeweg neben Google. Ein Link ist 15 Minuten gültig
 * und genau einmal einlösbar; gespeichert wird nur der SHA-256 des Tokens.
 */

const TOKEN_TTL_MS = 15 * 60 * 1000;

/** Einmal-Code nach dem Google-Login der nativen App (ADR 0016): nur für den direkten Rücksprung. */
const NATIVE_CODE_TTL_MS = 60 * 1000;

/** Höchstens so viele Links pro Adresse innerhalb von {@link TOKEN_TTL_MS} (Schutz vor Mail-Flut). */
const MAX_TOKENS_PER_WINDOW = 3;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/**
 * Räumt abgelaufene Tokens beider Zwecke weg (kein eigener Aufräum-Job nötig). Nur nach Alter, nicht
 * nach `usedAt`: sonst kann das Löschen einer fremden, gerade erst eingelösten Zeile dazwischenfunken
 * (siehe consumeLoginToken), und verbrauchte Tokens würden nicht mehr gegen MAX_TOKENS_PER_WINDOW zählen.
 */
const purgeExpiredTokens = (now: Date): Promise<number> =>
	LoginToken.destroy({ where: { expiresAt: { [Op.lt]: new Date(now.getTime() - TOKEN_TTL_MS) } } });

/**
 * Öffentliche Basis-URL für den Link in der Mail. Bewusst eine eigene Umgebungsvariable statt des
 * `Host`-Headers: Ein gefälschter Host würde sonst Links mit echtem Token auf fremde Domains erzeugen.
 */
export const publicBaseUrl = (): string | undefined =>
	process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, '') || undefined;

/** Magic Link ist nutzbar, sobald SMTP und `PUBLIC_BASE_URL` konfiguriert sind. */
export const isMagicLinkEnabled = (): boolean => isMailConfigured() && !!publicBaseUrl();

/**
 * Baut den Link, den die Mail enthält. Die App löst `?magic=` per POST ein (kein Verbrauch per GET).
 * Fordert die Android-App den Link an (`X-Client-Channel: play`, #2563), markiert `client=app` den
 * Link: Öffnet ihn ein Browser, bietet die Web-App den Rücksprung in die App an, statt den
 * Einmal-Token still zu verbrauchen.
 */
export const buildMagicLinkUrl = (token: string, clientChannel?: string): string =>
	`${publicBaseUrl()}/app/?magic=${encodeURIComponent(token)}${clientChannel === 'play' ? '&client=app' : ''}`;

/** Format einer PKCE-Challenge: base64url(SHA-256) ohne Padding, genau 43 Zeichen (#2563). */
export const isCodeChallenge = (value: unknown): value is string =>
	typeof value === 'string' && /^[\w-]{43}$/.test(value);

/**
 * Prüft den `codeVerifier` der App gegen die gespeicherte Challenge (PKCE, #2563) — Vergleich in
 * konstanter Zeit. Ohne Verifier gilt die Bindung als nicht erfüllt.
 */
export const matchesCodeChallenge = (challenge: string, verifier: unknown): boolean => {
	if (typeof verifier !== 'string') return false;
	const actual = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
	const expected = Buffer.from(challenge);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
};

/**
 * Legt einen neuen Token für `email` an und liefert den Klartext — oder `null`, wenn für die Adresse
 * im aktuellen Zeitfenster schon {@link MAX_TOKENS_PER_WINDOW} Links verschickt wurden. Abgelaufene
 * und eingelöste Tokens werden dabei mit weggeräumt (kein eigener Aufräum-Job nötig). Mit
 * `codeChallenge` ist der Token an die anfordernde App gebunden (PKCE, #2563).
 */
export const createLoginToken = async (
	email: string,
	codeChallenge: string | null = null,
	now: Date = new Date(),
): Promise<string | null> => {
	await purgeExpiredTokens(now);

	const recent = await LoginToken.count({
		where: { email, purpose: 'magic', createdAt: { [Op.gt]: new Date(now.getTime() - TOKEN_TTL_MS) } },
	});
	if (recent >= MAX_TOKENS_PER_WINDOW) {
		return null;
	}

	const token = randomBytes(32).toString('base64url');
	await LoginToken.create({
		email,
		tokenHash: hashToken(token),
		codeChallenge,
		expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
	});
	return token;
};

/** Einlösbarer Token eines App-Logins: Code nur zusammen mit dem `state` der startenden App. */
export const nativeLoginToken = (code: string, state: string): string => `${code}:${state}`;

/**
 * Legt den Einmal-Code an, den die native App nach dem Google-Login über den App Link einlöst
 * (ADR 0016). Gespeichert wird der Hash von Code und `state`, damit nur die startende App ihn
 * einlösen kann. Ohne Mengenlimit: Er entsteht nur nach einem erfolgreichen Google-Login.
 */
export const createNativeLoginCode = async (email: string, state: string, now: Date = new Date()): Promise<string> => {
	await purgeExpiredTokens(now);
	const code = randomBytes(32).toString('base64url');
	await LoginToken.create({
		email,
		tokenHash: hashToken(nativeLoginToken(code, state)),
		purpose: 'native',
		expiresAt: new Date(now.getTime() + NATIVE_CODE_TTL_MS),
	});
	return code;
};

/**
 * Löst einen Token ein und liefert E-Mail und PKCE-Challenge — `null` bei unbekanntem, abgelaufenem,
 * schon benutztem oder für einen anderen Zweck ausgestelltem Token. Der Verbrauch ist ein einzelnes
 * bedingtes UPDATE: Zwei parallele Einlöseversuche mit demselben Token können so nie beide gewinnen.
 */
export const consumeLoginToken = async (
	token: string,
	purpose: 'magic' | 'native' = 'magic',
	now: Date = new Date(),
): Promise<{ email: string; codeChallenge: string | null } | null> => {
	const tokenHash = hashToken(token);
	// E-Mail vor dem Verbrauch lesen: das Aufräumen in createLoginToken kann zwischen UPDATE und
	// einem nachträglichen findOne dazwischenfunken (fremder Aufruf löscht die soeben eingelöste
	// Zeile, bevor sie hier wieder gelesen wird).
	const row = await LoginToken.findOne({ where: { tokenHash, purpose, usedAt: null, expiresAt: { [Op.gt]: now } } });
	if (!row) {
		return null;
	}
	const [affected] = await LoginToken.update(
		{ usedAt: now },
		{ where: { tokenHash, purpose, usedAt: null, expiresAt: { [Op.gt]: now } } },
	);
	return affected === 1 ? { email: row.email, codeChallenge: row.codeChallenge ?? null } : null;
};
