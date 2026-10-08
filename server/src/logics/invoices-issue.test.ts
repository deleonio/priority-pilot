import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import sequelize from '../database.js';
import Invoice from '../models/invoice.js';
import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { issueInvoiceForPeriod } from './invoices.js';

/**
 * Ergänzung der Impl-Phase zu #1495 AK8: die Spec-Phase hat `issueInvoiceForPeriod` vertraglich
 * festgelegt (`docs/spec/issue-1495.md`), aber nur die Nummernvergabe abgedeckt
 * (`invoices.test.ts`). Hier wird der Rechnungsinhalt geprüft — Betrag aus dem Paketkatalog, KEIN
 * Steuerausweis, §19-Hinweis, angestoßene Zustellung — sowie die Idempotenz je Abrechnungszeitraum.
 * Eigene Datei, weil `invoices.test.ts` die Sequelize-Verbindung in seinem `after()` schließt.
 */

describe('invoices.ts — issueInvoiceForPeriod (#1495 AK8)', () => {
	const now = new Date('2026-04-01T00:00:00Z');

	before(async () => {
		await sequelize.sync({ force: true });
	});

	after(async () => {
		await sequelize.close();
	});

	it('stellt genau eine Rechnung je Zeitraum aus, ohne Steuerausweis, und stößt die Zustellung an', async () => {
		const user = await User.create({ email: 'rechnung@example.com', displayName: 'Rechnung', passwordHash: 'x' });
		const subscription = await Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: 'I-INVOICE',
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-04-01T00:00:00Z'),
		});
		const sent: { subject: string; text: string }[] = [];

		const invoice = await issueInvoiceForPeriod(subscription, now, async (payload) => {
			sent.push({ subject: payload.subject, text: payload.text });
		});

		assert.equal(invoice.get('amountCents'), 899, 'Betrag kommt aus dem Paketkatalog (plans.ts)');
		assert.match(invoice.get('taxNote') as string, /§19 UStG/);
		assert.ok(!Object.keys(Invoice.getAttributes()).includes('taxRate'), 'Kein Steuersatz — §19 UStG');
		assert.equal(sent.length, 1, 'Die Rechnung muss zugestellt werden');
		assert.match(sent[0].text, /§19 UStG/);
		assert.ok(invoice.get('deliveredAt'), 'Nach erfolgreicher Zustellung ist deliveredAt gesetzt');

		const again = await issueInvoiceForPeriod(subscription, now, async () => {});
		assert.equal(again.get('id'), invoice.get('id'), 'Ein zweiter Lauf erzeugt keine zweite Rechnung');
	});

	// #2030 — Rechnungen mit gescheitertem Mailversand werden in Folgeläufen nachzugestellt.
	const makeSub = async (email: string, ext: string, periodEnd: string) => {
		const user = await User.create({ email, displayName: 'Nachholen', passwordHash: 'x' });
		return Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: ext,
			plan: 'pro',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date(periodEnd),
		});
	};
	const failing = async () => {
		throw new Error('SMTP down');
	};
	type Sent = { subject: string; attachments?: { content: unknown }[] };

	it('App-Sprache en: englische Rechnungsmail, das PDF bleibt der deutsche Beleg', async () => {
		const user = await User.create({
			email: 'invoice-en@example.com',
			displayName: 'En',
			passwordHash: 'x',
			sprache: 'en',
		});
		const subscription = await Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: 'I-INVOICE-EN',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-04-01T00:00:00Z'),
		});
		const sent: { subject: string; text: string }[] = [];
		await issueInvoiceForPeriod(subscription, now, async (payload) => {
			sent.push({ subject: payload.subject, text: payload.text });
		});
		assert.match(sent[0].subject, /^Your invoice /);
		assert.match(sent[0].text, /Plan: Plus \(monthly\)/);
		assert.match(sent[0].text, /issued in German/);
	});

	it('#2030 AK1: unzugestellte Rechnung wird im Folgelauf erneut versendet (gleiche Nummer, gleiche PDF-Bytes)', async () => {
		const sub = await makeSub('retry@example.com', 'I-RETRY', '2026-04-01T00:00:00Z');
		const first = await issueInvoiceForPeriod(sub, now, failing);
		assert.ok(!first.get('deliveredAt'), 'Nach Mailfehler bleibt deliveredAt leer');
		const pdf = Buffer.from((first.get({ plain: true }) as { pdfBytes: Uint8Array }).pdfBytes);

		const sent: Sent[] = [];
		const second = await issueInvoiceForPeriod(sub, now, async (p) => {
			sent.push(p as Sent);
		});

		assert.equal(sent.length, 1, 'Der Folgelauf muss die Rechnung erneut zustellen');
		assert.match(sent[0].subject, new RegExp(String(first.get('number'))), 'Gleiche Rechnungsnummer');
		assert.ok(Buffer.from(sent[0].attachments![0].content as Uint8Array).equals(pdf), 'PDF-Bytes unverändert');
		assert.equal(second.get('id'), first.get('id'));
		assert.ok(second.get('deliveredAt'), 'deliveredAt nach gelungener Zustellung gesetzt');
		assert.equal(await Invoice.count({ where: { subscriptionId: sub.get('id') as number } }), 1);
	});

	it('#2030 AK1: scheitert der Nachversand erneut, bleibt deliveredAt leer', async () => {
		const sub = await makeSub('retry2@example.com', 'I-RETRY2', '2026-04-01T00:00:00Z');
		await issueInvoiceForPeriod(sub, now, failing);
		const again = await issueInvoiceForPeriod(sub, now, failing);
		assert.ok(!again.get('deliveredAt'));
	});

	it('#2030 AK2: zugestellte Rechnung wird im Folgelauf nicht erneut versendet', async () => {
		const sub = await makeSub('done@example.com', 'I-DONE', '2026-04-01T00:00:00Z');
		await issueInvoiceForPeriod(sub, now, async () => {});
		let calls = 0;
		await issueInvoiceForPeriod(sub, now, async () => {
			calls++;
		});
		assert.equal(calls, 0);
	});

	it('#2030 AK3: Lauf für neuere Periode stellt ältere unzugestellte Rechnungen desselben Abos nach', async () => {
		const sub = await makeSub('older@example.com', 'I-OLDER', '2026-04-01T00:00:00Z');
		const old = await issueInvoiceForPeriod(sub, now, failing);
		await sub.update({ currentPeriodEnd: new Date('2026-05-01T00:00:00Z') });

		const sent: Sent[] = [];
		const next = await issueInvoiceForPeriod(sub, new Date('2026-05-01T00:00:00Z'), async (p) => {
			sent.push(p as Sent);
		});

		assert.equal(sent.length, 2, 'Neue Rechnung plus nachgeholte ältere');
		await old.reload();
		assert.ok(old.get('deliveredAt'), 'Ältere Rechnung ist nachgestellt');
		assert.ok(next.get('deliveredAt'));
		assert.notEqual(old.get('number'), next.get('number'));
	});

	// #2031 AK1 — Label „Paket <Plan> (<deutscher Zeitraum>)“ an allen drei Anzeigeorten
	// (Mailzeile, Rechnungsposition, PDF-Leistungszeile); die Katalog-Schlüssel bleiben englisch.
	const LABEL_COMBOS = [
		['plus', 'monthly', 'Plus (monatlich)'],
		['plus', 'quarterly', 'Plus (vierteljährlich)'],
		['plus', 'yearly', 'Plus (jährlich)'],
		['pro', 'monthly', 'Pro (monatlich)'],
		['pro', 'quarterly', 'Pro (vierteljährlich)'],
		['pro', 'yearly', 'Pro (jährlich)'],
	] as const;

	it('#2031 AK1: Mailzeile und Rechnungsposition nennen Paket und Zeitraum deutsch (alle Kombinationen)', async () => {
		for (const [plan, period, display] of LABEL_COMBOS) {
			const user = await User.create({
				email: `label-${plan}-${period}@example.com`,
				displayName: 'Label',
				passwordHash: 'x',
			});
			const subscription = await Subscription.create({
				userId: user.get('id') as number,
				provider: 'paypal',
				externalSubscriptionId: `I-LABEL-${plan}-${period}`,
				plan,
				period,
				status: 'active',
				currentPeriodEnd: new Date('2026-04-01T00:00:00Z'),
				creditCents: 100,
			});
			const sent: { text: string }[] = [];
			const invoice = await issueInvoiceForPeriod(subscription, now, async (payload) => {
				sent.push({ text: payload.text });
			});
			assert.ok(
				sent[0]?.text.includes(`Paket: ${display}`),
				`Mailzeile für ${plan}/${period} muss "${display}" zeigen`,
			);
			const lineItems = invoice.get('lineItems') as { label: string }[];
			assert.equal(lineItems[0]?.label, `Paket ${display}`, `Rechnungsposition für ${plan}/${period}`);
		}
	});

	it('#2031 AK1: gespeichertes PDF trägt das deutsche Label in der Leistungsposition', async () => {
		const user = await User.create({ email: 'label-pdf@example.com', displayName: 'Label', passwordHash: 'x' });
		const subscription = await Subscription.create({
			userId: user.get('id') as number,
			provider: 'paypal',
			externalSubscriptionId: 'I-LABEL-PDF',
			plan: 'plus',
			period: 'monthly',
			status: 'active',
			currentPeriodEnd: new Date('2026-04-01T00:00:00Z'),
		});
		const invoice = await issueInvoiceForPeriod(subscription, now, async () => {});
		const pdf = Buffer.from((invoice.get({ plain: true }) as { pdfBytes: Uint8Array }).pdfBytes);
		// Streams sind Flate-komprimiert (pdf-lib). Die eingebettete Unicode-Schrift (#2233) schreibt
		// Glyph-IDs statt Zeichen — das Label wird über die ToUnicode-CMap in Glyph-IDs übersetzt.
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
				return Array.from('Paket Plus (monatlich)', (char) => glyphIds.get(char) ?? '?').join('');
			});
		assert.ok(
			hexes.some((hex) => streams.some((stream) => stream.includes(`<${hex}>`))),
			'Die PDF-Leistungszeile muss das deutsche Label tragen',
		);
	});
});
