import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb } from '../test/helpers.js';
import KpiEvent from '../models/kpiEvent.js';
import { berechneKpis, protokolliereErledigung, protokolliereKpiEreignis, type KpiEingabe } from './kpiKennzahlen.js';

/**
 * Rote Spec-Tests für #1989 (Spec docs/spec/issue-1989.md) — anonyme KPI-Protokollierung und
 * reine Auswertung. AK1: Dedup je Nutzer/Tag/Woche ohne `userId`; AK2: Tag-0-Entscheid; AK3/AK6:
 * Kohorten-Quoten mit `MIN_ZELLE`-Unterdrückung; AK7: Feldlisten. Rot, bis `logics/kpiKennzahlen.ts`
 * und `models/kpiEvent.ts` existieren. KEIN Produktivcode.
 */
describe('kpiKennzahlen (#1989)', () => {
	before(async () => {
		await resetDb();
	});
	after(async () => {
		await closeDb();
	});

	it('AK1: Doppelaufruf desselben Ereignisses schreibt genau eine Zeile — nur tag/art/dedupKey, keine userId-Spalte (AK7)', async () => {
		const jetzt = new Date('2026-01-07T12:00:00Z');
		await protokolliereKpiEreignis(1, 'aktivitaet', jetzt);
		await protokolliereKpiEreignis(1, 'aktivitaet', jetzt);

		const zeilen = await KpiEvent.findAll({ raw: true });
		assert.equal(zeilen.length, 1, 'Doppelaufruf desselben Tags zählt einfach');
		assert.equal(zeilen[0]!.art, 'aktivitaet');
		assert.equal(zeilen[0]!.tag, '2026-01-07');
		assert.equal(zeilen[0]!.dedupKey?.length, 64, 'dedupKey ist ein SHA-256-HMAC');
		const spalten = Object.keys(KpiEvent.getAttributes()).filter((s) => s !== 'id');
		assert.deepEqual(spalten.sort(), ['art', 'dedupKey', 'tag'], 'AK7: genau diese drei Felder');
	});

	it('AK4: wochenkarte je Woche einmal — gleiche Woche dedupliziert, neue Woche zählt erneut', async () => {
		const nutzer = 2;
		await protokolliereKpiEreignis(nutzer, 'wochenkarte', new Date('2026-01-07T12:00:00Z'));
		await protokolliereKpiEreignis(nutzer, 'wochenkarte', new Date('2026-01-11T12:00:00Z'));
		await protokolliereKpiEreignis(nutzer, 'wochenkarte', new Date('2026-01-13T12:00:00Z'));
		assert.equal(await KpiEvent.count(), 2, 'Mo 05.01. + So 11.01. = eine Woche, Di 13.01. = neue Woche');
	});

	it('AK2: Tag 0 → aktivierung, späterer Tag → aktivitaet', async () => {
		const registriertAm = new Date('2026-01-05T23:30:00Z');
		await protokolliereErledigung(3, registriertAm, new Date('2026-01-05T23:59:59Z'));
		await protokolliereErledigung(4, registriertAm, new Date('2026-01-06T00:00:01Z'));
		assert.equal(await KpiEvent.count({ where: { art: 'aktivierung' } }), 1);
		assert.equal(await KpiEvent.count({ where: { art: 'aktivitaet' } }), 1);
	});

	it('AK3/AK6: Quoten je Periode aus Kohorte und Ereignissen; kleine Zellen unterdrückt', () => {
		const eingabe: KpiEingabe = {
			nutzer: [1, 2, 3, 4, 5, 6].map((id) => ({ id, registriertAm: new Date('2026-01-05T09:30:00Z') })),
			erledigungen: [
				{ userId: 1, zeitpunkt: new Date('2026-01-05T15:00:00Z') }, // Tag 0
				{ userId: 2, zeitpunkt: new Date('2026-01-12T15:00:00Z') }, // Tag 7
				{ userId: 3, zeitpunkt: new Date('2026-01-08T10:00:00Z') }, // Tag 3: weder noch
			],
			ereignisse: [
				{ tag: '2026-01-05', art: 'aktivierung', anzahl: 1 },
				{ tag: '2026-01-06', art: 'einladung', anzahl: 3 },
				{ tag: '2026-01-07', art: 'wochenkarte', anzahl: 2 },
			],
		};
		const jetzt = new Date('2026-01-14T00:00:00Z');

		const woche = berechneKpis(eingabe, 'woche', jetzt);
		assert.equal(woche.zeilen.length, 1);
		const zeile = woche.zeilen[0]!;
		assert.equal(zeile.periode, '2026-01-05', 'Woche = Montag der Registrierung');
		assert.equal(zeile.neueNutzer, 6);
		assert.deepEqual(zeile.aktivierung, { zaehler: 1, nenner: 6, quote: 1 / 6 });
		assert.deepEqual(zeile.tag7, { zaehler: 1, nenner: 6, quote: 1 / 6 });
		assert.deepEqual(zeile.wochenkarte, { zaehler: 2, nenner: 6, quote: 2 / 6 });
		assert.deepEqual(zeile.einladungen, { zaehler: 3, nenner: 6, quote: 3 / 6 });

		const monat = berechneKpis(eingabe, 'monat', jetzt);
		assert.equal(monat.zeilen[0]!.periode, '2026-01');
		assert.deepEqual(monat.zeilen[0]!.tag7, { zaehler: 1, nenner: 6, quote: 1 / 6 });

		const klein: KpiEingabe = { ...eingabe, nutzer: eingabe.nutzer.slice(0, 3) };
		const unterdrueckt = berechneKpis(klein, 'woche', jetzt);
		for (const zelle of [
			unterdrueckt.zeilen[0]!.aktivierung,
			unterdrueckt.zeilen[0]!.tag7,
			unterdrueckt.zeilen[0]!.wochenkarte,
			unterdrueckt.zeilen[0]!.einladungen,
		]) {
			assert.equal(zelle, 'unterdrueckt', 'nenner < 5 → unterdrückt');
		}
	});
});
