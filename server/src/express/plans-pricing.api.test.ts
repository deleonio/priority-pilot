import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1494 AK5 (Spec docs/spec/issue-1494.md) — `GET /plans` liefert je Paket alle
 * drei Zeiträume (`monthly`, `quarterly`, `yearly`) als Ganzzahlen in Cent.
 *
 * Eigene Datei statt Ergänzung von `plans.api.test.ts` (#1456 T1 AK3): dort geht es um den
 * öffentlichen Zugriff ohne Session, hier um den Preisvertrag selbst — inhaltlich getrennte
 * Zuständigkeiten, kein Dublette.
 *
 * Rot, weil `GET /plans` heute nur `monthly`/`yearly` in Euro liefert (`plans.ts:57-62`).
 * KEIN Produktivcode.
 */

let server: TestServer;

describe('GET /plans — Cent-Preise mit Quartalsstaffel (#1494 AK5)', () => {
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

	it('liefert für jedes Paket monthly, quarterly und yearly als Ganzzahl', async () => {
		const res = await fetch(`${server.baseUrl}/plans`);
		assert.equal(res.status, 200);
		const body = (await res.json()) as { prices: Record<string, Record<string, number>> };
		for (const plan of ['free', 'pro', 'max', 'ultimate']) {
			const price = body.prices[plan];
			assert.ok(price, `Preis für ${plan} fehlt`);
			assert.equal(typeof price.quarterly, 'number', `${plan}.quarterly fehlt`);
			assert.ok(Number.isInteger(price.monthly), `${plan}.monthly muss Ganzzahl (Cent) sein`);
			assert.ok(Number.isInteger(price.quarterly), `${plan}.quarterly muss Ganzzahl (Cent) sein`);
			assert.ok(Number.isInteger(price.yearly), `${plan}.yearly muss Ganzzahl (Cent) sein`);
		}
	});

	it('Pro liefert 799 / 2157 / 7670 Cent laut Konzepttabelle', async () => {
		const res = await fetch(`${server.baseUrl}/plans`);
		const body = (await res.json()) as { prices: Record<string, Record<string, number>> };
		assert.deepEqual(body.prices.pro, { monthly: 799, quarterly: 2157, yearly: 7670 });
	});
});
