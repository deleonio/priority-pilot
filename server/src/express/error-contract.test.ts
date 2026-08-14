/**
 * Fehler-Response-Vertrag (Issue #117)
 * ------------------------------------
 * Für **alle** Backend-Requests und -Responses — insbesondere die Fehlerfälle — muss das
 * Backend dem Frontend eine **anzeigbare** Rückmeldung liefern: Status-Code **und** ein Body
 * der Form `{ message: string }` mit nicht-leerer Meldung.
 *
 * Diese Suite sichert genau diese Lücke ab: Die bestehenden Tests prüfen überwiegend nur
 * `res.status`; hier wird zusätzlich für jeden Fehler-Branch der **Body-Vertrag** geprüft
 * (siehe `expectError`). Ergänzt werden die bislang in Tests nicht ausgelösten 500er-Branche
 * von `/forest` und `/next`.
 */
import { describe, it, beforeEach, after } from 'node:test';
import { Task, Pillar } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import { expectError } from './test-helpers.js';
import { MissingApiKeyError, MistralRequestError, type PillarClassifier } from '../llm/llm.js';

/** Legt die fünf gleichgewichteten Standard-Säulen an. */
const seedPillars = async (): Promise<Pillar[]> => {
	const names = ['Körper', 'Beziehungen', 'Sinn', 'Mentale Gesundheit', 'Wirksamkeit'];
	await Pillar.bulkCreate(names.map((name) => ({ name, weight: 20 })));
	return Pillar.findAll({ order: [['id', 'ASC']] });
};

// ── Tasks / Pillars: Fehler-Body-Vertrag pro sendError-Branch ───────────────────────────────

describe('Fehler-Response-Vertrag: tasks & pillars', () => {
	let server: TestServer;

	const get = (path: string) => fetch(`${server.baseUrl}${path}`);
	const post = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	const patch = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	const put = (path: string, body: unknown) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	const del = (path: string) => fetch(`${server.baseUrl}${path}`, { method: 'DELETE' });

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
		// DB-Verbindung NICHT hier schließen: die zweite Suite (suggest-pillars) teilt sich
		// dieselbe Sequelize-Instanz und braucht sie noch in ihrem beforeEach (resetDb → sync).
		// Geschlossen wird erst am Ende der letzten Suite.
	});

	// AK 1: eine beliebige Fehler-Anfrage liefert 400 + anzeigbare message.
	it('POST /tasks ohne title → 400 mit nicht-leerer message', async () => {
		await expectError(await post('/tasks', { priority: 3, estimatedEffort: 1 }), 400);
	});

	// AK 2/3: Body-Vertrag je sendError-Branch (400/404) der Tasks-Routen.
	it('POST /tasks ungültige priority → 400 mit message', async () => {
		await expectError(await post('/tasks', { title: 'T', priority: 9, estimatedEffort: 1 }), 400);
	});

	it('POST /tasks ungültige pillars-Summe → 400 mit message', async () => {
		const [a, b] = await seedPillars();
		await expectError(
			await post('/tasks', {
				title: 'T',
				priority: 1,
				estimatedEffort: 1,
				pillars: [
					{ pillarId: a.id, share: 30 },
					{ pillarId: b.id, share: 30 },
				],
			}),
			400,
		);
	});

	it('POST /tasks pillars verweist auf unbekannte Säule → 400 mit message', async () => {
		await expectError(
			await post('/tasks', { title: 'T', priority: 1, estimatedEffort: 1, pillars: [{ pillarId: 99999, share: 100 }] }),
			400,
		);
	});

	it('GET /tasks/:id unbekannt → 404 mit message', async () => {
		await expectError(await get('/tasks/99999'), 404);
	});

	it('PATCH /tasks/:id unbekannt → 404 mit message', async () => {
		await expectError(await patch('/tasks/99999', { title: 'X' }), 404);
	});

	it('PATCH /tasks/:id ungültiger status → 400 mit message', async () => {
		const task = await Task.create({ title: 'T', priority: 1, estimatedEffort: 1 });
		await expectError(await patch(`/tasks/${task.id}`, { status: 'BadStatus' }), 400);
	});

	it('DELETE /tasks/:id unbekannt → 404 mit message', async () => {
		await expectError(await del('/tasks/99999'), 404);
	});

	// AK 2: Dependency-Branches (400/404).
	it('POST /tasks/:id/dependencies ohne dependingTaskId → 400 mit message', async () => {
		const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
		await expectError(await post(`/tasks/${a.id}/dependencies`, {}), 400);
	});

	it('POST /tasks/:id/dependencies dependent unbekannt → 404 mit message', async () => {
		const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
		await expectError(await post('/tasks/99999/dependencies', { dependingTaskId: b.id }), 404);
	});

	it('POST /tasks/:id/dependencies depending unbekannt → 404 mit message', async () => {
		const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
		await expectError(await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: 99999 }), 404);
	});

	// AK 4: Zyklus → 409 mit anzeigbarer message.
	it('POST /tasks/:id/dependencies Zyklus → 409 mit message', async () => {
		const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
		await post(`/tasks/${b.id}/dependencies`, { dependingTaskId: a.id });
		await expectError(await post(`/tasks/${a.id}/dependencies`, { dependingTaskId: b.id }), 409);
	});

	it('DELETE /tasks/:id/dependencies/:depId unbekannte Kante → 404 mit message', async () => {
		const a = await Task.create({ title: 'A', priority: 1, estimatedEffort: 1 });
		const b = await Task.create({ title: 'B', priority: 1, estimatedEffort: 1 });
		await expectError(await del(`/tasks/${a.id}/dependencies/${b.id}`), 404);
	});

	// AK 2: Pillars-Routen.
	it('PUT /pillars/weights Summe ≠ 100 → 400 mit message', async () => {
		const pillars = await seedPillars();
		await expectError(await put('/pillars/weights', { weights: pillars.map((p) => ({ id: p.id, weight: 10 })) }), 400);
	});

	it('PUT /pillars/weights unbekannte Säulen-id → 400 mit message', async () => {
		const pillars = await seedPillars();
		const weights = pillars.map((p) => ({ id: p.id, weight: 20 }));
		weights[0] = { id: 99999, weight: 20 };
		await expectError(await put('/pillars/weights', { weights }), 400);
	});

	it('PUT /pillars/weights Body ohne weights-Liste → 400 mit message', async () => {
		await seedPillars();
		// Ein Top-Level-Array passiert den strikten express.json()-Parser (ein primitives
		// `null` würde dort dagegen als SyntaxError abgewiesen und nie die Route erreichen).
		// In der Route fehlt damit `weights` → 400 mit anzeigbarer message.
		await expectError(await put('/pillars/weights', []), 400);
	});

	// AK 5: interner Fehler in /forest bzw. /next → 500 mit Body-Vertrag.
	// buildTaskForest und findNextImportantTask lesen über Task.findAll; ein erzwungener
	// Lesefehler löst den catch-/500-Branch in index.ts aus (kein Produktivcode nötig).
	it('GET /forest bei internem Fehler → 500 mit message', async () => {
		const original = Task.findAll;
		Task.findAll = (async () => {
			throw new Error('DB kaputt');
		}) as typeof Task.findAll;
		try {
			await expectError(await get('/forest'), 500);
		} finally {
			Task.findAll = original;
		}
	});

	it('GET /next bei internem Fehler → 500 mit message', async () => {
		const original = Task.findAll;
		Task.findAll = (async () => {
			throw new Error('DB kaputt');
		}) as typeof Task.findAll;
		try {
			await expectError(await get('/next'), 500);
		} finally {
			Task.findAll = original;
		}
	});
});

