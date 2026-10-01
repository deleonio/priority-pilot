import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { sendAccountAccessMail } from './accessMail.js';
import type { MailSender } from './mail.js';
import { resetDb, closeDb } from '../test/helpers.js';

// #1983 AK4/AK5: Die Benachrichtigung an eine neue Adresse ist eine E-Mail mit direktem
// Konto-Zugang (Magic-Link-Muster). Versand wird am injizierten Sender geprüft.
process.env.SMTP_HOST = 'smtp.test';
process.env.MAIL_FROM = 'test@balamentum.de';
process.env.PUBLIC_BASE_URL = 'https://test';

interface SentMail {
	to: string;
	subject: string;
	text: string;
}

describe('sendAccountAccessMail (#1983 AK4)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	after(async () => {
		await closeDb();
	});

	it('verschickt eine Mail mit Betreff und Zugangs-URL an die neue Adresse', async () => {
		const sent: SentMail[] = [];
		const sender: MailSender = async (payload) => {
			sent.push({ to: payload.to, subject: payload.subject, text: payload.text });
		};

		const ok = await sendAccountAccessMail(
			'neu@beispiel.de',
			{
				subject: 'Einladung zur Gruppe „Familie" bei Balamentum',
				lines: ['Alice lädt dich ein, in Balamentum die Gruppe „Familie" zu teilen.'],
			},
			sender,
		);

		assert.equal(ok, true, 'Versand muss erfolgreich sein');
		assert.equal(sent.length, 1);
		assert.equal(sent[0].to, 'neu@beispiel.de');
		assert.equal(sent[0].subject, 'Einladung zur Gruppe „Familie" bei Balamentum');
		assert.match(sent[0].text, /Konto öffnen und Passwort setzen/);
		assert.match(sent[0].text, /https:\/\/test\/app\/\?magic=/);
	});

	it('ohne konfigurierten Magic-Link wird nichts versendet', async () => {
		const savedBaseUrl = process.env.PUBLIC_BASE_URL;
		delete process.env.PUBLIC_BASE_URL;
		try {
			const sent: SentMail[] = [];
			const ok = await sendAccountAccessMail('neu@beispiel.de', { subject: 'Betreff', lines: [] }, async (payload) => {
				sent.push({ to: payload.to, subject: payload.subject, text: payload.text });
			});
			assert.equal(ok, false);
			assert.equal(sent.length, 0);
		} finally {
			process.env.PUBLIC_BASE_URL = savedBaseUrl;
		}
	});
});
