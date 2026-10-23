import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { CARE_SPRACHEN, CARE_VORLAGEN } from '../logics/careSuggestionData.js';
import { UEBERLAST_MINDEST_ERLEDIGUNGEN } from '../logics/careDeficit.js';
import { SHARE_MIN, SHARE_TOTAL } from '../logics/pillarShares.js';
import { Pillar, TaskPillar } from '../models/index.js';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1791 (Spec docs/spec/issue-1791.md) — `GET /scores/care-suggestions`
 * und `POST /scores/care-suggestions/dismissals`.
 *
 * AK1: offene Aufgabe der Defizit-Säule zuerst in der Antwort (TF1).
 * AK2: ohne passende offene Aufgabe kuratierte Vorlage der Säule — Free-Standardkonto (TF2).
 * AK3: Vorlagen-Payload per POST /tasks anlegbar, Task trägt den Säulen-Beitrag (TF3).
 * AK4 (API-Variante): frisch abgelehnte Vorlage wird unterdrückt; die 13/15-Tage-Grenzen
 *   deckt die Unit in `logics/careSuggestions.test.ts` ab.
 * Sprach-Param: `sprache=en` liefert den en-Text aus CARE_VORLAGEN (Spiegel), Default de.
 *
 * Rot, bis Endpunkt und Stammdaten existieren (heute: 404/SPA-Fallback). KEIN Produktivcode.
 */

applyTestAuthEnv('test-secret-issue-1791-care-suggestions');

let server: TestServer;

const getCare = (cookie: string, query = '', extraHeaders: Record<string, string> = {}): Promise<Response> =>
	server.json(`/scores/care-suggestions${query}`, { headers: { ...extraHeaders, Cookie: cookie } });

interface Vorschlag {
	typ: 'task' | 'vorlage';
	saeuleId: number;
	saeuleName: string;
	titel: string;
	beschreibung: string | null;
	saeulenBeitraege: { pillarId: number; share: number }[];
	taskId?: number;
	templateKey?: string;
	anlass?: 'defizit' | 'ueberlast' | 'ermutigung' | 'einstieg';
}

const leseVorschlaege = async (
	cookie: string,
	query = '',
	extraHeaders: Record<string, string> = {},
): Promise<Vorschlag[]> => {
	const res = await getCare(cookie, query, extraHeaders);
	assert.equal(res.status, 200, 'Vorschlags-Endpunkt muss 200 liefern');
	return ((await res.json()) as { vorschlaege: Vorschlag[] }).vorschlaege;
};

/** Erste gesäte Säule des Nutzers (Registrierung sät fünf Standard-Säulen, ids 1–5). */
const ersteSaeule = async (cookie: string): Promise<number> => {
	const res = await server.json('/pillars', { headers: { Cookie: cookie } });
	assert.equal(res.status, 200, 'Setup: Säulen müssen über die API lesbar sein');
	const pillars = (await res.json()) as { id: number }[];
	assert.ok(pillars.length >= 5, 'Setup: Registrierung sollte fünf Standard-Säulen säen');
	return pillars[0]!.id;
};

/** Legt eine offene Aufgabe mit Säulen-Beitrag an (Setup, Legacy-Insert außerhalb der Schreib-Regel #2077). */
const createOpenTask = async (cookie: string, titel: string, pillarId: number): Promise<number> => {
	const res = await server.json('/tasks', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ title: titel, priority: 3, estimatedEffort: 0.5 }),
	});
	assert.equal(res.status, 201, 'Setup: Task-Anlage muss 201 liefern');
	const { id } = (await res.json()) as { id: number };
	await TaskPillar.create({ taskId: id, pillarId, share: 100, confidence: 100 });
	return id;
};

