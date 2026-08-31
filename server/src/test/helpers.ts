import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import sequelize from '../database.js';
import { createApp, type AppDeps } from '../express/index.js';
import { createSessionStore, disconnectStore } from '../express/session.js';
// Import models to ensure associations are registered before sync
import '../models/index.js';

export const resetDb = async (): Promise<void> => {
	await sequelize.sync({ force: true });
};

/**
 * Test-Helper für das Single-Provider-System (#951): ersetzt den früheren
 * `MISTRAL_API_KEY`-Env-Fallback. Seedy (`active === true`) genau EINEN aktiven
 * Mistral-Provider mit Endpoint `api.mistral.ai` — die bestehenden fetch-Stubs der
 * LLM-Tests erkennen genau diese URL — bzw. räumt alle Provider ab (`active === false`,
 * z. B. für „kein aktiver Provider → MissingApiKeyError").
 */
export const setTestLlmProvider = async (active: boolean): Promise<void> => {
	const { default: LlmProvider } = await import('../models/llmProvider.js');
	await sequelize.sync();
	await LlmProvider.destroy({ where: {}, truncate: true });
	if (active) {
		await LlmProvider.create({
			name: 'Mistral',
			endpoint: 'https://api.mistral.ai/v1/chat/completions',
			apiKey: 'test-key',
			model: 'mistral-medium-latest',
			isActive: true,
		});
	}
};

export const closeDb = async (): Promise<void> => {
	// No-op: closing the Sequelize singleton prevents subsequent resetDb() calls in later
	// test suites from working (SQLITE_MISUSE: Database is closed). In-memory SQLite
	// connections are cleaned up on process exit, so there is nothing real to release here.
};

/**
 * Setzt die vier Auth-bezogenen Env-Variablen auf prefix-abgeleitete Test-Werte (#1142).
 * Muss VOR dem Server-Start aufgerufen werden — `createApp` liest `SESSION_SECRET` beim Start.
 */
export const applyTestAuthEnv = (prefix: string): void => {
	process.env.SESSION_SECRET = `${prefix}-secret`;
	process.env.GOOGLE_CLIENT_ID = `${prefix}-client-id`;
	process.env.GOOGLE_CLIENT_SECRET = `${prefix}-client-secret`;
	process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';
};

/** Optionen für den Test-Only-Login (`POST /auth/test-login`) jenseits der E-Mail. */
export interface TestLoginOptions {
	/** Anzeigename des angelegten Nutzers; Default: lokaler Teil der E-Mail. */
	displayName?: string;
	/** Avatar-URL (nur auth-avatar-Tests, #217). */
	avatarUrl?: string;
}

export interface TestServer {
	baseUrl: string;
	close: () => Promise<void>;
	/** Registriert einen Nutzer (erwartet 201) und liefert den Session-Cookie. */
	register: (email: string, password: string) => Promise<string>;
	/** Loggt über den Test-Only-Endpunkt ein (erwartet 200) und liefert den Session-Cookie. */
	login: (email: string, options?: TestLoginOptions) => Promise<string>;
	/** JSON-Request gegen `baseUrl` (Content-Type wird gesetzt), liefert die rohe Response. */
	json: (path: string, init?: RequestInit) => Promise<Response>;
}

/** Erste `name=value`-Paar eines Set-Cookie-Headers (ohne Attribute) — mit Guard statt `!`. */
const cookieOf = (res: Response, message: string): string => {
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, message);
	return setCookie.split(';')[0];
};

/** POST /auth/register — rohe Response (für eigene Status-Assertions wie 409). */
export const registerResponse = (target: TestServer, email: string, password: string): Promise<Response> =>
	fetch(`${target.baseUrl}/auth/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});

/** POST /auth/test-login — rohe Response (für Set-Cookie-Attribut-Assertions). */
export const testLoginResponse = (
	target: TestServer,
	email: string,
	options: TestLoginOptions = {},
): Promise<Response> => {
	const body: Record<string, unknown> = { email, displayName: options.displayName ?? email.split('@')[0] };
	if (options.avatarUrl) body.avatarUrl = options.avatarUrl;
	return fetch(`${target.baseUrl}/auth/test-login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
};

/** POST /auth/register — erwartet 201, liefert den Session-Cookie. */
export const registerOn = async (target: TestServer, email: string, password: string): Promise<string> => {
	const res = await registerResponse(target, email, password);
	assert.equal(res.status, 201, `Register ${email} muss 201 liefern`);
	return cookieOf(res, `Register ${email} muss einen Set-Cookie-Header setzen`);
};

/** POST /auth/test-login — erwartet 200, liefert den Session-Cookie. */
export const testLoginOn = async (
	target: TestServer,
	email: string,
	options: TestLoginOptions = {},
): Promise<string> => {
	const res = await testLoginResponse(target, email, options);
	assert.equal(res.status, 200, `Test-Login für ${email} sollte 200 liefern`);
	return cookieOf(res, 'Test-Login sollte einen Set-Cookie-Header setzen');
};

export const startTestServer = async (deps: AppDeps = {}): Promise<TestServer> => {
	// Respect injected store; only create (and own) a new one if none was provided.
	const sessionStore = deps.sessionStore ?? (await createSessionStore());
	const ownsStore = !deps.sessionStore;
	const app = createApp({ ...deps, sessionStore });
	return new Promise((resolve, reject) => {
		const server: Server = app.listen(0, () => {
			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				reject(new Error('Could not get server address'));
				return;
			}
			const baseUrl = `http://localhost:${addr.port}`;
			const testServer: TestServer = {
				baseUrl,
				close: async () => {
					await new Promise<void>((res, rej) => {
						server.close((err) => {
							if (err && (err as Error & { code?: string }).code === 'ERR_SERVER_NOT_RUNNING') {
								res();
							} else if (err) {
								rej(err);
							} else {
								res();
							}
						});
					});
					if (ownsStore) disconnectStore(sessionStore);
				},
				register: (email, password) => registerOn(testServer, email, password),
				login: (email, options) => testLoginOn(testServer, email, options),
				json: (path, init) =>
					fetch(`${baseUrl}${path}`, {
						...init,
						// Content-Type nur mit Body: ein leerer JSON-Body würde `express.json()` zum 400 führen.
						headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
					}),
			};
			resolve(testServer);
		});
		server.on('error', reject);
	});
};

/**
 * Prüft den **Fehler-Response-Vertrag** des Backends (Issue #117):
 * Jede Fehler-Antwort hat den erwarteten Status **und** einen Body der Form
 * `{ message: string }` mit einer **nicht-leeren** Meldung — damit das Frontend
 * dem Nutzer eine anzeigbare Rückmeldung präsentieren kann.
 *
 * Gibt den geparsten Body zurück, damit Aufrufer die konkrete Meldung weiter
 * prüfen können.
 */
export const expectError = async (res: Response, expectedStatus: number): Promise<{ message: string }> => {
	assert.equal(res.status, expectedStatus, `Erwarteter Status ${expectedStatus}, war ${res.status}`);

	const contentType = res.headers.get('content-type') ?? '';
	assert.ok(contentType.includes('application/json'), `Fehler-Body sollte JSON sein, war "${contentType}"`);

	const body = (await res.json()) as Record<string, unknown>;
	assert.ok(body !== null && typeof body === 'object' && !Array.isArray(body), 'Fehler-Body muss ein Objekt sein');
	assert.equal(typeof body.message, 'string', 'Fehler-Body braucht ein string-Feld "message"');
	assert.ok((body.message as string).trim().length > 0, 'Fehler-Meldung darf nicht leer sein');

	return body as { message: string };
};
