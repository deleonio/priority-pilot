import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, applyTestAuthEnv, type TestServer } from '../test/helpers.js';
// Rote Spec-Tests für #2041 (AK1-AK4) — Vertrag: docs/spec/issue-2041.md.
// Der Zähler lebt im Prozess und `resetDb` vergibt Nutzer-IDs neu: DB deshalb nur einmal
// zurücksetzen und je Test frische Nutzer/Adressen verwenden, damit der Zähler nicht durchschlägt.
// Das Limit (ACCESS_MAIL_DAILY_LIMIT) ist hier bewusst als Literal gespiegelt (Spec: 10).
applyTestAuthEnv('access-mail-throttle-test');

const LIMIT = 10;
let server: TestServer;
let counter = 0;

type Json = Record<string, unknown>;

const post = (path: string, cookie: string, body: unknown) =>
	fetch(`${server.baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', cookie },
		body: JSON.stringify(body),
	});

/** Frischer, zugelassener Nutzer mit eigener Gruppe. */
const freshUser = async () => {
	counter += 1;
	const { AllowedEmail } = await import('../models/allowedEmail.js');
	const email = `absender${counter}@beispiel.de`;
	await AllowedEmail.create({ email, origin: 'admin' });
	const cookie = await server.login(email, { displayName: `Absender ${counter}`, role: 'admin' });
	const groupRes = await post('/groups', cookie, { name: `Gruppe ${counter}` });
	assert.equal(groupRes.status, 201, 'Setup: Gruppe muss anlegbar sein');
	const group = (await groupRes.json()) as { id: number };
	return { cookie, groupId: group.id };
};

const newAddress = () => {
	counter += 1;
	return `neu${counter}@beispiel.de`;
};

const tokenCount = async (email: string) => {
	const { default: LoginToken } = await import('../models/loginToken.js');
	return LoginToken.count({ where: { email } });
};

const invite = (user: { cookie: string; groupId: number }, email: string) =>
	post(`/groups/${user.groupId}/invitations`, user.cookie, { email });

/** Verbraucht das Kontingent des Nutzers über Einladungen an neue Adressen. */
const exhaust = async (user: { cookie: string; groupId: number }) => {
	for (let i = 0; i < LIMIT; i += 1) {
		const email = newAddress();
		const res = await invite(user, email);
		assert.equal(res.status, 201, `Setup: Einladung ${i + 1} muss gelingen`);
		assert.equal(await tokenCount(email), 1, `Setup: Mail ${i + 1} unterhalb der Grenze muss rausgehen`);
	}
};

describe('Zugangs-Mails drosseln (#2041)', () => {
	before(async () => {
		process.env.SMTP_HOST = 'smtp.test';
		process.env.MAIL_FROM = 'test@balamentum.de';
		process.env.PUBLIC_BASE_URL = 'https://test';
		server = await startTestServer();
		await resetDb();
	});
	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	it('Einladung: nach dem Limit keine weitere Mail, Einladung + Freischaltung bleiben, Feld gesetzt (AK1/AK2)', async () => {
		const user = await freshUser();
		await exhaust(user);

		const email = newAddress();
		const res = await invite(user, email);
		assert.equal(res.status, 201);
		const body = (await res.json()) as Json;
		assert.equal(body.accessMailThrottled, true, 'Antwort muss die Drosselung melden');
		assert.equal(await tokenCount(email), 0, 'an der Grenze darf keine Zugangs-Mail entstehen');
		const { isDbEmailAllowed } = await import('../logics/allowedEmails.js');
		assert.equal(await isDbEmailAllowed(email), true, 'Adresse bleibt freigeschaltet');
	});

	it('unterhalb der Grenze fehlt das Drossel-Feld (AK2)', async () => {
		const user = await freshUser();
		const res = await invite(user, newAddress());
		assert.equal(res.status, 201);
		const body = (await res.json()) as Json;
		assert.ok(!body.accessMailThrottled, 'ohne Drosselung kein Feld bzw. false');
	});

	it('Zähler ist über Einladung, POST /tasks und PATCH geteilt (AK1/AK2)', async () => {
		const user = await freshUser();
		const taskRes = await post('/tasks', user.cookie, { title: 'Vorab-Aufgabe' });
		assert.equal(taskRes.status, 201, 'Setup: Aufgabe ohne Empfänger');
		const task = (await taskRes.json()) as { id: number };
		await exhaust(user);

		const postEmail = newAddress();
		const postRes = await post('/tasks', user.cookie, { title: 'Blumen gießen', recipientEmail: postEmail });
		assert.equal(postRes.status, 201);
		assert.equal(((await postRes.json()) as Json).accessMailThrottled, true, 'POST /tasks meldet Drosselung');
		assert.equal(await tokenCount(postEmail), 0);
		const { isDbEmailAllowed } = await import('../logics/allowedEmails.js');
		assert.equal(await isDbEmailAllowed(postEmail), true, 'Delegation bleibt freigeschaltet');

		const patchEmail = newAddress();
		const patchRes = await fetch(`${server.baseUrl}/tasks/${task.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie: user.cookie },
			body: JSON.stringify({ recipientEmail: patchEmail }),
		});
		assert.equal(patchRes.status, 200);
		assert.equal(((await patchRes.json()) as Json).accessMailThrottled, true, 'PATCH meldet Drosselung');
		assert.equal(await tokenCount(patchEmail), 0);
		assert.equal(await isDbEmailAllowed(patchEmail), true);
	});

	it('Limit gilt je Nutzer: ein zweiter Nutzer versendet weiter (AK3)', async () => {
		const a = await freshUser();
		await exhaust(a);
		const b = await freshUser();

		const email = newAddress();
		const res = await invite(b, email);
		assert.equal(res.status, 201);
		assert.ok(!((await res.json()) as Json).accessMailThrottled, 'anderer Nutzer ist nicht gedrosselt');
		assert.equal(await tokenCount(email), 1, 'Mail des zweiten Nutzers geht raus');
	});

	it('Einladungen an bestehende Konten zählen nicht mit und bleiben ohne Feld (AK4)', async () => {
		const user = await freshUser();
		const existing: string[] = [];
		for (let i = 0; i < LIMIT; i += 1) {
			const email = newAddress();
			const { AllowedEmail } = await import('../models/allowedEmail.js');
			await AllowedEmail.create({ email, origin: 'admin' });
			await server.login(email);
			existing.push(email);
		}
		for (const email of existing) {
			const res = await invite(user, email);
			assert.equal(res.status, 201);
			assert.ok(!((await res.json()) as Json).accessMailThrottled);
		}
		// Kontingent ist trotz 10 Einladungen an bestehende Konten unberührt: eine neue Adresse bekommt Mail.
		const fresh = newAddress();
		const res = await invite(user, fresh);
		assert.equal(res.status, 201);
		assert.equal(await tokenCount(fresh), 1, 'bestehende Konten haben kein Kontingent verbraucht');

		// An der Grenze bleibt die Einladung an ein bestehendes Konto ohne Drossel-Feld.
		const other = await freshUser();
		await exhaust(other);
		const accountEmail = newAddress();
		const { AllowedEmail } = await import('../models/allowedEmail.js');
		await AllowedEmail.create({ email: accountEmail, origin: 'admin' });
		await server.login(accountEmail);
		const limitRes = await invite(other, accountEmail);
		assert.equal(limitRes.status, 201);
		assert.ok(!((await limitRes.json()) as Json).accessMailThrottled, 'Konto-Einladung an der Grenze ohne Feld');
	});
});