describe('GET /scores/care-suggestions (#1791)', () => {
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
		assert.equal((await getCare('cookie=none')).status, 401);
	});

	it('AK1: offene Aufgabe der Defizit-Säule erscheint zuerst (typ task, taskId)', async () => {
		const cookie = await server.register('care-task-first@example.com', 'password123');
		await erledigeVerteilt(cookie, UEBERLAST_MINDEST_ERLEDIGUNGEN); // Test-Pflege #2527
		const saeuleId = await ersteSaeule(cookie);
		const taskId = await createOpenTask(cookie, 'Spaziergang im Park', saeuleId);

		const saeulenVorschlaege = (await leseVorschlaege(cookie)).filter((v) => v.saeuleId === saeuleId);
		assert.ok(saeulenVorschlaege.length > 0, 'Defizit-Säule muss Vorschläge liefern');
		assert.equal(saeulenVorschlaege[0]?.typ, 'task', 'eigene offene Aufgabe zuerst');
		assert.equal(saeulenVorschlaege[0]?.taskId, taskId);
	});

	it('AK2: ohne offene Aufgabe kuratierte Vorlage der Säule — Free-Konto, Sprach-Param spiegelt CARE_VORLAGEN', async () => {
		const cookie = await server.register('care-free-template@example.com', 'password123');
		await erledigeVerteilt(cookie, UEBERLAST_MINDEST_ERLEDIGUNGEN); // Test-Pflege #2527
		const saeuleId = await ersteSaeule(cookie);

		const deVorschlaege = (await leseVorschlaege(cookie)).filter((v) => v.saeuleId === saeuleId && v.typ === 'vorlage');
		assert.ok(deVorschlaege.length > 0, 'Free-Konto muss Vorlagen der Defizit-Säule erhalten');
		const getroffen = deVorschlaege[0]!;
		assert.ok(getroffen.templateKey, 'Vorlage braucht stabilen templateKey');
		const katalog = CARE_VORLAGEN.find((vorlage) => vorlage.key === getroffen.templateKey);
		assert.ok(katalog, 'templateKey muss in CARE_VORLAGEN existieren');
		assert.equal(getroffen.titel, katalog.texte.de.titel, 'Default-Sprache ist de');

		const enVorschlaege = (await leseVorschlaege(cookie, '?sprache=en')).filter(
			(v) => v.templateKey === getroffen.templateKey,
		);
		assert.equal(enVorschlaege[0]?.titel, katalog.texte.en.titel, 'sprache=en muss den en-Text liefern');
	});

	it('AK3: Vorlagen-Payload per POST /tasks anlegbar, Task trägt den Säulen-Beitrag', async () => {
		const cookie = await server.register('care-adopt@example.com', 'password123');
		await erledigeVerteilt(cookie, UEBERLAST_MINDEST_ERLEDIGUNGEN); // Test-Pflege #2527
		const saeuleId = await ersteSaeule(cookie);
		const vorlage = (await leseVorschlaege(cookie)).find((v) => v.saeuleId === saeuleId && v.typ === 'vorlage');
		assert.ok(vorlage, 'Setup: Säule braucht eine Vorlage');

		const createRes = await server.json('/tasks', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify({ title: vorlage.titel, pillars: vorlage.saeulenBeitraege }),
		});
		assert.equal(createRes.status, 201, 'Vorlage muss per POST /tasks anlegbar sein');
		const created = (await createRes.json()) as { id: number };

		const detailRes = await server.json(`/tasks/${created.id}`, { headers: { Cookie: cookie } });
		assert.equal(detailRes.status, 200);
		const task = (await detailRes.json()) as { pillars: { pillarId: number; share: number }[] };
		// #2075 AK3: der angelegte Task trägt exakt die gelieferte Verteilung (fünf gültige Beiträge).
		const geliefert = [...vorlage.saeulenBeitraege].sort((a, b) => a.pillarId - b.pillarId);
		const angelegt = task.pillars
			.map((p) => ({ pillarId: p.pillarId, share: p.share }))
			.sort((a, b) => a.pillarId - b.pillarId);
		assert.deepEqual(angelegt, geliefert, 'angelegter Task muss die Vorschlags-Verteilung exakt übernehmen');
	});

	it('AK4 (API): frisch abgelehnte Vorlage wird unterdrückt', async () => {
		const cookie = await server.register('care-dismiss@example.com', 'password123');
		await erledigeVerteilt(cookie, UEBERLAST_MINDEST_ERLEDIGUNGEN); // Test-Pflege #2527
		const saeuleId = await ersteSaeule(cookie);
		const vorlage = (await leseVorschlaege(cookie)).find((v) => v.saeuleId === saeuleId && v.typ === 'vorlage');
		assert.ok(vorlage?.templateKey, 'Setup: Säule braucht eine Vorlage mit templateKey');

		const dismissRes = await server.json('/scores/care-suggestions/dismissals', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify({ templateKey: vorlage.templateKey }),
		});
		assert.equal(dismissRes.status, 204, 'Ablehnung muss 204 liefern');

		const danach = (await leseVorschlaege(cookie)).filter(
			(v) => v.saeuleId === saeuleId && v.templateKey === vorlage.templateKey,
		);
		assert.equal(danach.length, 0, 'abgelehnte Vorlage darf nicht erneut erscheinen');
	});

	/** Setup: erledigte Aufgabe(n) mit Aufwand in einer Säule (ScoreEntry-Zeitpunkt = jetzt, Legacy-Insert #2077). */
	const erledigeAufgabe = async (cookie: string, pillarId: number, anzahl = 1): Promise<void> => {
		for (let i = 0; i < anzahl; i++) {
			const createRes = await server.json('/tasks', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: JSON.stringify({ title: 'Überlast', priority: 3, estimatedEffort: 1 }),
			});
			assert.equal(createRes.status, 201, 'Setup: Task-Anlage muss 201 liefern');
			const { id } = (await createRes.json()) as { id: number };
			await TaskPillar.create({ taskId: id, pillarId, share: 100, confidence: 100 });
			const doneRes = await server.json(`/tasks/${id}`, {
				method: 'PATCH',
				headers: { Cookie: cookie },
				body: JSON.stringify({ status: 'Done' }),
			});
			assert.equal(doneRes.status, 200, 'Setup: Statuswechsel auf Done muss 200 liefern');
		}
	};

	/** Setup: Mindestmenge Erledigungen, verteilt auf verschiedene Säulen (je 100 % auf die eigene
	 *  Säule → keine Überlast; Säule 0 bleibt frei — #2527-Test-Pflege und #2527-Tests). */
	const erledigeVerteilt = async (cookie: string, anzahl: number): Promise<void> => {
		const res = await server.json('/pillars', { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'Setup: Säulen müssen über die API lesbar sein');
		const pillars = (await res.json()) as { id: number }[];
		assert.ok(pillars.length >= anzahl + 1, 'Setup: genug Säulen für die Verteilung');
		for (let i = 0; i < anzahl; i++) {
			const createRes = await server.json('/tasks', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: JSON.stringify({ title: 'Erledigt verteilt', priority: 3, estimatedEffort: 1 }),
			});
			assert.equal(createRes.status, 201, 'Setup: Task-Anlage muss 201 liefern');
			const { id } = (await createRes.json()) as { id: number };
			await TaskPillar.create({ taskId: id, pillarId: pillars[i + 1]!.id, share: 100, confidence: 100 });
			const doneRes = await server.json(`/tasks/${id}`, {
				method: 'PATCH',
				headers: { Cookie: cookie },
				body: JSON.stringify({ status: 'Done' }),
			});
			assert.equal(doneRes.status, 200, 'Setup: Statuswechsel auf Done muss 200 liefern');
		}
	};

	const WIRKSAMKEIT = 4;
	const ERHOLUNGS_SAEULEN = [1, 2];

	it('#1795 AK1: bei Überlast ist der erste Vorschlag ein Erholungsvorschlag, keine Aufgabe der überwiegenden Säule', async () => {
		const cookie = await server.register('care-overload@example.com', 'password123');
		await createOpenTask(cookie, 'Steuererklärung', WIRKSAMKEIT);
		// #2521: Mindestmenge — erst ab 3 Erledigungen im jüngeren Fenster gilt eine Säule als überlastet.
		await erledigeAufgabe(cookie, WIRKSAMKEIT, 3);

		const vorschlaege = await leseVorschlaege(cookie);
		const erster = vorschlaege[0]!;
		assert.equal(erster.anlass, 'ueberlast', 'erster Eintrag muss der Überlast-Anlass sein');
		assert.ok(
			ERHOLUNGS_SAEULEN.includes(erster.saeuleId) || erster.templateKey === 'pause-1',
			'Erholung kommt aus Körper, Mentale Gesundheit oder der Pause-Vorlage',
		);
		assert.ok(
			!(erster.typ === 'task' && erster.saeuleId === WIRKSAMKEIT),
			'keine Aufgabe der überwiegenden Säule an Position 0',
		);
		assert.equal(erster.typ, 'vorlage', 'Erholungsvorschläge sind kuratierte Vorlagen');
	});

	it('#1795 AK2: Pause-Vorlage wird mit ?sprache=en in Zielsprache geliefert', async () => {
		const cookie = await server.register('care-overload-en@example.com', 'password123');
		// #2521: Mindestmenge — erst ab 3 Erledigungen im jüngeren Fenster gilt eine Säule als überlastet.
		await erledigeAufgabe(cookie, WIRKSAMKEIT, 3);

		const katalog = CARE_VORLAGEN.find((vorlage) => vorlage.key === 'pause-1');
		assert.ok(katalog, 'Pause-Vorlage pause-1 muss in CARE_VORLAGEN existieren');
		const erholung = (await leseVorschlaege(cookie, '?sprache=en')).filter((v) => v.anlass === 'ueberlast');
		assert.ok(erholung.length > 0, 'Überlast liefert Erholungsvorschläge');
		for (const vorschlag of erholung) {
			const vorlage = CARE_VORLAGEN.find((v) => v.key === vorschlag.templateKey);
			assert.equal(vorschlag.titel, vorlage?.texte.en.titel, 'Titel in Zielsprache en');
		}
	});

	it('#1795 AK3: ohne Überlast tragen alle Vorschläge anlass defizit', async () => {
		const cookie = await server.register('care-no-overload@example.com', 'password123');
		await erledigeVerteilt(cookie, UEBERLAST_MINDEST_ERLEDIGUNGEN); // Test-Pflege #2527: sonst käme jetzt der Einstieg-Eintrag
		const saeuleId = await ersteSaeule(cookie);
		await createOpenTask(cookie, 'Spaziergang', saeuleId);

		const vorschlaege = await leseVorschlaege(cookie);
		assert.ok(vorschlaege.length > 0);
		assert.ok(
			vorschlaege.every((v) => v.anlass === 'defizit'),
			'ohne Überlast ist jeder Anlass defizit',
		);
	});

	it('#2521 AK1/AK5: genau eine Erledigung → genau ein Ermutigungs-Eintrag vorn, kein ueberlast', async () => {
		const cookie = await server.register('care-ermutigung@example.com', 'password123');
		const saeuleId = await ersteSaeule(cookie);
		await erledigeAufgabe(cookie, saeuleId);

		const de = await leseVorschlaege(cookie);
		const ermutigung = de.filter((v) => v.anlass === 'ermutigung');
		assert.equal(ermutigung.length, 1, 'genau ein Ermutigungs-Eintrag');
		assert.equal(de[0]?.anlass, 'ermutigung', 'der Ermutigungs-Eintrag steht vorn (einziger sichtbarer)');
		assert.equal(de.filter((v) => v.anlass === 'ueberlast').length, 0, 'unter der Mindestmenge kein ueberlast-Eintrag');
		assert.equal(ermutigung[0]?.taskId, undefined, 'nichts zum Übernehmen');
		assert.equal(ermutigung[0]?.templateKey, undefined, 'nichts zum Ablehnen/Dismissal');
		const satz = (v: Vorschlag): string => `${v.titel} ${v.beschreibung ?? ''}`.trim();
		assert.notEqual(satz(ermutigung[0]!), '', 'der Eintrag trägt den Satz');

		const en = (await leseVorschlaege(cookie, '?sprache=en')).filter((v) => v.anlass === 'ermutigung');
		assert.equal(en.length, 1, 'Ermutigung auch bei sprache=en');
		assert.notEqual(satz(en[0]!), '', 'Satz auch auf en');
		assert.notEqual(satz(en[0]!), satz(ermutigung[0]!), 'de und en unterscheiden sich');
	});

	it('#2075 AK2: jeder Vorlagen-Vorschlag (Defizit und Erholung) trägt fünf Säulen-Beiträge — Ziel 50, Rest 13/13/12/12', async () => {
		const cookie = await server.register('care-2075-form@example.com', 'password123');
		// #2521: Mindestmenge — erst ab 3 Erledigungen im jüngeren Fenster gilt eine Säule als überlastet.
		await erledigeAufgabe(cookie, WIRKSAMKEIT, 3);

		const relevante = (await leseVorschlaege(cookie)).filter((v) => v.typ === 'vorlage');
		assert.ok(
			relevante.some((v) => v.anlass === 'ueberlast'),
			'Setup: Erholungspfad muss vertreten sein',
		);
		assert.ok(
			relevante.some((v) => v.anlass === 'defizit'),
			'Setup: Defizit-Pfad muss vertreten sein',
		);
		for (const vorschlag of relevante) {
			const beitraege = vorschlag.saeulenBeitraege;
			assert.equal(beitraege.length, 5, `${vorschlag.templateKey}: genau fünf Säulen-Beiträge`);
			assert.equal(
				beitraege.find((b) => b.pillarId === vorschlag.saeuleId)?.share,
				50,
				`${vorschlag.templateKey}: Ziel-Säule 50 %`,
			);
			assert.deepEqual(
				beitraege
					.filter((b) => b.pillarId !== vorschlag.saeuleId)
					.map((b) => b.share)
					.sort((a, b) => b - a),
				[13, 13, 12, 12],
				`${vorschlag.templateKey}: übrige vier gleichmäßig über 50 %`,
			);
			assert.equal(
				beitraege.reduce((acc, b) => acc + b.share, 0),
				SHARE_TOTAL,
				`${vorschlag.templateKey}: Summe exakt 100`,
			);
			assert.ok(
				beitraege.every((b) => b.share >= SHARE_MIN),
				`${vorschlag.templateKey}: jeder Anteil ≥ SHARE_MIN`,
			);
		}
	});

	// Rote Spec-Tests #2527 (docs/spec/issue-2527.md): Bei 0 Erledigungen im jüngeren Fenster
	// liefert die Care-Route genau einen Einstieg-Eintrag vorn und keine Defizit-Vorschläge;
	// ab der Mindestmenge bleibt alles wie bisher.
	describe('GET /scores/care-suggestions — Einstieg unter der Mindestmenge (#2527)', () => {
		it('AK1/AK4: 0 Erledigungen → genau ein einstieg-Eintrag vorn, kein defizit/ueberlast, Satz in de und en', async () => {
			const cookie = await server.register('care-einstieg-2527@example.com', 'password123');

			const de = await leseVorschlaege(cookie);
			const einstieg = de.filter((v) => v.anlass === 'einstieg');
			assert.equal(einstieg.length, 1, 'genau ein Einstieg-Eintrag');
			assert.equal(de[0]?.anlass, 'einstieg', 'der Einstieg-Eintrag steht vorn (einziger sichtbarer)');
			assert.equal(de.filter((v) => v.anlass === 'defizit').length, 0, 'unter der Mindestmenge keine Defizit-Einträge');
			assert.equal(
				de.filter((v) => v.anlass === 'ueberlast').length,
				0,
				'unter der Mindestmenge kein ueberlast-Eintrag',
			);
			assert.equal(einstieg[0]?.typ, 'vorlage', 'reiner Satz-Eintrag');
			assert.equal(einstieg[0]?.saeuleId, 0, 'kein Säulenbezug');
			assert.equal(einstieg[0]?.taskId, undefined, 'nichts zum Übernehmen');
			assert.equal(einstieg[0]?.templateKey, undefined, 'nichts zum Ablehnen/Dismissal');
			assert.equal(
				einstieg[0]?.titel,
				'Such dir eine kleine Aufgabe aus, die dir heute guttut – klein anfangen zählt.',
				'deutscher Einstiegssatz (AK4, Ton nach docs/fuersorge-tonalitaet.md)',
			);

			const en = (await leseVorschlaege(cookie, '?sprache=en')).filter((v) => v.anlass === 'einstieg');
			assert.equal(en.length, 1, 'Einstieg auch bei sprache=en');
			assert.equal(
				en[0]?.titel,
				'Pick one small task that does you good today – starting small counts.',
				'englischer Einstiegssatz (AK4)',
			);
			assert.notEqual(en[0]?.titel, einstieg[0]?.titel, 'de und en unterscheiden sich');
		});

		it('AK2/AK3: ab UEBERLAST_MINDEST_ERLEDIGUNGEN Erledigungen → defizit wie bisher, kein einstieg', async () => {
			const cookie = await server.register('care-defizit-2527@example.com', 'password123');
			await erledigeVerteilt(cookie, UEBERLAST_MINDEST_ERLEDIGUNGEN);

			const vorschlaege = await leseVorschlaege(cookie);
			assert.ok(
				vorschlaege.some((v) => v.anlass === 'defizit'),
				'Defizit-Vorschläge wie bisher',
			);
			assert.ok(
				vorschlaege.every((v) => v.anlass !== 'einstieg'),
				'ab der Mindestmenge kein Einstieg-Eintrag',
			);
		});
	});
});

