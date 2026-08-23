import { ResponseError } from 'client';
import { describe, expect, it } from 'vitest';

import { toApiError } from './apiError';

/**
 * Rote Spec-Tests für #948 — Session-401 vs. KI-401 in `toApiError`.
 *
 * Spezifikation: `docs/spec/issue-948.md` (Mapping-Tabelle). Der Serververtrag liefert 401
 * ausschließlich aus der Session-Auth (`requireAuth` → „Nicht eingeloggt.", Auth-Routen →
 * „Ungültige Zugangsdaten."); LLM-Fehler kommen serverseitig als 502/503. Aktuell übersetzt
 * `toApiError` JEDES 401 pauschal in den KI-Konfigurationstext — deshalb sind die AK1-Tests rot.
 * Die AK2/AK3-Tests sichern Bestandsverhalten (#620) gegen einen überzogenen Umbau.
 */

/** Bekannte Session-401-Messages aus dem Serververtrag (führende Quelle: server/src/express). */
const SESSION_MESSAGES = ['Nicht eingeloggt.', 'Ungültige Zugangsdaten.'] as const;

const SESSION_TEXT = 'Nicht eingeloggt. Bitte melde dich erneut an.';
const KI_CONFIG_TEXT = 'Die KI-Konfiguration ist ungültig. Bitte prüfe die Einstellungen.';
const KI_DIENT_TEXT = 'Der KI-Dienst ist gerade nicht erreichbar. Bitte versuche es später erneut.';

/** ResponseError mit fake Response; `toApiError` liest nur `.status` und `.clone().json()`. */
const responseError = (status: number, body?: unknown): ResponseError => {
	const response = {
		status,
		clone: () => ({
			json: body === undefined ? async () => Promise.reject(new Error('kein JSON')) : async () => body,
		}),
	} as unknown as Response;
	return new ResponseError(response);
};

describe('toApiError — 401 Session vs. KI (#948, Spec issue-948.md)', () => {
	// AK1: Session-401 (lesbarer Body) → Session-Meldung, keine KI-Meldung.
	it.each(SESSION_MESSAGES)('401 mit Server-Message "%s" → Session-Meldung statt KI-Text', async (message) => {
		const result = await toApiError(responseError(401, { message }));

		expect(result.status).toBe(401);
		expect(result.message).toBe(SESSION_TEXT);
	});

	// AK1 (catch-Zweig): 401 ohne lesbaren JSON-Body → Session-Fallback statt KI-Text.
	it('401 ohne lesbaren Body → Session-Fallback statt KI-Text', async () => {
		const result = await toApiError(responseError(401));

		expect(result.status).toBe(401);
		expect(result.message).toBe(SESSION_TEXT);
	});

	// AK2 (#620-Bestandsschutz): 401 mit NICHT-Session-Message (LLM-/Proxy-Kontext) → KI-Meldung bleibt.
	it('401 mit fremder Message (LLM-Kontext) → KI-Konfigurations-Meldung bleibt', async () => {
		const result = await toApiError(responseError(401, { message: 'Invalid API key' }));

		expect(result.status).toBe(401);
		expect(result.message).toBe(KI_CONFIG_TEXT);
	});

	// AK3: 502/503/504-Mapping (#620) bleibt unverändert.
	it.each([502, 503, 504])('%i → KI-Dienst-Meldung unverändert (#620)', async (status) => {
		const result = await toApiError(responseError(status, { message: 'upstream failed' }));

		expect(result.status).toBe(status);
		expect(result.message).toBe(KI_DIENT_TEXT);
	});

	// AK3: übrige Statuscodes reichen die Server-Message durch (409 Zyklus, 400 Validierung).
	it.each([
		[409, 'Es würde ein Zyklus entstehen.'],
		[400, 'text muss ein nicht-leerer String sein.'],
	] as const)('%i → Server-Message wird durchgereicht', async (status, message) => {
		const result = await toApiError(responseError(status, { message }));

		expect(result.status).toBe(status);
		expect(result.message).toBe(message);
	});
});
