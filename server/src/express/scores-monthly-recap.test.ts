import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { MilestoneReached, ScoreEntry, TaskPillar, User } from '../models/index.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1995 (Spec docs/spec/issue-1995.md) — `GET /scores/monthly-recap`.
 *
 * AK1: Monatsrückblick je Nutzer — Säulen-Differenz im Monatsfenster (Parität zur Wochenkarte
 * #1968 über /scores/balance/history), Streak zum Monatsende in der Nutzerzeitzone, im Monat
 * neu erreichte Meilensteine (MilestoneReached.zeitpunkt im Fenster), Datenisolation.
 *
 * Rot, bis der Endpunkt existiert (heute: 404/SPA-Fallback unter `/scores/monthly-recap`).
 * KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1995-monthly-recap');

let server: TestServer;

const getRecap = (cookie: string, query: string): Promise<Response> =>
	server.json(`/scores/monthly-recap${query}`, { headers: { Cookie: cookie } });

const getHistory = (cookie: string, query: string): Promise<Response> =>
	server.json(`/scores/balance/history${query}`, { headers: { Cookie: cookie } });

/**
 * Gibt eine der fünf festen Standard-Säulen des Nutzers zurück (Setup). Säulen-CRUD ist seit
 * #1573 gesperrt — die Registrierung sät fünf Standard-Säulen; statt anzulegen wird aus diesem
 * Bestand gewählt (Zyklus, damit aufeinanderfolgende Aufrufe unterschiedliche ids liefern).
 */
let seedPillarCursor = 0;
const createPillar = async (cookie: string): Promise<{ id: number; weight: number }> => {
	const res = await server.json('/pillars', { headers: { Cookie: cookie } });
	assert.equal(res.status, 200, 'Setup: Säulen müssen über die API lesbar sein');
	const pillars = (await res.json()) as { id: number; weight: number }[];
	assert.ok(pillars.length > 1, 'Setup: Registrierung sollte fünf Standard-Säulen säen');
	return pillars[seedPillarCursor++ % pillars.length]!;
};

/** Legt einen Task mit Säulenanteilen an, erledigt ihn und setzt den ScoreEntry-Zeitpunkt fest. */
const completeTaskAt = async (
	cookie: string,
	title: string,
	estimatedEffort: number,
	pillars: { pillarId: number; share: number }[],
	zeitpunkt: Date,
): Promise<void> => {
	const createRes = await server.json('/tasks', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ title, priority: 3, estimatedEffort }),
	});
	assert.equal(createRes.status, 201, 'Task-Anlage muss 201 liefern');
	const task = (await createRes.json()) as { id: number };
	// Legacy-Insert außerhalb der Schreib-Regel (#2077): die Historien-Lesepfade werten Alt-
	// Verteilungen unverfälscht aus, die Schreib-Regel ist für dieses Setup bewusst nicht aktiv.
	for (const entry of pillars) {
		await TaskPillar.create({ taskId: task.id, pillarId: entry.pillarId, share: entry.share, confidence: 100 });
	}

	const doneRes = await server.json(`/tasks/${task.id}`, {
		method: 'PATCH',
		headers: { Cookie: cookie },
		body: JSON.stringify({ status: 'Done' }),
	});
	assert.equal(doneRes.status, 200, 'Statuswechsel auf Done muss 200 liefern');

	const [updated] = await ScoreEntry.update({ zeitpunkt }, { where: { taskId: task.id } });
	assert.equal(updated, 1, 'Setup: ScoreEntry für den Task muss existieren, um den Zeitpunkt zu verschieben');
};

interface MonthlyRecap {
	monat: string;
	saeulen: { id: number; name: string; punkte: number }[];
	streak: number;
	meilensteine: { schluessel: string; zeitpunkt: string }[];
}

/** Auf eine Dezimalstelle gerundet (Vertrag: Punktwerte mit einer Dezimalstelle, Muster /scores/balance). */
const round1 = (wert: number): number => Math.round(wert * 10) / 10;