// Rote Spec-Tests #1977 (docs/spec/issue-1977.md) — POST/GET /scores/care-suggestions/rejections.
// Rot, bis Endpunkt und Modell existieren (heute: SPA-Fallback). KEIN Produktivcode.
describe('POST/GET /scores/care-suggestions/rejections (#1977)', () => {
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

	const legeAnkerTaskAn = async (cookie: string): Promise<number> => {
		const res = await server.json('/tasks', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify({ title: 'Rejection-Anker', priority: 3, estimatedEffort: 0.5 }),
		});
		assert.equal(res.status, 201, 'Setup: Task-Anlage muss 201 liefern');
		return ((await res.json()) as { id: number }).id;
	};

	const rejeziere = (cookie: string, body: Record<string, unknown>): Promise<Response> =>
		server.json('/scores/care-suggestions/rejections', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify(body),
		});

	it('AK2: POST persistiert Grund je taskId und je templateKey (via GET abrufbar)', async () => {
		const cookie = await server.register('care-reject-1977@example.com', 'password123');
		const taskId = await legeAnkerTaskAn(cookie);

		const mitTask = await rejeziere(cookie, { grund: 'keine-energie', taskId });
		assert.equal(mitTask.status, 204, 'Rejection mit taskId muss 204 liefern');
		const mitVorlage = await rejeziere(cookie, { grund: 'zu-gross', templateKey: 'koerper-spaziergang' });
		assert.equal(mitVorlage.status, 204, 'Rejection mit templateKey muss 204 liefern');

		const historie = await server.json(`/scores/care-suggestions/rejections?taskId=${taskId}`, {
			headers: { Cookie: cookie },
		});
		assert.equal(historie.status, 200);
		const eintraege = (await historie.json()) as { grund: string; abgelehntAm: string }[];
		assert.equal(eintraege.length, 1, 'Historie je Aufgabe enthält genau den einen Eintrag');
		assert.equal(eintraege[0]?.grund, 'keine-energie');
		assert.ok(eintraege[0]?.abgelehntAm, 'Eintrag trägt abgelehntAm');

		const alle = await server.json('/scores/care-suggestions/rejections', { headers: { Cookie: cookie } });
		assert.equal(((await alle.json()) as unknown[]).length, 2, 'ohne Filter alle eigenen Einträge');
	});

	it('AK2: ungültige Payloads → 400 (ohne grund, ohne Bezug, mit unbekanntem grund)', async () => {
		const cookie = await server.register('care-reject-invalid@example.com', 'password123');
		for (const body of [{}, { taskId: 1 }, { grund: 'keine-energie' }, { grund: 'gaib', taskId: 1 }]) {
			const res = await rejeziere(cookie, body);
			assert.equal(res.status, 400, `Payload ${JSON.stringify(body)} muss 400 liefern`);
		}
	});

	it('AK4: GET liefert nur eigene Einträge — fremde taskId bleibt leer', async () => {
		const alice = await server.register('care-reject-alice@example.com', 'password123');
		const taskId = await legeAnkerTaskAn(alice);
		assert.equal((await rejeziere(alice, { grund: 'zu-gross', taskId })).status, 204);

		const bob = await server.register('care-reject-bob@example.com', 'password123');
		const fremd = await server.json(`/scores/care-suggestions/rejections?taskId=${taskId}`, {
			headers: { Cookie: bob },
		});
		assert.equal(fremd.status, 200);
		assert.equal(((await fremd.json()) as unknown[]).length, 0, 'fremde Aufgabe bleibt unsichtbar');
		const alleVonBob = await server.json('/scores/care-suggestions/rejections', { headers: { Cookie: bob } });
		assert.equal(((await alleVonBob.json()) as unknown[]).length, 0, 'ohne Filter nur eigene Einträge');
	});

	// #2495/AK3: taskId vorhanden, aber keine Ganzzahl → 400 statt stiller Filter-Ausfall
	// (heute: `Number('abc')` → NaN → Filter entfällt → alle Einträge). KEIN Produktivcode.
	it('#2495/AK3: taskId=abc → 400; leerer Parameter bleibt Bestandsverhalten (alle Einträge)', async () => {
		const cookie = await server.register('care-reject-2495@example.com', 'password123');
		const taskId = await legeAnkerTaskAn(cookie);
		assert.equal((await rejeziere(cookie, { grund: 'zu-gross', taskId })).status, 204);

		const invalid = await server.json('/scores/care-suggestions/rejections?taskId=abc', {
			headers: { Cookie: cookie },
		});
		assert.equal(invalid.status, 400, 'vorhandener, aber nicht ganzzahliger taskId muss 400 liefern');

		const leer = await server.json('/scores/care-suggestions/rejections?taskId=', {
			headers: { Cookie: cookie },
		});
		assert.equal(leer.status, 200, 'leerer taskId bleibt Bestandsverhalten');
		assert.equal(((await leer.json()) as unknown[]).length, 1, 'ohne wirksamen Filter alle eigenen Einträge');
	});

	// #2772/AK1: mehrfach gesendeter taskId (Express qs → Array) ist ein Bedienfehler (400),
	// statt den Filter still entfallen zu lassen (ungefilterte Liste). KEIN Produktivcode.
	it('#2772/AK1: taskId=1&taskId=abc → 400 statt ungefilterter Liste', async () => {
		const cookie = await server.register('care-reject-2772@example.com', 'password123');
		const taskId = await legeAnkerTaskAn(cookie);
		assert.equal((await rejeziere(cookie, { grund: 'zu-gross', taskId })).status, 204);

		const res = await server.json('/scores/care-suggestions/rejections?taskId=1&taskId=abc', {
			headers: { Cookie: cookie },
		});
		assert.equal(res.status, 400, 'mehrfach gesendeter taskId muss 400 liefern');
	});
});

