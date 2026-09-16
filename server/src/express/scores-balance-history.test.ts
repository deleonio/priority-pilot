import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ScoreEntry } from '../models/index.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1424 (Spec docs/spec/issue-1424.md) — `GET /scores/balance/history`.
 *
 * AK1: genau ein Eintrag je Kalendertag des geschlossenen Intervalls, `von == bis` → ein Eintrag.
 * AK2: Tages-Eintrag enthält `fuellstandProzent` + `saeulen` (Punkte je Säule zum Tagesende).
 * AK3: ein Tag ohne Erledigung trägt Füllstand/Säulen-Punkte des Vortags.
 * AK4: letzter Eintrag bei `bis = heute` stimmt exakt mit `GET /scores/balance` überein.
 * AK5: `?tz=` bestimmt die Tagesgrenze, unbekannter Wert → Fallback Serverzeit, kein Fehler.
 * AK6: ein Token liefert ausschließlich Daten seines Besitzers.
 * AK7: ungültige Datumsangaben → 400 mit `message`.
 *
 * Rot, bis der Endpoint existiert (heute: 404/SPA-Fallback, kein Router unter `/scores/balance/history`).
 * KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1424-balance-history');

let server: TestServer;
let idCounter = 1;

const getHistory = (cookie: string, query: string): Promise<Response> =>
	server.json(`/scores/balance/history${query}`, { headers: { Cookie: cookie } });

const getBalance = (cookie: string, query = ''): Promise<Response> =>
	server.json(`/scores/balance${query}`, { headers: { Cookie: cookie } });

const createPillar = async (cookie: string, name: string): Promise<{ id: number; weight: number }> => {
	const res = await server.json('/pillars', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ name, description: '' }),
	});
	assert.equal(res.status, 201, 'Setup: Säule muss über die API anlegbar sein');
	return (await res.json()) as { id: number; weight: number };
};

/** Legt einen Task mit Säulenanteilen an, erledigt ihn und setzt den ScoreEntry-Zeitpunkt fest. */
const completeTaskAt = async (
	cookie: string,
	title: string,
	estimatedEffort: number,
	pillars: { pillarId: number; share: number }[],
	zeitpunkt: Date,
): Promise<number> => {
	const createRes = await server.json('/tasks', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ title, priority: 3, estimatedEffort, pillars }),
	});
	assert.equal(createRes.status, 201, 'Task-Anlage muss 201 liefern');
	const task = (await createRes.json()) as { id: number };

	const doneRes = await server.json(`/tasks/${task.id}`, {
		method: 'PATCH',
		headers: { Cookie: cookie },
		body: JSON.stringify({ status: 'Done' }),
	});
	assert.equal(doneRes.status, 200, 'Statuswechsel auf Done muss 200 liefern');

	const [updated] = await ScoreEntry.update({ zeitpunkt }, { where: { taskId: task.id } });
	assert.equal(updated, 1, 'Setup: ScoreEntry für den Task muss existieren, um den Zeitpunkt zu verschieben');
	return task.id;
};

/** `YYYY-MM-DD` eines Datums X Tage nach `basis` (UTC-Zivilrechnung, für Setup-Zeitstempel). */
const tagPlus = (basis: string, tage: number): string => {
	const [jahr, monat, tag] = basis.split('-').map(Number);
	const datum = new Date(Date.UTC(jahr, monat - 1, tag + tage));
	return datum.toISOString().slice(0, 10);
};

