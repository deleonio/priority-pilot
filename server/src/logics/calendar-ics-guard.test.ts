import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchIcs } from './calendar-ics.js';

describe('fetchIcs: Schutz bei nutzerdefinierter Adresse (#2209)', () => {
	const respond = (body: BodyInit, headers?: HeadersInit) =>
		(async () => new Response(body, { status: 200, headers })) as typeof fetch;

	it('ruft interne Adressen nicht ab und folgt keinen Redirects', async () => {
		let calls = 0;
		const fakeFetch = (async (_input: unknown, init?: RequestInit) => {
			calls++;
			assert.equal(init?.redirect, 'error');
			return new Response('', { status: 200 });
		}) as typeof fetch;
		for (const url of ['http://127.0.0.1/cal.ics', 'http://169.254.169.254/latest', 'http://[::1]/cal.ics']) {
			await assert.rejects(fetchIcs(url, fakeFetch));
		}
		assert.equal(calls, 0);
		await fetchIcs('https://8.8.8.8/cal.ics', fakeFetch);
		assert.equal(calls, 1);
	});

	it('bricht Antworten über 5 MB ab, auch ohne Content-Length', async () => {
		const big = new Uint8Array(5 * 1024 * 1024 + 1);
		await assert.rejects(fetchIcs('https://8.8.8.8/cal.ics', respond('x', { 'content-length': String(big.length) })));
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(big.subarray(0, 4 * 1024 * 1024));
				controller.enqueue(big.subarray(4 * 1024 * 1024));
				controller.close();
			},
		});
		await assert.rejects(fetchIcs('https://8.8.8.8/cal.ics', respond(stream)));
	});
});
