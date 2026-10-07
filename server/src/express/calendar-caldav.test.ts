import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
import { CalendarSource, User } from '../models/index.js';
import { runCalendarSync } from '../logics/calendar-ics.js';
import { decryptSecret, encryptSecret } from '../logics/secret-crypto.js';

/**
 * Rote Spec-Tests für #2211 (Spec docs/spec/issue-2211.md): Kalenderquellen per CalDAV.
 * AK1 Abruf+Fenster (Anlegen und Sync), AK2 Passwort verschlüsselt/nie in Antworten, AK3 nur REPORT/PROPFIND/GET,
 * AK4 Löschen, AK5 ohne Env-Schlüssel abgelehnt, AK6 Paketgrenze. Rot, bis CalDAV-Quellen angelegt werden können.
 * Der CalDAV-Server ist ein lokaler HTTP-Stub (PROPFIND/REPORT → 207 Multistatus).
 */

applyTestAuthEnv('test-secret-issue-2211');

const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = 'app-passwort-geheim-2211';
const USER = 'max@example.org';
const stamp = (d: Date): string =>
	d
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
const vevent = (title: string, offsetDays: number): string => {
	const start = new Date(Date.now() + offsetDays * DAY);
	return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${title}@test\r\nDTSTART:${stamp(start)}\r\nDTEND:${stamp(new Date(start.getTime() + 3600_000))}\r\nSUMMARY:${title}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
};

let server: TestServer;
let dav: http.Server;
let davUrl = '';
let calendars: string[] = [];
const requests: { method: string; authorization: string | undefined }[] = [];

const multistatus = (): string => {
	const items = calendars
		.map(
			(ics, i) =>
				`<d:response><d:href>/dav/cal/${i}.ics</d:href><d:propstat><d:prop><d:getetag>"${i}"</d:getetag><c:calendar-data><![CDATA[${ics}]]></c:calendar-data><d:resourcetype><d:collection/><c:calendar/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`,
		)
		.join('');
	return `<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${items}</d:multistatus>`;
};

const post = (cookie: string, body: unknown): Promise<Response> =>
	server.json('/calendar-sources', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookie },
		body: JSON.stringify(body),
	});
const caldav = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
	type: 'caldav',
	url: davUrl,
	username: USER,
	password: PASSWORD,
	name: 'Dienst',
	...extra,
});
const titles = async (cookie: string): Promise<string[]> =>
	((await (await server.json('/calendar-events', { headers: { Cookie: cookie } })).json()) as { title: string }[]).map(
		(e) => e.title,
	);
const setPlan = async (email: string, plan: string): Promise<void> => {
	const user = await User.findOne({ where: { email } });
	assert.ok(user, 'Setup: Nutzer muss existieren');
	await (user as unknown as { update: (v: Record<string, unknown>) => Promise<unknown> }).update({ plan });
};

