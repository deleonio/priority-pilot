import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Pass-Through-Modus: **kein** Auth-Kontext konfiguriert (weder Allowlist noch Google-OAuth noch
 * `SESSION_SECRET`). `requireAuth` lässt in diesem Zustand jede API-Route durch — `/auth/me` muss
 * dann konsistent dazu einen Nutzer melden statt 401.
 *
 * Schutz vor einem **stillen** Ausfall: meldet `/auth/me` hier 401, rendert das Frontend
 * (`Root.tsx` → `checkAuth`) eine Login-Seite, hinter die niemand kommt — ohne OAuth-Credentials
 * ist weder `/auth/google` noch `/auth/google/silent` registriert. Die API antwortet dabei
 * fröhlich mit 200, der Fehler ist also weder im Server-Log noch an der API sichtbar. Genau dieser
 * Zustand ist das lokale Inspect-Setup für den Browser-MCP (`pnpm ui:inspect`, docs/browser-mcp.md).
 *
 * Bewusst eine eigene Datei: der Auth-Kontext wird beim Modul-Load ausgewertet, und die
 * bestehenden Auth-Suiten (`auth.test.ts`, `auth-avatar.test.ts`) setzen ihn global auf „aktiv".
 * node:test führt jede Testdatei in einem eigenen Prozess aus, die Env-Welten kollidieren also nicht.
 */

// Sicherstellen, dass wirklich KEIN Auth-Kontext gesetzt ist (server/.env wird in Tests nicht
// geladen — `env.ts` importiert nur `index.ts` —, aber explizit ist besser als implizit).
delete process.env.GOOGLE_ALLOWED_EMAIL;
delete process.env.GOOGLE_ALLOWED_EMAILS;
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.SESSION_SECRET;

let server: TestServer;

describe('Pass-Through-Modus (kein Auth-Kontext konfiguriert)', () => {
	before(async () => {
		server = await startTestServer();
		await resetDb();
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	it('GET /auth/me liefert 200 mit einem Nutzer statt 401', async () => {
		const res = await fetch(`${server.baseUrl}/auth/me`);
		assert.equal(res.status, 200, 'Ohne Auth-Kontext darf /auth/me keine Login-Wand aufbauen');
		const body = (await res.json()) as Record<string, unknown>;
		assert.equal(typeof body.email, 'string');
		assert.ok(body.name, 'Das Frontend (AuthUser.name) rendert den Anzeigenamen im Header');
	});

	it('geschützte Routen bleiben erreichbar (Konsistenz zu requireAuth)', async () => {
		const res = await fetch(`${server.baseUrl}/tasks`);
		assert.equal(res.status, 200);
	});
});
