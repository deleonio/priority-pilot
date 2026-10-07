import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchCaldavEvents } from './calendar-caldav.js';

/** Rote Spec-Tests für #2211 (docs/spec/issue-2211.md): Netz-Guard des CalDAV-Abrufs (wie `fetchIcs`). Rot, bis das Modul existiert. */

describe('fetchCaldavEvents: Schutz bei nutzerdefinierter Adresse (#2211)', () => {
	it('ruft interne Adressen nicht ab', async () => {
		let calls = 0;
		const fakeFetch = (async () => {
			calls++;
			return new Response('', { status: 207 });
		}) as unknown as typeof fetch;
		const saved = process.env.ICS_ALLOW_INTERNAL_HOSTS;
		delete process.env.ICS_ALLOW_INTERNAL_HOSTS;
		try {
			for (const url of ['http://127.0.0.1/dav/', 'http://169.254.169.254/dav/', 'http://[::1]/dav/']) {
				await assert.rejects(fetchCaldavEvents(url, 'u', 'p', new Date(), fakeFetch));
			}
		} finally {
			if (saved !== undefined) process.env.ICS_ALLOW_INTERNAL_HOSTS = saved;
		}
		assert.equal(calls, 0);
	});
});
