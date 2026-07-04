import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * ROTER Spec-Test (#228, AK-5): Score-Rücknahme beim Wiedereröffnen (Done → Open).
 *
 * Wird ein erledigter Task über den „Wieder öffnen"-Schalter zurück auf „Offen" (`status: 'Open'`)
 * gesetzt, muss der beim Erledigen vergebene Gamification-`ScoreEntry` wieder entfernt werden — der
 * Task zählt dann nicht mehr in die Balance/Punkte. Ein erneutes Erledigen vergibt genau **einen**
 * neuen Eintrag (keine Doppelzählung, keine Altlasten).
 *
 * Diese Rücknahme-Logik existiert im PATCH-Handler noch NICHT (nur die Vergabe bei Done). Die Tests
 * sind daher rot, bis `server/src/express/routes/tasks.ts` die ScoreEntry-Entfernung bei Done→Open
 * ergänzt. Bewusst rein über HTTP formuliert (Black-Box-Vertrag, implementierungsunabhängig).
 */
describe('AK-5 — Score-Rücknahme beim Reopen (Done → Open)', () => {
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

	const createTask = async (body: Record<string, unknown>): Promise<number> => {
		const res = await post('/tasks', body);
		assert.equal(res.status, 201, 'Task-Anlage muss 201 liefern');
		const task = (await res.json()) as { id: number };
		return task.id;
	};

	const future = new Date('2026-12-31T00:00:00.000Z').toISOString();

	interface ScoreDto {
		taskId: number;
		punkte: number;
		pünktlich: boolean;
	}

	const fetchScores = async (): Promise<ScoreDto[]> => {
		const res = await get('/scores');
		assert.equal(res.status, 200);
		return (await res.json()) as ScoreDto[];
	};

	it('AK-5.1: Done → Open entfernt den ScoreEntry des Tasks (GET /scores listet keinen Eintrag mehr)', async () => {
		const id = await createTask({ title: 'Reopen', priority: 3, estimatedEffort: 1, deadline: future });

		// Erledigen → genau ein ScoreEntry für diesen Task.
		assert.equal((await patch(`/tasks/${id}`, { status: 'Done' })).status, 200);
		const nachDone = await fetchScores();
		assert.equal(nachDone.filter((entry) => entry.taskId === id).length, 1, 'nach Done genau ein Eintrag');

		// Wieder öffnen → der ScoreEntry muss verschwinden.
		assert.equal((await patch(`/tasks/${id}`, { status: 'Open' })).status, 200);
		const nachReopen = await fetchScores();
		assert.equal(
			nachReopen.filter((entry) => entry.taskId === id).length,
			0,
			'nach Reopen kein ScoreEntry mehr für diesen Task',
		);
	});

	it('AK-5.2: Summen-Check — Score-Gesamtpunkte gehen nach Reopen auf den Stand vor Done (hier 0) zurück', async () => {
		const id = await createTask({ title: 'Summe', priority: 3, estimatedEffort: 1, deadline: future });

		const summe = (scores: ScoreDto[]): number => scores.reduce((acc, entry) => acc + entry.punkte, 0);

		const vorDone = summe(await fetchScores());
		assert.equal(vorDone, 0, 'vor Done keine Punkte');

		await patch(`/tasks/${id}`, { status: 'Done' });
		assert.ok(summe(await fetchScores()) > 0, 'nach Done positive Gesamtpunkte');

		await patch(`/tasks/${id}`, { status: 'Open' });
		assert.equal(summe(await fetchScores()), vorDone, 'nach Reopen Gesamtpunkte zurück auf Ausgangswert');
	});

	it('AK-5.3: Idempotenz — Done → Open → Done erzeugt genau EINEN ScoreEntry (keine Doppelzählung)', async () => {
		const id = await createTask({ title: 'Idempotent', priority: 3, estimatedEffort: 1, deadline: future });

		await patch(`/tasks/${id}`, { status: 'Done' });
		await patch(`/tasks/${id}`, { status: 'Open' });
		await patch(`/tasks/${id}`, { status: 'Done' });

		const scores = await fetchScores();
		assert.equal(
			scores.filter((entry) => entry.taskId === id).length,
			1,
			'nach Done→Open→Done genau ein ScoreEntry',
		);
	});
});