describe('GET /scores/balance/history (#1424)', () => {
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
		assert.equal((await getHistory('cookie=none', '?von=2026-06-01&bis=2026-06-01')).status, 401);
	});

	it('AK1: von == bis liefert genau einen Eintrag für diesen Tag', async () => {
		const cookie = await server.register('history-single-day@example.com', 'password123');
		await createPillar(cookie, `Säule-${idCounter++}`);

		const res = await getHistory(cookie, '?von=2026-06-01&bis=2026-06-01');
		assert.equal(res.status, 200);
		const body = (await res.json()) as { tag: string }[];
		assert.equal(body.length, 1);
		assert.equal(body[0].tag, '2026-06-01');
	});

	it('AK1: liefert genau einen Eintrag je Kalendertag, aufsteigend sortiert', async () => {
		const cookie = await server.register('history-range@example.com', 'password123');
		await createPillar(cookie, `Säule-${idCounter++}`);

		const res = await getHistory(cookie, '?von=2026-06-01&bis=2026-06-04');
		assert.equal(res.status, 200);
		const body = (await res.json()) as { tag: string }[];
		assert.deepEqual(
			body.map((tag) => tag.tag),
			['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'],
		);
	});

	it('AK2/AK3: eine Erledigung an Tag 1 hebt Füllstand ab Tag 1, Tag 2 (keine Erledigung) spiegelt Tag 1, Tag 4 spiegelt Tag 3', async () => {
		const cookie = await server.register('history-carry@example.com', 'password123');
		const saeule = await createPillar(cookie, `Säule-${idCounter++}`);
		await completeTaskAt(
			cookie,
			'Tag 1',
			1,
			[{ pillarId: saeule.id, share: 100 }],
			new Date('2026-06-01T10:00:00.000Z'),
		);
		await completeTaskAt(
			cookie,
			'Tag 3',
			1,
			[{ pillarId: saeule.id, share: 100 }],
			new Date('2026-06-03T10:00:00.000Z'),
		);

		const res = await getHistory(cookie, '?von=2026-06-01&bis=2026-06-04&tz=UTC');
		assert.equal(res.status, 200);
		const body = (await res.json()) as {
			tag: string;
			fuellstandProzent: number;
			hatPunkte: boolean;
			saeulen: { id: number; punkte: number }[];
		}[];
		assert.equal(body.length, 4);
		assert.equal(body[0].hatPunkte, true, 'Tag 1 muss die Erledigung sehen');
		assert.deepEqual(body[1].saeulen, body[0].saeulen, 'Tag 2 ohne Erledigung muss Tag 1 spiegeln');
		assert.equal(body[1].fuellstandProzent, body[0].fuellstandProzent);
		assert.deepEqual(body[3].saeulen, body[2].saeulen, 'Tag 4 ohne Erledigung muss Tag 3 spiegeln');
		const koerperTag1 = body[0].saeulen.find((s) => s.id === saeule.id);
		const koerperTag3 = body[2].saeulen.find((s) => s.id === saeule.id);
		assert.ok(
			koerperTag1 && koerperTag3 && koerperTag3.punkte > koerperTag1.punkte,
			'Tag 3 muss mehr Punkte tragen als Tag 1 (kumuliert)',
		);
	});

	it('AK4: letzter Eintrag bei bis = heute stimmt exakt mit GET /scores/balance überein', async () => {
		const cookie = await server.register('history-parity@example.com', 'password123');
		const saeule = await createPillar(cookie, `Säule-${idCounter++}`);
		await completeTaskAt(cookie, 'Für Paritätstest', 1, [{ pillarId: saeule.id, share: 100 }], new Date());

		const heute = new Date().toISOString().slice(0, 10);
		const historyRes = await getHistory(cookie, `?von=${tagPlus(heute, -1)}&bis=${heute}`);
		assert.equal(historyRes.status, 200);
		const history = (await historyRes.json()) as {
			fuellstandProzent: number;
			hatPunkte: boolean;
			saeulen: { id: number; name: string; punkte: number; gewichtung: number }[];
		}[];
		const letzterEintrag = history[history.length - 1];

		const balanceRes = await getBalance(cookie);
		assert.equal(balanceRes.status, 200);
		const balance = (await balanceRes.json()) as {
			fuellstandProzent: number;
			hatPunkte: boolean;
			saeulen: { id: number; name: string; punkte: number; gewichtung: number }[];
		};

		assert.equal(letzterEintrag.fuellstandProzent, balance.fuellstandProzent);
		assert.equal(letzterEintrag.hatPunkte, balance.hatPunkte);
		assert.deepEqual(letzterEintrag.saeulen, balance.saeulen);
	});

	it('AK5: unbekannte tz fällt ohne Fehler auf die Serverzeitzone zurück', async () => {
		const cookie = await server.register('history-tz-fallback@example.com', 'password123');
		await createPillar(cookie, `Säule-${idCounter++}`);

		const res = await getHistory(cookie, '?von=2026-06-01&bis=2026-06-01&tz=Nicht/Existent');
		assert.equal(res.status, 200, 'ein unbekannter tz-Wert darf keinen Fehler auslösen');
	});

	it('AK5: tz verschiebt die Tagesgrenze einer späten Erledigung', async () => {
		const cookie = await server.register('history-tz-shift@example.com', 'password123');
		const saeule = await createPillar(cookie, `Säule-${idCounter++}`);
		// 23:30 UTC am 1. Juni ist in Europe/Berlin (UTC+2 im Juni) bereits der 2. Juni.
		await completeTaskAt(
			cookie,
			'Grenzfall',
			1,
			[{ pillarId: saeule.id, share: 100 }],
			new Date('2026-06-01T23:30:00.000Z'),
		);

		const berlin = await getHistory(cookie, '?von=2026-06-01&bis=2026-06-02&tz=Europe/Berlin');
		const berlinBody = (await berlin.json()) as { hatPunkte: boolean }[];
		assert.equal(berlinBody[0].hatPunkte, false, 'Europe/Berlin darf die Erledigung erst am 2. Juni sehen');
		assert.equal(berlinBody[1].hatPunkte, true);

		const utc = await getHistory(cookie, '?von=2026-06-01&bis=2026-06-02&tz=UTC');
		const utcBody = (await utc.json()) as { hatPunkte: boolean }[];
		assert.equal(utcBody[0].hatPunkte, true, 'UTC muss die Erledigung bereits am 1. Juni sehen');
	});

	it('AK6: ein Token liefert ausschließlich Daten seines Besitzers', async () => {
		const cookieA = await server.register('history-owner-a@example.com', 'password123');
		const cookieB = await server.register('history-owner-b@example.com', 'password123');
		const saeuleA = await createPillar(cookieA, `Säule-A-${idCounter++}`);
		await createPillar(cookieB, `Säule-B-${idCounter++}`);

		const vorher = await getHistory(cookieA, '?von=2026-06-01&bis=2026-06-01');
		const vorherBody = (await vorher.json()) as { hatPunkte: boolean }[];
		assert.equal(vorherBody[0].hatPunkte, false);

		await completeTaskAt(cookieB, 'Fremde Erledigung', 1, [], new Date('2026-06-01T10:00:00.000Z'));

		const nachher = await getHistory(cookieA, '?von=2026-06-01&bis=2026-06-01');
		const nachherBody = (await nachher.json()) as { hatPunkte: boolean }[];
		assert.equal(nachherBody[0].hatPunkte, false, 'die Erledigung von B darf den Verlauf von A nicht verändern');
		assert.notEqual(saeuleA.id, undefined);
	});

	it('AK7: ungültige Datumsangaben liefern 400 mit message', async () => {
		const cookie = await server.register('history-invalid@example.com', 'password123');

		const faelle: { query: string; grund: string }[] = [
			{ query: '?bis=2026-06-01', grund: 'von fehlt' },
			{ query: '?von=2026-06-01', grund: 'bis fehlt' },
			{ query: '?von=01.06.2026&bis=2026-06-01', grund: 'von ist kein YYYY-MM-DD' },
			{ query: '?von=2026-02-30&bis=2026-03-01', grund: 'von ist kein existierendes Datum' },
			{ query: '?von=2026-06-05&bis=2026-06-01', grund: 'bis < von' },
			{ query: '?von=2025-01-01&bis=2026-06-01', grund: 'Zeitraum > 366 Tage' },
		];

		for (const fall of faelle) {
			const res = await getHistory(cookie, fall.query);
			assert.equal(res.status, 400, `Fall "${fall.grund}" muss 400 liefern`);
			const body = (await res.json()) as { message?: string };
			assert.ok(body.message, `Fall "${fall.grund}" muss eine message enthalten`);
		}
	});
});