// Rote Spec-Tests #2146 (docs/spec/issue-2146.md) — Vorlagen pro Nutzer über den Säulen-Key
// zuordnen, eigene Säulen bekommen einen generischen Vorschlag. Rot, bis die Zuordnung über
// `Pillar.key` läuft (heute: `vorlage.saeuleId === saeule.id`). KEIN Produktivcode.
describe('GET /scores/care-suggestions — Säulen pro Nutzer (#2146)', () => {
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

	interface SaeuleDto {
		id: number;
		name: string;
		key?: string | null;
	}

	const leseSaeulen = async (cookie: string): Promise<SaeuleDto[]> => {
		const res = await server.json('/pillars', { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'Setup: Säulen müssen lesbar sein');
		return (await res.json()) as SaeuleDto[];
	};

	/** Zweiter Nutzer ohne DB-Reset dazwischen: seine Standard-Säulen haben NICHT die ids 1–5. */
	const registriereZweitenNutzer = async (): Promise<{ cookie: string; saeulen: SaeuleDto[] }> => {
		await server.register('care-2146-first@example.com', 'password123');
		const cookie = await server.register('care-2146-second@example.com', 'password123');
		const saeulen = await leseSaeulen(cookie);
		assert.ok(
			saeulen.every((saeule) => saeule.id > 5),
			'Setup: Säulen des zweiten Nutzers haben ids > 5',
		);
		return { cookie, saeulen };
	};

	/** Eigene Säule direkt anlegen (POST /pillars ist gesperrt, #1573). */
	const legeEigeneSaeuleAn = async (cookie: string, name: string, key: string | null): Promise<number> => {
		const userId = ((await (await server.json('/auth/me', { headers: { Cookie: cookie } })).json()) as { id: number })
			.id;
		return (await Pillar.create({ name, key, userId })).id;
	};

	const offeneAufgabe = async (cookie: string, titel: string, pillarId: number): Promise<number> => {
		const res = await server.json('/tasks', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify({ title: titel, priority: 3, estimatedEffort: 0.5 }),
		});
		assert.equal(res.status, 201, 'Setup: Task-Anlage muss 201 liefern');
		const { id } = (await res.json()) as { id: number };
		await TaskPillar.create({ taskId: id, pillarId, share: 100, confidence: 100 });
		return id;
	};

	/** #2527-Test-Pflege: Mindestmenge an Erledigungen OHNE Säulen-Beitrag — sie zählen für die
	 * Mindestmenge, lassen aber jede Säule defizitär (kein Ist-Anteil im jüngeren Fenster). */
	const erledigeOhneSaeulen = async (cookie: string): Promise<void> => {
		for (let i = 0; i < UEBERLAST_MINDEST_ERLEDIGUNGEN; i++) {
			const createRes = await server.json('/tasks', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: JSON.stringify({ title: 'Erledigt ohne Säule', priority: 3, estimatedEffort: 1 }),
			});
			assert.equal(createRes.status, 201, 'Setup: Task-Anlage muss 201 liefern');
			const { id } = (await createRes.json()) as { id: number };
			const doneRes = await server.json(`/tasks/${id}`, {
				method: 'PATCH',
				headers: { Cookie: cookie },
				body: JSON.stringify({ status: 'Done' }),
			});
			assert.equal(doneRes.status, 200, 'Setup: Statuswechsel auf Done muss 200 liefern');
		}
	};

	it('AK1: zweiter Nutzer bekommt für eine defizitäre Standard-Säule eine Vorlage mit seiner saeuleId', async () => {
		const { cookie, saeulen } = await registriereZweitenNutzer();
		await erledigeOhneSaeulen(cookie); // Test-Pflege #2527: Defizit-Vorschläge erst ab der Mindestmenge
		const vorschlaege = await leseVorschlaege(cookie);
		for (const saeule of saeulen) {
			const vorlagen = vorschlaege.filter((v) => v.saeuleId === saeule.id && v.typ === 'vorlage');
			assert.ok(vorlagen.length > 0, `Säule ${saeule.name} (${saeule.id}) braucht mindestens eine Vorlage`);
		}
	});

	it('AK2: zweiter Nutzer bekommt bei Überlast Erholungsvorschläge mit den ids SEINER Säulen', async () => {
		const { cookie, saeulen } = await registriereZweitenNutzer();
		const wirksamkeit = saeulen[3]!;
		// #2521: Mindestmenge — erst ab 3 Erledigungen im jüngeren Fenster gilt eine Säule als überlastet.
		for (let i = 0; i < 3; i++) {
			const createRes = await server.json('/tasks', {
				method: 'POST',
				headers: { Cookie: cookie },
				body: JSON.stringify({ title: 'Überlast', priority: 3, estimatedEffort: 1 }),
			});
			const { id } = (await createRes.json()) as { id: number };
			await TaskPillar.create({ taskId: id, pillarId: wirksamkeit.id, share: 100, confidence: 100 });
			const doneRes = await server.json(`/tasks/${id}`, {
				method: 'PATCH',
				headers: { Cookie: cookie },
				body: JSON.stringify({ status: 'Done' }),
			});
			assert.equal(doneRes.status, 200, 'Setup: Statuswechsel auf Done muss 200 liefern');
		}

		const erholung = (await leseVorschlaege(cookie)).filter((v) => v.anlass === 'ueberlast');
		assert.ok(erholung.length > 0, 'Überlast liefert Erholungsvorschläge');
		const eigeneIds = saeulen.map((saeule) => saeule.id);
		for (const vorschlag of erholung) {
			assert.ok(eigeneIds.includes(vorschlag.saeuleId), `saeuleId ${vorschlag.saeuleId} gehört zum Nutzer`);
		}
		assert.ok(
			erholung.some((v) => v.saeuleId === saeulen[0]!.id),
			'Körper-Vorschlag mit der eigenen Körper-Säulen-id',
		);
	});

	it('AK3: eigene Säule (key null und unbekannter key) bekommt genau einen generischen Vorschlag mit Namen', async () => {
		const cookie = await server.register('care-2146-custom@example.com', 'password123');
		const garten = await legeEigeneSaeuleAn(cookie, 'Gartenarbeit', null);
		const musik = await legeEigeneSaeuleAn(cookie, 'Musikmachen', 'eigene-musik');
		await erledigeOhneSaeulen(cookie); // Test-Pflege #2527

		const vorschlaege = await leseVorschlaege(cookie);
		for (const [id, name] of [
			[garten, 'Gartenarbeit'],
			[musik, 'Musikmachen'],
		] as const) {
			const treffer = vorschlaege.filter((v) => v.saeuleId === id);
			assert.equal(treffer.length, 1, `${name}: genau ein generischer Vorschlag`);
			const vorschlag = treffer[0]!;
			assert.equal(vorschlag.typ, 'vorlage');
			assert.ok(vorschlag.templateKey, `${name}: templateKey gesetzt`);
			assert.ok(`${vorschlag.titel} ${vorschlag.beschreibung ?? ''}`.includes(name), `${name}: Säulenname im Text`);
			assert.equal(vorschlag.saeulenBeitraege.find((b) => b.pillarId === id)?.share, 50, `${name}: Ziel-Säule 50 %`);
		}
		const keys = vorschlaege.filter((v) => [garten, musik].includes(v.saeuleId)).map((v) => v.templateKey);
		assert.equal(new Set(keys).size, 2, 'templateKey unterscheidet die Säulen');
	});

	it('AK4: generischer Text kommt in allen Sprachen mit Säulenname; de und en unterscheiden sich', async () => {
		const cookie = await server.register('care-2146-lang@example.com', 'password123');
		const garten = await legeEigeneSaeuleAn(cookie, 'Gartenarbeit', null);
		await erledigeOhneSaeulen(cookie); // Test-Pflege #2527
		const texte = new Map<string, string>();
		for (const sprache of CARE_SPRACHEN) {
			const vorschlag = (await leseVorschlaege(cookie, `?sprache=${sprache}`)).find((v) => v.saeuleId === garten);
			assert.ok(vorschlag, `${sprache}: generischer Vorschlag vorhanden`);
			const text = `${vorschlag.titel} ${vorschlag.beschreibung ?? ''}`;
			assert.ok(vorschlag.titel.trim().length > 0, `${sprache}: Titel nicht leer`);
			assert.ok(text.includes('Gartenarbeit'), `${sprache}: Säulenname eingesetzt`);
			texte.set(sprache, vorschlag.titel);
		}
		assert.notEqual(texte.get('de'), texte.get('en'), 'de und en sind unterschiedlich übersetzt');
	});

	it('AK5: offene Aufgabe der eigenen Säule steht vor dem generischen Vorschlag', async () => {
		const cookie = await server.register('care-2146-task@example.com', 'password123');
		const garten = await legeEigeneSaeuleAn(cookie, 'Gartenarbeit', null);
		const taskId = await offeneAufgabe(cookie, 'Beet umgraben', garten);
		await erledigeOhneSaeulen(cookie); // Test-Pflege #2527

		const treffer = (await leseVorschlaege(cookie)).filter((v) => v.saeuleId === garten);
		assert.equal(treffer[0]?.typ, 'task');
		assert.equal(treffer[0]?.taskId, taskId);
	});

	it('AK6: Ablehnung gilt pro eigener Säule — die andere eigene Säule behält ihren Vorschlag', async () => {
		const cookie = await server.register('care-2146-dismiss@example.com', 'password123');
		const garten = await legeEigeneSaeuleAn(cookie, 'Gartenarbeit', null);
		const musik = await legeEigeneSaeuleAn(cookie, 'Musikmachen', null);
		await erledigeOhneSaeulen(cookie); // Test-Pflege #2527
		const gartenKey = (await leseVorschlaege(cookie)).find((v) => v.saeuleId === garten)?.templateKey;
		assert.ok(gartenKey, 'Setup: generischer Vorschlag mit templateKey');

		const res = await server.json('/scores/care-suggestions/dismissals', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify({ templateKey: gartenKey }),
		});
		assert.equal(res.status, 204);

		const danach = await leseVorschlaege(cookie);
		assert.equal(danach.filter((v) => v.saeuleId === garten).length, 0, 'abgelehnter Vorschlag verschwindet');
		assert.equal(danach.filter((v) => v.saeuleId === musik).length, 1, 'andere eigene Säule bleibt sichtbar');
	});

	it('AK7: generischer Vorschlag ist per POST /tasks übernehmbar und erscheint in GET /tasks', async () => {
		const cookie = await server.register('care-2146-adopt@example.com', 'password123');
		const garten = await legeEigeneSaeuleAn(cookie, 'Gartenarbeit', null);
		await erledigeOhneSaeulen(cookie); // Test-Pflege #2527
		const vorschlag = (await leseVorschlaege(cookie)).find((v) => v.saeuleId === garten);
		assert.ok(vorschlag, 'Setup: generischer Vorschlag');

		const createRes = await server.json('/tasks', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify({ title: vorschlag.titel, pillars: vorschlag.saeulenBeitraege }),
		});
		assert.equal(createRes.status, 201, 'generischer Vorschlag muss per POST /tasks anlegbar sein');
		const { id } = (await createRes.json()) as { id: number };

		const liste = await server.json('/tasks', { headers: { Cookie: cookie } });
		const tasks = (await liste.json()) as { id: number }[];
		assert.ok(
			tasks.some((task) => task.id === id),
			'übernommene Aufgabe erscheint in GET /tasks',
		);
	});

	/**
	 * Rote Spec-Tests für #2523 (docs/spec/issue-2523.md): Säulennamen der Fürsorge-Hinweise folgen
	 * der App-Sprache (`User.sprache`), nicht dem `Accept-Language`-Header.
	 */
	describe('Säulennamen in App-Sprache (#2523)', () => {
		const setzeSprache = async (cookie: string, sprache: string): Promise<void> => {
			const res = await server.json('/care-config/sprache', {
				method: 'PUT',
				headers: { Cookie: cookie },
				body: JSON.stringify({ sprache }),
			});
			assert.equal(res.status, 200, 'Setup: App-Sprache muss über PUT /care-config/sprache setzbar sein');
		};

		it('AK1: User.sprache=en — saeuleName englisch, ohne und mit deutschem Accept-Language-Header', async () => {
			const cookie = await server.register('care-2523-en@example.com', 'password123');
			const saeuleId = await ersteSaeule(cookie);
			await setzeSprache(cookie, 'en');
			await erledigeOhneSaeulen(cookie); // Test-Pflege #2527

			const ohneHeader = (await leseVorschlaege(cookie)).filter((v) => v.saeuleId === saeuleId);
			assert.ok(ohneHeader.length > 0, 'Defizit-Säule muss Vorschläge liefern');
			for (const v of ohneHeader) {
				assert.equal(v.saeuleName, 'Body', 'Seed-Name muss aus User.sprache=en englisch sein');
			}

			const mitDeHeader = (await leseVorschlaege(cookie, '', { 'Accept-Language': 'de' })).filter(
				(v) => v.saeuleId === saeuleId,
			);
			assert.ok(mitDeHeader.length > 0, 'Defizit-Säule muss auch mit Header Vorschläge liefern');
			for (const v of mitDeHeader) {
				assert.equal(v.saeuleName, 'Body', 'App-Sprache gewinnt gegen den Accept-Language-Header');
			}
		});

		it('Randbedingung: App-Sprache de + Accept-Language: en — saeuleName bleibt deutsch (Kohärenz)', async () => {
			const cookie = await server.register('care-2523-de@example.com', 'password123');
			const saeuleId = await ersteSaeule(cookie);
			await erledigeOhneSaeulen(cookie); // Test-Pflege #2527

			const vorschlaege = (await leseVorschlaege(cookie, '', { 'Accept-Language': 'en' })).filter(
				(v) => v.saeuleId === saeuleId,
			);
			assert.ok(vorschlaege.length > 0, 'Defizit-Säule muss Vorschläge liefern');
			for (const v of vorschlaege) {
				assert.equal(v.saeuleName, 'Körper', 'App-Sprache de: Name darf nicht gegen die App-Sprache übersetzt werden');
			}
		});

		it('AK3: umbenannte Säule erscheint wortgleich in saeuleName und reasons.balance.pillars', async () => {
			const cookie = await server.register('care-2523-rename@example.com', 'password123');
			const saeuleId = await ersteSaeule(cookie);
			// Umbenennen ist per API gesperrt (#1573) — Alt-Bestand modellseitig nachstellen.
			await Pillar.update({ name: 'Mein Körper' }, { where: { id: saeuleId } });
			await setzeSprache(cookie, 'en');
			await erledigeOhneSaeulen(cookie); // Test-Pflege #2527

			const vorschlaege = (await leseVorschlaege(cookie)).filter((v) => v.saeuleId === saeuleId);
			assert.ok(vorschlaege.length > 0, 'umbenannte Defizit-Säule muss Vorschläge liefern');
			for (const v of vorschlaege) {
				assert.equal(v.saeuleName, 'Mein Körper', 'umbenannte Säule bleibt wortgleich');
			}

			await createOpenTask(cookie, 'Rücken stärken', saeuleId);
			const nextRes = await server.json('/next', { headers: { Cookie: cookie } });
			assert.equal(nextRes.status, 200, 'Setup: GET /next muss 200 liefern');
			const next = (await nextRes.json()) as { reasons?: { balance?: { pillars?: string[] } } };
			assert.deepEqual(next.reasons?.balance?.pillars, ['Mein Körper'], 'Begründung trägt den Eigennamen');
		});
	});
});
