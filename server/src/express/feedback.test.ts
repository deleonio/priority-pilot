/**
 * Rote Spec-Tests für Issue #1435 — Feedback direkt in Obsidian (AK1–AK7).
 *
 * Vertrag (docs/spec/issue-1435.md): `POST /feedback` legt über einen injizierbaren
 * `ObsidianGithubClient` (AppDeps.obsidianGithubClient) eine Markdown-Datei auf dem
 * konfigurierten Feedback-Branch an. Kein echtes Netzwerk — der Client wird pro Test gestubt.
 *
 * AK8–AK10 (Frontend-UI) stehen in `frontend/e2e/issue-1435-feedback.spec.ts`.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';

applyTestAuthEnv('test-secret-issue-1435');

const ENV_KEYS = [
	'FEEDBACK_GITHUB_TOKEN',
	'FEEDBACK_GITHUB_REPO',
	'FEEDBACK_GITHUB_BRANCH',
	'FEEDBACK_GITHUB_DIR',
] as const;
const envBackup: Record<string, string | undefined> = {};

interface RecordedCommit {
	repo: string;
	branch: string;
	path: string;
	content: string;
}

let server: TestServer;
let branchShaAnswer: string | null = 'existing-sha';
let branchShaError: Error | null = null;
let commitError: Error | null = null;
let getBranchShaCalls: { repo: string; branch: string }[] = [];
let createBranchCalls: { repo: string; branch: string; fromBranch: string }[] = [];
let commitFileCalls: RecordedCommit[] = [];

const resetStubState = (): void => {
	branchShaAnswer = 'existing-sha';
	branchShaError = null;
	commitError = null;
	getBranchShaCalls = [];
	createBranchCalls = [];
	commitFileCalls = [];
};

describe('POST /feedback (#1435)', () => {
	before(async () => {
		for (const key of ENV_KEYS) envBackup[key] = process.env[key];
		server = await startTestServer({
			// @ts-expect-error — Seam noch nicht in AppDeps deklariert (Umsetzung folgt in Phase 4).
			obsidianGithubClient: {
				getBranchSha: async (repo: string, branch: string) => {
					getBranchShaCalls.push({ repo, branch });
					if (branchShaError) throw branchShaError;
					return branchShaAnswer;
				},
				createBranch: async (repo: string, branch: string, fromBranch: string) => {
					createBranchCalls.push({ repo, branch, fromBranch });
				},
				commitFile: async (repo: string, branch: string, path: string, content: string) => {
					if (commitError) throw commitError;
					commitFileCalls.push({ repo, branch, path, content });
				},
			},
		});
	});

	beforeEach(async () => {
		for (const key of ENV_KEYS) delete process.env[key];
		process.env.FEEDBACK_GITHUB_TOKEN = 'test-pat';
		resetStubState();
		await resetDb();
	});

	after(async () => {
		for (const [key, value] of Object.entries(envBackup)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		if (server) await server.close();
		await closeDb();
	});

	const validBody = { category: 'bug', title: 'Login hängt', description: 'Nach dem Login lädt nichts mehr.' };

	const submit = (cookie: string | null, body: unknown = validBody) =>
		fetch(`${server.baseUrl}/feedback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
			body: JSON.stringify(body),
		});

	it('AK1/AK3: gültiger Body → 201, genau ein Commit auf FEEDBACK_GITHUB_BRANCH (nie main), Frontmatter im Inhalt', async () => {
		process.env.FEEDBACK_GITHUB_BRANCH = 'app-feedback';
		const cookie = await server.register('feedback-ak1@example.com');

		const res = await submit(cookie);
		assert.equal(res.status, 201, `Erwartet 201, erhalten ${res.status}: ${await res.text()}`);
		assert.equal(commitFileCalls.length, 1, 'Genau ein Commit-Aufruf');
		const commit = commitFileCalls[0];
		assert.equal(commit.branch, 'app-feedback', 'Zielbranch kommt aus FEEDBACK_GITHUB_BRANCH');
		assert.notEqual(commit.branch, 'main', 'Niemals main als Zielbranch');
		assert.match(commit.content, /^---\n/, 'Inhalt beginnt mit YAML-Frontmatter');
		assert.match(commit.content, /kategorie:\s*bug/, 'Frontmatter enthält die Kategorie');
		assert.match(commit.content, /quelle:\s*app-feedback/, 'Frontmatter markiert die Quelle');
		assert.match(commit.content, /# Login hängt/, 'Titel erscheint als Überschrift');
	});

	it('AK2: zwei Einreichungen mit identischem Titel am selben Tag erzeugen zwei verschiedene Pfade', async () => {
		const cookie = await server.register('feedback-ak2@example.com');

		const first = await submit(cookie);
		const second = await submit(cookie);
		assert.equal(first.status, 201);
		assert.equal(second.status, 201);
		assert.equal(commitFileCalls.length, 2);
		assert.notEqual(commitFileCalls[0].path, commitFileCalls[1].path, 'Pfade müssen sich unterscheiden');
		assert.match(commitFileCalls[0].path, /^Feedback\/\d{4}-\d{2}-\d{2}-bug-.+\.md$/);
	});

	it('AK4: unbekannte Kategorie, leerer Titel oder leere Beschreibung → 400, kein Commit', async () => {
		const cookie = await server.register('feedback-ak4@example.com');

		const cases = [
			{ ...validBody, category: 'sonstiges' },
			{ ...validBody, title: '' },
			{ ...validBody, description: '' },
		];
		for (const body of cases) {
			const res = await submit(cookie, body);
			assert.equal(res.status, 400, `Body ${JSON.stringify(body)} muss 400 liefern`);
		}
		assert.equal(commitFileCalls.length, 0, 'Kein Upstream-Aufruf bei Validierungsfehlern');
	});

	it('AK5: fehlendes FEEDBACK_GITHUB_TOKEN → 503, kein Tokenwert im Body', async () => {
		delete process.env.FEEDBACK_GITHUB_TOKEN;
		const cookie = await server.register('feedback-ak5-token@example.com');

		const res = await submit(cookie);
		assert.equal(res.status, 503);
		const text = await res.text();
		assert.doesNotMatch(text, /test-pat/, 'Tokenwert darf nicht in der Response stehen');
	});

	it('AK5: Upstream-Fehler (401/409 des Clients) → 502, Upstream-Body nicht durchgereicht', async () => {
		const cookie = await server.register('feedback-ak5-upstream@example.com');
		commitError = new Error('raw upstream 401: token invalid, secret-upstream-detail');

		const res = await submit(cookie);
		assert.equal(res.status, 502);
		const text = await res.text();
		assert.doesNotMatch(text, /secret-upstream-detail/, 'Roher Upstream-Fehlertext darf nicht durchgereicht werden');
	});

	it('AK6: Branch existiert nicht → Branch wird vor dem Commit angelegt, Commit nennt den neuen Branch', async () => {
		process.env.FEEDBACK_GITHUB_BRANCH = 'app-feedback';
		branchShaAnswer = null;
		const cookie = await server.register('feedback-ak6@example.com');

		const res = await submit(cookie);
		assert.equal(res.status, 201, `Erwartet 201, erhalten ${res.status}: ${await res.text()}`);
		assert.equal(createBranchCalls.length, 1, 'Branch-Anlage muss genau einmal aufgerufen werden');
		assert.equal(createBranchCalls[0].branch, 'app-feedback');
		assert.equal(commitFileCalls.length, 1);
		assert.equal(commitFileCalls[0].branch, 'app-feedback', 'Commit nennt den neu angelegten Branch');
	});

	it('AK7: ohne Session → 401, kein Upstream-Aufruf', async () => {
		const res = await submit(null);
		assert.equal(res.status, 401);
		assert.equal(commitFileCalls.length, 0);
		assert.equal(getBranchShaCalls.length, 0);
	});
});
