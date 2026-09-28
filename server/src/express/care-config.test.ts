import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1794 (Spec: docs/spec/issue-1794.md) — pro-User Care-Konfiguration.
 *
 * AK7: der Schalter „Fürsorge-Hinweise" ist serverseitig pro Nutzer gespeichert (Default: ein)
 *   und unabhängig vom Push-Hauptschalter bedienbar — `GET/PUT /care-config` nach Muster
 *   `/geo-config` (#1098).
 * AK8: die Nutzer-Zeitzone (IANA) wird serverseitig gespeichert und vom Client geliefert;
 *   ungültige Werte weist die API mit 400 ab (der Lauf selbst fällt auf den Default zurück,
 *   siehe `logics/carePush.test.ts`).
 *
 * Rot, bis der Endpoint existiert (heute: 404/SPA-Fallback). KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1794');

type CareConfig = { carePushEnabled: boolean; zeitzone: string };

const DEFAULTS: CareConfig = { carePushEnabled: true, zeitzone: 'UTC' };

let server: TestServer;

const getConfig = (cookie: string): Promise<Response> => server.json('/care-config', { headers: { Cookie: cookie } });

const putConfig = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/care-config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

describe('Care-Konfiguration pro User (#1794 AK7/AK8)', () => {
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
		assert.equal((await getConfig('cookie=none')).status, 401);
		assert.equal(
			(
				await fetch(`${server.baseUrl}/care-config`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(DEFAULTS),
				})
			).status,
			401,
		);
	});

	it('GET liefert die Defaults (Schalter an, Zeitzone UTC), solange nichts gespeichert ist', async () => {
		const cookie = await server.register('care-defaults@example.com', 'password123');
		const res = await getConfig(cookie);
		assert.equal(res.status, 200);
		assert.deepEqual((await res.json()) as CareConfig, DEFAULTS);
	});

	it('PUT speichert Schalter (aus) und Zeitzone, GET liefert sie zurück', async () => {
		const cookie = await server.register('care-put@example.com', 'password123');
		const next: CareConfig = { carePushEnabled: false, zeitzone: 'Europe/Berlin' };
		const put = await putConfig(cookie, next);
		assert.equal(put.status, 200, 'valide Config muss 200 liefern');
		const stored = (await (await getConfig(cookie)).json()) as CareConfig;
		assert.deepEqual(stored, next, 'GET muss die gespeicherten Werte liefern, nicht die Defaults');
	});

	const invalid: Array<[string, unknown]> = [
		['Zeitzone kein IANA-Name', { carePushEnabled: true, zeitzone: 'Mars/Olympus' }],
		['Zeitzone leer', { carePushEnabled: true, zeitzone: '' }],
		['Zeitzone fehlt', { carePushEnabled: true }],
		['Schalter kein Boolean', { carePushEnabled: 'ja', zeitzone: 'UTC' }],
	];
	for (const [index, [label, body]] of invalid.entries()) {
		it(`PUT weist ${label} ab (400)`, async () => {
			const cookie = await server.register(`care-invalid-${index}@example.com`);
			const res = await putConfig(cookie, body);
			assert.equal(res.status, 400, `${label} ist keine gültige Care-Konfiguration`);
			assert.deepEqual(
				(await (await getConfig(cookie)).json()) as CareConfig,
				DEFAULTS,
				'der Verstoß persistiert nichts',
			);
		});
	}

	it('Dataisolation: User B sieht seine eigene (Default-)Config, nicht die von User A', async () => {
		const cookieA = await server.register('care-a@example.com', 'password123');
		const cookieB = await server.register('care-b@example.com', 'password123');
		await putConfig(cookieA, { carePushEnabled: false, zeitzone: 'Europe/Berlin' });

		const ofB = (await (await getConfig(cookieB)).json()) as CareConfig;
		assert.deepEqual(ofB, DEFAULTS, 'B darf die Config von A nicht lesen');

		const putByB = await putConfig(cookieB, { carePushEnabled: false, zeitzone: 'Asia/Tokyo' });
		assert.equal(putByB.status, 200);
		const ofA = (await (await getConfig(cookieA)).json()) as CareConfig;
		assert.deepEqual(
			ofA,
			{ carePushEnabled: false, zeitzone: 'Europe/Berlin' },
			'PUT von B darf die Config von A nicht überschreiben',
		);
	});
});
