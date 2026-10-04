import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Category, Pillar, Task, TaskPillar, User } from '../../models/index.js';
import { CATEGORY_COLORS } from '../../models/categoryColors.js';
import { closeDb, expectError, resetDb, startTestServer, type TestServer } from '../../test/helpers.js';

// Rote Spec-Tests für #1969 (Spec `docs/spec/issue-1969.md`): Zwei-Schritt-Import (Preview + Apply)
// für Todoist- und Allgemein-CSV. Die Endpunkte existieren noch nicht — erster roter Zustand ist
// die 404 der noch nicht gemounteten Route; der Parser selbst wird in `logics/csv.test.ts` geprüft.
// Row = 1-basierte Datenzeile (erste Zeile nach dem Header = 1).

after(closeDb);

const TODOIST_CSV = [
	'TYPE,CONTENT,PRIORITY,DATE',
	'task,Steuererklärung,4,2026-11-02',
	'task,"Wocheneinkauf, auch Drogerie",2,2026-10-10',
	'note,Kurze Notiz ohne Import,1,',
].join('\r\n');

// 3 valide (Zeilen 1, 3, 5) + 2 defekte (Zeilen 2: leerer Titel, 4: ungültige Priorität).
const MIXED_CSV = [
	'TYPE,CONTENT,PRIORITY,DATE',
	'task,Gültig A,2,2026-11-01',
	'task,,2,2026-11-01',
	'task,Gültig B,3,2026-12-24',
	'task,Gültig C,7,2026-11-01',
	'task,Gültig D,1,2026-11-05',
].join('\r\n');

const userIdOf = async (email: string): Promise<number> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, `Nutzer ${email} muss nach test-login existieren`);
	return user.id;
};

