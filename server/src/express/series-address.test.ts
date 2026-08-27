import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

/**
 * Rote Spec-Tests für #1063 — optionales `address`-Feld an Serien (AK1, Spec
 * docs/spec/issue-1063.md): Analog zum Task-Modell (`tasks-address.test.ts`) akzeptieren
 * POST/PATCH `/series` eine Adresse (String ≤ 255 Zeichen oder null) und GET gibt sie zurück.
 * Ohne Angabe gilt `address === null`. KEIN Produktivcode — die Tests werden grün, sobald das
 * Series-Modell die Spalte führt und `validateSeriesFields`/`serializeSeries` sie durchreichen.
 */
describe('Adressfeld an Serien (#1063, AK1)', () => {
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
	const get = (path: string) => fetch(`${server.baseUrl}${path}`);

	const futureDate = (offsetDays: number): string => {
		const result = new Date();
		result.setUTCDate(result.getUTCDate() + offsetDays);
		result.setUTCHours(0, 0, 0, 0);
		return result.toISOString().replace(/\.\d{3}Z$/, '.000Z');
	};

	const validSeries = () => ({
		title: 'Wöchentlich kochen',
		rhythm: 'weekly',
		priority: 4,
		estimatedEffort: 0.5,
		active: true,
		startDate: futureDate(1),
	});

	it('POST /series mit address → 201, Adresse gespeichert und zurückgegeben', async () => {
		const res = await post('/series', { ...validSeries(), address: 'Musterstraße 1, 12345 Musterstadt' });
		assert.equal(res.status, 201, 'Serien-Anlage mit Adresse muss 201 liefern');
		const created = (await res.json()) as { address: string | null };
		assert.equal(created.address, 'Musterstraße 1, 12345 Musterstadt');
	});

	it('POST /series ohne address → address === null (kein Ortsbezug)', async () => {
		const res = await post('/series', validSeries());
		assert.equal(res.status, 201);
		const created = (await res.json()) as { id: number; address: string | null };
		assert.equal(created.address, null, 'ohne Angabe gilt address === null');

		// GET /series/:id liefert das Feld ebenfalls mit null zurück.
		const detail = (await (await get(`/series/${created.id}`)).json()) as { address: string | null };
		assert.equal(detail.address, null);
	});

	it('GET /series gibt address in der Liste zurück', async () => {
		await post('/series', { ...validSeries(), title: 'Mit Adresse', address: 'Hauptplatz 3, 10115 Berlin' });
		const res = await get('/series');
		assert.equal(res.status, 200);
		const list = (await res.json()) as { title: string; address: string | null }[];
		const entry = list.find((s) => s.title === 'Mit Adresse');
		assert.ok(entry, 'angelegte Serie ist in der Liste');
		assert.equal(entry.address, 'Hauptplatz 3, 10115 Berlin');
	});

	it('PATCH /series/:id aktualisiert die Adresse', async () => {
		const id = ((await (await post('/series', validSeries())).json()) as { id: number }).id;
		const res = await patch(`/series/${id}`, { address: 'Neue Adresse 2, 54321 Anderestadt' });
		assert.equal(res.status, 200);
		const updated = (await res.json()) as { address: string | null };
		assert.equal(updated.address, 'Neue Adresse 2, 54321 Anderestadt');
	});

	it('PATCH /series/:id mit address: null entfernt einen bestehenden Ortsbezug', async () => {
		const id = ((await (await post('/series', { ...validSeries(), address: 'Alte Adresse' })).json()) as { id: number })
			.id;
		const res = await patch(`/series/${id}`, { address: null });
		assert.equal(res.status, 200);
		const updated = (await res.json()) as { address: string | null };
		assert.equal(updated.address, null);
	});

	it('address über 255 Zeichen → 400', async () => {
		const res = await post('/series', { ...validSeries(), address: 'x'.repeat(256) });
		assert.equal(res.status, 400, 'mehr als 255 Zeichen werden abgelehnt');
	});

	it('address als Zahl → 400', async () => {
		const res = await post('/series', { ...validSeries(), address: 123 });
		assert.equal(res.status, 400, 'nicht-String-Werte werden abgelehnt');
	});
});