describe('GET /scores/monthly-recap (#1995)', () => {
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
		const res = await server.json('/scores/monthly-recap?monat=2026-09');
		assert.equal(res.status, 401);
	});

	it('ungültiger oder fehlender Monat → 400 mit message', async () => {
		const cookie = await server.register('recap-invalid@example.com');
		for (const query of ['', '?monat=2026-13', '?monat=foo', '?monat=2026-09-01']) {
			const res = await getRecap(cookie, query);
			assert.equal(res.status, 400, `Query "${query || '(leer)'}" muss 400 liefern`);
			const body = (await res.json()) as { message?: string };
			assert.equal(typeof body.message, 'string');
			assert.ok(body.message!.length > 0);
		}
	});

	it('Säulen-Differenz entspricht exakt der Verlaufs-Parität (Fenster: letzter Tag Vormonat bis Monatsende)', async () => {
		const cookie = await server.register('recap-parity@example.com');
		const p1 = await createPillar(cookie);
		const p2 = await createPillar(cookie);
		await completeTaskAt(
			cookie,
			'Vor dem Fenster',
			1,
			[{ pillarId: p1.id, share: 100 }],
			new Date('2026-08-31T12:00:00Z'),
		);
		await completeTaskAt(cookie, 'Im Monat', 1, [{ pillarId: p1.id, share: 100 }], new Date('2026-09-15T12:00:00Z'));
		await completeTaskAt(
			cookie,
			'Später im Monat',
			1,
			[{ pillarId: p2.id, share: 100 }],
			new Date('2026-09-28T12:00:00Z'),
		);

		const recapRes = await getRecap(cookie, '?monat=2026-09&tz=UTC');
		assert.equal(recapRes.status, 200);
		const recap = (await recapRes.json()) as MonthlyRecap;
		assert.equal(recap.monat, '2026-09');

		const historyRes = await getHistory(cookie, '?von=2026-08-31&bis=2026-09-30&tz=UTC');
		assert.equal(historyRes.status, 200, 'Setup: /scores/balance/history muss lesbar sein (Paritäts-Spiegel)');
		const tage = (await historyRes.json()) as { tag: string; saeulen: { id: number; punkte: number }[] }[];
		assert.ok(Array.isArray(tage) && tage.length >= 2, 'Setup: Verlauf muss das Fenster abdecken');
		const standFensterEintritt = new Map((tage[0]?.saeulen ?? []).map((s) => [s.id, s.punkte]));
		const standMonatsende = new Map((tage.at(-1)?.saeulen ?? []).map((s) => [s.id, s.punkte]));

		assert.deepEqual(
			recap.saeulen.map((s) => s.id).sort(),
			[...standMonatsende.keys()].sort(),
			'Recap muss je Säule des Nutzers einen Eintrag tragen',
		);
		for (const saeule of recap.saeulen) {
			const erwartet = round1((standMonatsende.get(saeule.id) ?? 0) - (standFensterEintritt.get(saeule.id) ?? 0));
			assert.equal(
				round1(saeule.punkte),
				erwartet,
				`Säule ${saeule.id}: Recap-Punkte müssen der Wochenkarten-Differenz entsprechen`,
			);
			assert.equal(typeof saeule.name, 'string');
			assert.ok(saeule.name.length > 0);
		}
		assert.ok(
			recap.saeulen.some((s) => s.punkte > 0),
			'Mit Erledigungen im Monat darf nicht alles auf 0 stehen',
		);
	});

	it('Streak zum Monatsende folgt der Nutzerzeitzone (America/New_York vs UTC)', async () => {
		const cookie = await server.register('recap-tz@example.com');
		const p1 = await createPillar(cookie);
		// Beide Erledigungen lokal am 30.09. (New York), UTC-seitig 30.09. 20:00 und 01.10. 03:00.
		await completeTaskAt(cookie, 'Abend eins', 1, [{ pillarId: p1.id, share: 100 }], new Date('2026-09-30T20:00:00Z'));
		await completeTaskAt(cookie, 'Abend zwei', 1, [{ pillarId: p1.id, share: 100 }], new Date('2026-10-01T03:00:00Z'));

		const utc = (await (await getRecap(cookie, '?monat=2026-09&tz=UTC')).json()) as MonthlyRecap;
		assert.equal(utc.streak, 0, 'UTC-seitig liegt keine Erledigung im September — Streak am Monatsende 0');

		const ny = (await (await getRecap(cookie, '?monat=2026-09&tz=America%2FNew_York')).json()) as MonthlyRecap;
		// Test-Pflege (#1995): beide Erledigungen liegen in New York (EDT, UTC-4) am 30.09. — ein
		// aktiver Tag; `berechneStreak` zählt unterschiedliche Tage, mehr als 1 ist aus einem Tag
		// nicht ableitbar. Der UTC-Fall (zwei Tage, Stichtag Monatsende → 0) bleibt unverändert.
		assert.equal(ny.streak, 1, 'New-York-seitig sind beide Erledigungen am 30.09. — Streak am Monatsende 1');
	});

	it('Meilensteine: nur die eigenen mit zeitpunkt im Monatsfenster', async () => {
		const emailA = 'recap-ms-a@example.com';
		const cookieA = await server.register(emailA);
		const cookieB = await server.register('recap-ms-b@example.com');
		assert.notEqual(cookieA, cookieB, 'Setup: zwei getrennte Sessions nötig');
		const userA = await User.findOne({ where: { email: emailA } });
		assert.ok(userA, 'Setup: Nutzer A muss nach der Registrierung auffindbar sein');
		const userB = (await User.findOne({ where: { email: 'recap-ms-b@example.com' } }))!;
		// Test-Pflege (#1995): je Zeile nur EIN Create — der Unique-Index (userId+schluessel,
		// milestoneReached.ts) ließe Doppelte nicht zu; Assertions (Fenster + Isolation) unverändert.
		await MilestoneReached.create({
			userId: userA.id,
			schluessel: 'streak-7',
			zeitpunkt: new Date('2026-09-14T10:00:00Z'),
		});
		await MilestoneReached.create({
			userId: userA.id,
			schluessel: 'punkte-100',
			zeitpunkt: new Date('2026-10-05T10:00:00Z'),
		});
		await MilestoneReached.create({
			userId: userB.id,
			schluessel: 'streak-30',
			zeitpunkt: new Date('2026-09-20T10:00:00Z'),
		});

		const res = await getRecap(cookieA, '?monat=2026-09&tz=UTC');
		assert.equal(res.status, 200);
		const recap = (await res.json()) as MonthlyRecap;
		assert.deepEqual(recap.meilensteine, [{ schluessel: 'streak-7', zeitpunkt: '2026-09-14T10:00:00.000Z' }]);
	});
});
