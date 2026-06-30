import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync, existsSync } from 'node:fs';
import { startTestServer, resetDb, closeDb, type TestServer } from '../test/helpers.js';

// createSessionStore ist die Store-Factory aus session.ts (wird durch die Implementierung angelegt).
// Solange session.ts nicht existiert, schlägt dieser Import fehl → Tests sind ROT.
import { createSessionStore } from './session.js';

// Auth-Kontext muss vor dem Server-Start feststehen (wie in auth.test.ts).
process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
process.env.SESSION_SECRET = 'test-secret-for-session-tests';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost/auth/google/callback';

const ALLOWED_EMAIL = 'testuser@example.com';
const ALLOWED_NAME = 'Test User';

const cookieFromSetCookie = (setCookie: string): string => setCookie.split(';')[0];

const testLogin = async (baseUrl: string): Promise<string> => {
	const res = await fetch(`${baseUrl}/auth/test-login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: ALLOWED_EMAIL, displayName: ALLOWED_NAME }),
	});
	assert.equal(res.status, 200, 'Test-Login sollte 200 liefern');
	const setCookie = res.headers.get('set-cookie');
	assert.ok(setCookie, 'Test-Login sollte Set-Cookie setzen');
	return cookieFromSetCookie(setCookie);
};

// ── AK-3 — Dev-Modus: MemoryStore aktiv, kein Fehler ─────────────────────────

describe('AK-3 — createSessionStore: NODE_ENV=development ohne SESSION_STORE', () => {
	before(() => {
		delete process.env.SESSION_STORE;
		process.env.NODE_ENV = 'test'; // test entspricht dev-Verhalten (kein persistenter Store nötig)
	});

	it('liefert einen Store ohne Fehler zu werfen', async () => {
		const store = await createSessionStore();
		assert.ok(store, 'createSessionStore() muss einen Store zurückgeben');
		assert.equal(typeof store, 'object', 'Store muss ein Objekt sein');
		assert.ok(typeof store.get === 'function', 'Store muss store.get() implementieren');
		assert.ok(typeof store.set === 'function', 'Store muss store.set() implementieren');
		assert.ok(typeof store.destroy === 'function', 'Store muss store.destroy() implementieren');
	});

	it('liefert einen MemoryStore (kein persistenter Store) im Nicht-Produktions-Modus', async () => {
		const store = await createSessionStore();
		// MemoryStore hält Sessions im RAM — Eigenschaft: constructor.name enthält 'Memory' oder 'MemoryStore'
		const name = store.constructor.name;
		assert.ok(
			name.toLowerCase().includes('memory'),
			`Im Dev-Modus sollte MemoryStore geliefert werden, war: ${name}`,
		);
	});
});

// ── AK-2 — Produktion + Redis + ungültige URL → Server startet nicht ────────

describe('AK-2 — createSessionStore: NODE_ENV=production, SESSION_STORE=redis, ungültige REDIS_URL', () => {
	before(() => {
		process.env.NODE_ENV = 'production';
		process.env.SESSION_STORE = 'redis';
		process.env.REDIS_URL = 'redis://invalid-host-that-does-not-exist:9999';
	});

	after(() => {
		process.env.NODE_ENV = 'test';
		delete process.env.SESSION_STORE;
		delete process.env.REDIS_URL;
	});

	it('wirft einen Fehler bei nicht erreichbarer Redis-URL', async () => {
		await assert.rejects(
			() => createSessionStore(),
			(err: unknown) => {
				assert.ok(err instanceof Error, 'Fehler muss eine Error-Instanz sein');
				return true;
			},
			'createSessionStore() muss bei ungültiger Redis-URL rejecten',
		);
	});
});

// ── AK-1 — SESSION_STORE=sqlite → Sessions überleben Prozess-Neustart ───────

describe('AK-1 — SQLite-Store: Sessions überleben Server-Neustart', () => {
	const dbPath = join(tmpdir(), `priority-pilot-test-sessions-${process.pid}.db`);
	let server: TestServer;
	let sessionCookie: string;

	before(async () => {
		process.env.SESSION_STORE = 'sqlite';
		process.env.SESSION_DB_PATH = dbPath;
		await resetDb();
		server = await startTestServer();
		sessionCookie = await testLogin(server.baseUrl);
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
		delete process.env.SESSION_STORE;
		delete process.env.SESSION_DB_PATH;
		if (existsSync(dbPath)) unlinkSync(dbPath);
	});

	it('Session-Cookie ist nach Login gültig (Baseline)', async () => {
		const res = await fetch(`${server.baseUrl}/tasks`, {
			headers: { Cookie: sessionCookie },
		});
		assert.equal(res.status, 200, 'Eingeloggte Anfrage sollte 200 liefern');
	});

	it('Session bleibt nach Server-Neustart gültig (SQLite-Persistenz)', async () => {
		// Server stoppen
		await server.close();

		// Neuen Server mit DERSELBEN SQLite-Datei starten
		process.env.SESSION_STORE = 'sqlite';
		process.env.SESSION_DB_PATH = dbPath;
		const server2 = await startTestServer();

		try {
			const res = await fetch(`${server2.baseUrl}/tasks`, {
				headers: { Cookie: sessionCookie },
			});
			assert.equal(
				res.status,
				200,
				'Session muss nach Neustart noch gültig sein (SQLite-Persistenz)',
			);
		} finally {
			await server2.close();
		}
	});
});

// ── AK-4 — SESSION_TTL=1 → Session läuft ab → 401 ──────────────────────────

describe('AK-4 — Session-TTL wird eingehalten', () => {
	let server: TestServer;

	before(async () => {
		delete process.env.SESSION_STORE; // MemoryStore reicht für TTL-Test
		process.env.NODE_ENV = 'test';
		process.env.SESSION_TTL = '1'; // 1 Sekunde TTL
		await resetDb();
		server = await startTestServer();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
		delete process.env.SESSION_TTL;
	});

	it('Session ist direkt nach Login gültig', async () => {
		const cookie = await testLogin(server.baseUrl);
		const res = await fetch(`${server.baseUrl}/tasks`, {
			headers: { Cookie: cookie },
		});
		assert.equal(res.status, 200, 'Session direkt nach Login muss gültig sein');
	});

	it('Session ist nach Ablauf der TTL ungültig → 401', async () => {
		const cookie = await testLogin(server.baseUrl);

		// Warten bis TTL (1 Sek.) abgelaufen ist
		await new Promise((resolve) => setTimeout(resolve, 1500));

		const res = await fetch(`${server.baseUrl}/tasks`, {
			headers: { Cookie: cookie },
		});
		assert.equal(res.status, 401, 'Abgelaufene Session muss 401 liefern');
	});
});

// ── AK-5 — SESSION_STORE=redis → Zwei Instanzen teilen Sessions ─────────────
// Anmerkung: Dieser Test erfordert eine laufende Redis-Instanz (REDIS_URL gesetzt).
// In CI ohne Redis wird er als Integrations-Hinweis betrachtet.
// Die Implementierung muss sicherstellen, dass connect-redis Sessions korrekt serialisiert.

describe('AK-5 — Redis-Store: Zwei Server-Instanzen teilen Sessions', () => {
	const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
	let server1: TestServer;
	let server2: TestServer;

	before(async () => {
		process.env.SESSION_STORE = 'redis';
		process.env.REDIS_URL = redisUrl;
		process.env.NODE_ENV = 'test';
		await resetDb();
	});

	after(async () => {
		if (server1) await server1.close().catch(() => {});
		if (server2) await server2.close().catch(() => {});
		await closeDb();
		delete process.env.SESSION_STORE;
	});

	it('Session von Instanz 1 ist auf Instanz 2 gültig', async () => {
		// Beide Instanzen starten (teilen denselben Redis-Store via REDIS_URL)
		[server1, server2] = await Promise.all([startTestServer(), startTestServer()]);

		// Login über Instanz 1
		const cookie = await testLogin(server1.baseUrl);

		// Session auf Instanz 2 prüfen
		const res = await fetch(`${server2.baseUrl}/tasks`, {
			headers: { Cookie: cookie },
		});
		assert.equal(
			res.status,
			200,
			'Session von Instanz 1 muss auf Instanz 2 akzeptiert werden (geteilter Redis-Store)',
		);
	});
});
