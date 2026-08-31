import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAuth } from './auth';

/**
 * Spec-Tests für `checkAuth`: Die Funktion fragt den Auth-Status über `GET /auth/me` ab.
 *
 * Vertrag (#192/PR #199 — 401/5xx-Differenzierung):
 *  - HTTP 200 → das User-Objekt `{ id, name, email }` wird zurückgegeben.
 *  - HTTP 401 → `null` (= unauthentifiziert → Login-Seite).
 *  - jede andere non-ok-Antwort (z. B. 5xx) → wirft, damit `Root.tsx` einen Fehler-Zustand
 *    (Fehlermeldung statt Login-Seite) anzeigen kann.
 *
 * `global.fetch` wird mit `vi.fn()` gemockt, damit der Test deterministisch und ohne echtes Backend
 * läuft.
 */
describe('checkAuth', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('gibt bei HTTP 200 das User-Objekt zurück', async () => {
		const user = { id: 1, name: 'Test User', email: 'test@example.com' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => user,
		}) as unknown as typeof fetch;

		// Issue #217: checkAuth normalisiert avatarUrl auf null, wenn die API es nicht liefert.
		await expect(checkAuth()).resolves.toEqual({ ...user, avatarUrl: null });
	});

	it('ruft den Endpunkt /auth/me auf', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ id: 1, name: 'Test User', email: 'test@example.com' }),
		});
		global.fetch = fetchMock as unknown as typeof fetch;

		await checkAuth();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
		expect(calledUrl).toContain('/auth/me');
	});

	it('gibt bei HTTP 401 null zurück', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			json: async () => ({ error: 'Unauthorized' }),
		}) as unknown as typeof fetch;

		await expect(checkAuth()).resolves.toBeNull();
	});

	it('wirft bei einer non-ok-Antwort (z. B. 500), statt null zurückzugeben', async () => {
		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ error: 'Internal Server Error' }),
		}) as unknown as typeof fetch;

		await expect(checkAuth()).rejects.toThrow();
	});
});

// ── Issue #1136 — checkAuth: 30-s-Timeout gegen den Dauerspinner ───────────
// Vertrag (docs/spec/issue-1136.md, AK1): checkAuth() bindet den /auth/me-Fetch an ein
// AbortSignal aus AbortSignal.timeout(30000). Löst das Signal ab, rejected checkAuth(),
// statt ewig zu warten (Root hängt sonst dauerhaft im Lade-Spinner).
//
// Determinismus: AbortSignal.timeout läuft auf Node-internen Timern und folgt KEINEN
// Fake-Timern. Deshalb ersetzt der Spy AbortSignal.timeout durch eine echtes Timeout(0)
// — das Signal bricht nach ~1 ms ab — und merkt sich das geforderte Limit zur Assertion.

describe('Issue #1136 — checkAuth: 30-s-Timeout', () => {
	const originalFetch = global.fetch;
	const originalTimeout = AbortSignal.timeout;

	afterEach(() => {
		global.fetch = originalFetch;
		AbortSignal.timeout = originalTimeout;
	});

	it('AC-1136-1: bindet den Fetch an AbortSignal.timeout(30000)', async () => {
		let requestedTimeoutMs: number | undefined;
		let passedSignal: AbortSignal | undefined;

		AbortSignal.timeout = ((ms: number) => {
			requestedTimeoutMs = ms;
			passedSignal = originalTimeout.call(AbortSignal, 0); // bricht nach ~1 ms ab
			return passedSignal;
		}) as typeof AbortSignal.timeout;

		// Fetch antwortet nie — nur der Signal-Abbruch kann den Check beenden.
		global.fetch = vi.fn((_url: unknown, init?: { signal?: AbortSignal }) => {
			return new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new Error('AbortError (Test)')));
			}) as unknown as Promise<Response>;
		}) as unknown as typeof fetch;

		await expect(checkAuth()).rejects.toThrow(/AbortError/);

		expect(requestedTimeoutMs).toBe(30_000);
		expect(passedSignal?.aborted).toBe(true);
	});
});

// ── Issue #217 — Avatar mit Google Profilbild ─────────────────────────────
// AuthUser muss avatarUrl: string | null enthalten; checkAuth() muss es durchleiten.
// Diese Tests sind ROT bis AuthUser um avatarUrl erweitert und checkAuth() angepasst ist:
//   AC-217-5: wenn API kein avatarUrl liefert, muss checkAuth() explizit null zurueckgeben
//             (nicht undefined) — das erfordert eine explizite Normalisierung in checkAuth().

describe('Issue #217 — checkAuth: avatarUrl', () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('AC-217-4: leitet avatarUrl als HTTPS-String durch wenn die API eine URL liefert', async () => {
		const apiResponse = {
			id: 1,
			name: 'Test User',
			email: 'test@example.com',
			avatarUrl: 'https://lh3.googleusercontent.com/a/photo.jpg',
		};
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => apiResponse,
		}) as unknown as typeof fetch;

		const result = await checkAuth();
		expect(result).not.toBeNull();
		// AuthUser muss avatarUrl: string | null enthalten (Issue #217)
		expect((result as unknown as Record<string, unknown>)['avatarUrl']).toBe(
			'https://lh3.googleusercontent.com/a/photo.jpg',
		);
	});

	it('AC-217-5: liefert avatarUrl: null (nicht undefined) wenn die API kein avatarUrl-Feld hat', async () => {
		// Simuliert eine Antwort ohne avatarUrl-Feld (z.B. Passwort-User oder kein Foto).
		// checkAuth() muss den fehlenden Wert explizit auf null normalisieren.
		const apiResponse = { id: 1, name: 'Test User', email: 'test@example.com' };
		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => apiResponse,
		}) as unknown as typeof fetch;

		const result = await checkAuth();
		expect(result).not.toBeNull();
		// Erwartet null, bekommt aktuell undefined -> roter Test bis checkAuth normalisiert
		expect((result as unknown as Record<string, unknown>)['avatarUrl']).toBeNull();
	});
});
