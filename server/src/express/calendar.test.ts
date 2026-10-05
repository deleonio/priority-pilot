import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { User } from '../models/index.js';

/**
 * Rote Spec-Tests für #2209 (Spec docs/spec/issue-2209.md): Kalenderquellen per ICS-Adresse.
 * AK1 anlegen+speichern, AK2 Fenster/ersetzen, AK3 Löschen, AK4 Paketgrenze, AK5 Datenisolation.
 * Rot, bis die Routen existieren (heute 404/SPA-Fallback). ICS kommt von einem lokalen HTTP-Stub.
 */

applyTestAuthEnv('test-secret-issue-2209');

const DAY = 24 * 60 * 60 * 1000;
const stamp = (d: Date): string =>
	d
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
const vevent = (title: string, offsetDays: number): string => {
	const start = new Date(Date.now() + offsetDays * DAY);
	return `BEGIN:VEVENT\r\nUID:${title}@test\r\nDTSTART:${stamp(start)}\r\nDTEND:${stamp(new Date(start.getTime() + 3600_000))}\r\nSUMMARY:${title}\r\nEND:VEVENT`;
};

let server: TestServer;
let ics: http.Server;
let icsBody = '';
const methods: string[] = [];
let icsUrl = '';

type EventDto = { sourceId: number; start: string; end: string; title: string; allDay: boolean };

const setEvents = (...events: string[]): void => {
	icsBody = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
};
const post = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/calendar-sources', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});
const events = async (cookie: string): Promise<EventDto[]> =>
	(await (await server.json('/calendar-events', { headers: { Cookie: cookie } })).json()) as EventDto[];
const setPlan = async (email: string, plan: string): Promise<void> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, 'Setup: Nutzer muss existieren');
	await (user as unknown as { update: (v: Record<string, unknown>) => Promise<unknown> }).update({ plan });
};

describe('Kalenderquellen per ICS (#2209)', () => {
	before(async () => {
		server = await startTestServer();
		ics = http.createServer((req, res) => {
			methods.push(req.method ?? '');
			res.setHeader('Content-Type', 'text/calendar');
			res.end(icsBody);
		});
		await new Promise<void>((resolve) => ics.listen(0, '127.0.0.1', resolve));
		icsUrl = `http://127.0.0.1:${(ics.address() as AddressInfo).port}/cal.ics`;
	});

	beforeEach(async () => {
		await resetDb();
		methods.length = 0;
		setEvents(vevent('Termin', 1));
	});

	after(async () => {
		await new Promise<void>((resolve) => ics.close(() => resolve()));
		if (server) await server.close();
		await closeDb();
	});

	it('AK1: POST legt die Quelle an und speichert die Termine (Adresse nie in der Antwort)', async () => {
		const cookie = await server.register('cal-ak1@example.com', 'password123');
		const res = await post(cookie, { url: icsUrl, name: 'Privat' });
		assert.equal(res.status, 201);
		assert.ok(!JSON.stringify(await res.json()).includes(icsUrl), 'ICS-Adresse ist geheim');
		const stored = await events(cookie);
		assert.deepEqual(
			stored.map((e) => e.title),
			['Termin'],
		);
		assert.deepEqual(Object.keys(stored[0]).sort(), ['allDay', 'end', 'sourceId', 'start', 'title']);
		assert.deepEqual([...new Set(methods)], ['GET'], 'AK6: nur GET an die Kalender-Adresse');
	});

	it('AK2: Termine außerhalb des Fensters werden nicht gespeichert', async () => {
		setEvents(vevent('innen', 2), vevent('vorbei', -5), vevent('weit', 30));
		const cookie = await server.register('cal-ak2a@example.com', 'password123');
		await post(cookie, { url: icsUrl });
		assert.deepEqual(
			(await events(cookie)).map((e) => e.title),
			['innen'],
		);
	});

	it('AK3: DELETE der Quelle löscht ihre Termine', async () => {
		const cookie = await server.register('cal-ak3@example.com', 'password123');
		const { id } = (await (await post(cookie, { url: icsUrl })).json()) as { id: number };
		const del = await server.json(`/calendar-sources/${id}`, { method: 'DELETE', headers: { Cookie: cookie } });
		assert.equal(del.status, 204);
		assert.deepEqual(await events(cookie), []);
	});

	it('AK4: Free darf nur eine Quelle, Plus mehrere', async () => {
		const free = await server.register('cal-ak4-free@example.com', 'password123');
		assert.equal((await post(free, { url: icsUrl })).status, 201);
		assert.equal((await post(free, { url: `${icsUrl}?b=1` })).status, 403, 'zweite Quelle im Free-Paket');

		const plus = await server.register('cal-ak4-plus@example.com', 'password123');
		await setPlan('cal-ak4-plus@example.com', 'plus');
		assert.equal((await post(plus, { url: icsUrl })).status, 201);
		assert.equal((await post(plus, { url: `${icsUrl}?b=1` })).status, 201, 'Plus erlaubt mehrere');
	});

	it('AK5: Termine und Quellen sind je Nutzer isoliert', async () => {
		const a = await server.register('cal-ak5-a@example.com', 'password123');
		const b = await server.register('cal-ak5-b@example.com', 'password123');
		const { id } = (await (await post(a, { url: icsUrl })).json()) as { id: number };
		assert.deepEqual(await events(b), []);
		const del = await server.json(`/calendar-sources/${id}`, { method: 'DELETE', headers: { Cookie: b } });
		assert.equal(del.status, 404, 'fremde Quelle ist unsichtbar');
		assert.equal((await events(a)).length, 1);
	});
});
