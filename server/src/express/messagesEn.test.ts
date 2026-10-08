import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { translateMessages } from './messagesEn.js';

/** Schickt `body` durch die Middleware und liefert, was `res.json` tatsächlich erhält. */
const antwort = (acceptLanguage: string, body: unknown): unknown => {
	let gesendet: unknown;
	const res = { json: (value: unknown) => ((gesendet = value), res) } as unknown as Response;
	const req = { get: () => acceptLanguage } as unknown as Request;
	translateMessages(req, res, () => {});
	res.json(body);
	return gesendet;
};

describe('translateMessages', () => {
	it('übersetzt bei en Meldung und unveränderte Standard-Säulen, eigene Namen bleiben', () => {
		const body = {
			message: 'Anmeldung erforderlich.',
			saeulen: [{ name: 'Körper' }, { name: 'Mein Sport' }],
			vorschlag: { saeuleName: 'Sinn' },
			am: new Date('2026-01-02T00:00:00Z'),
		};
		assert.deepEqual(antwort('en-US,en;q=0.9', body), {
			message: 'Sign-in required.',
			saeulen: [{ name: 'Body' }, { name: 'Mein Sport' }],
			vorschlag: { saeuleName: 'Meaning' },
			am: '2026-01-02T00:00:00.000Z',
		});
	});

	it('lässt deutsche Antworten unangetastet', () => {
		const body = { message: 'Anmeldung erforderlich.', name: 'Körper' };
		assert.equal(antwort('de', body), body);
	});
});
