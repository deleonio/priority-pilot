import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import type { SendResult } from 'web-push';
import { Invoice, NotificationLog, PushSubscription, Subscription, User } from '../models/index.js';
import { resetDb, closeDb } from '../test/helpers.js';
import { GRACE_PERIOD_DAYS } from './billing/lifecycle.js';
import { ABO_PUSH_TEXTE, runAboServicePush } from './aboPush.js';
import type { PushSender } from './push.js';

/**
 * Rote Spec-Tests für #2852 (Spec docs/spec/issue-2852.md) — zustandsbasierter Abo-/Rechnungs-
 * Service-Sweep. AK1 neue Rechnung/Gutschrift, AK2 fehlgeschlagene Zahlung, AK3 Kulanz-Erinnerung,
 * AK4 Ruhezeit mit Nachholung, AK5 Abo-Ende, AK6 Texte de/en ohne Werbesatz.
 * `aboPush.ts` existiert noch nicht — der fehlende Modul-Import ist der legitime erste Rot-Zustand.
 * Muster: `monthlyRecapPush.test.ts` (injizierbare Uhr, injizierbarer PushSender, Dedupe über
 * NotificationLog erst bei sent > 0), Ruhezeit-Gate `istRuhezeit` (`carePush.ts`).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** 10:00 UTC — Tagesfenster (7–21), Zeitzone des Testnutzers: UTC (Fallback ohne gesetzte Zone). */
const NOW = new Date('2026-10-21T10:00:00Z');

/** Empfänger mit Push-Subscription (ohne PushSubscription: sent = 0, kein Log — Muster streakReminder). */
const seedEmpfaenger = async (email: string, extra: Record<string, unknown> = {}) => {
	const user = await User.create({
		email,
		displayName: 'Abo',
		passwordHash: '__test__',
		...extra,
	} as never);
	await PushSubscription.create({
		endpoint: `https://push.example.com/${user.id}`,
		p256dh: 'p256dh',
		auth: 'auth',
		expirationTime: null,
		userId: user.id,
	});
	return user;
};

const seedAbo = async (userId: number, status: string, extra: Record<string, unknown> = {}): Promise<Subscription> =>
	Subscription.create({
		userId,
		provider: 'paypal',
		externalSubscriptionId: `I-2852-${userId}`,
		plan: 'plus',
		period: 'monthly',
		status,
		currentPeriodEnd: new Date(NOW.getTime() + 20 * DAY_MS),
		...extra,
	});

const seedRechnung = async (
	userId: number,
	subscriptionId: number,
	createdAt: Date,
	extra: Record<string, unknown> = {},
) =>
	Invoice.create({
		userId,
		subscriptionId,
		number: `INV-2026-2852-${userId}`,
		periodStart: new Date(createdAt.getTime() - 30 * DAY_MS),
		periodEnd: createdAt,
		amountCents: 799,
		createdAt,
		...extra,
	});

// Test-Pflege (#1995): `PushSender` erhält die Wire-Payload als STRING — erst JSON.parse macht
// die Felder auswertbar.
const okSender =
	(calls: string[]): PushSender =>
	(_subscription, payload) => {
		calls.push(payload);
		return Promise.resolve({ statusCode: 201, body: '', headers: {} } as SendResult);
	};

const payloads = (calls: string[]) =>
	calls.map((call) => JSON.parse(call) as { title?: string; body?: string; url?: string });

const logCount = () => NotificationLog.count();

