import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Task, User } from '../models/index.js';

/**
 * Rote Spec-Tests für #2758 — aus Fürsorge-Vorlagen übernommene Aufgaben als „Balamentum"
 * kennzeichnen (Vertrag: docs/spec/issue-2758.md, TF1–TF3 für AK1–AK3).
 *
 * Diskriminator ist ein neues Task-Flag (gesetzt, wenn POST /tasks mit `careTemplateKey` kommt),
 * NICHT die `createdById`-null-Regel: Bestandsaufgaben ohne Ersteller (Flag fehlt) bleiben ohne
 * Anzeigename (kein Backfill, AK3).
 *
 * Rot, bis POST /tasks bei `careTemplateKey` die System-Herkunft setzt und serializeTask dafür
 * `createdByName: "Balamentum"` liefert. KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'nina@example.com';
applyTestAuthEnv('tasks-system-created-test');

const NINA = 'nina@example.com';

let server: TestServer;

/** Erwartete Task-DTO-Felder gemäß Spec #2758 (in der Implementierung nullable). */
interface SystemTaskDto {
	id: number;
	title: string;
	createdById?: number | null;
	createdByName?: string | null;
}

describe('Systemseitig erzeugte Aufgaben (#2758)', () => {
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

	const postTask = async (cookie: string, body: Record<string, unknown>): Promise<Response> =>
		fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify(body),
		});

	const listTasks = async (cookie: string): Promise<SystemTaskDto[]> => {
		const res = await fetch(`${server.baseUrl}/tasks`, { headers: { Cookie: cookie } });
		assert.equal(res.status, 200, 'GET /tasks muss 200 liefern');
		return (await res.json()) as SystemTaskDto[];
	};

	const userIdOf = async (email: string): Promise<number> => {
		const user = await User.findOne({ where: { email } });
		assert.ok(user, `Setup: Konto ${email} muss existieren`);
		return user.id;
	};

	// ── AK1: careTemplateKey → System-Herkunft ──────────────────────────────────────

	it('TF1/AK1: POST mit careTemplateKey legt ohne Ersteller-Konto an — createdById null, createdByName "Balamentum"', async () => {
		const cookie = await server.login(NINA, { displayName: 'Nina Nutzerin' });

		const res = await postTask(cookie, { title: 'Spaziergang', careTemplateKey: 'koerper-spaziergang' });
		assert.equal(res.status, 201, 'POST muss 201 liefern');
		const dto = (await res.json()) as SystemTaskDto;

		assert.equal(dto.createdById, null, 'System-Aufgabe hat kein Ersteller-Konto');
		assert.equal(dto.createdByName, 'Balamentum', 'Anzeigename ist der Systemname');
	});

	// ── AK2: Passthrough-Vertrag für MCP task_list (tools.ts:432 reicht GET /tasks durch) ──

	it('TF2/AK2: GET /tasks — die Antwortform, die mcp task_list durchreicht — nennt "Balamentum"', async () => {
		const cookie = await server.login(NINA, { displayName: 'Nina Nutzerin' });
		const res = await postTask(cookie, { title: 'Dehnen', careTemplateKey: 'koerper-dehnen' });
		assert.equal(res.status, 201, 'Setup: POST muss 201 liefern');
		const dto = (await res.json()) as SystemTaskDto;

		const liste = await listTasks(cookie);
		const eintrag = liste.find((task) => task.id === dto.id);
		assert.ok(eintrag, 'die System-Aufgabe muss in der Aufgabenliste liegen');
		assert.equal(eintrag.createdByName, 'Balamentum', 'task_list-Passthrough trägt den Systemnamen');
	});

	// ── AK3: ohne Key unverändert; Bestand ohne Flag ohne Backfill ──────────────────

	it('TF3/AK3: POST ohne careTemplateKey bleibt Nutzer-Aufgabe — createdById/createdByName des Erstellers', async () => {
		const cookie = await server.login(NINA, { displayName: 'Nina Nutzerin' });

		const res = await postTask(cookie, { title: 'Ganz normale Aufgabe' });
		assert.equal(res.status, 201, 'POST muss 201 liefern');
		const dto = (await res.json()) as SystemTaskDto;

		assert.equal(dto.createdById, await userIdOf(NINA), 'ohne Key ist der Anleger der Ersteller');
		assert.equal(dto.createdByName, 'Nina Nutzerin', 'ohne Key trägt die Aufgabe den Anzeigenamen');
	});

	it('TF3/AK3: Bestandsaufgabe ohne Flag und ohne createdById bleibt ohne Anzeigename (kein Backfill)', async () => {
		const cookie = await server.login(NINA, { displayName: 'Nina Nutzerin' });
		// Bestand vor #2758: direkt geseedete Zeile — nie über den System-Pfad angelegt (Flag fehlt).
		await Task.create({ title: 'Alte Aufgabe', userId: await userIdOf(NINA), createdById: null });

		const liste = await listTasks(cookie);
		const eintrag = liste.find((task) => task.title === 'Alte Aufgabe');
		assert.ok(eintrag, 'Setup: Bestandsaufgabe muss in der Liste liegen');
		assert.equal(eintrag.createdById, null, 'Bestand bleibt ohne Ersteller-Konto');
		assert.equal(eintrag.createdByName, null, 'kein Backfill: Bestand bleibt ohne Anzeigename');
	});
});
