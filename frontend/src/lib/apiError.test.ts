import { ResponseError } from 'client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

/**
 * Real-Flow (CI-Run 32635064021): openapi-fetch liest den Body JEDER non-ok Response selbst —
 * danach wirft `response.clone()`, und ohne Body-Feld würde der 401 fälschlich in den
 * Session-Fallback fallen. Genau so wirft `api.ts` (ResponseError mit konsumierter Response
 * + geparstem `body`).
 */
const consumedResponseError = (status: number, body: unknown): ResponseError => {
	const response = {
		status,
		clone: () => {
			throw new TypeError('Response.clone: Body has already been consumed.');
		},
	} as unknown as Response;
	return new ResponseError(response, body);
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

	// Real-Flow-Regression (e2e issue-620 „API-Key ungültig" war rot): Body aus dem
	// ResponseError.body-Feld, Response bereits konsumiert — clone() wirft.
	it('401 mit fremder Message und konsumierter Response (Real-Flow) → KI-Meldung bleibt', async () => {
		const result = await toApiError(consumedResponseError(401, { message: 'Unauthorized: Invalid API key' }));

		expect(result.status).toBe(401);
		expect(result.message).toBe(KI_CONFIG_TEXT);
	});

	it('401 mit Session-Message und konsumierter Response (Real-Flow) → Session-Meldung', async () => {
		const result = await toApiError(consumedResponseError(401, { message: 'Nicht eingeloggt.' }));

		expect(result.status).toBe(401);
		expect(result.message).toBe(SESSION_TEXT);
	});
});

/**
 * Rote Spec-Tests für #1231 (Spec docs/spec/issue-1231.md, Ereignis-Vertrag): Genau die
 * Session-401-Lagen, die auf SESSION_TEXT mappen (#948), feuern einmal das DOM-Event
 * `pp:session-expired` auf window — der globale SessionExpiredDialog öffnet sich danach.
 * Jede andere 401-Ursache (LLM/Proxy), 403 und sonstige Fehler feuern NICHT.
 */
describe('toApiError — Session-Expired-Event (#1231, Spec issue-1231.md)', () => {
	const SESSION_EXPIRED_EVENT = 'pp:session-expired';

	let fired: number;
	const listener = (): void => {
		fired += 1;
	};

	beforeEach(() => {
		fired = 0;
		window.addEventListener(SESSION_EXPIRED_EVENT, listener);
	});

	afterEach(() => {
		window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
	});

	it.each(SESSION_MESSAGES)('AK1: 401 mit Session-Message "%s" feuert das Event genau 1×', async (message) => {
		await toApiError(responseError(401, { message }));
		expect(fired).toBe(1);
	});

	it('AK1: 401 ohne lesbaren Body (Session-Fallback) feuert das Event genau 1×', async () => {
		await toApiError(responseError(401));
		expect(fired).toBe(1);
	});

	it('AK2: 401 mit fremder Message (LLM/Proxy „Invalid API key") feuert NICHT', async () => {
		await toApiError(responseError(401, { message: 'Invalid API key' }));
		expect(fired).toBe(0);
	});

	it('AK2: 403 und andere Fehler feuern NICHT', async () => {
		await toApiError(responseError(403, { message: 'Nicht eingeloggt.' }));
		await toApiError(responseError(500, { message: 'boom' }));
		await toApiError(new Error('fetch failed'));
		expect(fired).toBe(0);
	});
});