describe('POST /tasks/import (Preview + Übernahme, Spec #1969)', () => {
	let server: TestServer;

	beforeEach(async () => {
		await resetDb();
		if (!server) {
			server = await startTestServer();
		}
	});

	after(async () => {
		if (server) await server.close();
	});

	const postImport = (cookie: string, path: string, body: unknown): Promise<Response> =>
		server.json(path, { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify(body) });

	const taskCount = async (): Promise<number> => Task.count();

	// AK2: Preview legt nichts an und liefert Gesamtzahl, valide Anzahl, Non-Task-Zähler,
	// max. 5 Beispiele und die Fehlerliste.
	it('AK2: Preview ändert die Task-Anzahl nicht und meldet total/valid/skippedNonTask/samples', async () => {
		const cookie = await server.login('preview@example.com');

		const res = await postImport(cookie, '/tasks/import/preview', { csv: TODOIST_CSV });
		assert.equal(res.status, 200, `Preview muss 200 liefern, erhalten ${res.status}`);
		const body = (await res.json()) as {
			total: number;
			valid: number;
			skippedNonTask: number;
			samples: Array<{ row: number; title: string; deadline: string | null; priority: number | null }>;
			errors: Array<{ row: number; reason: string }>;
		};
		assert.equal(body.total, 3, 'total zählt alle Datenzeilen');
		assert.equal(body.valid, 2, 'valid zählt nur task-Zeilen');
		assert.equal(body.skippedNonTask, 1, 'note-Zeile wird gezählt (AK1)');
		assert.ok(Array.isArray(body.samples) && body.samples.length === 2, 'Beispiele je valider Zeile');
		assert.equal(body.samples[0]?.title, 'Steuererklärung');
		assert.equal(body.samples[0]?.priority, 5, 'Todoist-Priorität 4 → intern 5 (AK1)');
		assert.equal(body.samples[0]?.deadline, '2026-11-02T00:00:00.000Z');
		assert.deepEqual(body.errors, [], 'valide Fixtur hat keine Fehler');
		assert.equal(await taskCount(), 0, 'Preview darf keine Aufgaben anlegen');
	});

	// AK1: Todoist-CSV erzeugt Aufgaben mit Titel, geparster Frist und gemappter Priorität;
	// Nicht-Task-Zeilen werden nicht angelegt.
	it('AK1: Todoist-CSV legt Aufgaben mit gemappter Priorität und Frist an, note-Zeilen nicht', async () => {
		const cookie = await server.login('todoist@example.com');
		const uid = await userIdOf('todoist@example.com');

		const res = await postImport(cookie, '/tasks/import', { csv: TODOIST_CSV });
		assert.equal(res.status, 200, `Import muss 200 liefern, erhalten ${res.status}`);
		const body = (await res.json()) as { created: number; skippedNonTask: number };
		assert.equal(body.created, 2);
		assert.equal(body.skippedNonTask, 1);

		const tasks = await Task.findAll({ where: { userId: uid } });
		assert.equal(tasks.length, 2, 'genau die zwei task-Zeilen anlegen');
		const steuer = tasks.find((task) => task.title === 'Steuererklärung');
		assert.ok(steuer, 'Titel aus CONTENT übernehmen');
		assert.equal(steuer.priority, 5, 'Todoist 4 (höchste) → intern 5');
		assert.equal(steuer.deadline?.toISOString(), '2026-11-02T00:00:00.000Z', 'DATE als UTC-Mitternacht');
		const einkauf = tasks.find((task) => task.title === 'Wocheneinkauf, auch Drogerie');
		assert.ok(einkauf, 'Komma im quoted field darf Titel nicht zerlegen');
		assert.equal(einkauf.priority, 3, 'Todoist 2 → intern 3');
		assert.equal(einkauf.deadline?.toISOString(), '2026-10-10T00:00:00.000Z');
	});

	// AK3: Unlesbare Zeilen werden einzeln gemeldet, alle übrigen importiert; 0 valide → 400.
	it('AK3: defekte Zeilen scheitern einzeln mit Nummer+Grund, 0 valide Zeilen → 400', async () => {
		const cookie = await server.login('mixed@example.com');

		const res = await postImport(cookie, '/tasks/import', { csv: MIXED_CSV });
		assert.equal(res.status, 200);
		const body = (await res.json()) as { created: number; errors: Array<{ row: number; reason: string }> };
		assert.equal(body.created, 3, 'alle validen Zeilen trotz Defekten importieren');
		assert.equal(body.errors.length, 2, 'je defekter Zeile ein Eintrag');
		assert.deepEqual(
			body.errors.map((error) => error.row).sort((a, b) => a - b),
			[2, 4],
			'Zeilennummern der defekten Datenzeilen',
		);
		for (const error of body.errors) {
			assert.ok(typeof error.reason === 'string' && error.reason.length > 0, 'Grund muss verständlich sein');
		}
		assert.equal(await taskCount(), 3);

		// 0 valide Zeilen: nichts anlegen, 400 mit message.
		const onlyBroken = 'TYPE,CONTENT,PRIORITY,DATE\r\ntask,Nur kaputt,9,31.12.2026';
		await expectError(await postImport(cookie, '/tasks/import', { csv: onlyBroken }), 400);
		assert.equal(await taskCount(), 3, 'die 400-Antwort darf nichts anlegen');
	});

	// AK4: Spalten-Mapping je Zielfeld; Kategorie/Säule per Name case-insensitive, share 100,
	// unbekannte Werte ohne Zuordnung + Vorschau-Hinweis.
	it('AK4: Mapping matcht Kategorie/Säule case-insensitive, unbekannt bleibt ohne Zuordnung', async () => {
		const cookie = await server.login('mapping@example.com');
		const uid = await userIdOf('mapping@example.com');
		const category = await Category.create({ name: 'Hausbau', color: CATEGORY_COLORS[0], userId: uid });
		const pillar = await Pillar.create({ name: 'Mobilität', description: 'Umbau', weight: 100, userId: uid });

		const csv = [
			'Titel,Frist,Prioritaet,Kategorie,Saeule',
			'Kartons packen,2026-12-01,3,hausbau,MOBILITÄT',
			'Werkzeug leihen,,2,Fremdkategorie,',
		].join('\r\n');
		const body = {
			csv,
			mapping: { title: 'Titel', deadline: 'Frist', priority: 'Prioritaet', category: 'Kategorie', pillar: 'Saeule' },
		};

		const preview = await postImport(cookie, '/tasks/import/preview', body);
		assert.equal(preview.status, 200);
		const previewBody = (await preview.json()) as {
			valid: number;
			unmapped: Array<{ row: number; field: string; value: string }>;
		};
		assert.equal(previewBody.valid, 2);
		assert.deepEqual(previewBody.unmapped, [{ row: 2, field: 'category', value: 'Fremdkategorie' }]);

		const res = await postImport(cookie, '/tasks/import', body);
		assert.equal(res.status, 200);
		const tasks = await Task.findAll({ where: { userId: uid } });
		assert.equal(tasks.length, 2);
		const kartons = tasks.find((task) => task.title === 'Kartons packen');
		assert.ok(kartons, 'Titel über Mapping-Spalte übernehmen');
		assert.equal(kartons.categoryId, category.id, 'Kategorie case-insensitive gematcht');
		assert.equal(kartons.priority, 3, 'Priorität aus Allgemein-CSV direkt 1-5 übernommen (AK1)');
		const assignments = await TaskPillar.findAll({ where: { taskId: kartons.id } });
		assert.equal(assignments.length, 1, 'genau eine Säulen-Zuordnung');
		assert.equal(assignments[0]?.pillarId, pillar.id);
		assert.equal(assignments[0]?.share, 100);
		const werkzeug = tasks.find((task) => task.title === 'Werkzeug leihen');
		assert.ok(werkzeug);
		assert.equal(werkzeug.categoryId ?? null, null, 'unbekannte Kategorie ohne Zuordnung');
		assert.equal((await TaskPillar.findAll({ where: { taskId: werkzeug.id } })).length, 0);
	});

	// AK5: Grenzen (5000 Zeilen, 10 MB) → 400 mit message; Isolation je Nutzer.
	it('AK5: mehr als 5000 Zeilen oder >10 MB → 400 mit message; Aufgaben gehören dem Importeur', async () => {
		const cookieA = await server.login('owner@example.com');
		await server.login('other@example.com');
		const uidA = await userIdOf('owner@example.com');
		const uidB = await userIdOf('other@example.com');

		const tooManyRows = `TYPE,CONTENT,PRIORITY,DATE\n${Array.from(
			{ length: 5001 },
			(_, index) => `task,Task ${index},3,2026-11-01`,
		).join('\n')}`;
		await expectError(await postImport(cookieA, '/tasks/import', { csv: tooManyRows }), 400);
		await expectError(await postImport(cookieA, '/tasks/import/preview', { csv: tooManyRows }), 400);
		const tooBig = `TYPE,CONTENT,PRIORITY,DATE\ntask,${'x'.repeat(10 * 1024 * 1024 + 1)},3,`;
		await expectError(await postImport(cookieA, '/tasks/import', { csv: tooBig }), 400);
		assert.equal(await taskCount(), 0, 'Grenzprüfung vor jedem Schreibzugriff');

		const res = await postImport(cookieA, '/tasks/import', { csv: TODOIST_CSV });
		assert.equal(res.status, 200);
		const owned = await Task.findAll({ where: { userId: uidA } });
		assert.equal(owned.length, 2);
		assert.equal(await Task.count({ where: { userId: uidB } }), 0, 'zweiter Nutzer sieht nichts');
	});
});
