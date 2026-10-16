import type { User } from '../models/index.js';

/**
 * Rechnungsadresse am Konto (#2661): erforderlich vor jedem Abo-Abschluss, verpflichtender
 * Bestandteil jeder Rechnung und des Rechnungs-PDFs. Gespeichert am User (`billing*`-Spalten),
 * nicht am Abo — Änderungen wirken auf alle Rechnungen ab dem Speichern.
 */

/** Felder der Rechnungsadresse nach `trim()` — alle Pflicht (#2661 AK2). */
export interface BillingAddress {
	name: string;
	street: string;
	zip: string;
	city: string;
	country: string;
}

/** Maximale Feldlänge nach `trim()` — Spiegel `MAX_DISPLAY_NAME_LENGTH` (profile.ts). */
const MAX_FIELD_LENGTH = 120;

const trimTo = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length === 0 || trimmed.length > MAX_FIELD_LENGTH ? null : trimmed;
};

/**
 * Liest und prüft die Rechnungsadresse aus einem Request-Body: alle fünf Felder sind Pflicht,
 * je 1 bis 120 Zeichen nach `trim()` (Muster `extractDisplayName`, profile.ts). Ungültig oder
 * unvollständig → `null` (Aufrufer antwortet mit 400).
 */
export const extractBillingAddress = (body: unknown): BillingAddress | null => {
	if (typeof body !== 'object' || body === null) return null;
	const { name, street, zip, city, country } = body as Record<string, unknown>;
	const trimmedName = trimTo(name);
	const trimmedStreet = trimTo(street);
	const trimmedZip = trimTo(zip);
	const trimmedCity = trimTo(city);
	const trimmedCountry = trimTo(country);
	if (
		trimmedName === null ||
		trimmedStreet === null ||
		trimmedZip === null ||
		trimmedCity === null ||
		trimmedCountry === null
	) {
		return null;
	}
	return { name: trimmedName, street: trimmedStreet, zip: trimmedZip, city: trimmedCity, country: trimmedCountry };
};

/** `true`, wenn am Konto eine vollständige Rechnungsadresse erfasst ist — sonst kein Abo-Abschluss. */
export const hasBillingAddress = (user: User): boolean =>
	[user.billingName, user.billingStreet, user.billingZip, user.billingCity, user.billingCountry].every(
		(value) => typeof value === 'string' && value.trim().length > 0,
	);

/**
 * Empfänger-Adresszeilen der Rechnung (#2661 AK3) — der PDF-Adressblock, Zeile für Zeile.
 * Bei (nach #2661 ausgeschlossener) fehlender Adresse bleibt nur der Anzeigename.
 */
export const billingAddressLines = (
	user: Pick<User, 'displayName' | 'billingName' | 'billingStreet' | 'billingZip' | 'billingCity' | 'billingCountry'>,
): string[] =>
	[
		user.billingName ?? user.displayName,
		user.billingStreet ?? null,
		user.billingZip || user.billingCity ? [user.billingZip, user.billingCity].filter(Boolean).join(' ') : null,
		user.billingCountry ?? null,
	].filter((line): line is string => line !== null && line.length > 0);
