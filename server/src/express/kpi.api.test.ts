import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import KpiEvent from '../models/kpiEvent.js';
import User from '../models/user.js';

/**
 * Rote Spec-Tests für #1989 (Spec docs/spec/issue-1989.md) — Protokollierpunkte und Admin-Auswertung.
 * AK2: Erledigung Tag 0 vs. später; AK4: Wochenkarten-Share-Ping je Woche einmal; AK5: Einladungen;
 * AK6: `GET /admin/kpis` je Zeitraum mit Kleinzellen-Unterdrückung; AK7: keine Identitäten.
 * Rot, bis Modell, Endpunkte und Auswertung existieren. KEIN Produktivcode.
 */
applyTestAuthEnv('test-secret-issue-1989-kpi');

let server: TestServer;

const auth = (cookie: string) => ({ headers: { Cookie: cookie } });

const zaehle = (art: string): Promise<number> => KpiEvent.count({ where: { art } });

/** Legt einen eigenen Task an und erledigt ihn (echter Done-Übergang). */
const erledigeTask = async (cookie: string, titel: string): Promise<void> => {
	const created = await server.json('/tasks', {
		method: 'POST',
		...auth(cookie),
		body: JSON.stringify({ title: titel }),
	});
	assert.equal(created.status, 201, 'Setup: Task muss anlegbar sein');
	const { id } = (await created.json()) as { id: number };
	const done = await server.json(`/tasks/${id}`, {
		method: 'PATCH',
		...auth(cookie),
		body: JSON.stringify({ status: 'Done' }),
	});
	assert.equal(done.status, 200, 'Setup: Task muss erledigbar sein');
};

