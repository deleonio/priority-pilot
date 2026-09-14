/**
 * Geltungsbereich der Rate-Limiter (#1479)
 *
 * Die Limiter für Auth, Säulen und Kategorien hingen pfadlos an ihren Routern
 * (`authRouter.use(authLimiter)`). Da diese Router per `app.use(router)` an der Wurzel montiert
 * sind, lief jede pfadlose Middleware für JEDE Anfrage mit — der Brute-Force-Limiter deckelte
 * damit die gesamte API auf 30 Anfragen pro Minute und IP. Ein Seitenaufbau kostet 14 Anfragen,
 * ein Löschen weitere 7; entsprechend antwortete der Server kurz nach dem Löschen auf alles 429.
 *
 * AK1 — Aufgaben-Endpunkte laufen ungedrosselt (Auth-Limiter gilt nur für `/auth/*`).
 * AK2 — Endpunkte hinter den Säulen-/Kategorie-Routern laufen ungedrosselt.
 * AK3 — Der Brute-Force-Schutz auf `/auth/*` bleibt erhalten.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

let server: TestServer;

/** Ruft `path` sequenziell `times`-mal auf und sammelt die Statuscodes. */
const hammer = async (baseUrl: string, path: string, times: number): Promise<number[]> => {
	const codes: number[] = [];
	for (let index = 0; index < times; index++) {
		const response = await fetch(`${baseUrl}${path}`);
		codes.push(response.status);
	}
	return codes;
};

/** Position des ersten 429 (1-basiert) oder 0 — macht die Fehlermeldung lesbar. */
const firstThrottled = (codes: number[]): number => codes.indexOf(429) + 1;

describe('Geltungsbereich der Rate-Limiter (#1479)', () => {
	let savedNodeEnv: string | undefined;

	before(async () => {
		await resetDb();
		server = await startTestServer();
		// Die Limiter überspringen alles außerhalb der Produktion (`skip`). NODE_ENV wird bewusst
		// erst NACH createApp() umgestellt: `skip` wertet je Request aus, während die
		// Produktionspflichten von createApp (SESSION_SECRET, Allowlist, Session-Store) hier nicht
		// greifen sollen. Ohne Auth-Kontext bleibt der Pass-Through-Modus aktiv (200 statt 401).
		savedNodeEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = 'production';
	});

	after(async () => {
		process.env.NODE_ENV = savedNodeEnv;
		if (server) await server.close();
		await closeDb();
	});

	// ── AK1 — Der Auth-Limiter (30/min) darf die Aufgaben-Endpunkte nicht deckeln ─────────────
	it('drosselt GET /tasks nicht', async () => {
		const codes = await hammer(server.baseUrl, '/tasks', 60);
		assert.equal(codes[0], 200, 'Vorbedingung: /tasks antwortet im Pass-Through-Modus mit 200');
		assert.equal(firstThrottled(codes), 0, `429 ab Aufruf ${firstThrottled(codes)} auf /tasks`);
	});

	// ── AK2 — Säulen-/Kategorie-Limiter (je 60/10s) dürfen nur ihre eigenen Pfade deckeln ─────
	// `/scores` ist hinter beiden Routern montiert (express/index.ts) und lief deshalb durch
	// deren pfadlose Middleware.
	it('drosselt GET /scores nicht', async () => {
		const codes = await hammer(server.baseUrl, '/scores', 130);
		assert.equal(codes[0], 200, 'Vorbedingung: /scores antwortet im Pass-Through-Modus mit 200');
		assert.equal(firstThrottled(codes), 0, `429 ab Aufruf ${firstThrottled(codes)} auf /scores`);
	});

	// ── AK3 — Brute-Force-Schutz auf /auth/* bleibt ───────────────────────────────────────────
	it('drosselt /auth/* weiterhin ab dem 31. Aufruf pro Minute', async () => {
		const codes = await hammer(server.baseUrl, '/auth/me', 31);
		assert.equal(firstThrottled(codes), 31, 'Der Auth-Limiter muss genau ab dem 31. Aufruf greifen');
	});

	// ── AK4 — Die gedrosselte Antwort muss erklärbar sein ──────────────────────────────────────
	// Der Klartext-Default von express-rate-limit passt weder zum Fehlervertrag (`{ message }`)
	// noch zur Anzeige; das Frontend baut aus `Retry-After` den Wartehinweis (lib/apiError.ts).
	it('antwortet gedrosselt nach dem Fehlervertrag, mit Retry-After', async () => {
		const response = await fetch(`${server.baseUrl}/auth/me`);
		assert.equal(response.status, 429, 'Vorbedingung: Das Kontingent aus AK3 ist noch erschöpft');
		assert.ok(response.headers.has('retry-after'), 'Retry-After fehlt — das Frontend kann keine Wartezeit nennen');
		const body: unknown = await response.json();
		assert.equal(typeof (body as { message?: unknown }).message, 'string');
	});
});
