import { describe, it, beforeEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Category, Dependency, Task } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

// Vertrag: docs/spec/issue-1993.md (AK1–AK6). Datenquelle `TEMPLATES` ist neu → fehlendes Modul = roter Zustand.
process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
applyTestAuthEnv('templates-test');

type Step = { id: string; title: string; after: string[] };
type Template = { slug: string; title: string; steps: Step[] };

let server: TestServer;
let template: Template;

// Neues Modul: Pfad bewusst dynamisch, damit der Spec-Stand (Modul fehlt noch) knip/tsc nicht bricht.
const SERVER_TEMPLATES = '../logics/templates.js';
const loadServerTemplates = () => import(SERVER_TEMPLATES) as Promise<{ TEMPLATES: Template[] }>;

const edgeCount = (t: Template) => t.steps.reduce((sum, step) => sum + step.after.length, 0);

describe('Vorlagen-API (#1993)', () => {
	beforeEach(async () => {
		await resetDb();
		if (!server) {
			server = await startTestServer();
		}
		const { TEMPLATES } = await loadServerTemplates();
		template = TEMPLATES.find((entry) => entry.slug === 'hausbau') as Template;
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const get = (path: string, cookie?: string) =>
		fetch(`${server.baseUrl}${path}`, { headers: { ...(cookie ? { cookie } : {}) } });
	const apply = (slug: string, cookie?: string) =>
		fetch(`${server.baseUrl}/templates/${slug}/apply`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
			body: '{}',
		});

	describe('AK1 Vorschau', () => {
		it('liefert Zählwerte und Struktur von hausbau', async () => {
			const cookie = await server.login('alice@example.com');
			const res = await get('/templates/hausbau/preview', cookie);
			assert.equal(res.status, 200);
			const body = (await res.json()) as { slug: string; taskCount: number; dependencyCount: number; steps: Step[] };
			assert.equal(body.slug, 'hausbau');
			assert.equal(body.taskCount, 9);
			assert.equal(body.dependencyCount, edgeCount(template));
			assert.deepEqual(body.steps, template.steps);
			assert.equal(await Task.count(), 0, 'Vorschau schreibt nichts');
		});

		it('404 bei unbekanntem Slug, 401 ohne Login', async () => {
			const cookie = await server.login('alice@example.com');
			assert.equal((await get('/templates/gibt-es-nicht/preview', cookie)).status, 404);
			assert.equal((await get('/templates/hausbau/preview')).status, 401);
		});
	});

	describe('AK2 Übernahme', () => {
		it('legt Aufgaben, Kanten und Kategorie des Nutzers an und liefert die Task-IDs', async () => {
			const cookie = await server.login('alice@example.com');
			const res = await apply('hausbau', cookie);
			assert.ok(res.status >= 200 && res.status < 300, `Status ${res.status}`);
			assert.match(JSON.stringify(await res.json()), /\d/, 'Antwort nennt neue Task-IDs');

			const tasks = await Task.findAll({ where: { userId: 1 } });
			assert.deepEqual(tasks.map((t) => t.title).sort(), template.steps.map((s) => s.title).sort());

			const category = await Category.findOne({ where: { name: 'Hausbau', userId: 1 } });
			assert.ok(category, 'Kategorie mit Vorlagentitel');
			assert.ok(tasks.every((t) => t.categoryId === category.id));

			const idByStep = new Map(template.steps.map((s) => [s.id, tasks.find((t) => t.title === s.title)?.id]));
			const expected = template.steps
				.flatMap((s) => s.after.map((pre) => `${idByStep.get(s.id)}<-${idByStep.get(pre)}`))
				.sort();
			const actual = (await Dependency.findAll())
				.map((d) => `${d.get('dependentTaskId')}<-${d.get('dependingTaskId')}`)
				.sort();
			assert.deepEqual(actual, expected);
		});

		it('401 ohne Login, 404 bei unbekanntem Slug', async () => {
			const cookie = await server.login('alice@example.com');
			assert.equal((await apply('hausbau')).status, 401);
			assert.equal((await apply('gibt-es-nicht', cookie)).status, 404);
		});
	});

	describe('AK3 erneutes Übernehmen', () => {
		it('erzeugt eine zweite vollständige Kopie, Kategorie bleibt einmalig', async () => {
			const cookie = await server.login('alice@example.com');
			assert.equal((await apply('hausbau', cookie)).status < 300, true);
			assert.equal((await apply('hausbau', cookie)).status < 300, true);
			assert.equal(await Task.count({ where: { userId: 1 } }), template.steps.length * 2);
			assert.equal(await Dependency.count(), edgeCount(template) * 2);
			assert.equal(await Category.count({ where: { name: 'Hausbau', userId: 1 } }), 1);
		});
	});

	describe('AK4 Rollback', () => {
		it('hinterlässt bei einem Fehler mitten in der Übernahme nichts', async () => {
			const cookie = await server.login('alice@example.com');
			const boom = () => Promise.reject(new Error('injizierter Fehler'));
			mock.method(Dependency, 'bulkCreate', boom);
			mock.method(Dependency, 'create', boom);
			mock.method(Task.prototype, 'addDependency', boom);
			mock.method(Task.prototype, 'addDependencies', boom);
			try {
				const res = await apply('hausbau', cookie);
				assert.ok(res.status >= 400, `Status ${res.status}`);
			} finally {
				mock.restoreAll();
			}
			assert.equal(await Task.count(), 0);
			assert.equal(await Dependency.count(), 0);
			assert.equal(await Category.count(), 0);
		});
	});

	describe('AK5 Datenisolation', () => {
		it('übernommene Aufgaben sind für andere Nutzer unsichtbar', async () => {
			const alice = await server.login('alice@example.com');
			const bob = await server.login('bob@example.com');
			assert.equal((await apply('hausbau', alice)).status < 300, true);
			const res = await get('/tasks', bob);
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), []);
		});
	});

	describe('AK6 Datenquelle nur einmal', () => {
		it('die Website nutzt dieselbe TEMPLATES-Instanz wie der Server', async () => {
			const serverSide = await loadServerTemplates();
			const websiteUrl = new URL('../../../website/src/templates.ts', import.meta.url).href;
			const websiteSide = (await import(websiteUrl)) as { TEMPLATES: unknown };
			assert.equal(websiteSide.TEMPLATES, serverSide.TEMPLATES);
		});
	});
});
