import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import { startTestServer, resetDb, closeDb, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';
import { issueAppToken } from './apiTokenAuth.js';

/**
 * CSRF-Schutz im Produktionsmodus (server/src/express/csrf.ts, CodeQL js/missing-token-validation).
 *
 * Der Schutz ist nur außerhalb von NODE_ENV=test aktiv — deshalb fährt dieser Suite eine App mit
 * NODE_ENV=production hoch (inkl. der Produktions-Gates SESSION_SECRET + E-Mail-Allowlist und
 * injiziertem MemoryStore, da SESSION_STORE in Produktion Pflicht wäre) und prüft:
 * Token-Ausstellung, 403 ohne Token, Durchlass mit gültigem Cookie+Header-Paar.
 */
describe('CSRF-Schutz (Produktionsmodus)', () => {
	let server: TestServer;
	const previous: Record<string, string | undefined> = {};

	before(async () => {
		// createApp liest die Env beim Aufruf — vor dem Start setzen, danach wiederherstellen.
		for (const key of ['NODE_ENV', 'SESSION_SECRET', 'GOOGLE_ALLOWED_EMAIL']) {
			previous[key] = process.env[key];
		}
		process.env.NODE_ENV = 'production';
		process.env.SESSION_SECRET = 'csrf-test-secret';
		process.env.GOOGLE_ALLOWED_EMAIL = 'test@example.com';
		await resetDb();
		server = await startTestServer({ sessionStore: new session.MemoryStore() });
	});

	after(async () => {
		await server.close();
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
		await closeDb();
	});

	// Holt Token + Cookie als Double-Submit-Paar (node:fetch hat keinen Cookie-Jar → Header manuell).
	const fetchCsrfPair = async (): Promise<{ cookie: string; csrfToken: string }> => {
		const res = await fetch(`${server.baseUrl}/auth/csrf`);
		assert.equal(res.status, 200);
		const setCookie = res.headers.get('set-cookie');
		assert.ok(setCookie?.includes('__Host-csrf='), `__Host-csrf-Cookie erwartet, war: ${setCookie}`);
		const body = (await res.json()) as { csrfToken: string };
		assert.ok(body.csrfToken.length > 0, 'CSRF-Token sollte nicht leer sein');
		return { cookie: setCookie.split(';')[0], csrfToken: body.csrfToken };
	};

	it('GET /auth/csrf stellt Token + Cookie aus', async () => {
		const { cookie, csrfToken } = await fetchCsrfPair();
		assert.ok(cookie.startsWith('__Host-csrf='), `__Host-csrf-Cookie erwartet, war: ${cookie}`);
		assert.ok(csrfToken.includes('.'), 'Token sollte aus HMAC + Zufallswert bestehen');
	});

	it('lehnt schreibenden Request ohne Token mit 403 ab', async () => {
		const res = await fetch(`${server.baseUrl}/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com', password: 'stimmt-nicht' }),
		});
		assert.equal(res.status, 403);
		// #2549 AK2: Fehlervertrag ist `{ message }`, nicht `{ error }` (Text unverändert).
		const body = (await res.json()) as Record<string, unknown>;
		assert.equal(body.message, 'Ungültiger CSRF-Token.');
		assert.equal(body.error, undefined);
	});

	// Die Android-App ruft vor der Anmeldung ohne Cookies auf (ADR 0023); ohne Ausnahme scheiterte jeder Login mit 403.
	it('lässt die Android-App ohne Cookie durch (400 = Code-Prüfung erreicht)', async () => {
		const res = await fetch(`${server.baseUrl}/auth/native/exchange`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-client-channel': 'play' },
			body: JSON.stringify({ code: 'unbekannt', state: 'unbekannt' }),
		});
		assert.equal(res.status, 400);
	});

	it('lässt schreibenden Request mit gültigem Token + Cookie durch (401 = Auth-Logik erreicht)', async () => {
		const { cookie, csrfToken } = await fetchCsrfPair();
		const res = await fetch(`${server.baseUrl}/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrfToken },
			body: JSON.stringify({ email: 'test@example.com', password: 'stimmt-nicht' }),
		});
		assert.equal(res.status, 401);
	});
});

