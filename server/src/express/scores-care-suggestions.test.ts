import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { CARE_VORLAGEN } from '../logics/careSuggestionData.js';
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

const getCare = (cookie: string, query = ''): Promise<Response> =>
	server.json(`/scores/care-suggestions${query}`, { headers: { Cookie: cookie } });

interface Vorschlag {
	typ: 'task' | 'vorlage';
	saeuleId: number;
	saeuleName: string;
	titel: string;
	beschreibung: string | null;
	saeulenBeitraege: { pillarId: number; share: number }[];
	taskId?: number;
	templateKey?: string;
	anlass?: 'defizit' | 'ueberlast';
}

const leseVorschlaege = async (cookie: string, query = ''): Promise<Vorschlag[]> => {
	const res = await getCare(cookie, query);
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

/** Legt eine offene Aufgabe mit Säulen-Beitrag an (Setup). */
const createOpenTask = async (cookie: string, titel: string, pillarId: number): Promise<number> => {
	const res = await server.json('/tasks', {
		method: 'POST',
		headers: { Cookie: cookie },
		body: JSON.stringify({ title: titel, priority: 3, estimatedEffort: 0.5, pillars: [{ pillarId, share: 100 }] }),
	});
	assert.equal(res.status, 201, 'Setup: Task-Anlage muss 201 liefern');
	return ((await res.json()) as { id: number }).id;
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
		const saeuleId = await ersteSaeule(cookie);
		const taskId = await createOpenTask(cookie, 'Spaziergang im Park', saeuleId);

		const saeulenVorschlaege = (await leseVorschlaege(cookie)).filter((v) => v.saeuleId === saeuleId);
		assert.ok(saeulenVorschlaege.length > 0, 'Defizit-Säule muss Vorschläge liefern');
		assert.equal(saeulenVorschlaege[0]?.typ, 'task', 'eigene offene Aufgabe zuerst');
		assert.equal(saeulenVorschlaege[0]?.taskId, taskId);
	});

	it('AK2: ohne offene Aufgabe kuratierte Vorlage der Säule — Free-Konto, Sprach-Param spiegelt CARE_VORLAGEN', async () => {
		const cookie = await server.register('care-free-template@example.com', 'password123');
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
		assert.ok(
			task.pillars.some((p) => p.pillarId === saeuleId && p.share === 100),
			'angelegter Task muss den Säulen-Beitrag der Vorlage tragen',
		);
	});

	it('AK4 (API): frisch abgelehnte Vorlage wird unterdrückt', async () => {
		const cookie = await server.register('care-dismiss@example.com', 'password123');
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

	/** Setup: erledigte Aufgabe mit Aufwand in einer Säule (ScoreEntry-Zeitpunkt = jetzt). */
	const erledigeAufgabe = async (cookie: string, pillarId: number): Promise<void> => {
		const createRes = await server.json('/tasks', {
			method: 'POST',
			headers: { Cookie: cookie },
			body: JSON.stringify({ title: 'Überlast', priority: 3, estimatedEffort: 1, pillars: [{ pillarId, share: 100 }] }),
		});
		assert.equal(createRes.status, 201, 'Setup: Task-Anlage muss 201 liefern');
		const { id } = (await createRes.json()) as { id: number };
		const doneRes = await server.json(`/tasks/${id}`, {
			method: 'PATCH',
			headers: { Cookie: cookie },
			body: JSON.stringify({ status: 'Done' }),
		});
		assert.equal(doneRes.status, 200, 'Setup: Statuswechsel auf Done muss 200 liefern');
	};

	const WIRKSAMKEIT = 4;
	const ERHOLUNGS_SAEULEN = [1, 2];

	it('#1795 AK1: bei Überlast ist der erste Vorschlag ein Erholungsvorschlag, keine Aufgabe der überwiegenden Säule', async () => {
		const cookie = await server.register('care-overload@example.com', 'password123');
		await createOpenTask(cookie, 'Steuererklärung', WIRKSAMKEIT);
		await erledigeAufgabe(cookie, WIRKSAMKEIT);

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
		await erledigeAufgabe(cookie, WIRKSAMKEIT);

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
		const saeuleId = await ersteSaeule(cookie);
		await createOpenTask(cookie, 'Spaziergang', saeuleId);

		const vorschlaege = await leseVorschlaege(cookie);
		assert.ok(vorschlaege.length > 0);
		assert.ok(
			vorschlaege.every((v) => v.anlass === 'defizit'),
			'ohne Überlast ist jeder Anlass defizit',
		);
	});
});