describe('Kalenderquellen per CalDAV (#2211)', () => {
	before(async () => {
		server = await startTestServer();
		dav = http.createServer((req, res) => {
			requests.push({ method: req.method ?? '', authorization: req.headers.authorization });
			req.resume();
			if (req.method === 'PROPFIND' || req.method === 'REPORT') {
				res.statusCode = 207;
				res.setHeader('Content-Type', 'application/xml; charset=utf-8');
				res.end(multistatus());
			} else if (req.method === 'GET') {
				res.setHeader('Content-Type', 'text/calendar');
				res.end(calendars[0] ?? '');
			} else {
				res.statusCode = 405;
				res.end();
			}
		});
		await new Promise<void>((resolve) => dav.listen(0, '127.0.0.1', resolve));
		davUrl = `http://127.0.0.1:${(dav.address() as AddressInfo).port}/dav/cal/`;
	});

	beforeEach(async () => {
		await resetDb();
		process.env.CALDAV_ENCRYPTION_KEY = 'test-key-2211';
		requests.length = 0;
		calendars = [vevent('Dienst', 1)];
	});

	after(async () => {
		delete process.env.CALDAV_ENCRYPTION_KEY;
		await new Promise<void>((resolve) => dav.close(() => resolve()));
		if (server) await server.close();
		await closeDb();
	});

	it('AK1/AK3: POST legt die CalDAV-Quelle an, speichert nur Termine im Fenster, sendet nur erlaubte Methoden mit Basic-Auth', async () => {
		calendars = [vevent('innen', 2), vevent('vorbei', -5), vevent('weit', 30)];
		const cookie = await server.register('cd-ak1@example.com', 'password123');
		const res = await post(cookie, caldav());
		assert.equal(res.status, 201);
		assert.deepEqual(await titles(cookie), ['innen']);
		const methods = new Set(requests.map((r) => r.method));
		assert.ok(methods.has('REPORT'), 'Termine kommen per REPORT calendar-query');
		for (const method of methods)
			assert.ok(['PROPFIND', 'REPORT', 'GET'].includes(method), `verbotene Methode ${method}`);
		const expected = `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`;
		assert.ok(requests.every((r) => r.authorization === expected));
	});

	it('AK1: der Sync-Lauf ruft CalDAV-Quellen ab und ersetzt den Bestand', async () => {
		const cookie = await server.register('cd-sync@example.com', 'password123');
		assert.equal((await post(cookie, caldav())).status, 201);
		calendars = [vevent('neu', 3)];
		requests.length = 0;
		await runCalendarSync();
		assert.deepEqual(await titles(cookie), ['neu']);
		assert.ok(requests.length > 0 && requests.every((r) => ['PROPFIND', 'REPORT', 'GET'].includes(r.method)));
	});

	it('AK1: der Sync-Lauf entschlüsselt ein gespeichertes Passwort (Basic-Auth mit Klartext)', async () => {
		const cookie = await server.register('cd-sync2@example.com', 'password123');
		const user = await User.findOne({ where: { email: 'cd-sync2@example.com' } });
		await CalendarSource.create({
			userId: user!.id,
			name: 'Direkt',
			type: 'caldav',
			url: davUrl,
			username: USER,
			passwordEncrypted: encryptSecret(PASSWORD),
		});
		await runCalendarSync();
		assert.deepEqual(await titles(cookie), ['Dienst']);
		assert.ok(
			requests.every((r) => r.authorization === `Basic ${Buffer.from(`${USER}:${PASSWORD}`).toString('base64')}`),
		);
	});

	it('AK2: Passwort steht nur verschlüsselt in der DB und in keiner Antwort (Anlegen, Liste)', async () => {
		const cookie = await server.register('cd-ak2@example.com', 'password123');
		const created = await post(cookie, caldav());
		const createdText = JSON.stringify(await created.json());
		const list = await server.json('/calendar-sources', { headers: { Cookie: cookie } });
		const listText = JSON.stringify(await list.json());
		for (const text of [createdText, listText]) {
			assert.ok(!text.includes(PASSWORD), 'Passwort in der Antwort');
			assert.ok(!text.includes(davUrl), 'Adresse in der Antwort');
			assert.ok(!text.includes(USER), 'Benutzername in der Antwort');
		}
		assert.ok(JSON.parse(listText)[0].type === 'caldav');
		const source = await CalendarSource.findOne();
		const stored = source!.get('passwordEncrypted') as string;
		assert.ok(typeof stored === 'string' && stored.length > 0 && !stored.includes(PASSWORD), 'Spalte ohne Klartext');
		assert.equal(decryptSecret(stored), PASSWORD);
		assert.ok(!JSON.stringify(source!.toJSON()).includes(PASSWORD), 'kein Klartext im Modell');
	});

	it('AK4: DELETE entfernt Quelle samt Zugangsdaten und Termine', async () => {
		const cookie = await server.register('cd-ak4@example.com', 'password123');
		const { id } = (await (await post(cookie, caldav())).json()) as { id: number };
		const del = await server.json(`/calendar-sources/${id}`, { method: 'DELETE', headers: { Cookie: cookie } });
		assert.equal(del.status, 204);
		assert.equal(await CalendarSource.count(), 0);
		assert.deepEqual(await titles(cookie), []);
	});

	it('AK5: ohne Env-Schlüssel wird CalDAV klar abgelehnt, ICS bleibt nutzbar', async () => {
		delete process.env.CALDAV_ENCRYPTION_KEY;
		const cookie = await server.register('cd-ak5@example.com', 'password123');
		const res = await post(cookie, caldav());
		assert.equal(res.status, 400);
		assert.match(((await res.json()) as { message: string }).message, /caldav/i);
		assert.equal(await CalendarSource.count(), 0);
		assert.equal(requests.length, 0, 'kein Abruf ohne Schlüssel');
		assert.equal((await post(cookie, { url: davUrl, name: 'ICS' })).status, 201);
	});

	it('AK6: CalDAV- und ICS-Quellen zählen gemeinsam zur Paketgrenze', async () => {
		const free = await server.register('cd-ak6-free@example.com', 'password123');
		assert.equal((await post(free, caldav())).status, 201);
		assert.equal((await post(free, { url: `${davUrl}?b=1` })).status, 403, 'ICS nach CalDAV im Free-Paket');
		const free2 = await server.register('cd-ak6-free2@example.com', 'password123');
		assert.equal((await post(free2, { url: davUrl })).status, 201);
		assert.equal((await post(free2, caldav())).status, 403, 'CalDAV nach ICS im Free-Paket');
		const plus = await server.register('cd-ak6-plus@example.com', 'password123');
		await setPlan('cd-ak6-plus@example.com', 'plus');
		assert.equal((await post(plus, caldav())).status, 201);
		assert.equal((await post(plus, caldav({ name: 'Zwei' }))).status, 201, 'Plus erlaubt mehrere');
	});
});
