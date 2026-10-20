import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { Task, User, Group, GroupMember } from '../models/index.js';
import CareSuggestionEvent from '../models/careSuggestionEvent.js';

/**
 * Rote Spec-Tests für #2758 — aus Fürsorge-Vorlagen übernommene Aufgaben als „Balamentum"
 * kennzeichnen (Vertrag: docs/spec/issue-2758.md, TF1–TF3 für AK1–AK3).
 *
 * Diskriminator ist ein neues Task-Flag (gesetzt, wenn POST /tasks mit `careTemplateKey` kommt),
 * NICHT die `createdById`-null-Regel: Bestandsaufgaben ohne Ersteller (Flag fehlt) bleiben ohne
 * Anzeigename (kein Backfill, AK3).
 *
 * Rot, bis POST /tasks bei `careTemplateKey` die System-Herkunft setzt und serializeTask dafür
 * `createdByName: "Balamentum"` liefert. #2787: Katalog-Validierung für `careTemplateKey`
 * (unbekannter Schlüssel → 400, TF3) und Übergabe setzt `systemCreated` zurück (TF4).
 * KEIN Produktivcode.
 */
process.env.GOOGLE_ALLOWED_EMAILS = 'nina@example.com,bob@example.com';
applyTestAuthEnv('tasks-system-created-test');

const NINA = 'nina@example.com';
const BOB = 'bob@example.com';

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

		const res = await postTask(cookie, { title: 'Spaziergang', careTemplateKey: 'koerper-1' });
		assert.equal(res.status, 201, 'POST muss 201 liefern');
		const dto = (await res.json()) as SystemTaskDto;

		assert.equal(dto.createdById, null, 'System-Aufgabe hat kein Ersteller-Konto');
		assert.equal(dto.createdByName, 'Balamentum', 'Anzeigename ist der Systemname');
	});

	// ── AK2: Passthrough-Vertrag für MCP task_list (tools.ts:432 reicht GET /tasks durch) ──

	it('TF2/AK2: GET /tasks — die Antwortform, die mcp task_list durchreicht — nennt "Balamentum"', async () => {
		const cookie = await server.login(NINA, { displayName: 'Nina Nutzerin' });
		const res = await postTask(cookie, { title: 'Dehnen', careTemplateKey: 'koerper-2' });
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

	// ── #2787: Katalog-Validierung + Übergabe setzt systemCreated zurück ─────────────

	it('TF3/AK3 (#2787): unbekannter careTemplateKey → 400, keine Aufgabe, kein uebernommen-Ereignis', async () => {
		const cookie = await server.login(NINA, { displayName: 'Nina Nutzerin' });
		const vorher = await Task.count();

		const res = await postTask(cookie, { title: 'Tippfehler-Vorlage', careTemplateKey: 'gibts-nicht-42' });
		assert.equal(res.status, 400, 'unbekannter Schlüssel wird gegen CARE_VORLAGEN abgewiesen');
		assert.equal(await Task.count(), vorher, 'es wurde keine Aufgabe angelegt');
		assert.equal(
			await CareSuggestionEvent.count({ where: { reaktion: 'uebernommen' } }),
			0,
			'kein Übernahme-Ereignis für einen unbekannten Schlüssel',
		);
	});

	it('TF4/AK4 (#2787): Übergabe einer System-Aufgabe setzt systemCreated zurück — Antwort und Liste nennen den Übergebenden', async () => {
		const ninaCookie = await server.login(NINA, { displayName: 'Nina Nutzerin' });
		await server.login(BOB, { displayName: 'Bob Empfänger' });
		const ninaId = await userIdOf(NINA);
		const bobId = await userIdOf(BOB);

		// Gemeinsame Gruppe (#1213): sonst lehnt resolveRecipientId die Übergabe mit 403 ab.
		const group = await Group.create({ name: 'Familie', description: null });
		await GroupMember.create({ groupId: group.id, userId: ninaId, role: 'admin', joinedAt: new Date() });
		await GroupMember.create({ groupId: group.id, userId: bobId, role: 'member', joinedAt: new Date() });

		const created = await postTask(ninaCookie, { title: 'Spaziergang', careTemplateKey: 'koerper-1' });
		assert.equal(created.status, 201, 'Setup: System-Aufgabe muss angelegt sein');
		const systemDto = (await created.json()) as SystemTaskDto;
		assert.equal(systemDto.createdByName, 'Balamentum', 'Setup: vor der Übergabe gilt der Systemname');

		const res = await fetch(`${server.baseUrl}/tasks/${systemDto.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Cookie: ninaCookie },
			body: JSON.stringify({ userId: bobId }),
		});
		assert.equal(res.status, 200, 'Setup: Übergabe muss gelingen');
		const dto = (await res.json()) as SystemTaskDto;
		assert.equal(dto.createdByName, 'Nina Nutzerin', 'Antwort nennt nach der Übergabe den Übergebenden');

		const liste = await listTasks(ninaCookie);
		const eintrag = liste.find((task) => task.id === dto.id);
		assert.ok(eintrag, 'die übergebene Aufgabe muss in der Aufgabenliste liegen');
		assert.equal(eintrag.createdByName, 'Nina Nutzerin', 'Liste nennt denselben Übergebenden');
	});
});
