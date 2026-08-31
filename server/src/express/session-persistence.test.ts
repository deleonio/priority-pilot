import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
	resetDb,
	closeDb,
	startTestServer,
	type TestServer,
	applyTestAuthEnv,
	testLoginResponse,
} from '../test/helpers.js';

/**
 * Rote Spec-Tests für Issue #396 — „Automatisches Login", PR A (Persistente App-Session).
 *
 * Ausgangslage (verifiziert, s. Issue-Analyse): `server/src/express/index.ts` setzt `cookie.maxAge`
 * NUR, wenn `SESSION_TTL` gesetzt ist — ohne die Env-Var entsteht ein reines Session-Cookie, das beim
 * Schließen des Browsers verfällt. Folge: Browser-Neustart → `/auth/me` 401 → App zeigt erneut die
 * `LoginPage`. Zudem fehlt `rolling: true`, sodass sich eine vorhandene Session bei Aktivität nicht
 * verlängert.
 *
 * Diese Tests sind ROT, bis die Umsetzung (PR A) einen verbindlichen Code-Default von
 * `maxAge = 604800 * 1000` (7 Tage) bei unsettem `SESSION_TTL` setzt UND `rolling: true` aktiviert.
 *
 * Bewusst in einer eigenen Datei (nicht `session.test.ts`): jene Datei verwaltet `NODE_ENV` und den
 * Session-Store (`SESSION_STORE`) für ein anderes Ticket (Persistenz via SQLite/Redis) und hat eigene
 * AK-Nummern — eine Vermischung der Env-/Store-Hooks wäre fragil. Hier geht es ausschließlich um
 * Cookie-Lebensdauer (`maxAge`) und Rolling-Verhalten.
 */

// Auth-Kontext muss vor dem Server-Start feststehen (wie in auth.test.ts / session.test.ts).
process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
applyTestAuthEnv('test-secret-for-session-persistence');

const ALLOWED_EMAIL = 'testuser@example.com';
const ALLOWED_NAME = 'Test User';
const SEVEN_DAYS_SECONDS = 604800;

/** Vereinigt alle Set-Cookie-Header einer Response zu einem String (case-insensitive auswertbar). */
const allSetCookies = (res: Response): string => {
	const list =
		typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') ?? ''];
	return list.join('\n');
};

describe('Issue #396 PR A — Persistente App-Session (Default 7 Tage, rolling)', () => {
	let server: TestServer;

	before(async () => {
		// Default erzwingen: weder SESSION_TTL noch ein persistenter Store gesetzt.
		delete process.env.SESSION_TTL;
		delete process.env.SESSION_STORE;
		process.env.NODE_ENV = 'test';
		await resetDb();
		server = await startTestServer();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	// ── AK1 — Default maxAge = 7 Tage, wenn SESSION_TTL nicht gesetzt ist ─────────

	it('AK1a: Set-Cookie enthält Max-Age/Expires ≈ 7 Tage, wenn SESSION_TTL nicht gesetzt ist', async () => {
		const res = await testLoginResponse(server, ALLOWED_EMAIL, { displayName: ALLOWED_NAME });
		assert.equal(res.status, 200, 'Test-Login sollte 200 liefern');

		const all = allSetCookies(res);
		// Heute (ROT): maxAge ist undefined → Set-Cookie hat weder Max-Age noch Expires.
		// Nach PR A: maxAge = 604800*1000 → Max-Age=604800 (alternativ Expires ~7 Tage in der Zukunft).
		if (/expires=/i.test(all) && !/max-age=/i.test(all)) {
			const expiresMatch = all.match(/expires=([^;\n]+)/i);
			assert.ok(expiresMatch, 'Expires-Attribut muss parsebar sein');
			const expires = new Date(expiresMatch![1].trim());
			const sevenDaysMs = SEVEN_DAYS_SECONDS * 1000;
			const diff = Math.abs(expires.getTime() - Date.now() - sevenDaysMs);
			assert.ok(diff < 60_000, `Expires sollte ~7 Tage in der Zukunft liegen, war: ${expiresMatch![1].trim()}`);
		} else {
			assert.match(
				all,
				new RegExp(`max-age=${SEVEN_DAYS_SECONDS}`, 'i'),
				'Set-Cookie muss Max-Age=604800 (7 Tage) enthalten',
			);
		}
	});

	it('AK1b: Session verlängert sich bei Aktivität (rolling) — Folgeanfrage sendet aktualisiertes Set-Cookie', async () => {
		const cookie = await server.login(ALLOWED_EMAIL, { displayName: ALLOWED_NAME });

		// Eine authentifizierte Folgeanfrage OHNE Session-Änderung: mit rolling:true MUSS erneut ein
		// Set-Cookie mit (ungekürztem) 7-Tage-Max-Age gesendet werden. Heute (ROT) fehlt rolling → kein
		// Set-Cookie auf der Leseanfrage.
		const res = await fetch(`${server.baseUrl}/tasks`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'Eingeloggte Anfrage sollte 200 liefern');

		const all = allSetCookies(res);
		assert.ok(all.length > 0 && !all.startsWith('null'), 'rolling:true muss auf jeder Antwort Set-Cookie senden');
		assert.match(
			all,
			new RegExp(`max-age=${SEVEN_DAYS_SECONDS}`, 'i'),
			'Aktualisiertes Set-Cookie muss erneut die vollen 7 Tage Max-Age tragen',
		);
	});
});
