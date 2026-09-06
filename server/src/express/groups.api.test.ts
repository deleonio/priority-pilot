import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

// Rote Spec-Tests für #1211 (AK1/AK4/AK5) — API-Vertrag laut docs/spec/issue-1211.md.
// Der Router /groups existiert noch nicht; die Tests werden grün, sobald
// server/src/express/routes/groups.ts den Vertrag umsetzt. Läuft bewusst ohne
// Auth-Env (Pass-Through-Modus) — die Datenisolation deckt groups-dataisolation.test.ts ab.

let server: TestServer;

/** Response-Body der Gruppen-Routen: DTO bei Erfolg, `{ message }` bei Fehler (Fehlervertrag #1130). */
type GroupResponseBody = {
	id?: number;
	name?: string;
	description?: string | null;
	imageUrl?: string | null;
	role?: string;
	memberCount?: number;
	message?: string;
};

/** Legt eine Gruppe an und liefert die Response (Status + geparsten Body). */
const createGroup = async (body: unknown): Promise<{ status: number; body: GroupResponseBody | null }> => {
	const res = await fetch(`${server.baseUrl}/groups`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: await res.json().catch(() => null) };
};

describe('Gruppen-API — Anlegen, Validierung, Löschen (#1211)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	// ── AK1: POST /groups → 201 mit vollständigem Shape ────────────────────────────────

	it('POST /groups legt Gruppe an: 201 mit id, name, description, role=admin, memberCount=1 (AK1)', async () => {
		const { status, body } = await createGroup({ name: 'Familie Müller' });
		assert.equal(status, 201, 'Anlegen muss 201 liefern');
		assert.ok(body && typeof body.id === 'number', 'id muss vorhanden sein');
		assert.equal(body.name, 'Familie Müller');
		assert.equal(body.description, null, 'description ohne Angabe ist null/leer');
		assert.equal(body.role, 'admin', 'Ersteller ist automatisch Admin');
		assert.equal(body.memberCount, 1, 'Ersteller zählt als einziges Mitglied');
	});

	it('POST /groups mit Beschreibung liefert sie zurück (AK1)', async () => {
		const { status, body } = await createGroup({ name: 'Sport', description: 'Wandern und Rad' });
		assert.equal(status, 201);
		assert.equal(body.description, 'Wandern und Rad');
	});

	// ── AK4: Validierung Name ─────────────────────────────────────────────────────────

	it('POST /groups ohne Name → 400 mit deutscher Meldung (AK4)', async () => {
		const { status, body } = await createGroup({ description: 'kein Name' });
		assert.equal(status, 400);
		assert.ok(typeof body?.message === 'string' && body.message.length > 0, 'Fehlermeldung vorhanden');
	});

	it('POST /groups mit leerem Name → 400 (AK4)', async () => {
		const { status } = await createGroup({ name: '   ' });
		assert.equal(status, 400, 'Whitespace-only Name ist leer');
	});

	it('POST /groups mit Name > 60 Zeichen → 400 mit deutscher Meldung (AK4)', async () => {
		const { status, body } = await createGroup({ name: 'x'.repeat(61) });
		assert.equal(status, 400);
		assert.ok(typeof body?.message === 'string' && body.message.length > 0, 'Fehlermeldung vorhanden');
	});

	it('POST /groups mit Name = 60 Zeichen → 201 (Grenze erlaubt, AK4)', async () => {
		const { status } = await createGroup({ name: 'x'.repeat(60) });
		assert.equal(status, 201, '60 Zeichen sind noch gültig');
	});

	// ── PATCH: Teil-Update nach OpenAPI-Vertrag (GroupUpdate: alle Felder optional) ────

	it('PATCH /groups/:id nur mit description → 200, Name unverändert (Review PR #1214, Finding 1)', async () => {
		const { body: created } = await createGroup({ name: 'Familie Müller', description: 'Alte Beschreibung' });
		const res = await fetch(`${server.baseUrl}/groups/${created.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ description: 'Neue Beschreibung' }),
		});
		assert.equal(res.status, 200, 'Beschreibungs-only-Edit ohne name muss laut GroupUpdate-Vertrag erlaubt sein');
		const updated = (await res.json()) as GroupResponseBody;
		assert.equal(updated.name, 'Familie Müller', 'abwesendes Feld name bleibt unverändert');
		assert.equal(updated.description, 'Neue Beschreibung');
	});

	it('PATCH /groups/:id nur mit name → 200, Beschreibung unverändert; leerer name → 400 (AK4)', async () => {
		const { body: created } = await createGroup({ name: 'Sport', description: 'Wandern und Rad' });
		const res = await fetch(`${server.baseUrl}/groups/${created.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Sport neu' }),
		});
		assert.equal(res.status, 200);
		const updated = (await res.json()) as GroupResponseBody;
		assert.equal(updated.name, 'Sport neu');
		assert.equal(updated.description, 'Wandern und Rad', 'abwesendes Feld description bleibt unverändert');

		// Angegebenes, aber ungültiges name-Feld wird weiterhin abgewiesen (Validierung greift
		// nur bei Anwesenheit, nicht als Dummy durchgelassen).
		const invalidRes = await fetch(`${server.baseUrl}/groups/${created.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: '   ' }),
		});
		assert.equal(invalidRes.status, 400, 'leerer Name bleibt 400');
	});

	// ── AK5: DELETE entfernt Gruppe inkl. Mitgliedschaften ────────────────────────────

	it('DELETE /groups/:id entfernt Gruppe und Mitgliedschaften; GET danach → 404 (AK5)', async () => {
		const { body: created } = await createGroup({ name: 'Weg damit' });
		const deleteRes = await fetch(`${server.baseUrl}/groups/${created.id}`, { method: 'DELETE' });
		assert.equal(deleteRes.status, 204, 'Löschen muss 204 liefern');

		const getRes = await fetch(`${server.baseUrl}/groups/${created.id}`);
		assert.equal(getRes.status, 404, 'Gruppe ist nach dem Löschen weg');

		const listRes = await fetch(`${server.baseUrl}/groups`);
		const list = (await listRes.json()) as { id: number }[];
		assert.ok(!list.some((group) => group.id === created.id), 'Gruppe fehlt in der Liste');
	});
});

// ── #1225 AK1: PATCH /groups/:id mit optionaler Bildadresse (imageUrl) ────────────────
// Vertrag laut docs/spec/issue-1225.md: nur https:// wird übernommen, null entfernt das
// Bild, abwesendes Feld bleibt unverändert (presence-basierter PATCH-Vertrag), DTO liefert
// das Feld mit. Rot, bis der Router imageUrl verarbeitet.
describe('Gruppen-API — Bildadresse imageUrl (#1225, AK1)', () => {
	before(async () => {
		server = await startTestServer();
	});
	beforeEach(async () => {
		await resetDb();
	});
	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	const patchImageUrl = async (groupId: number, body: unknown): Promise<Response> =>
		fetch(`${server.baseUrl}/groups/${groupId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

	it('PATCH mit gültiger https-Bildadresse → 200, DTO und GET liefern imageUrl zurück (AK1)', async () => {
		const { body: created } = await createGroup({ name: 'Familie Bild' });
		const res = await patchImageUrl(created!.id!, { imageUrl: 'https://example.com/gruppe.png' });
		assert.equal(res.status, 200, 'gültige https-Adresse muss übernommen werden');
		const updated = (await res.json()) as GroupResponseBody;
		assert.equal(updated.imageUrl, 'https://example.com/gruppe.png', 'DTO liefert imageUrl mit');

		const getRes = await fetch(`${server.baseUrl}/groups/${created!.id!}`);
		const reloaded = (await getRes.json()) as GroupResponseBody;
		assert.equal(reloaded.imageUrl, 'https://example.com/gruppe.png', 'GET /groups/:id liefert das Bild mit');
	});

	it('PATCH mit http://-Adresse → 400 mit deutscher Meldung, Bild nicht übernommen (AK1)', async () => {
		const { body: created } = await createGroup({ name: 'Familie Unsicher' });
		const res = await patchImageUrl(created!.id!, { imageUrl: 'http://example.com/gruppe.png' });
		assert.equal(res.status, 400, 'nur https:// ist erlaubt');
		const body = (await res.json()) as GroupResponseBody;
		assert.ok(typeof body.message === 'string' && body.message.length > 0, 'deutsche Meldung vorhanden');

		const getRes = await fetch(`${server.baseUrl}/groups/${created!.id!}`);
		const reloaded = (await getRes.json()) as GroupResponseBody;
		assert.notEqual(reloaded.imageUrl, 'http://example.com/gruppe.png', 'unsichere Adresse wurde nicht gespeichert');
	});

	it('PATCH mit imageUrl: null → Bild entfernt, DTO liefert null (AK1)', async () => {
		const { body: created } = await createGroup({ name: 'Familie Wegbild' });
		await patchImageUrl(created!.id!, { imageUrl: 'https://example.com/gruppe.png' });
		const res = await patchImageUrl(created!.id!, { imageUrl: null });
		assert.equal(res.status, 200, 'null muss als „Bild entfernen“ akzeptiert werden');
		const updated = (await res.json()) as GroupResponseBody;
		assert.equal(updated.imageUrl, null, 'nach null ist das Feld leer');
	});

	it('PATCH ohne imageUrl-Feld → Bild bleibt unverändert (presence-basierter Vertrag, AK1)', async () => {
		const { body: created } = await createGroup({ name: 'Familie Bleibt' });
		await patchImageUrl(created!.id!, { imageUrl: 'https://example.com/gruppe.png' });
		const res = await patchImageUrl(created!.id!, { description: 'nur Beschreibung' });
		assert.equal(res.status, 200);
		const updated = (await res.json()) as GroupResponseBody;
		assert.equal(updated.imageUrl, 'https://example.com/gruppe.png', 'abwesendes Feld darf nichts entfernen');
	});
});