// ── suggest-pillars: 400/502/503/500 mit Body-Vertrag (AK 6) ────────────────────────────────

describe('Fehler-Response-Vertrag: POST /tasks/suggest-pillars', () => {
	let server: TestServer;
	let classifierImpl: PillarClassifier;
	const classifier: PillarClassifier = (input) => classifierImpl(input);

	const post = (body: unknown) =>
		fetch(`${server.baseUrl}/tasks/suggest-pillars`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

	beforeEach(async () => {
		await resetDb();
		classifierImpl = async () => [];
		if (!server) {
			server = await startTestServer({ pillarClassifier: classifier });
		}
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		// Letzte Suite: jetzt die geteilte Sequelize-Verbindung schließen.
		await closeDb();
	});

	it('400 wenn title fehlt → message', async () => {
		await seedPillars();
		await expectError(await post({}), 400);
	});

	it('503 wenn keine Säulen konfiguriert sind → message', async () => {
		await expectError(await post({ title: 'Irgendwas' }), 503);
	});

	it('503 bei fehlendem API-Key (MissingApiKeyError) → message', async () => {
		await seedPillars();
		classifierImpl = async () => {
			throw new MissingApiKeyError();
		};
		await expectError(await post({ title: 'X' }), 503);
	});

	it('502 bei Upstream-/Format-Fehler (MistralRequestError) → message', async () => {
		await seedPillars();
		classifierImpl = async () => {
			throw new MistralRequestError('kaputt');
		};
		await expectError(await post({ title: 'X' }), 502);
	});

	it('500 bei unerwartetem Fehler im Klassifikator → message', async () => {
		await seedPillars();
		classifierImpl = async () => {
			throw new Error('boom');
		};
		await expectError(await post({ title: 'X' }), 500);
	});
});
