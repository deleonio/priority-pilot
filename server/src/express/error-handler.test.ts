import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { errorHandler } from './http-error.js';

/**
 * Rote Spec-Tests für #2549 (Spec: docs/spec/issue-2549.md) — globaler Express-Fehlerhandler.
 *
 * AK1: Ein unbehandelter Routen-Fehler (auch aus async Routen, Express 5) endet als 500 mit JSON
 * `{ message }` (generischer Text, kein Stacktrace und keine Fehlerdetails) statt der
 * Express-Standardseite und erzeugt genau einen console.error-Eintrag mit Methode, Pfad und Fehler.
 * KEIN Produktivcode — der Export `errorHandler` (http-error.ts) und der Mount in `createApp` sind
 * Teil der Umsetzung; der fehlende Export ist der legitime erste rote Zustand.
 */
describe('Globaler Fehlerhandler (#2549 AK1)', () => {
	const startApp = async (): Promise<{ baseUrl: string; close: () => Promise<unknown> }> =>
		new Promise((resolve) => {
			const app = express();
			app.get('/boom', async () => {
				throw new Error('Streng vertraulicher Fehler');
			});
			app.use(errorHandler);
			const server = app.listen(0, '127.0.0.1', () => {
				const address = server.address() as { port: number };
				resolve({ baseUrl: `http://127.0.0.1:${address.port}`, close: async () => server.close() });
			});
		});

	it('unbehandelter Routen-Fehler → 500 mit generischem JSON-Body ohne Details', async () => {
		const app = await startApp();
		try {
			const res = await fetch(`${app.baseUrl}/boom`);
			assert.equal(res.status, 500);
			assert.ok((res.headers.get('content-type') ?? '').includes('application/json'), 'Body sollte JSON sein');
			const body = (await res.json()) as Record<string, unknown>;
			assert.equal(body.message, 'Interner Serverfehler.');
			assert.equal(body.error, undefined);
			assert.equal(body.stack, undefined);
			assert.ok(!String(body.message).includes('Streng vertraulicher Fehler'), 'Body trägt keine Fehlerdetails');
		} finally {
			await app.close();
		}
	});

	it('unbehandelter Routen-Fehler → genau ein Log-Eintrag mit Methode, Pfad und Fehler', async () => {
		const app = await startApp();
		const ce = mock.method(console, 'error', () => {});
		try {
			await fetch(`${app.baseUrl}/boom`);
		} finally {
			ce.mock.restore();
			await app.close();
		}
		assert.equal(ce.mock.callCount(), 1, 'Genau ein Log-Eintrag erwartet');
		const logged = ce.mock.calls[0].arguments.map(String).join(' ');
		assert.ok(logged.includes('GET'), `Log nennt die Methode: ${logged}`);
		assert.ok(logged.includes('/boom'), `Log nennt den Pfad: ${logged}`);
		assert.ok(logged.includes('Streng vertraulicher Fehler'), `Log nennt den Fehler: ${logged}`);
	});
});
