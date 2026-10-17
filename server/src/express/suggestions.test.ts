import { describe, it, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { UEBERLAST_MINDEST_ERLEDIGUNGEN } from '../logics/careDeficit.js';
import { Pillar, ScoreEntry, Task, TaskPillar, User } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #122 — Endpoint der „Was ist jetzt dran?"-Vorschlagsliste.
 *
 * Vertrag: `GET /suggestions` liefert die nach Score sortierte, post-gefilterte Liste der nächsten
 * Tasks (vgl. `findSuggestedTasks` in `logics/find.ts`). Jeder Eintrag ist ein vollständig
 * serialisierter Task (`serializeTask`). Der bestehende `GET /next` (Top-1) bleibt unberührt.
 * Die Implementierung (Route + `openapi.yml`) folgt durch die Umsetzung.
 */
describe('GET /suggestions — Vorschlagsliste (#122)', () => {
	let server: TestServer;

	beforeEach(async () => {
		await resetDb();
		if (!server) {
			server = await startTestServer();
		}
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const get = (path: string) => fetch(`${server.baseUrl}${path}`);

	it('200 mit leerer Liste, wenn keine Tasks existieren', async () => {
		const res = await get('/suggestions');
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), []);
	});

	it('liefert eine nach Score sortierte Liste (höchste Priorität zuerst)', async () => {
		const niedrig = await Task.create({ title: 'Niedrig', priority: 2, estimatedEffort: 1 });
		const hoch = await Task.create({ title: 'Hoch', priority: 5, estimatedEffort: 1 });

		const res = await get('/suggestions');
		assert.equal(res.status, 200);
		const body = (await res.json()) as Array<{ id: number }>;
		assert.ok(Array.isArray(body));
		assert.equal(body.length, 2);
		assert.equal(body[0].id, hoch.id, 'höchste Priorität zuerst');
		assert.equal(body[1].id, niedrig.id);
	});

	it('Listenelemente tragen die Task-Pflichtfelder (serializeTask)', async () => {
		await Task.create({ title: 'Feldtest', priority: 3, estimatedEffort: 0.5 });
		const res = await get('/suggestions');
		const body = (await res.json()) as Array<Record<string, unknown>>;
		assert.ok(body.length >= 1);
		for (const field of ['id', 'title', 'status', 'priority', 'estimatedEffort', 'deadline', 'pillars']) {
			assert.ok(field in body[0], `Fehlendes Feld: ${field}`);
		}
	});

	it('blockierte Tasks (offene Abhängigkeit) sind nicht enthalten', async () => {
		const blocker = await Task.create({ title: 'Blocker', priority: 1, estimatedEffort: 1 });
		const blockiert = await Task.create({ title: 'Blockiert', priority: 5, estimatedEffort: 1 });
		await blockiert.addDependency(blocker);

		const res = await get('/suggestions');
		const body = (await res.json()) as Array<{ id: number }>;
		const ids = body.map((t) => t.id);
		assert.ok(!ids.includes(blockiert.id), 'blockierter Task fehlt in der Vorschlagsliste');
		assert.ok(ids.includes(blocker.id), 'freier Blocker ist enthalten');
	});

	it('#2043 AK1: GET /next liefert dieselbe Aufgabe wie Rang 1 von GET /suggestions', async () => {
		await Task.create({ title: 'Teuer', priority: 3, estimatedEffort: 1 });
		const billig = await Task.create({ title: 'Billig', priority: 3, estimatedEffort: 0.1 });

		const suggestions = (await (await get('/suggestions')).json()) as Array<{ id: number }>;
		const next = (await (await get('/next')).json()) as { id: number };
		assert.equal(suggestions[0].id, billig.id);
		assert.equal(next.id, suggestions[0].id);
	});

	type Breakdown = {
		total: number;
		priority?: number;
		unlock?: number;
		balance?: number;
		deadline?: number;
		effort?: number;
	};
	const FAKTOREN = ['priority', 'unlock', 'balance', 'deadline', 'effort'] as const;
	const summe = (b: Breakdown) => FAKTOREN.reduce((acc, key) => acc + (b[key] ?? 0), 0);

	it('#2044 AK1/AK3: GET /next trägt scoreBreakdown, Summe der Beiträge = total', async () => {
		await Task.create({ title: 'Eins', priority: 4, estimatedEffort: 0.5, deadline: new Date() });
		const next = (await (await get('/next')).json()) as { scoreBreakdown: Breakdown };
		assert.ok(next.scoreBreakdown, 'scoreBreakdown fehlt');
		assert.ok(Math.abs(summe(next.scoreBreakdown) - next.scoreBreakdown.total) < 1e-9);
	});

	it('#2044 AK2/AK3: jeder /suggestions-Eintrag trägt scoreBreakdown, absteigend nach total; /next = Rang 1', async () => {
		await Task.create({ title: 'A', priority: 2, estimatedEffort: 1 });
		await Task.create({ title: 'B', priority: 5, estimatedEffort: 0.2, deadline: new Date() });
		await Task.create({ title: 'C', priority: 3, estimatedEffort: 0.5 });

		const list = (await (await get('/suggestions')).json()) as Array<{ id: number; scoreBreakdown: Breakdown }>;
		assert.equal(list.length, 3);
		for (const [i, eintrag] of list.entries()) {
			assert.ok(eintrag.scoreBreakdown, 'scoreBreakdown fehlt');
			assert.ok(Math.abs(summe(eintrag.scoreBreakdown) - eintrag.scoreBreakdown.total) < 1e-9);
			if (i > 0) {
				assert.ok(list[i - 1].scoreBreakdown.total >= eintrag.scoreBreakdown.total, 'nicht absteigend');
			}
		}
		const next = (await (await get('/next')).json()) as { id: number; scoreBreakdown: Breakdown };
		assert.equal(next.id, list[0].id);
		assert.equal(next.scoreBreakdown.total, list[0].scoreBreakdown.total);
	});

	it('#2044 AK4: Faktor mit Beitrag 0 fehlt, Faktoren mit Beitrag ≠ 0 sind vorhanden', async () => {
		// Priorität 1 ⇒ 0, Aufwand 1 ⇒ 0, keine Deadline/Nachfolger/Säulen ⇒ alle Beiträge 0.
		await Task.create({ title: 'Null', priority: 1, estimatedEffort: 1 });
		const [leer] = (await (await get('/suggestions')).json()) as Array<{ scoreBreakdown: Breakdown }>;
		assert.ok(leer.scoreBreakdown, 'scoreBreakdown fehlt');
		assert.deepEqual(Object.keys(leer.scoreBreakdown), ['total']);
		assert.equal(leer.scoreBreakdown.total, 0);

		await resetDb();
		const blocker = await Task.create({ title: 'Blocker', priority: 5, estimatedEffort: 0.5, deadline: new Date() });
		const folge = await Task.create({ title: 'Folge', priority: 1, estimatedEffort: 1 });
		await folge.addDependency(blocker);
		const [voll] = (await (await get('/suggestions')).json()) as Array<{ id: number; scoreBreakdown: Breakdown }>;
		assert.equal(voll.id, blocker.id);
		for (const key of ['priority', 'unlock', 'deadline', 'effort'] as const) {
			assert.ok((voll.scoreBreakdown[key] ?? 0) > 0, `${key} fehlt`);
		}
		assert.ok(!('balance' in voll.scoreBreakdown), 'balance (keine Säulen) muss fehlen');
	});

	/**
	 * Rote Spec-Tests für #1985 (TF1 — docs/spec/issue-1985.md): `GET /next` trägt neben dem
	 * unveränderten `scoreBreakdown` (#2044) ein additives Feld `reasons` mit strukturierten
	 * Begründungswerten je Faktor mit Beitrag > 0. Der alte Vertrag bleibt unberührt; dessen
	 * Summen-/Schlüssel-Prüfungen stehen bereits in den #2044-Tests derselben Datei (Dedup —
	 * hier bewusst nicht dupliziert).
	 */
	describe('GET /next — strukturierte Begründungswerte (#1985)', () => {
		const inTagen = (tage: number): Date => new Date(Date.now() + tage * 24 * 60 * 60 * 1000);

		it('#1985 AK1: reasons je Faktor mit Anteil > 0 (balance, unlock, deadline, priority)', async () => {
			const koerper = await Pillar.create({ name: 'Körper', weight: 20 });
			const frist = inTagen(2);
			const basis = await Task.create({ title: 'Basis', priority: 3, estimatedEffort: 1, deadline: frist });
			await basis.addPillar(koerper);
			// Test-Pflege #2527: `reasons.balance` gibt es erst ab der Überlast-Mindestmenge — die
			// Erledigungen laufen auf einer zweiten Säule, damit Körper defizitär bleibt.
			const wirksamkeit = await Pillar.create({ name: 'Wirksamkeit', weight: 20 });
			for (let i = 0; i < UEBERLAST_MINDEST_ERLEDIGUNGEN; i++) {
				const erledigt = await Task.create({ title: `Erledigt ${i}`, status: 'Done', priority: 3, estimatedEffort: 1 });
				await erledigt.addPillar(wirksamkeit);
				await ScoreEntry.create({ taskId: erledigt.id, punkte: 2, pünktlich: true, zeitpunkt: new Date() });
			}
			for (const titel of ['Nachfolger 1', 'Nachfolger 2']) {
				const nachfolger = await Task.create({ title: titel, priority: 1, estimatedEffort: 1 });
				await nachfolger.addDependency(basis);
			}

			const next = (await (await get('/next')).json()) as {
				id: number;
				reasons?: {
					balance?: { pillars: string[] };
					unlock?: { openCount: number };
					deadline?: { date: string; daysUntil: number };
					priority?: { priority: number };
				};
			};
			assert.equal(next.id, basis.id);
			assert.ok(next.reasons, 'reasons fehlt vollständig');
			assert.deepEqual(next.reasons.balance, { pillars: ['Körper'] }, 'Defizit-Säule fehlt');
			assert.deepEqual(next.reasons.unlock, { openCount: 2 }, 'Anzahl offener Nachfolger falsch');
			assert.deepEqual(next.reasons.priority, { priority: 3 }, 'Prioritätswert falsch');
			assert.ok(next.reasons.deadline, 'deadline-reasons fehlen');
			// Mitternachts-Rundung kann über Tagesgrenze hinweg 1 statt 2 liefern — beides korrekt.
			assert.ok([1, 2].includes(next.reasons.deadline?.daysUntil ?? -1), 'Tagesdifferenz falsch');
			assert.equal(next.reasons.deadline?.date, frist.toISOString().slice(0, 10));
		});

		it('#1985 AK1: Task ohne Anteile → kein reasons, scoreBreakdown-Vertrag unverändert', async () => {
			await Task.create({ title: 'Ohne Anteile', priority: 1, estimatedEffort: 1 });

			const next = (await (await get('/next')).json()) as {
				reasons?: unknown;
				scoreBreakdown: Record<string, number>;
			};
			assert.equal(next.reasons, undefined, 'ohne Anteile darf reasons nicht existieren');
			assert.deepEqual(Object.keys(next.scoreBreakdown), ['total'], 'Beitrag 0 ⇒ Schlüssel fehlt (#2044)');
		});
	});

	/**
	 * Rote Spec-Tests für #2523 (docs/spec/issue-2523.md): `reasons.balance.pillars` folgt der
	 * App-Sprache (`User.sprache`), nicht dem `Accept-Language`-Header. Task-Setup per Modell-Insert
	 * (Muster #1985), bewusst unter der UserId des Testnutzers — der Distribution-Regel-Weg über
	 * POST /tasks ist für Säulen-Beiträge auf einer einzigen Säule nicht nutzbar.
	 */
	describe('GET /next — Säulennamen in App-Sprache (#2523)', () => {
		const registriereMitSprache = async (email: string, sprache: string | null): Promise<string> => {
			const cookie = await server.register(email, 'password123');
			if (sprache !== null) {
				const res = await server.json('/care-config/sprache', {
					method: 'PUT',
					headers: { Cookie: cookie },
					body: JSON.stringify({ sprache }),
				});
				assert.equal(res.status, 200, 'Setup: App-Sprache muss über PUT /care-config/sprache setzbar sein');
			}
			return cookie;
		};

		/** Legt per Modell-Insert eine offene Aufgabe des Nutzers an, die zur Körper-Säule beiträgt. */
		const taskAufKoerper = async (cookie: string): Promise<void> => {
			const userId = ((await (await server.json('/auth/me', { headers: { Cookie: cookie } })).json()) as { id: number })
				.id;
			const pillars = (await (await server.json('/pillars', { headers: { Cookie: cookie } })).json()) as {
				id: number;
				name: string;
			}[];
			const koerper = pillars.find((p) => p.name === 'Körper');
			assert.ok(koerper, 'Setup: Körper-Säule muss gesät sein');
			const task = await Task.create({ title: 'Laufen', priority: 3, estimatedEffort: 1, userId });
			await TaskPillar.create({ taskId: task.id, pillarId: koerper.id, share: 100, confidence: 100 });
		};

		/** #2527: Mindestmenge an Erledigungen, verteilt auf Nicht-Körper-Säulen (keine Überlast). */
		const erledigungenNichtKoerper = async (cookie: string): Promise<void> => {
			const userId = ((await (await server.json('/auth/me', { headers: { Cookie: cookie } })).json()) as { id: number })
				.id;
			const pillars = (await (await server.json('/pillars', { headers: { Cookie: cookie } })).json()) as {
				id: number;
				name: string;
			}[];
			const andere = pillars.filter((pillar) => pillar.name !== 'Körper').slice(0, UEBERLAST_MINDEST_ERLEDIGUNGEN);
			assert.equal(andere.length, UEBERLAST_MINDEST_ERLEDIGUNGEN, 'Setup: genug Nicht-Körper-Säulen');
			for (const pillar of andere) {
				const task = await Task.create({ title: 'Erledigt', status: 'Done', priority: 3, estimatedEffort: 1, userId });
				await TaskPillar.create({ taskId: task.id, pillarId: pillar.id, share: 100, confidence: 100 });
				await ScoreEntry.create({ taskId: task.id, punkte: 2, pünktlich: true, zeitpunkt: new Date() });
			}
		};

		it('AK2: User.sprache=en — reasons.balance.pillars englisch, ohne Header', async () => {
			const cookie = await registriereMitSprache('sugg-2523-en@example.com', 'en');
			await taskAufKoerper(cookie);
			await erledigungenNichtKoerper(cookie); // Test-Pflege #2527: balance erst ab der Mindestmenge

			const res = await fetch(`${server.baseUrl}/next`, { headers: { Cookie: cookie } });
			assert.equal(res.status, 200);
			const next = (await res.json()) as { reasons?: { balance?: { pillars?: string[] } } };
			assert.deepEqual(next.reasons?.balance?.pillars, ['Body'], 'Defizit-Säule muss englisch heißen');
		});

		it('Randbedingung: App-Sprache de + Accept-Language: en — reasons.balance.pillars bleibt deutsch', async () => {
			const cookie = await registriereMitSprache('sugg-2523-de@example.com', null);
			await taskAufKoerper(cookie);
			await erledigungenNichtKoerper(cookie); // Test-Pflege #2527: balance erst ab der Mindestmenge

			const res = await fetch(`${server.baseUrl}/next`, {
				headers: { Cookie: cookie, 'Accept-Language': 'en' },
			});
			assert.equal(res.status, 200);
			const next = (await res.json()) as { reasons?: { balance?: { pillars?: string[] } } };
			assert.deepEqual(next.reasons?.balance?.pillars, ['Körper'], 'App-Sprache gewinnt gegen den Header');
		});
	});

	/**
	 * Rote Spec-Tests für #2527 (docs/spec/issue-2527.md): Unter der Überlast-Mindestmenge liefert
	 * `GET /next` kein `reasons.balance`, sondern das Einstieg-Signal `einstieg: true`; das
	 * Dashboard rendert dafür den Einstiegssatz (TF3). Ab der Mindestmenge bleibt alles wie bisher.
	 */
	describe('GET /next — Einstieg unter der Mindestmenge (#2527)', () => {
		const userIdVon = async (cookie: string): Promise<number> =>
			((await (await server.json('/auth/me', { headers: { Cookie: cookie } })).json()) as { id: number }).id;

		const pillarsVon = async (cookie: string): Promise<{ id: number; name: string }[]> =>
			(await (await server.json('/pillars', { headers: { Cookie: cookie } })).json()) as {
				id: number;
				name: string;
			}[];

		/** Offene Aufgabe mit Säulen-Beitrag (Modell-Insert, Muster #2523). */
		const offeneAufgabe = async (userId: number, pillarId: number): Promise<void> => {
			const task = await Task.create({ title: 'Nächste Aufgabe', priority: 3, estimatedEffort: 1, userId });
			await TaskPillar.create({ taskId: task.id, pillarId, share: 100, confidence: 100 });
		};

		/** Erledigte Aufgabe im jüngeren Fenster (Done + ScoreEntry-Zeitpunkt jetzt, Modell-Insert). */
		const erledigteAufgabe = async (userId: number, pillarId: number): Promise<void> => {
			const task = await Task.create({ title: 'Erledigt', status: 'Done', priority: 3, estimatedEffort: 1, userId });
			await TaskPillar.create({ taskId: task.id, pillarId, share: 100, confidence: 100 });
			await ScoreEntry.create({ taskId: task.id, punkte: 2, pünktlich: true, zeitpunkt: new Date() });
		};

		it('AK1: 0 Erledigungen im jüngeren Fenster → kein reasons.balance, Einstieg-Signal gesetzt', async () => {
			const cookie = await server.register('sugg-2527-fresh@example.com', 'password123');
			const userId = await userIdVon(cookie);
			const koerper = (await pillarsVon(cookie)).find((pillar) => pillar.name === 'Körper');
			assert.ok(koerper, 'Setup: Körper-Säule muss gesät sein');
			await offeneAufgabe(userId, koerper.id);

			const res = await fetch(`${server.baseUrl}/next`, { headers: { Cookie: cookie } });
			assert.equal(res.status, 200);
			const next = (await res.json()) as { reasons?: { balance?: unknown; einstieg?: boolean } };
			assert.ok(next.reasons, 'reasons muss existieren (Einstieg-Signal)');
			assert.equal(next.reasons.balance, undefined, 'unter der Mindestmenge kein reasons.balance');
			assert.equal(next.reasons.einstieg, true, 'Einstieg-Signal gesetzt (Spec: TaskReasons.einstieg = true)');
		});

		it('AK2: ab UEBERLAST_MINDEST_ERLEDIGUNGEN Erledigungen → reasons.balance wie bisher, kein Einstieg-Signal', async () => {
			const cookie = await server.register('sugg-2527-drei@example.com', 'password123');
			const userId = await userIdVon(cookie);
			const pillars = await pillarsVon(cookie);
			const koerper = pillars.find((pillar) => pillar.name === 'Körper');
			assert.ok(koerper, 'Setup: Körper-Säule muss gesät sein');
			await offeneAufgabe(userId, koerper.id);
			// Mindestmenge auf Nicht-Körper-Säulen verteilt (je 100 % auf die eigene Säule → keine Überlast).
			const andere = pillars.filter((pillar) => pillar.name !== 'Körper').slice(0, UEBERLAST_MINDEST_ERLEDIGUNGEN);
			assert.equal(andere.length, UEBERLAST_MINDEST_ERLEDIGUNGEN, 'Setup: genug Nicht-Körper-Säulen');
			for (const pillar of andere) {
				await erledigteAufgabe(userId, pillar.id);
			}

			const res = await fetch(`${server.baseUrl}/next`, { headers: { Cookie: cookie } });
			assert.equal(res.status, 200);
			const next = (await res.json()) as { reasons?: { balance?: { pillars: string[] }; einstieg?: boolean } };
			assert.deepEqual(next.reasons?.balance, { pillars: ['Körper'] }, 'Defizit-Säule wie bisher');
			assert.equal(next.reasons?.einstieg, undefined, 'ab der Mindestmenge kein Einstieg-Signal');
		});
	});

	/**
	 * Rote Spec-Tests für #2624 (docs/spec/issue-2624.md): `GET /next` mit leerem Ergebnis
	 * (`200` + `null`) löst KEINE Nutzer-Auflösung mehr aus — die Route kehrt zurück, bevor
	 * `resolveGeoUser` (User-Abfrage) läuft. Relativer Vergleich gegen eine Kontroll-Anfrage
	 * (`/suggestions`), weil die Auth-Middleware selbst User-Abfragen machen könnte. Beide
	 * Fetches schicken bewusst keinen Cookie: die Suite läuft ohne `applyTestAuthEnv`, Auth ist
	 * inaktiv — ohne Cookie greift in `resolveGeoUser` der Dev-Fallback (`User.findOne`), dessen
	 * Abfrage der Früh-Return im Leerfall einspart. Gezählt werden die `resolveGeoUser`-Lese-Pfade
	 * `User.findByPk` und `User.findOne` (mock.method, Muster error-contract.test.ts).
	 */
	describe('GET /next — keine Nutzer-Abfrage im Leerfall (#2624 AK2)', () => {
		it('200 + null mit gleich vielen Nutzer-Abfragen wie eine Kontroll-Anfrage', async () => {
			await server.register('sugg-2624-leer@example.com', 'password123');

			const zaehleUserAbfragen = async (path: string): Promise<{ status: number; body: unknown; anzahl: number }> => {
				const findByPk = mock.method(User, 'findByPk', async () => null);
				const findOne = mock.method(User, 'findOne', async () => null);
				try {
					const res = await fetch(`${server.baseUrl}${path}`);
					return {
						status: res.status,
						body: await res.json(),
						anzahl: findByPk.mock.callCount() + findOne.mock.callCount(),
					};
				} finally {
					findByPk.mock.restore();
					findOne.mock.restore();
				}
			};

			const kontrolle = await zaehleUserAbfragen('/suggestions');
			const next = await zaehleUserAbfragen('/next');
			assert.equal(kontrolle.status, 200);
			assert.equal(next.status, 200);
			assert.equal(next.body, null, 'leeres /next liefert null');
			assert.equal(
				next.anzahl,
				kontrolle.anzahl,
				`ohne Früh-Return löst /next im Leerfall eine Nutzer-Auflösung aus: /next=${next.anzahl}, Kontrolle=${kontrolle.anzahl}`,
			);
		});
	});
});
