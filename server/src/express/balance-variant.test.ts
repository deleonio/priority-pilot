import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { User } from '../models/index.js';

/**
 * Rote Spec-Tests für #2009 (Spec: docs/spec/issue-2009.md) — Zifferblatt-Auswahl am Konto.
 *
 * AK1: `PUT /balance-variant` persistiert einen der vier Varianten-Schlüssel am Konto;
 *   jeder andere Wert → 400, nichts persistiert.
 * AK2: `GET /balance-variant` liefert die gespeicherte Wahl, sonst `bluete` — auch für ein
 *   inzwischen entferntes Bild.
 * AK3: Kontoisolation — die Wahl von Nutzer A ist für Nutzer B nicht sichtbar.
 *
 * Muster `care-config.test.ts` (#1794): zwei Sessions für Isolation, 400-/Default-Fälle.
 * Rot, bis der Endpoint existiert (heute: 404/SPA-Fallback). KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-2009');

/** Die vier Bild-Schlüssel (`BALANCE_VARIANTS`, frontend/src/lib/balanceVariant.ts). */
const VARIANTEN = ['strahlen', 'bluete', 'kristall', 'zeiger'];

let server: TestServer;

const getVariant = (cookie: string): Promise<Response> =>
	server.json('/balance-variant', { headers: { Cookie: cookie } });

const putVariant = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/balance-variant', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

describe('Zifferblatt-Auswahl pro User (#2009 AK1–AK3)', () => {
	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('ohne Session → 401 (GET und PUT)', async () => {
		assert.equal((await getVariant('cookie=none')).status, 401);
		assert.equal(
			(
				await fetch(`${server.baseUrl}/balance-variant`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ variant: 'kristall' }),
				})
			).status,
			401,
		);
	});

	it('AK2 — GET liefert bluete, solange nichts gespeichert ist', async () => {
		const cookie = await server.register('variant-default@example.com', 'password123');
		const res = await getVariant(cookie);
		assert.equal(res.status, 200);
		assert.deepEqual((await res.json()) as { variant: string }, { variant: 'bluete' });
	});

	it('AK2 — GET liefert bluete für ein am Konto gespeichertes, inzwischen entferntes Bild', async () => {
		const email = 'variant-entfernt@example.com';
		const cookie = await server.register(email, 'password123');
		await User.update({ balanceVariant: 'herz' }, { where: { email } });
		const res = await getVariant(cookie);
		assert.deepEqual((await res.json()) as { variant: string }, { variant: 'bluete' });
	});

	it('AK1 — PUT persistiert jeden der vier Varianten-Schlüssel, GET liefert ihn zurück', async () => {
		const cookie = await server.register('variant-alle@example.com', 'password123');
		for (const variant of VARIANTEN) {
			const put = await putVariant(cookie, { variant });
			assert.equal(put.status, 200, `${variant} ist ein gültiger Schlüssel und muss 200 liefern`);
			const stored = (await (await getVariant(cookie)).json()) as { variant: string };
			assert.equal(stored.variant, variant, `GET muss die zuletzt gespeicherte Wahl ${variant} liefern`);
		}
	});

	const invalid: Array<[string, unknown]> = [
		['unbekannten Schlüssel', { variant: 'seifenblasen-3000' }],
		['entfernten Schlüssel', { variant: 'herz' }],
		['leeren Schlüssel', { variant: '' }],
		['Schlüssel falschen Typs', { variant: 5 }],
		['fehlenden Schlüssel', {}],
	];
	for (const [index, [label, body]] of invalid.entries()) {
		it(`AK1 — PUT weist ${label} ab (400) und persistiert nichts`, async () => {
			const cookie = await server.register(`variant-invalid-${index}@example.com`, 'password123');
			await putVariant(cookie, { variant: 'strahlen' });
			const res = await putVariant(cookie, body);
			assert.equal(res.status, 400, `${label} ist keine gültige Wahl`);
			const stored = (await (await getVariant(cookie)).json()) as { variant: string };
			assert.equal(stored.variant, 'strahlen', 'der Verstoß darf die gespeicherte Wahl nicht verändern');
		});
	}

	it('AK3 — Dataisolation: Nutzer B sieht nie die Wahl von Nutzer A', async () => {
		const cookieA = await server.register('variant-a@example.com', 'password123');
		const cookieB = await server.register('variant-b@example.com', 'password123');
		await putVariant(cookieA, { variant: 'kristall' });

		const ofB = (await (await getVariant(cookieB)).json()) as { variant: string };
		assert.equal(ofB.variant, 'bluete', 'B erhält den Default, nicht die Wahl von A');

		await putVariant(cookieB, { variant: 'zeiger' });
		const ofA = (await (await getVariant(cookieA)).json()) as { variant: string };
		assert.equal(ofA.variant, 'kristall', 'B neu zu wählen darf die Wahl von A nicht überschreiben');
	});
});
