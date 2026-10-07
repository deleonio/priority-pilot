import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import sequelize from '../database.js';
import Invoice from '../models/invoice.js';
import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { issueCreditNote, issueInvoiceForPeriod } from './invoices.js';

/**
 * Rote Spec-Tests für #2329 AK3-AK5 (Spec docs/spec/issue-2329.md): die erste Rechnung zu einem Abo mit
 * gespeicherter Zustimmung (`withdrawalConsentAt`) trägt in PDF und Mail die Vertragsbestätigung.
 * Folgerechnungen, Gutschriften und Abos ohne Zustimmung nicht. KEIN Produktivcode.
 */

const CONSENT = new Date('2026-03-15T10:00:00Z');
const now = new Date('2026-04-01T00:00:00Z');
type Sent = { text: string };

let counter = 0;
const makeSub = async (consentAt: Date | null) => {
	counter++;
	const user = await User.create({ email: `consent${counter}@example.com`, displayName: 'Ada', passwordHash: 'x' });
	return Subscription.create({
		userId: user.get('id') as number,
		provider: 'paypal',
		externalSubscriptionId: `I-CONSENT-${counter}`,
		plan: 'plus',
		period: 'monthly',
		status: 'active',
		currentPeriodEnd: new Date('2026-04-01T00:00:00Z'),
		withdrawalConsentAt: consentAt,
	} as never);
};

/** Wahr, wenn eine PDF-Textzeile `text` enthält (Glyph-IDs über die ToUnicode-CMap, Muster invoices-issue.test.ts). */
const pdfHas = (invoice: Invoice, text: string): boolean => {
	const pdf = Buffer.from((invoice.get({ plain: true }) as { pdfBytes: Uint8Array }).pdfBytes);
	const streams: string[] = [];
	for (let i = pdf.indexOf('stream\n'); i !== -1; i = pdf.indexOf('>>\nstream\n', i + 1)) {
		const start = pdf.indexOf('stream\n', i) + 7;
		streams.push(zlib.inflateSync(pdf.subarray(start, pdf.indexOf('endstream', start))).toString('latin1'));
	}
	// Regular und Fett sind getrennte Schriften mit eigener CMap — jede Variante prüfen.
	const hexes = streams
		.filter((stream) => stream.includes('beginbfchar'))
		.map((cmap) => {
			const glyphIds = new Map(
				[...cmap.matchAll(/<([0-9A-F]{4})> <([0-9A-F]{4})>/g)].map(([, gid, code]) => [
					String.fromCharCode(parseInt(code, 16)),
					gid,
				]),
			);
			return Array.from(text, (char) => glyphIds.get(char) ?? '?').join('');
		})
		.filter((hex) => !hex.includes('?'));
	return hexes.some((hex) => streams.some((stream) => stream.includes(hex)));
};

describe('Vertragsbestätigung auf der ersten Rechnung (#2329)', () => {
	before(async () => {
		await sequelize.sync({ force: true });
	});

	after(async () => {
		await sequelize.close();
	});

	it('AK3: PDF der ersten Rechnung enthält Überschrift, Zustimmungsdatum und /widerruf/-Link', async () => {
		const sub = await makeSub(CONSENT);
		const invoice = await issueInvoiceForPeriod(sub, now, async () => {});

		assert.ok(pdfHas(invoice, 'Vertragsbestätigung'), 'Überschrift Vertragsbestätigung');
		assert.ok(pdfHas(invoice, '2026-03-15'), 'Datum der Zustimmung');
		assert.ok(pdfHas(invoice, '/widerruf/'), 'Link auf /widerruf/');
	});

	it('AK4: Mail der ersten Rechnung nennt Paket, Preis, Zustimmungsdatum und /widerruf/-Link', async () => {
		const sub = await makeSub(CONSENT);
		const sent: Sent[] = [];
		await issueInvoiceForPeriod(sub, now, async (p) => {
			sent.push(p as Sent);
		});

		assert.equal(sent.length, 1);
		const text = sent[0].text;
		assert.match(text, /Vertragsbestätigung/);
		assert.match(text, /Plus \(monatlich\)/, 'Paket und Laufzeit');
		assert.match(text, /4[,.]99/, 'Preis (plus monatlich = 499 Cent, plans.ts)');
		assert.match(text, /2026-03-15/, 'Datum der Zustimmung');
		assert.match(text, /\/widerruf\//, 'Link auf /widerruf/');
	});

	it('AK4: der Nachholversand der ersten Rechnung trägt denselben Absatz', async () => {
		const sub = await makeSub(CONSENT);
		await issueInvoiceForPeriod(sub, now, async () => {
			throw new Error('SMTP down');
		});
		const sent: Sent[] = [];
		await issueInvoiceForPeriod(sub, now, async (p) => {
			sent.push(p as Sent);
		});

		assert.equal(sent.length, 1);
		assert.match(sent[0].text, /Vertragsbestätigung/);
		assert.match(sent[0].text, /2026-03-15/);
	});

	it('AK5: Folgerechnung (PDF und Mail) enthält den Absatz nicht', async () => {
		const sub = await makeSub(CONSENT);
		await issueInvoiceForPeriod(sub, now, async () => {});
		await sub.update({ currentPeriodEnd: new Date('2026-05-01T00:00:00Z') });
		const sent: Sent[] = [];
		const second = await issueInvoiceForPeriod(sub, new Date('2026-05-01T00:00:00Z'), async (p) => {
			sent.push(p as Sent);
		});

		assert.equal(sent.length, 1);
		assert.doesNotMatch(sent[0].text, /Vertragsbest/);
		assert.ok(!pdfHas(second, 'Vertragsbest'), 'PDF der Folgerechnung ohne Absatz');
	});

	it('AK5: Abo ohne gespeicherte Zustimmung bekommt keinen Absatz', async () => {
		const sub = await makeSub(null);
		const sent: Sent[] = [];
		const invoice = await issueInvoiceForPeriod(sub, now, async (p) => {
			sent.push(p as Sent);
		});

		assert.doesNotMatch(sent[0].text, /Vertragsbest/);
		assert.ok(!pdfHas(invoice, 'Vertragsbest'));
	});

	it('AK5: Gutschrift zur ersten Rechnung enthält den Absatz nicht', async () => {
		const sub = await makeSub(CONSENT);
		const original = await issueInvoiceForPeriod(sub, now, async () => {});
		const sent: Sent[] = [];
		const credit = await issueCreditNote(original, now, undefined, async (p) => {
			sent.push(p as Sent);
		});

		assert.equal(sent.length, 1);
		assert.doesNotMatch(sent[0].text, /Vertragsbest/);
		assert.ok(!pdfHas(credit, 'Vertragsbest'));
	});
});
