import { createHash, randomBytes } from 'node:crypto';
import { Op } from 'sequelize';
import { LoginToken } from '../models/index.js';
import { isMailConfigured } from './mail.js';

/**
 * Magic-Link-Login per E-Mail — zweiter Anmeldeweg neben Google. Ein Link ist 15 Minuten gültig
 * und genau einmal einlösbar; gespeichert wird nur der SHA-256 des Tokens.
 */

const TOKEN_TTL_MS = 15 * 60 * 1000;

/** Höchstens so viele Links pro Adresse innerhalb von {@link TOKEN_TTL_MS} (Schutz vor Mail-Flut). */
const MAX_TOKENS_PER_WINDOW = 3;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/**
 * Öffentliche Basis-URL für den Link in der Mail. Bewusst eine eigene Umgebungsvariable statt des
 * `Host`-Headers: Ein gefälschter Host würde sonst Links mit echtem Token auf fremde Domains erzeugen.
 */
const publicBaseUrl = (): string | undefined => process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, '') || undefined;

/** Magic Link ist nutzbar, sobald SMTP und `PUBLIC_BASE_URL` konfiguriert sind. */
export const isMagicLinkEnabled = (): boolean => isMailConfigured() && !!publicBaseUrl();

/** Baut den Link, den die Mail enthält. Die App löst `?magic=` per POST ein (kein Verbrauch per GET). */
export const buildMagicLinkUrl = (token: string): string =>
	`${publicBaseUrl()}/app/?magic=${encodeURIComponent(token)}`;

/**
 * Legt einen neuen Token für `email` an und liefert den Klartext — oder `null`, wenn für die Adresse
 * im aktuellen Zeitfenster schon {@link MAX_TOKENS_PER_WINDOW} Links verschickt wurden. Abgelaufene
 * und eingelöste Tokens werden dabei mit weggeräumt (kein eigener Aufräum-Job nötig).
 */
export const createLoginToken = async (email: string, now: Date = new Date()): Promise<string | null> => {
	await LoginToken.destroy({ where: { [Op.or]: [{ expiresAt: { [Op.lt]: now } }, { usedAt: { [Op.ne]: null } }] } });

	const recent = await LoginToken.count({
		where: { email, createdAt: { [Op.gt]: new Date(now.getTime() - TOKEN_TTL_MS) } },
	});
	if (recent >= MAX_TOKENS_PER_WINDOW) {
		return null;
	}

	const token = randomBytes(32).toString('base64url');
	await LoginToken.create({ email, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS) });
	return token;
};

/**
 * Löst einen Token ein und liefert die zugehörige E-Mail — `null` bei unbekanntem, abgelaufenem oder
 * schon benutztem Token. Der Verbrauch ist ein einzelnes bedingtes UPDATE: Zwei parallele Einlöse-
 * versuche mit demselben Token können so nie beide gewinnen.
 */
export const consumeLoginToken = async (token: string, now: Date = new Date()): Promise<string | null> => {
	const tokenHash = hashToken(token);
	const [affected] = await LoginToken.update(
		{ usedAt: now },
		{ where: { tokenHash, usedAt: null, expiresAt: { [Op.gt]: now } } },
	);
	if (affected !== 1) {
		return null;
	}
	const row = await LoginToken.findOne({ where: { tokenHash } });
	return row?.email ?? null;
};
