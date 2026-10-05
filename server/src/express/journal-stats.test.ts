import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, registerOn, applyTestAuthEnv } from '../test/helpers.js';
import { journalRouter } from './routes/journal.js';

/**
 * Vertrag der Journal-Statistik-API (#2213, docs/spec/issue-2213.md): `GET /journal/stats`
 * zählt eigene Einträge je Säule/ohne Säule/gesamt je Tages- bzw. Wochenfenster und liefert
 * den Balance-Verlauf (#1424) für denselben Zeitraum — Parität mit
 * `GET /scores/balance/history`. Rot, bis die Route existiert.
 */

applyTestAuthEnv('test-secret-journal-stats-2213');

type Fenster = {
	von: string;
	bis: string;
	proSaeule: { pillarId: number; anzahl: number }[];
	ohneSaeule: number;
	gesamt: number;
};
type Stats = { fenster: Fenster[]; balanceVerlauf: unknown[] };

let server: TestServer;

describe('Journal-Statistik API (#2213)', () => {
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
	const pillarsOf = async (cookie: string): Promise<{ id: number }[]> => {
		const pillars = (await (await call(cookie, 'GET', '/pillars')).json()) as { id: number }[];
		return [...pillars].sort((a, b) => a.id - b.id);
	};
	const seed = async (cookie: string, date: string, pillarId: number | null) => {
		const res = await call(cookie, 'POST', '/journal', { text: `Eintrag ${date}`, date, pillarId });
		assert.equal(res.status, 201, 'Setup: Journal-Eintrag muss anlegbar sein');
	};
	const stats = (cookie: string, query: string): Promise<Response> => call(cookie, 'GET', `/journal/stats${query}`);

	it('AK1 — Tagesstatistik: zählt je Säule, ohne Säule und gesamt; Tag ohne Einträge mit 0', async () => {
		const cookie = await register('stats-ak1@example.com');
		const pillars = await pillarsOf(cookie);
		const pillarId = pillars[0]!.id;
		await seed(cookie, '2026-10-01', pillarId);
		await seed(cookie, '2026-10-01', pillarId);
		await seed(cookie, '2026-10-01', null);
		await seed(cookie, '2026-10-02', pillarId);

		const res = await stats(cookie, '?von=2026-10-01&bis=2026-10-03');
		assert.equal(res.status, 200);
		const body = (await res.json()) as Stats;
		assert.equal(body.fenster.length, 3);
		// Alle Säulen des Nutzers sind gelistet, auch mit 0.
		assert.deepEqual(body.fenster[0], {
			von: '2026-10-01',
			bis: '2026-10-01',
			proSaeule: pillars.map((pillar) => ({ pillarId: pillar.id, anzahl: pillar.id === pillarId ? 2 : 0 })),
			ohneSaeule: 1,
			gesamt: 3,
		});
		assert.equal(body.fenster[1]!.gesamt, 1);
		assert.equal(body.fenster[2]!.gesamt, 0);
		assert.equal(body.fenster[2]!.ohneSaeule, 0);
	});

	it('AK2 — Wochengranularität: Kalenderwochen Montag-Beginn, Summen stimmen mit Tageswerten', async () => {
		const cookie = await register('stats-ak2@example.com');
		const pillars = await pillarsOf(cookie);
		await seed(cookie, '2026-10-01', pillars[0]!.id); // Donnerstag, KW des 28.09.
		await seed(cookie, '2026-10-03', null); // Samstag
		await seed(cookie, '2026-10-06', pillars[1]!.id); // Dienstag, KW des 05.10.

		const tageweise = (await (await stats(cookie, '?von=2026-09-28&bis=2026-10-11')).json()) as Stats;
		const wochenweise = (await (
			await stats(cookie, '?von=2026-09-28&bis=2026-10-11&granularitaet=woche')
		).json()) as Stats;

		assert.equal(wochenweise.fenster.length, 2);
		assert.deepEqual(
			{ von: wochenweise.fenster[0]!.von, bis: wochenweise.fenster[0]!.bis },
			{
				von: '2026-09-28',
				bis: '2026-10-04',
			},
		);
		assert.deepEqual(
			{ von: wochenweise.fenster[1]!.von, bis: wochenweise.fenster[1]!.bis },
			{
				von: '2026-10-05',
				bis: '2026-10-11',
			},
		);
		const gesamtTag1 = tageweise.fenster.slice(0, 7).reduce((total, f) => total + f.gesamt, 0);
		const gesamtTag2 = tageweise.fenster.slice(7).reduce((total, f) => total + f.gesamt, 0);
		assert.equal(wochenweise.fenster[0]!.gesamt, gesamtTag1);
		assert.equal(wochenweise.fenster[1]!.gesamt, gesamtTag2);
		const anzahlSaeule = (fenster: Fenster, pillarId: number) =>
			fenster.proSaeule.find((s) => s.pillarId === pillarId)!.anzahl;
		assert.equal(anzahlSaeule(wochenweise.fenster[0]!, pillars[0]!.id), 1);
		assert.equal(anzahlSaeule(wochenweise.fenster[1]!, pillars[1]!.id), 1);
		assert.equal(wochenweise.fenster[0]!.ohneSaeule, 1);
	});

	it('AK3 — balanceVerlauf identisch zu GET /scores/balance/history für denselben Zeitraum', async () => {
		const cookie = await register('stats-ak3@example.com');
		const von = '2026-09-28';
		const bis = '2026-10-04';
		const res = await stats(cookie, `?von=${von}&bis=${bis}`);
		assert.equal(res.status, 200);
		const body = (await res.json()) as Stats;
		const verlauf = await call(cookie, 'GET', `/scores/balance/history?von=${von}&bis=${bis}`);
		assert.equal(verlauf.status, 200);
		assert.deepEqual(body.balanceVerlauf, await verlauf.json());
	});

	it('AK4 — fremde Einträge zählen nicht (Isolation zweiter Nutzer)', async () => {
		const a = await register('stats-ak4-a@example.com');
		const b = await register('stats-ak4-b@example.com');
		await seed(a, '2026-10-01', null);
		await seed(a, '2026-10-01', null);
		await seed(b, '2026-10-01', null);

		const body = (await (await stats(a, '?von=2026-10-01&bis=2026-10-01')).json()) as Stats;
		assert.equal(body.fenster[0]!.gesamt, 2);
		assert.equal(body.fenster[0]!.ohneSaeule, 2);
	});

	it('AK4 — ungültige Parameter ergeben 400', async () => {
		const cookie = await register('stats-ak4-invalid@example.com');
		const faelle: string[] = [
			'', // Parameter fehlen
			'?bis=2026-10-01',
			'?von=2026-10-01',
			'?von=2026-02-30&bis=2026-10-01', // existiert nicht
			'?von=gestern&bis=2026-10-01',
			'?von=2026-10-02&bis=2026-10-01', // bis vor von
			'?von=2026-01-01&bis=2027-01-03', // 367 Tage > Obergrenze
			'?von=2026-10-01&bis=2026-10-02&granularitaet=monat',
		];
		for (const query of faelle) {
			const res = await stats(cookie, query);
			assert.equal(res.status, 400, `erwartet 400 für "${query}"`);
			assert.ok(((await res.json()) as { message?: string }).message, `400 braucht eine message (${query})`);
		}
	});

	it('AK4 — ohne Session 401', async () => {
		const res = await stats('', '?von=2026-10-01&bis=2026-10-02');
		assert.equal(res.status, 401);
	});
});