describe('runAboServicePush (#2852)', () => {
	beforeEach(resetDb);
	after(closeDb);

	// AK1 — neue Rechnung: genau ein Push mit Rechnungen-Anker, Idempotenz über NotificationLog.
	it('AK1: sendet je neuer Rechnung genau einen Push mit url /settings/pakete#rechnungen; zweiter Lauf sendet nichts', async () => {
		const user = await seedEmpfaenger('rechnung@example.com');
		const abo = await seedAbo(user.id, 'active');
		await seedRechnung(user.id, abo.id, new Date(NOW.getTime() - 1 * DAY_MS));
		const calls: string[] = [];

		const ergebnis = await runAboServicePush(NOW, okSender(calls));

		assert.equal(ergebnis.sends, 1);
		const payload = payloads(calls)[0]!;
		assert.equal(payload.url, '/settings/pakete#rechnungen', 'Rechnungs-Push muss zum Rechnungen-Anker führen');

		const erneut = await runAboServicePush(NOW, okSender(calls));
		assert.equal(erneut.sends, 0, 'Zweiter Lauf darf nicht erneut senden (NotificationLog-Dedupe)');
		assert.equal(calls.length, 1);
		assert.equal(await logCount(), 1, 'Genau ein Log-Eintrag je zugestelltem Rechnungs-Push');
	});

	// AK1 — Gutschrift erhält denselben Rechnungs-Push.
	it('AK1: sendet auch bei einer Gutschrift (creditForInvoiceId) genau einen Push', async () => {
		const user = await seedEmpfaenger('gutschrift@example.com');
		const abo = await seedAbo(user.id, 'active');
		const original = await seedRechnung(user.id, abo.id, new Date(NOW.getTime() - 30 * DAY_MS));
		await seedRechnung(user.id, abo.id, new Date(NOW.getTime() - 1 * DAY_MS), {
			creditForInvoiceId: original.id,
			paymentStatus: 'refunded',
			amountCents: -799,
		});
		const calls: string[] = [];

		const ergebnis = await runAboServicePush(NOW, okSender(calls));

		assert.equal(ergebnis.sends, 1);
		assert.equal(payloads(calls)[0]!.url, '/settings/pakete#rechnungen');
	});

	// AK1 — Rückstands-Schutz: Rechnungen älter als 7 Tage erhalten keinen Push mehr.
	it('AK1: Rechnung älter als 7 Tage erhält keinen Push mehr (Rückstands-Schutz)', async () => {
		const user = await seedEmpfaenger('alt@example.com');
		const abo = await seedAbo(user.id, 'active');
		await seedRechnung(user.id, abo.id, new Date(NOW.getTime() - 8 * DAY_MS));
		const calls: string[] = [];

		const ergebnis = await runAboServicePush(NOW, okSender(calls));

		assert.equal(ergebnis.sends, 0);
	});

	// AK2 — Zahlungsausfall: past_due + firstFailureAt → genau ein Status-Push, dann Dedupe.
	it('AK2: sendet bei past_due mit firstFailureAt genau einen Push mit url /settings/pakete; zweiter Lauf nichts', async () => {
		const user = await seedEmpfaenger('pastdue@example.com');
		await seedAbo(user.id, 'past_due', { firstFailureAt: new Date(NOW.getTime() - 2 * DAY_MS) });
		const calls: string[] = [];

		const ergebnis = await runAboServicePush(NOW, okSender(calls));

		assert.equal(ergebnis.sends, 1);
		assert.equal(payloads(calls)[0]!.url, '/settings/pakete');

		const erneut = await runAboServicePush(NOW, okSender(calls));
		assert.equal(erneut.sends, 0, 'Kein zweiter Ausfall-Push (NotificationLog-Dedupe)');
	});

	// AK2 — Play ON_HOLD / PayPal SUSPENDED (suspended) teilt den Dedupe-Key-Raum mit past_due.
	it('AK2: suspended mit firstFailureAt sendet genau einen Push (kein Doppel je Provider)', async () => {
		const user = await seedEmpfaenger('onhold@example.com');
		await seedAbo(user.id, 'suspended', { firstFailureAt: new Date(NOW.getTime() - 2 * DAY_MS) });
		const calls: string[] = [];

		const ergebnis = await runAboServicePush(NOW, okSender(calls));

		assert.equal(ergebnis.sends, 1);
		assert.equal(payloads(calls)[0]!.url, '/settings/pakete');
	});

	// AK2 — wieder active: nichts wird nachgeholt.
	it('AK2: ist das Abo wieder active, wird kein Ausfall-Push nachgeholt', async () => {
		const user = await seedEmpfaenger('wiederaktiv@example.com');
		await seedAbo(user.id, 'active', { firstFailureAt: new Date(NOW.getTime() - 2 * DAY_MS) });
		const calls: string[] = [];

		const ergebnis = await runAboServicePush(NOW, okSender(calls));

		assert.equal(ergebnis.sends, 0);
	});

	// AK3 — Kulanz-Erinnerung ab Tag 12 (GRACE_PERIOD_DAYS − 3) unter eigenem Dedupe-Key.
	it('AK3: ab firstFailureAt + 12 Tagen kommt genau eine Erinnerung, auch nach geloggtem Ausfall-Push', async () => {
		const user = await seedEmpfaenger('kulanz@example.com');
		const firstFailureAt = new Date(NOW.getTime() - 2 * DAY_MS);
		await seedAbo(user.id, 'past_due', { firstFailureAt });
		const calls: string[] = [];

		await runAboServicePush(NOW, okSender(calls));
		assert.equal(calls.length, 1, 'Vorbereitung: Ausfall-Push geloggt');

		// 10 Tage später: Frist läuft (Tag GRACE_PERIOD_DAYS − 3 von 15), Erinnerung fällig —
		// der :failed-Log blockiert sie nicht.
		const spaeter = new Date(firstFailureAt.getTime() + (GRACE_PERIOD_DAYS - 3) * DAY_MS);
		const ergebnis = await runAboServicePush(spaeter, okSender(calls));

		assert.equal(ergebnis.sends, 1, 'Erinnerung darf nicht vom Ausfall-Push wegdeduppt werden');
		assert.equal(payloads(calls)[1]!.url, '/settings/pakete');

		const erneut = await runAboServicePush(spaeter, okSender(calls));
		assert.equal(erneut.sends, 0, 'Kein zweiter Erinnerungs-Push (eigener Dedupe-Key)');
	});

	// AK3 — zu früh (Tag 11) und Frist abgelaufen (Tag 16): kein Push.
	it('AK3: vor Tag 12 und nach Fristablauf kommt keine Erinnerung', async () => {
		const user = await seedEmpfaenger('kulanz-frueh@example.com');
		const firstFailureAt = new Date(NOW.getTime() - 11 * DAY_MS - 12 * 60 * 60 * 1000);
		await seedAbo(user.id, 'past_due', { firstFailureAt });
		const calls: string[] = [];

		// Tag 11: der Ausfall-Push ist weiterhin fällig (Zustand noch nicht geloggt) — aber es
		// darf noch NICHT die Erinnerung sein (Ausschluss über den Text, nicht die Anzahl).
		await runAboServicePush(NOW, okSender(calls));
		assert.notEqual(
			payloads(calls)[0]!.title,
			ABO_PUSH_TEXTE.kulanz_erinnerung.de.title,
			'Tag 11: noch keine Erinnerung',
		);

		// Tag GRACE_PERIOD_DAYS + 1: Frist abgelaufen — der Lifecycle-Sweep hat grace_expired
		// gesetzt; statt der Erinnerung darf nur der Abo-Ende-Push gehen.
		await Subscription.update({ status: 'grace_expired', firstFailureAt: null }, { where: { userId: user.id } });
		const abgelaufen = new Date(firstFailureAt.getTime() + (GRACE_PERIOD_DAYS + 1) * DAY_MS);
		const ergebnis = await runAboServicePush(abgelaufen, okSender(calls));
		assert.equal(ergebnis.sends, 1, 'Tag 16: der Abo-Ende-Push geht (AK5)');
		assert.notEqual(
			payloads(calls)[1]!.title,
			ABO_PUSH_TEXTE.kulanz_erinnerung.de.title,
			'Tag 16: keine Erinnerung mehr',
		);
	});

	// AK4 — Ruhezeit: kein Versand UND kein Log; erster Tick im Tagesfenster holt nach.
	it('AK4: Ruhezeit sendet und loggt nichts; 07:30 UTC wird nachgeholt', async () => {
		const user = await seedEmpfaenger('ruhezeit@example.com');
		const abo = await seedAbo(user.id, 'active');
		await seedRechnung(user.id, abo.id, new Date(NOW.getTime() - 1 * DAY_MS));
		const calls: string[] = [];

		const nachts = await runAboServicePush(new Date('2026-10-21T23:00:00Z'), okSender(calls));

		assert.equal(nachts.sends, 0, 'Um 23:00 UTC (Ruhezeit 21–7) wird nicht gesendet');
		assert.equal(
			await logCount(),
			0,
			'Ruhezeit-Skip darf keinen Log-Eintrag schreiben (sonst blockiert die Dedupe die Nachholung)',
		);

		const morgens = await runAboServicePush(new Date('2026-10-22T07:30:00Z'), okSender(calls));

		assert.equal(morgens.sends, 1, 'Erster Tick ab 07:00 Ortszeit holt nach, solange der Zustand zutrifft');
	});

	// AK5 — Abo-Ende: grace_expired und abgelaufene bezahlte Laufzeit senden je genau einen Push.
	it('AK5: grace_expired sendet genau einen Push mit url /settings/pakete', async () => {
		const user = await seedEmpfaenger('grace-expired@example.com');
		await seedAbo(user.id, 'grace_expired', {
			firstFailureAt: null,
			currentPeriodEnd: new Date(NOW.getTime() - 16 * DAY_MS),
		});
		const calls: string[] = [];

		const ergebnis = await runAboServicePush(NOW, okSender(calls));

		assert.equal(ergebnis.sends, 1);
		assert.equal(payloads(calls)[0]!.url, '/settings/pakete');

		const erneut = await runAboServicePush(NOW, okSender(calls));
		assert.equal(erneut.sends, 0, 'Kein zweiter Ende-Push (NotificationLog-Dedupe)');
	});

	it('AK5: cancelled mit abgelaufener Laufzeit (innerhalb 7 Tage) sendet genau einen Push', async () => {
		const user = await seedEmpfaenger('abgelaufen@example.com');
		await seedAbo(user.id, 'cancelled', { currentPeriodEnd: new Date(NOW.getTime() - 3 * DAY_MS) });
		const calls: string[] = [];

		const ergebnis = await runAboServicePush(NOW, okSender(calls));

		assert.equal(ergebnis.sends, 1);
		assert.equal(payloads(calls)[0]!.url, '/settings/pakete');
	});

	it('AK5: cancelled mit zukünftiger Laufzeit sendet nichts; Ende älter als 7 Tage auch nicht', async () => {
		const user = await seedEmpfaenger('zukunft@example.com');
		await seedAbo(user.id, 'cancelled', { currentPeriodEnd: new Date(NOW.getTime() + 10 * DAY_MS) });
		const calls: string[] = [];

		let ergebnis = await runAboServicePush(NOW, okSender(calls));
		assert.equal(ergebnis.sends, 0, 'Bezahlte Laufzeit läuft noch — kein Ende-Push');

		await seedAbo(user.id, 'cancelled', { currentPeriodEnd: new Date(NOW.getTime() - 10 * DAY_MS) });
		ergebnis = await runAboServicePush(NOW, okSender(calls));
		assert.equal(ergebnis.sends, 0, 'Ende älter als 7 Tage — Rückstands-Schutz');
	});

	// AK6 — Texte: je Ereignis de/en, nicht leer, ohne Werbesatz; Versand folgt users.sprache.
	it('AK6: Textkatalog deckt je Ereignis de und en ab, ist nicht leer und werbefrei', async () => {
		for (const [ereignis, texte] of Object.entries(ABO_PUSH_TEXTE)) {
			assert.ok(texte.de, `${ereignis}: de-Text fehlt`);
			assert.ok(texte.en, `${ereignis}: en-Text fehlt`);
			assert.ok(texte.de.title.length > 0 && texte.de.body.length > 0, `${ereignis}: de-Titel/-Text leer`);
			assert.ok(texte.en.title.length > 0 && texte.en.body.length > 0, `${ereignis}: en-Titel/-Text leer`);
			assert.notEqual(texte.de.title, texte.en.title, `${ereignis}: de und en müssen verschiedene Texte tragen`);
			for (const text of [texte.de, texte.en]) {
				assert.doesNotMatch(
					`${text.title} ${text.body}`,
					/(rabatt|angebot|deal|offer|%|jetzt upgraden)/i,
					`${ereignis}: kein werblicher Satz (push-konzept.md §7.3)`,
				);
			}
		}
	});

	// AK6 — der Versandtext folgt spracheVon(user.sprache).
	it('AK6: en-Nutzer erhalten den englischen, de-Nutzer den deutschen Text', async () => {
		const de = await seedEmpfaenger('de-sprache@example.com', { sprache: 'de' });
		const en = await seedEmpfaenger('en-sprache@example.com', { sprache: 'en' });
		await seedAbo(de.id, 'past_due', { firstFailureAt: new Date(NOW.getTime() - DAY_MS) });
		await seedAbo(en.id, 'past_due', { firstFailureAt: new Date(NOW.getTime() - DAY_MS) });
		const calls: string[] = [];

		await runAboServicePush(NOW, okSender(calls));

		assert.equal(calls.length, 2);
		const [dePayload, enPayload] = payloads(calls);
		assert.equal(dePayload!.title, ABO_PUSH_TEXTE.zahlung_fehlgeschlagen.de.title);
		assert.equal(enPayload!.title, ABO_PUSH_TEXTE.zahlung_fehlgeschlagen.en.title);
	});
});
