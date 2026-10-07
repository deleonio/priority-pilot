/**
 * Spec-Test #2335 (docs/spec/issue-2335.md, AK3): der Transit-Proxy des Bahn-Planers ist entfernt.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, closeDb, type TestServer } from '../test/helpers.js';

let server: TestServer;

describe('Transit-Proxy entfernt (#2335)', () => {
	before(async () => {
		server = await startTestServer();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	for (const path of [
		'/api/transit/geocode?text=Berlin&language=de',
		'/api/transit/plan?fromPlace=52.5,13.4&toPlace=48.1,11.6&time=12:00:00&arriveBy=false&numItineraries=3',
	]) {
		it(`AK3: GET ${path.split('?')[0]} liefert 404`, async () => {
			const res = await fetch(`${server.baseUrl}${path}`);
			assert.equal(res.status, 404);
		});
	}
});
