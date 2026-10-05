import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, registerOn, applyTestAuthEnv } from '../test/helpers.js';
import { journalRouter } from './routes/journal.js';
import { Pillar } from '../models/index.js';

/**
 * Vertrag der Journal-API (#2212, docs/spec/issue-2212.md): pro Nutzer isolierte Einträge mit
 * Freitext (1–3000), Datum (Standard heute) und optionaler Säule; fremde Einträge sind 404.
 */

applyTestAuthEnv('test-secret-journal-2212');

type Entry = { id: number; text: string; date: string; pillarId: number | null };

let server: TestServer;

describe('Journal API (#2212)', () => {
	before(async () => {
		server = await startTestServer();
		assert.ok(journalRouter, 'journalRouter muss exportiert sein');
	});

	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	const register = (email: string) => registerOn(server, email, 'password');
	const call = (cookie: string, method: string, path: string, body?: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method,
			headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
	const list = async (cookie: string) => (await (await call(cookie, 'GET', '/journal')).json()) as Entry[];
	const firstPillarId = async (cookie: string) =>
		((await (await call(cookie, 'GET', '/pillars')).json()) as { id: number }[])[0]!.id;

	it('AK1 — POST ohne Datum und Säule: 201, Datum heute, pillarId null', async () => {
		const cookie = await register('ak1@example.com');
		const res = await call(cookie, 'POST', '/journal', { text: 'Heute war ruhig.' });
		assert.equal(res.status, 201);
		const entry = (await res.json()) as Entry;
		assert.equal(entry.text, 'Heute war ruhig.');
		assert.equal(entry.date, new Date().toISOString().slice(0, 10));
		assert.equal(entry.pillarId, null);
		assert.equal((await list(cookie)).length, 1);
	});

	it('AK1 — POST mit Datum und eigener Säule übernimmt beides', async () => {
		const cookie = await register('ak1b@example.com');
		const pillarId = await firstPillarId(cookie);
		const res = await call(cookie, 'POST', '/journal', { text: 'Mit Säule', date: '2026-01-02', pillarId });
		assert.equal(res.status, 201);
		const entry = (await res.json()) as Entry;
		assert.equal(entry.date, '2026-01-02');
		assert.equal(entry.pillarId, pillarId);
	});

	it('AK2 — ungültige Eingaben ergeben 400 und speichern nichts', async () => {
		const cookie = await register('ak2@example.com');
		const owner = await register('ak2-other@example.com');
		const foreignPillar = await firstPillarId(owner);
		const bad: unknown[] = [
			{ text: '' },
			{ text: '   ' },
			{ text: 'x'.repeat(3001) },
			{ text: 'ok', date: 'gestern' },
			{ text: 'ok', date: '2026-02-30' },
			{ text: 'ok', pillarId: 999999 },
			{ text: 'ok', pillarId: foreignPillar },
		];
		for (const body of bad) {
			const res = await call(cookie, 'POST', '/journal', body);
			assert.equal(res.status, 400, `erwartet 400 für ${JSON.stringify(body).slice(0, 60)}`);
		}
		assert.equal((await list(cookie)).length, 0);
	});

	it('AK2 — genau 3000 Zeichen sind erlaubt', async () => {
		const cookie = await register('ak2-max@example.com');
		const res = await call(cookie, 'POST', '/journal', { text: 'x'.repeat(3000) });
		assert.equal(res.status, 201);
	});

	it('AK3 — GET liefert nur eigene Einträge, absteigend nach Datum', async () => {
		const cookie = await register('ak3@example.com');
		const other = await register('ak3-other@example.com');
		await call(cookie, 'POST', '/journal', { text: 'alt', date: '2026-01-01' });
		await call(cookie, 'POST', '/journal', { text: 'neu', date: '2026-03-01' });
		await call(other, 'POST', '/journal', { text: 'fremd', date: '2026-02-01' });
		assert.deepEqual(
			(await list(cookie)).map((entry) => entry.text),
			['neu', 'alt'],
		);
	});

	it('AK3 — PATCH und DELETE wirken auf eigene Einträge', async () => {
		const cookie = await register('ak3-own@example.com');
		const { id } = (await (await call(cookie, 'POST', '/journal', { text: 'vorher' })).json()) as Entry;
		const patched = await call(cookie, 'PATCH', `/journal/${id}`, { text: 'nachher', date: '2026-01-05' });
		assert.equal(patched.status, 200);
		const entry = (await patched.json()) as Entry;
		assert.equal(entry.text, 'nachher');
		assert.equal(entry.date, '2026-01-05');
		assert.equal((await call(cookie, 'PATCH', `/journal/${id}`, { text: '' })).status, 400);
		assert.equal((await call(cookie, 'DELETE', `/journal/${id}`)).status, 204);
		assert.equal((await list(cookie)).length, 0);
	});

	it('AK3 — PATCH und DELETE auf fremde oder unbekannte Einträge: 404 ohne Änderung', async () => {
		const cookie = await register('ak3-foreign@example.com');
		const other = await register('ak3-foreign-other@example.com');
		const { id } = (await (await call(other, 'POST', '/journal', { text: 'gehört anderem' })).json()) as Entry;
		assert.equal((await call(cookie, 'PATCH', `/journal/${id}`, { text: 'gekapert' })).status, 404);
		assert.equal((await call(cookie, 'DELETE', `/journal/${id}`)).status, 404);
		assert.equal((await call(cookie, 'PATCH', '/journal/999999', { text: 'x' })).status, 404);
		assert.equal((await call(cookie, 'DELETE', '/journal/999999')).status, 404);
		assert.equal((await list(other))[0]!.text, 'gehört anderem');
	});

	it('Säule löschen lässt den Eintrag bestehen (pillarId null)', async () => {
		const cookie = await register('pillar-delete@example.com');
		const pillarId = await firstPillarId(cookie);
		await call(cookie, 'POST', '/journal', { text: 'bleibt', pillarId });
		// DELETE /pillars/:id ist seit #1573 gesperrt (403) — die Säule verschwindet nur serverseitig.
		await Pillar.destroy({ where: { id: pillarId } });
		const entries = await list(cookie);
		assert.equal(entries.length, 1);
		assert.equal(entries[0]!.pillarId, null);
	});

	it('ohne Session antworten alle Routen 401', async () => {
		assert.equal((await call('', 'GET', '/journal')).status, 401);
		assert.equal((await call('', 'POST', '/journal', { text: 'x' })).status, 401);
		assert.equal((await call('', 'PATCH', '/journal/1', { text: 'x' })).status, 401);
		assert.equal((await call('', 'DELETE', '/journal/1')).status, 401);
	});
});
