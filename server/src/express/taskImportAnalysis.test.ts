import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Task, User } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

// Rote Spec-Tests für #1988 (Spec `docs/spec/issue-1988.md`, AK2–AK4, AK6): Import-Analyse
// als Onboarding-Moment — Analyse-Endpunkt `POST /tasks/import/analysis` (Grundform ohne
// ai_assist-Plan/Kontingent, Dubletten-Erkennung, KI-Vorschläge mit stiller Degradierung)
// und Merge-Endpunkt `POST /tasks/import/merge`. Beide Routen existieren noch nicht →
// erster roter Zustand ist die 404-Assertion.

after(closeDb);

const EMAIL = 'spec-1988@example.com';

const CSV = [
	'TYPE,CONTENT,PRIORITY,DATE',
	'task,Einkaufen,2,2026-11-02',
	'task,Sport,4,',
].join('\r\n');

/** Legt einen Zusatznutzer über den Register-Endpunkt an (User.create braucht passwordHash). */
const registerUser = async (srv: TestServer, email: string): Promise<number> => {
	await srv.register(email);
	const user = await User.findOne({ where: { email } });
	assert.ok(user, 'Registrierter Nutzer muss existieren');
	return user.id;
};

const post = (baseUrl: string, cookie: string, path: string, body: unknown) =>
	fetch(`${baseUrl}/tasks/import/${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});

const userId = async (): Promise<number> => {
	const user = await User.findOne({ where: { email: EMAIL } });
	assert.ok(user, 'Test-Login-Nutzer muss existieren');
	return user.id;
};

describe('POST /tasks/import/analysis (#1988)', () => {
	let server: TestServer;
	let cookie: string;

	beforeEach(async () => {
		await resetDb();
		if (!server) server = await startTestServer();
		cookie = await server.login(EMAIL);
	});

	it('TF3/AK3: antwortet ohne ai_assist-Plan und ohne Kontingent 200 mit voller Grundform', async () => {
		const res = await post(server.baseUrl, cookie, 'analysis', { csv: CSV });
		assert.equal(res.status, 200);
		const body = (await res.json()) as Record<string, unknown>;
		assert.equal(body.total, 2);
		const missing = (body.missingDeadlines ?? []) as Array<{ title: string }>;
		assert.equal(missing.length, 1);
		assert.equal(missing[0].title, 'Sport');
		assert.deepEqual(body.duplicates, []);
		assert.deepEqual(body.suggestions, []);
	});

	it('TF2/AK2: erkennt exakte Dubletten (trim+lowercase) importiert/importiert und importiert/vorhanden, Fremdkonto bleibt außen vor', async () => {
		const uid = await userId();
		// Vorhandener Task (gleicher Nutzer, anderer Schreibweise) + fremder Nutzer als Gegenprobe.
		await Task.create({ userId: uid, title: '  EINKAUFEN ' });
		const strangerId = await registerUser(server, 'spec-1988-b@example.com');
		await Task.create({ userId: strangerId, title: 'einkaufen' });

		const res = await post(server.baseUrl, cookie, 'analysis', {
			csv: `${CSV}\r\ntask,einkaufen ,3,`,
		});
		assert.equal(res.status, 200);
		const body = (await res.json()) as {
			duplicates: Array<{ keepTaskId: number; duplicateTaskId: number; title: string; reason: string }>;
		};
		// Genau zwei Treffer: Kopie im CSV ↔ vorhanden (gleiches Konto) und Kopie ↔ Kopie im CSV.
		assert.equal(body.duplicates.length, 2, `erwartet 2 Dubletten, erhalten: ${JSON.stringify(body.duplicates)}`);
		for (const dup of body.duplicates) {
			assert.ok(dup.keepTaskId > 0 && dup.duplicateTaskId > 0);
			assert.ok(dup.reason.length > 0, 'jede Dublette braucht eine Begründung');
			assert.match(dup.title.toLowerCase(), /einkaufen/);
		}
		// Kein Treffer darf in das Fremdkonto zeigen.
		const strangerTasks = await Task.findAll({ where: { userId: strangerId } });
		for (const dup of body.duplicates) {
			assert.ok(
				strangerTasks.every((t) => t.id !== dup.keepTaskId && t.id !== dup.duplicateTaskId),
				'Dublette darf fremde Tasks nicht berühren',
			);
		}
	});

	it('TF4/AK4: injizierter Analyzer liefert Abhängigkeits-Vorschläge mit Begründung; Analyzer-Fehler degradiert still auf die Grundform', async () => {
		const uid = await userId();
		const a = await Task.create({ userId: uid, title: 'Einkaufen' });
		const b = await Task.create({ userId: uid, title: 'Einkaufsliste schreiben' });

		const fake = async () => [
			{ dependentTaskId: b.id, dependingTaskId: a.id, title: 'Einkaufsliste schreiben', reason: 'Titel verweist auf Einkaufen' },
		];
		const injecting = await startTestServer({
			taskImportAnalyzer: fake,
		} as unknown as Parameters<typeof startTestServer>[0]);
		const cookie2 = await injecting.login(EMAIL);
		const ok = await post(injecting.baseUrl, cookie2, 'analysis', { csv: CSV });
		assert.equal(ok.status, 200);
		const okBody = (await ok.json()) as {
			suggestions: Array<{ dependentTaskId: number; dependingTaskId: number; reason: string }>;
		};
		assert.equal(okBody.suggestions.length, 1);
		assert.equal(okBody.suggestions[0].dependentTaskId, b.id);
		assert.equal(okBody.suggestions[0].dependingTaskId, a.id);
		assert.ok(okBody.suggestions[0].reason.length > 0);

		const failing = await startTestServer({
			taskImportAnalyzer: async () => {
				throw new Error('Quota erschöpft');
			},
		} as unknown as Parameters<typeof startTestServer>[0]);
		const cookie3 = await failing.login(EMAIL);
		const degraded = await post(failing.baseUrl, cookie3, 'analysis', { csv: CSV });
		assert.equal(degraded.status, 200, 'KI-Fehler darf die Grundform nicht reißen');
		const degradedBody = (await degraded.json()) as { total: number; suggestions: unknown[] };
		assert.equal(degradedBody.total, 2);
		assert.deepEqual(degradedBody.suggestions, []);
		await Promise.all([injecting.close(), failing.close()]);
	});
});

describe('POST /tasks/import/merge (#1988 AK6)', () => {
	let server: TestServer;
	let cookie: string;

	beforeEach(async () => {
		await resetDb();
		if (!server) server = await startTestServer();
		cookie = await server.login(EMAIL);
	});

	it('TF6/AK6: Merge lässt genau einen Task übrig und übernimmt Frist/Priorität der Kopie, falls beim Verbleibenden fehlend', async () => {
		const uid = await userId();
		const keep = await Task.create({ userId: uid, title: 'Einkaufen' });
		const dup = await Task.create({
			userId: uid,
			title: 'einkaufen',
			deadline: new Date('2026-11-02T00:00:00.000Z'),
			priority: 2,
		});

		const res = await post(server.baseUrl, cookie, 'merge', { keepTaskId: keep.id, duplicateTaskId: dup.id });
		assert.equal(res.status, 200);

		const remaining = await Task.findAll({ where: { userId: uid } });
		assert.equal(remaining.length, 1, 'genau ein Task bleibt übrig');
		const merged = remaining[0];
		assert.equal(merged.id, keep.id, 'die Kopie wird entfernt, der Ziel-Task bleibt');
		assert.ok(merged.deadline, 'Frist der Kopie übernommen');
		assert.equal(merged.priority, 2, 'Priorität der Kopie übernommen');

		// Fremder Task ist tabu (Isolation).
		const strangerId = await registerUser(server, 'spec-1988-c@example.com');
		const foreign = await Task.create({ userId: strangerId, title: 'einkaufen' });
		const denied = await post(server.baseUrl, cookie, 'merge', {
			keepTaskId: keep.id,
			duplicateTaskId: foreign.id,
		});
		assert.equal(denied.status, 404);
		assert.equal((await Task.count({ where: { userId: strangerId } })), 1);
	});
});
