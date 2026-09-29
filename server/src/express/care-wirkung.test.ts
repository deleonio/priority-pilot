import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import CareSuggestionEvent from '../models/careSuggestionEvent.js';
import CarePushToggle from '../models/carePushToggle.js';

/**
 * Rote Spec-Tests für #1798 (Spec docs/spec/issue-1798.md) — Wirkungsmessung Fürsorge-Vorschläge.
 * AK1/AK2: Protokollierung; AK4/AK6/AK7: `GET /admin/care-wirkung`; AK5: Push-Verlauf; AK8: keine `userId`.
 * AK3 (ignoriert-Ableitung mit 7-Tage-Grenze) und die Woche-4/12-Aktivität brauchen eine steuerbare
 * Uhr/Altdaten — siehe PR „Offene Fragen". Rot, bis Modelle und Endpunkt existieren. KEIN Produktivcode.
 */
applyTestAuthEnv('test-secret-issue-1798-care-wirkung');

let server: TestServer;

interface Vorschlag {
	typ: 'task' | 'vorlage';
	saeuleId: number;
	titel: string;
	saeulenBeitraege: { pillarId: number; share: number }[];
	templateKey?: string;
}

const auth = (cookie: string) => ({ headers: { Cookie: cookie } });

const ersterVorschlag = async (cookie: string): Promise<Vorschlag> => {
	const res = await server.json('/scores/care-suggestions', auth(cookie));
	assert.equal(res.status, 200);
	const v = ((await res.json()) as { vorschlaege: Vorschlag[] }).vorschlaege.find((x) => x.typ === 'vorlage');
	assert.ok(v?.templateKey, 'Setup: Vorlage mit templateKey erwartet');
	return v;
};

const zaehle = (reaktion: string): Promise<number> => CareSuggestionEvent.count({ where: { reaktion } });

describe('Care-Wirkung (#1798)', () => {
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

	it('AK1: wiederholter Abruf in derselben Woche erhöht die Anzeige-Summe nicht', async () => {
		const cookie = await server.register('wirkung-anzeige@example.com', 'password123');
		await ersterVorschlag(cookie);
		const nachErstem = await zaehle('angezeigt');
		assert.ok(nachErstem > 0, 'Anzeige muss protokolliert werden');
		await ersterVorschlag(cookie);
		assert.equal(await zaehle('angezeigt'), nachErstem, 'zweiter Abruf derselben Woche zählt nicht erneut');
	});

	it('AK2: Ablehnung schreibt ein Ereignis, Antwort bleibt 204', async () => {
		const cookie = await server.register('wirkung-ablehnen@example.com', 'password123');
		const v = await ersterVorschlag(cookie);
		const res = await server.json('/scores/care-suggestions/dismissals', {
			method: 'POST',
			...auth(cookie),
			body: JSON.stringify({ templateKey: v.templateKey }),
		});
		assert.equal(res.status, 204);
		assert.equal(await zaehle('abgelehnt'), 1);
	});

	it('AK2: POST /tasks mit careTemplateKey schreibt Übernahme, ohne Schlüssel keine', async () => {
		const cookie = await server.register('wirkung-uebernahme@example.com', 'password123');
		const v = await ersterVorschlag(cookie);
		const body = { title: v.titel, pillars: v.saeulenBeitraege };
		const ohne = await server.json('/tasks', { method: 'POST', ...auth(cookie), body: JSON.stringify(body) });
		assert.equal(ohne.status, 201);
		assert.equal(await zaehle('uebernommen'), 0, 'ohne careTemplateKey kein Ereignis');
		const mit = await server.json('/tasks', {
			method: 'POST',
			...auth(cookie),
			body: JSON.stringify({ ...body, careTemplateKey: v.templateKey }),
		});
		assert.equal(mit.status, 201);
		assert.equal(await zaehle('uebernommen'), 1);
	});

	it('AK5: Wechsel von carePushEnabled wird protokolliert, gleicher Wert nicht', async () => {
		const cookie = await server.register('wirkung-toggle@example.com', 'password123');
		const put = (carePushEnabled: boolean) =>
			server.json('/care-config', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', Cookie: cookie },
				body: JSON.stringify({ carePushEnabled, zeitzone: 'UTC' }),
			});
		assert.equal((await put(false)).status, 200);
		assert.equal(await CarePushToggle.count(), 1, 'Wechsel true→false protokolliert');
		assert.equal((await put(false)).status, 200);
		assert.equal(await CarePushToggle.count(), 1, 'gleicher Wert erzeugt keinen Eintrag');
	});

	it('AK7: /admin/care-wirkung — 401 anonym, 403 Member', async () => {
		assert.equal((await server.json('/admin/care-wirkung', auth('cookie=none'))).status, 401);
		const member = await server.login('member-wirkung@example.com', { role: 'member' });
		assert.equal((await server.json('/admin/care-wirkung', auth(member))).status, 403);
	});

	it('AK4/AK6: Admin erhält Wochen + Bindung je Push-Gruppe; kleine Zelle unterdrückt, keine Identitäten', async () => {
		const admin = await server.login('admin-wirkung@example.com', { role: 'admin' });
		const v = await ersterVorschlag(admin);
		await server.json('/scores/care-suggestions/dismissals', {
			method: 'POST',
			...auth(admin),
			body: JSON.stringify({ templateKey: v.templateKey }),
		});
		const res = await server.json('/admin/care-wirkung', auth(admin));
		assert.equal(res.status, 200);
		const raw = await res.text();
		const json = JSON.parse(raw) as {
			wochen: { angezeigt: number; abgelehnt: number }[];
			bindung: Record<'push_an' | 'push_aus', Record<'w4' | 'w12', unknown>>;
		};
		assert.equal(json.wochen.reduce((s, w) => s + w.angezeigt, 0) > 0, true);
		assert.equal(
			json.wochen.reduce((s, w) => s + w.abgelehnt, 0),
			1,
		);
		for (const gruppe of ['push_an', 'push_aus'] as const) {
			for (const ziel of ['w4', 'w12'] as const) {
				assert.equal(json.bindung[gruppe][ziel], 'unterdrueckt', `${gruppe}.${ziel}: <5 Nutzer → unterdrückt`);
			}
		}
		assert.doesNotMatch(raw, /userId|admin-wirkung@example\.com/, 'keine Identitäten in der Antwort');
	});

	it('AK8: care_suggestion_events hat keine userId-Spalte', () => {
		const spalten = Object.keys(CareSuggestionEvent.getAttributes());
		assert.ok(spalten.includes('woche') && spalten.includes('reaktion'), 'Modell trägt woche/reaktion');
		assert.ok(!spalten.some((s) => s.toLowerCase() === 'userid'), 'keine userId-Spalte');
	});
});