/**
 * #2540 (docs/spec/issue-2540.md): CSRF hängt an SESSION_SECRET statt an NODE_ENV=production.
 * Aktiv, sobald SESSION_SECRET gesetzt ist; nur NODE_ENV=test bleibt ausgenommen (E2E-Seeding).
 * Cookie-Name bleibt außerhalb von production `csrf` (Dev läuft über http://localhost).
 */
const ENV_KEYS = ['NODE_ENV', 'SESSION_SECRET', 'GOOGLE_ALLOWED_EMAIL'] as const;

const startWithEnv = async (nodeEnv: string): Promise<{ server: TestServer; restore: () => Promise<void> }> => {
	const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
	process.env.NODE_ENV = nodeEnv;
	process.env.SESSION_SECRET = 'csrf-2540-secret';
	process.env.GOOGLE_ALLOWED_EMAIL = 'test@example.com';
	await resetDb();
	const server = await startTestServer({ sessionStore: new session.MemoryStore() });
	return {
		server,
		restore: async () => {
			await server.close();
			for (const [key, value] of Object.entries(previous)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
			await closeDb();
		},
	};
};

const postLogin = (baseUrl: string, headers: Record<string, string> = {}): Promise<Response> =>
	fetch(`${baseUrl}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify({ email: 'test@example.com', password: 'stimmt-nicht' }),
	});

describe('CSRF-Schutz bei NODE_ENV=development mit SESSION_SECRET (#2540 AK1, AK3)', () => {
	let server: TestServer;
	let restore: () => Promise<void>;

	before(async () => {
		({ server, restore } = await startWithEnv('development'));
	});
	after(async () => {
		await restore();
	});

	it('AK1: lehnt schreibenden Request ohne Token mit 403 ab', async () => {
		assert.equal((await postLogin(server.baseUrl)).status, 403);
	});

	it('AK1: lässt schreibenden Request mit Token + Cookie aus GET /auth/csrf durch (401 = Auth-Logik erreicht)', async () => {
		const res = await fetch(`${server.baseUrl}/auth/csrf`);
		assert.equal(res.status, 200);
		const setCookie = res.headers.get('set-cookie');
		assert.ok(setCookie?.startsWith('csrf='), `csrf-Cookie (ohne __Host-) erwartet, war: ${setCookie}`);
		const { csrfToken } = (await res.json()) as { csrfToken: string };
		const login = await postLogin(server.baseUrl, { cookie: setCookie.split(';')[0], 'x-csrf-token': csrfToken });
		assert.equal(login.status, 401);
	});

	it('AK3: Android-App (X-Client-Channel: play) braucht kein Token (400 = Code-Prüfung erreicht)', async () => {
		const res = await fetch(`${server.baseUrl}/auth/native/exchange`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-client-channel': 'play' },
			body: JSON.stringify({ code: 'unbekannt', state: 'unbekannt' }),
		});
		assert.equal(res.status, 400);
	});

	it('AK3: Bearer-Request braucht kein Token (kein 403 aus dem CSRF-Gate)', async () => {
		const user = await User.create({ email: 'test@example.com', passwordHash: 'x' });
		const token = await issueAppToken(user.id);
		const res = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify({ title: 'Bearer ohne CSRF' }),
		});
		assert.notEqual(res.status, 403);
		assert.equal(res.status, 201);
	});
});

describe('CSRF-Schutz bei NODE_ENV=test (#2540 AK2)', () => {
	let server: TestServer;
	let restore: () => Promise<void>;

	before(async () => {
		({ server, restore } = await startWithEnv('test'));
	});
	after(async () => {
		await restore();
	});

	it('AK2: schreibender Request ohne Token läuft durch (401 = Auth-Logik erreicht)', async () => {
		assert.equal((await postLogin(server.baseUrl)).status, 401);
	});
});
