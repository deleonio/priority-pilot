import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Dependency, ScoreEntry, TaskPillar } from '../models/index.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1997 (Spec docs/spec/issue-1997.md) — `GET /scores/yearly-recap`.
 *
 * AK1: Kennzahlen des Jahres (Anzahl, Stunden, längster Streak, stärkste Säule, Projekte), nur
 * Erledigungen im Kalenderjahr. AK2: 400 bei ungültigem `jahr`, Datenisolation. AK3: Streak vor
 * dem Jahr zählt nicht. AK4: Projekt = erledigte Oberaufgabe mit Unteraufgabe im Jahr.
 *
 * Rot, bis der Endpunkt existiert (heute: 404/SPA-Fallback unter `/scores/yearly-recap`).
 * KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1997-yearly-recap');

let server: TestServer;

const getRecap = (cookie: string, query: string): Promise<Response> =>
	server.json(`/scores/yearly-recap${query}`, { headers: { Cookie: cookie } });

interface YearlyRecap {
	jahr: number;
	erledigteAufgaben: number;
	stunden: number;
	laengsterStreak: number;
	staerksteSaeule: { id: number; name: string; punkte: number } | null;
	abgeschlosseneProjekte: number;
}

/** Eine der fünf Standard-Säulen des Nutzers (Säulen-CRUD ist seit #1573 gesperrt, Registrierung sät sie). */
let seedPillarCursor = 0;
const createPillar = async (cookie: string): Promise<{ id: number }> => {
	const res = await server.json('/pillars', { headers: { Cookie: cookie } });
	assert.equal(res.status, 200, 'Setup: Säulen müssen lesbar sein');
	const pillars = (await res.json()) as { id: number }[];
	assert.ok(pillars.length > 1, 'Setup: Registrierung sollte fünf Standard-Säulen säen');
	return pillars[seedPillarCursor++ % pillars.length]!;
};

const createTask = async (cookie: string, title: string, estimatedEffort: number): Promise<number> => {
	const res = await server.json('/tasks', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ title, priority: 3, estimatedEffort }),
	});
	assert.equal(res.status, 201, 'Task-Anlage muss 201 liefern');
	return ((await res.json()) as { id: number }).id;
};

/** Legt einen Task an, erledigt ihn und setzt den ScoreEntry-Zeitpunkt fest (statisches `update`, Memory 2026-10-05). */
const completeTaskAt = async (
	cookie: string,
	title: string,
	estimatedEffort: number,
	zeitpunkt: Date,
	opts: { pillarId?: number; actualEffort?: number } = {},
): Promise<number> => {
	const id = await createTask(cookie, title, estimatedEffort);
	if (opts.pillarId !== undefined) {
		// Legacy-Insert außerhalb der Schreib-Regel (#2077), Muster scores-monthly-recap.test.ts.
		await TaskPillar.create({ taskId: id, pillarId: opts.pillarId, share: 100, confidence: 100 });
	}
	const doneRes = await server.json(`/tasks/${id}`, {
		method: 'PATCH',
		headers: { Cookie: cookie },
		body: JSON.stringify({
			status: 'Done',
			...(opts.actualEffort !== undefined && { actualEffort: opts.actualEffort }),
		}),
	});
	assert.equal(doneRes.status, 200, 'Statuswechsel auf Done muss 200 liefern');
	const [updated] = await ScoreEntry.update({ zeitpunkt }, { where: { taskId: id } });
	assert.equal(updated, 1, 'Setup: ScoreEntry muss existieren, um den Zeitpunkt zu verschieben');
	return id;
};

/** Auf eine Dezimalstelle gerundet (Muster /scores/balance). */
const round1 = (wert: number): number => Math.round(wert * 10) / 10;

