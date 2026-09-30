import { describe, it, beforeEach, afterEach, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { deleteAccount, type DeleteAccountResult } from './deleteAccount.js';

/**
 * #1922 AK1–AK3 (Vertrag: docs/spec/issue-1922.md): beim Löschen des Kontos entfernt der Server die
 * Feedback-Dateien des Kontos aus dem Obsidian-Vault. Der Client-Seam `ObsidianGithubClient` kommt
 * als lokal typisierter Stub; `listFeedbackFiles`/`deleteFile` und der zweite Parameter von
 * `deleteAccount` entstehen erst in der Impl-Phase (Cast statt Import, Muster dueTaskReminders.test.ts).
 */
type VaultFile = { path: string; sha: string; content: string };
type FeedbackClientStub = {
	listFeedbackFiles: (repo: string, branch: string, dir: string) => Promise<VaultFile[]>;
	deleteFile: (repo: string, branch: string, path: string, sha: string) => Promise<void>;
};
type DeleteAccountWithClient = (
	userId: number,
	options?: { feedbackClient?: FeedbackClientStub },
) => Promise<DeleteAccountResult>;
const deleteWithClient = deleteAccount as unknown as DeleteAccountWithClient;

const EMAIL = 'weg@example.com';
const file = (path: string, sha: string, email: string): VaultFile => ({
	path,
	sha,
	content: `---\ndatum: 2026-09-30T10:00:00.000Z\nnutzer: ${JSON.stringify(email)}\n---\n\n# Titel\n\nText\n`,
});

const makeClient = (files: VaultFile[]) => {
	const deleted: { repo: string; branch: string; path: string; sha: string }[] = [];
	const client: FeedbackClientStub = {
		listFeedbackFiles: async () => files,
		deleteFile: async (repo, branch, path, sha) => {
			deleted.push({ repo, branch, path, sha });
		},
	};
	return { client, deleted };
};

const createUser = () => User.create({ email: EMAIL, displayName: 'Weg', passwordHash: '__test__' } as never);

describe('Konto löschen entfernt Feedback (#1922)', () => {
	const savedToken = process.env.FEEDBACK_GITHUB_TOKEN;
	beforeEach(async () => {
		await resetDb();
		process.env.FEEDBACK_GITHUB_TOKEN = 'test-token-geheim';
	});
	afterEach(() => {
		mock.restoreAll();
		if (savedToken === undefined) delete process.env.FEEDBACK_GITHUB_TOKEN;
		else process.env.FEEDBACK_GITHUB_TOKEN = savedToken;
	});
	after(closeDb);

	it('löscht genau die Feedback-Dateien des Kontos mit passender sha (AK1)', async () => {
		const user = await createUser();
		const { client, deleted } = makeClient([
			file('Feedback/a.md', 'sha-a', EMAIL),
			file('Feedback/b.md', 'sha-b', 'andere@example.com'),
			file('Feedback/c.md', 'sha-c', EMAIL),
		]);
		assert.equal(await deleteWithClient(user.id, { feedbackClient: client }), 'deleted');
		assert.deepEqual(deleted.map((d) => [d.path, d.sha]).sort(), [
			['Feedback/a.md', 'sha-a'],
			['Feedback/c.md', 'sha-c'],
		]);
		assert.equal(await User.findByPk(user.id), null);
	});

	it('löscht Dateien ähnlicher Adressen nicht (AK2)', async () => {
		const user = await createUser();
		const { client, deleted } = makeClient([
			file('Feedback/prefix.md', 'sha-1', `x${EMAIL}`),
			file('Feedback/suffix.md', 'sha-2', `${EMAIL}.de`),
			file('Feedback/own.md', 'sha-3', EMAIL),
		]);
		await deleteWithClient(user.id, { feedbackClient: client });
		assert.deepEqual(
			deleted.map((d) => d.path),
			['Feedback/own.md'],
		);
	});

	it('löscht das Konto trotzdem und loggt genau einen Fehler ohne E-Mail und Token, wenn der Vault nicht erreichbar ist (AK3)', async () => {
		const user = await createUser();
		const errorLog = mock.method(console, 'error', () => {});
		const client: FeedbackClientStub = {
			listFeedbackFiles: async () => {
				throw new Error('GitHub antwortete auf GET /repos/x/contents/Feedback mit HTTP 502.');
			},
			deleteFile: async () => assert.fail('deleteFile darf nach Listenfehler nicht laufen'),
		};
		assert.equal(await deleteWithClient(user.id, { feedbackClient: client }), 'deleted');
		assert.equal(await User.findByPk(user.id), null);
		assert.equal(errorLog.mock.callCount(), 1);
		const logged = errorLog.mock.calls[0]!.arguments.map(String).join(' ');
		assert.ok(!logged.includes(EMAIL), 'Log enthält die E-Mail-Adresse');
		assert.ok(!logged.includes('test-token-geheim'), 'Log enthält den Token');
	});

	it('ruft ohne FEEDBACK_GITHUB_TOKEN keinen Client auf und löscht das Konto (AK3)', async () => {
		delete process.env.FEEDBACK_GITHUB_TOKEN;
		const user = await createUser();
		const calls: string[] = [];
		const client: FeedbackClientStub = {
			listFeedbackFiles: async () => {
				calls.push('list');
				return [];
			},
			deleteFile: async () => {
				calls.push('delete');
			},
		};
		assert.equal(await deleteWithClient(user.id, { feedbackClient: client }), 'deleted');
		assert.deepEqual(calls, []);
		assert.equal(await User.findByPk(user.id), null);
	});
});
