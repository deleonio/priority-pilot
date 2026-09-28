import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { type CareAufgabe, type CareVorlage, waehleCareVorschlaege } from './careSuggestions.js';

/**
 * Rote Spec-Tests für #1791 (Spec docs/spec/issue-1791.md) — Auswahl-Logik der
 * Fürsorge-Vorschläge (reine Funktion, kein DB/HTTP).
 *
 * TF4 (AK4): Ablehnung 13 Tage alt → Vorlage unterdrückt; 15 Tage alt → wieder dabei.
 * Zusätzlich Vertragssicherung: eigene offene Aufgaben zuerst, dann Vorlagen, max. drei
 * je Säule, Säulen-Filter über `saeuleId`.
 *
 * Rot, bis `logics/careSuggestions.ts` existiert. KEIN Produktivcode.
 */

const TAG_MS = 24 * 60 * 60 * 1000;
const JETZT = new Date('2026-10-01T12:00:00Z');

const saeule = { id: 1, name: 'Körper', weight: 20 };

const aufgabe = (
	id: number,
	pillars: { pillarId: number; share: number }[] = [{ pillarId: 1, share: 100 }],
): CareAufgabe => ({
	id,
	titel: `Aufgabe ${id}`,
	beschreibung: null,
	status: 'Open',
	pillars,
});

const vorlage = (key: string, saeuleId = 1): CareVorlage => ({
	key,
	saeuleId,
	texte: { titel: `Vorlage ${key}`, beschreibung: `Beschreibung ${key}` },
});

const keys = (vorschlaege: { templateKey?: string }[]): (string | undefined)[] => vorschlaege.map((v) => v.templateKey);

describe('waehleCareVorschlaege (#1791)', () => {
	it('TF4a/AK4: 13 Tage alte Ablehnung unterdrückt die Vorlage, Ersatzvorlage rückt nach', () => {
		const ablehnung = { templateKey: 'koerper-2', abgelehntAm: new Date(JETZT.getTime() - 13 * TAG_MS) };
		const ergebnis = waehleCareVorschlaege(
			saeule,
			[],
			[vorlage('koerper-1'), vorlage('koerper-2'), vorlage('koerper-3')],
			[ablehnung],
			JETZT,
		);
		assert.ok(
			ergebnis.every((v) => v.templateKey !== 'koerper-2'),
			'Vorlage muss 13 Tage nach Ablehnung unterdrückt sein',
		);
		assert.deepEqual(keys(ergebnis), ['koerper-1', 'koerper-3']);
	});

	it('TF4b/AK4: 15 Tage alte Ablehnung — Vorlage ist wieder lieferbar', () => {
		const ablehnung = { templateKey: 'koerper-2', abgelehntAm: new Date(JETZT.getTime() - 15 * TAG_MS) };
		const ergebnis = waehleCareVorschlaege(
			saeule,
			[],
			[vorlage('koerper-1'), vorlage('koerper-2'), vorlage('koerper-3')],
			[ablehnung],
			JETZT,
		);
		assert.ok(
			ergebnis.some((v) => v.templateKey === 'koerper-2' && v.typ === 'vorlage'),
			'Vorlage muss nach Ablauf der 14 Tage wieder erscheinen',
		);
	});

	it('Vertrag: eigene offene Aufgabe zuerst, dann Vorlagen, höchstens drei je Säule, Fremd-Säulen-Vorlage gefiltert', () => {
		const ergebnis = waehleCareVorschlaege(
			saeule,
			[aufgabe(7), aufgabe(8)],
			[vorlage('koerper-1'), vorlage('koerper-2'), vorlage('koerper-3'), vorlage('koerper-4'), vorlage('geist-1', 2)],
			[],
			JETZT,
		);
		assert.equal(ergebnis.length, 3, '„bis zu drei Vorschläge“ je Säule');
		assert.deepEqual(
			ergebnis.map((v) => v.typ),
			['task', 'task', 'vorlage'],
			'eigene offene Aufgaben zuerst, dann Vorlagen',
		);
		assert.equal(ergebnis[0]?.taskId, 7);
		assert.equal(ergebnis[2]?.templateKey, 'koerper-1');
		assert.ok(
			ergebnis.every((v) => v.templateKey !== 'geist-1'),
			'Vorlagen anderer Säulen dürfen nicht einfließen',
		);
	});
});