describe('GET /scores/yearly-recap (#1997)', () => {
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

	it('ohne Session → 401', async () => {
		const res = await server.json('/scores/yearly-recap?jahr=2026');
		assert.equal(res.status, 401);
	});

	it('AK2: ungültiges oder fehlendes jahr → 400 mit message', async () => {
		const cookie = await server.register('yearly-invalid@example.com');
		for (const query of ['', '?jahr=foo', '?jahr=26', '?jahr=2026-01', '?jahr=20266']) {
			const res = await getRecap(cookie, query);
			assert.equal(res.status, 400, `Query "${query || '(leer)'}" muss 400 liefern`);
			const body = (await res.json()) as { message?: string };
			assert.equal(typeof body.message, 'string');
			assert.ok(body.message!.length > 0);
		}
	});

	it('AK1: Anzahl, Stunden (actualEffort sonst estimatedEffort) und stärkste Säule — nur Erledigungen im Jahr', async () => {
		const cookie = await server.register('yearly-kpis@example.com');
		const p1 = await createPillar(cookie);
		const p2 = await createPillar(cookie);
		await completeTaskAt(cookie, 'Mit Ist', 0.8, new Date('2026-03-10T12:00:00Z'), {
			pillarId: p1.id,
			actualEffort: 3,
		});
		await completeTaskAt(cookie, 'Nur Schätzung', 0.5, new Date('2026-07-01T12:00:00Z'), { pillarId: p2.id });
		await completeTaskAt(cookie, 'Silvester Vorjahr', 1, new Date('2025-12-31T23:00:00Z'), { pillarId: p2.id });
		await completeTaskAt(cookie, 'Neujahr Folgejahr', 1, new Date('2027-01-01T01:00:00Z'), { pillarId: p2.id });

		const res = await getRecap(cookie, '?jahr=2026&tz=UTC');
		assert.equal(res.status, 200);
		const recap = (await res.json()) as YearlyRecap;
		assert.equal(recap.jahr, 2026);
		assert.equal(recap.erledigteAufgaben, 2, 'Erledigungen außerhalb des Jahres zählen nicht');
		assert.equal(recap.stunden, 3.5, '3 (actualEffort) + 0.5 (estimatedEffort) — nichts außerhalb des Jahres');

		// Parität zum Verlauf: Stand 31.12. Jahr minus Stand 31.12. Vorjahr, größte Differenz gewinnt.
		const historyRes = await server.json('/scores/balance/history?von=2025-12-31&bis=2026-12-31&tz=UTC', {
			headers: { Cookie: cookie },
		});
		assert.equal(historyRes.status, 200, 'Setup: Verlauf muss lesbar sein (Paritäts-Spiegel)');
		const tage = (await historyRes.json()) as { saeulen: { id: number; punkte: number }[] }[];
		const start = new Map((tage[0]?.saeulen ?? []).map((s) => [s.id, s.punkte]));
		const diffs = (tage.at(-1)?.saeulen ?? []).map((s) => ({
			id: s.id,
			punkte: round1(s.punkte - (start.get(s.id) ?? 0)),
		}));
		const staerkste = diffs.reduce((a, b) => (b.punkte > a.punkte ? b : a));
		assert.ok(staerkste.punkte > 0, 'Setup: mit Erledigungen im Jahr muss eine Säule Punkte haben');
		assert.ok(recap.staerksteSaeule, 'staerksteSaeule darf mit Punkten nicht null sein');
		assert.equal(recap.staerksteSaeule.id, staerkste.id);
		assert.equal(round1(recap.staerksteSaeule.punkte), staerkste.punkte);
		assert.equal(typeof recap.staerksteSaeule.name, 'string');
	});

	it('AK1: ohne Erledigungen im Jahr → Nullwerte, staerksteSaeule null', async () => {
		const cookie = await server.register('yearly-empty@example.com');
		const res = await getRecap(cookie, '?jahr=2026&tz=UTC');
		assert.equal(res.status, 200);
		const recap = (await res.json()) as YearlyRecap;
		assert.equal(recap.erledigteAufgaben, 0);
		assert.equal(recap.stunden, 0);
		assert.equal(recap.laengsterStreak, 0);
		assert.equal(recap.staerksteSaeule, null);
		assert.equal(recap.abgeschlosseneProjekte, 0);
	});

	it('AK3: ein Streak, der vor dem Jahr länger war, zählt nicht als längster Streak des Jahres', async () => {
		const cookie = await server.register('yearly-streak@example.com');
		for (let tag = 15; tag <= 24; tag++) {
			await completeTaskAt(cookie, `Dez ${tag}`, 1, new Date(`2025-12-${tag}T12:00:00Z`));
		}
		await completeTaskAt(cookie, 'März eins', 1, new Date('2026-03-10T12:00:00Z'));
		await completeTaskAt(cookie, 'März zwei', 1, new Date('2026-03-11T12:00:00Z'));

		const recap = (await (await getRecap(cookie, '?jahr=2026&tz=UTC')).json()) as YearlyRecap;
		assert.equal(recap.laengsterStreak, 2, 'nur die zwei Tage im Jahr zählen, nicht die zehn aus dem Vorjahr');
	});

	it('AK4: Projekt = im Jahr erledigte Oberaufgabe mit Unteraufgabe', async () => {
		const cookie = await server.register('yearly-projects@example.com');
		const child = async (parentId: number, title: string): Promise<void> => {
			const childId = await createTask(cookie, title, 1);
			await Dependency.create({ dependentTaskId: parentId, dependingTaskId: childId, weight: 1 });
		};

		const projekt = await completeTaskAt(cookie, 'Projekt', 1, new Date('2026-05-05T12:00:00Z'));
		await child(projekt, 'Teil davon');
		await completeTaskAt(cookie, 'Einzelaufgabe ohne Kinder', 1, new Date('2026-05-06T12:00:00Z'));
		const offen = await createTask(cookie, 'Offene Oberaufgabe', 1);
		await child(offen, 'Teil der offenen');
		const vorjahr = await completeTaskAt(cookie, 'Projekt Vorjahr', 1, new Date('2025-05-05T12:00:00Z'));
		await child(vorjahr, 'Teil des Vorjahres');

		const recap = (await (await getRecap(cookie, '?jahr=2026&tz=UTC')).json()) as YearlyRecap;
		assert.equal(recap.abgeschlosseneProjekte, 1, 'nur die im Jahr erledigte Oberaufgabe mit Unteraufgabe zählt');
		assert.equal(recap.erledigteAufgaben, 2, 'Projekt und Einzelaufgabe; Unteraufgaben sind offen');
	});

	it('AK2: Daten anderer Nutzer fließen nicht ein', async () => {
		const cookieA = await server.register('yearly-iso-a@example.com');
		const cookieB = await server.register('yearly-iso-b@example.com');
		const pB = await createPillar(cookieB);
		await completeTaskAt(cookieB, 'Fremd', 1, new Date('2026-03-10T12:00:00Z'), { pillarId: pB.id });
		await completeTaskAt(cookieA, 'Eigen', 1, new Date('2026-03-12T12:00:00Z'));

		const recap = (await (await getRecap(cookieA, '?jahr=2026&tz=UTC')).json()) as YearlyRecap;
		assert.equal(recap.erledigteAufgaben, 1);
		assert.equal(recap.stunden, 1);
		assert.equal(recap.laengsterStreak, 1);
		assert.equal(recap.staerksteSaeule, null, 'fremde Säulenpunkte dürfen nicht einfließen');
	});
});