describe('KPI-Protokollierung und Admin-Auswertung (#1989)', () => {
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

	it('AK2: Erledigung am Registrierungstag schreibt aktivierung und keinen aktivitaet-Eintrag', async () => {
		const cookie = await server.register('kpi-tag0@example.com', 'password123');
		await erledigeTask(cookie, 'Erster Tag');
		assert.equal(await zaehle('aktivierung'), 1);
		assert.equal(await zaehle('aktivitaet'), 0);
	});

	it('AK2: Erledigung an einem späteren Tag schreibt nur aktivitaet', async () => {
		const cookie = await server.register('kpi-spaeter@example.com', 'password123');
		const user = await User.findOne({ where: { email: 'kpi-spaeter@example.com' } });
		assert.ok(user, 'Setup: Nutzer erwartet');
		await user.update({ createdAt: new Date(Date.now() - 2 * 86_400_000) });
		await erledigeTask(cookie, 'Zweiter Tag');
		assert.equal(await zaehle('aktivierung'), 0);
		assert.equal(await zaehle('aktivitaet'), 1);
	});

	it('AK4: Wochenkarten-Share zählt je Nutzer und Woche einmal — zweiter Ping zählt nicht', async () => {
		const cookie = await server.register('kpi-share@example.com', 'password123');
		const ping = () => server.json('/kpis/wochenkarte', { method: 'POST', ...auth(cookie) });
		assert.equal((await ping()).status, 204);
		assert.equal(await zaehle('wochenkarte'), 1);
		assert.equal((await ping()).status, 204);
		assert.equal(await zaehle('wochenkarte'), 1, 'zweiter Ping derselben Woche zählt nicht');
	});

	it('AK4: Share-Ping ohne Session wird abgewiesen (401)', async () => {
		assert.equal((await server.json('/kpis/wochenkarte', { method: 'POST' })).status, 401);
	});

	it('AK5: je angelegter Gruppeneinladung ein einladung-Ereignis; anderes Konto zählt separat', async () => {
		const admin = await server.login('kpi-invite-admin@example.com', { displayName: 'Kpi Admin' });
		const bob = await server.login('kpi-invite-bob@example.com', { displayName: 'Bob Einladung' });
		const carol = await server.login('kpi-invite-carol@example.com', { displayName: 'Carol Einladung' });
		const gruppe = await server.json('/groups', {
			method: 'POST',
			...auth(admin),
			body: JSON.stringify({ name: 'Kpi-Gruppe' }),
		});
		assert.equal(gruppe.status, 201, 'Setup: Gruppe muss anlegbar sein');
		const { id: groupId } = (await gruppe.json()) as { id: number };

		const userIdOf = async (cookie: string, name: string): Promise<number> => {
			const res = await server.json(`/users/search?query=${encodeURIComponent(name)}`, auth(cookie));
			const hits = (await res.json()) as { id: number; displayName: string }[];
			const hit = hits.find((h) => h.displayName === name);
			assert.ok(hit, `Setup: Nutzer "${name}" muss über die Suche auffindbar sein`);
			return hit.id;
		};
		const ladeEin = (cookie: string, targetId: number): Promise<Response> =>
			server.json(`/groups/${groupId}/invitations`, {
				method: 'POST',
				...auth(cookie),
				body: JSON.stringify({ userId: targetId }),
			});

		assert.equal((await ladeEin(admin, await userIdOf(bob, 'Bob Einladung'))).status, 201);
		assert.equal(await zaehle('einladung'), 1);
		assert.equal((await ladeEin(admin, await userIdOf(carol, 'Carol Einladung'))).status, 201);
		assert.equal(await zaehle('einladung'), 2, 'Einladung an anderes Konto zählt separat');
	});

	it('AK6: /admin/kpis liefert beide Zeiträume als Quoten, leere Kohorte unterdrückt, keine Identitäten (AK7)', async () => {
		const admin = await server.login('kpi-admin@example.com', { role: 'admin' });
		for (let i = 1; i <= 6; i++) {
			const cookie = await server.register(`kpi-nutzer-${i}@example.com`, 'password123');
			await erledigeTask(cookie, `Aufgabe ${i}`);
		}
		const shareCookie = await server.register('kpi-nutzer-share@example.com', 'password123');
		await server.json('/kpis/wochenkarte', { method: 'POST', ...auth(shareCookie) });

		const res = await server.json('/admin/kpis?zeitraum=woche', auth(admin));
		assert.equal(res.status, 200);
		const raw = await res.text();
		const json = JSON.parse(raw) as { zeitraum: string; zeilen: Record<string, unknown>[] };
		assert.equal(json.zeitraum, 'woche');
		assert.equal(json.zeilen.length, 1);
		const zeile = json.zeilen[0] as {
			periode: string;
			neueNutzer: number;
			aktivierung: unknown;
			tag7: unknown;
			wochenkarte: unknown;
			einladungen: unknown;
		};
		assert.deepEqual(
			Object.keys(zeile).sort(),
			['aktivierung', 'einladungen', 'neueNutzer', 'periode', 'tag7', 'wochenkarte'],
			'AK7: genau diese sechs Felder',
		);
		assert.deepEqual(zeile.aktivierung, { zaehler: 6, nenner: 7, quote: 6 / 7 });
		assert.equal(zeile.tag7, 'unterdrueckt', 'Tag 7 liegt in der Zukunft → keine Kohorte → unterdrückt');
		assert.deepEqual(zeile.wochenkarte, { zaehler: 1, nenner: 7, quote: 1 / 7 });
		assert.deepEqual(zeile.einladungen, { zaehler: 0, nenner: 7, quote: 0 });
		assert.doesNotMatch(raw, /kpi-nutzer|@example\.com|userId/, 'AK7: keine Identitäten in der Antwort');

		const monat = await server.json('/admin/kpis?zeitraum=monat', auth(admin));
		assert.equal(monat.status, 200);
		const monatJson = JSON.parse(await monat.text()) as { zeitraum: string; zeilen: { periode: string }[] };
		assert.equal(monatJson.zeitraum, 'monat');
		assert.equal(monatJson.zeilen.length, 1);
		assert.match(monatJson.zeilen[0]!.periode, /^\d{4}-\d{2}$/);
	});

	it('AK6: ohne Session 401, als Member 403, fehlender/falscher zeitraum 400', async () => {
		assert.equal((await server.json('/admin/kpis?zeitraum=woche')).status, 401);
		const member = await server.login('kpi-member@example.com', { role: 'member' });
		assert.equal((await server.json('/admin/kpis?zeitraum=woche', auth(member))).status, 403);
		const admin = await server.login('kpi-admin-400@example.com', { role: 'admin' });
		assert.equal((await server.json('/admin/kpis?zeitraum=jahr', auth(admin))).status, 400);
		assert.equal((await server.json('/admin/kpis', auth(admin))).status, 400);
	});
});
