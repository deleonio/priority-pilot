import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	type CareAufgabe,
	type CareVorschlag,
	type CareVorlage,
	waehleCareVorschlaege,
	waehleErholungsVorschlaege,
} from './careSuggestions.js';

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
			SAEULEN_LISTE,
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
			SAEULEN_LISTE,
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
			SAEULEN_LISTE,
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

/**
 * #2075 (AK2, Spec docs/spec/issue-2075.md): Vorlagen- und Erholungsvorschläge tragen die
 * vollständige Verteilung über alle fünf Säulen — Ziel-Säule 50 %, übrige vier gleichmäßig über
 * die restlichen 50 % (13/13/12/12 in Säulen-Reihenfolge), ganzzahlig, Summe exakt 100, jeder
 * Anteil ≥ 5. Dafür bekommt `waehleCareVorschlaege` die Nutzer-Säulenliste als 2. Parameter,
 * `waehleErholungsVorschlaege` als 1. Parameter. Task-Vorschläge geben die Aufgaben-Verteilung
 * weiterhin 1:1 durch.
 */
type SaeuleOhneDb = { id: number; name: string; weight: number };
type Ablehnung = { templateKey: string; abgelehntAm: Date };

const waehleMitSaeulen = waehleCareVorschlaege as unknown as (
	saeule: SaeuleOhneDb,
	saeulen: SaeuleOhneDb[],
	aufgaben: CareAufgabe[],
	vorlagen: CareVorlage[],
	ablehnungen: Ablehnung[],
	jetzt: Date,
) => CareVorschlag[];

const waehleErholungMitSaeulen = waehleErholungsVorschlaege as unknown as (
	saeulen: SaeuleOhneDb[],
	ueberlasteSaeulenIds: number[],
	vorlagen: CareVorlage[],
	ablehnungen: Ablehnung[],
	jetzt: Date,
) => (CareVorschlag & { saeuleId: number })[];

const SAEULEN_LISTE: SaeuleOhneDb[] = [
	{ id: 1, name: 'Körper', weight: 20 },
	{ id: 2, name: 'Geist', weight: 20 },
	{ id: 3, name: 'Soziales', weight: 20 },
	{ id: 4, name: 'Wirksamkeit', weight: 20 },
	{ id: 5, name: 'Sinn', weight: 20 },
];

const pruefeForm = (beitraege: { pillarId: number; share: number }[], zielId: number, kontext: string): void => {
	assert.equal(beitraege.length, 5, `${kontext}: genau fünf Säulen-Beiträge`);
	assert.equal(beitraege.find((beitrag) => beitrag.pillarId === zielId)?.share, 50, `${kontext}: Ziel-Säule 50 %`);
	assert.deepEqual(
		beitraege
			.filter((beitrag) => beitrag.pillarId !== zielId)
			.map((beitrag) => beitrag.share)
			.sort((a, b) => b - a),
		[13, 13, 12, 12],
		`${kontext}: übrige vier gleichmäßig über 50 %`,
	);
	assert.equal(
		beitraege.reduce((acc, beitrag) => acc + beitrag.share, 0),
		100,
		`${kontext}: Summe exakt 100`,
	);
};

describe('waehleCareVorschlaege/waehleErholungsVorschlaege — vollständige Verteilung (#2075, AK2)', () => {
	/** Roter Guard: verlangt die Signaturerweiterung, bevor die Verhaltens-Assertions laufen. */
	const erweiterteSignatur = () => {
		assert.equal(
			waehleCareVorschlaege.length,
			6,
			'Signatur muss um die Nutzer-Säulenliste als 2. Parameter erweitert sein (AK2, docs/spec/issue-2075.md)',
		);
		assert.equal(
			waehleErholungsVorschlaege.length,
			5,
			'waehleErholungsVorschlaege muss die Nutzer-Säulenliste als 1. Parameter bekommen (AK2)',
		);
	};

	it('Vorlage der Ziel-Säule: fünf Beiträge — Ziel 50 %, Rest 13/13/12/12 in Säulen-Reihenfolge', () => {
		erweiterteSignatur();
		const ergebnis = waehleMitSaeulen(saeule, SAEULEN_LISTE, [], [vorlage('koerper-1')], [], JETZT);
		assert.equal(ergebnis.length, 1);
		pruefeForm(ergebnis[0]!.saeulenBeitraege, 1, 'koerper-1');
		assert.deepEqual(
			ergebnis[0]!.saeulenBeitraege,
			[
				{ pillarId: 1, share: 50 },
				{ pillarId: 2, share: 13 },
				{ pillarId: 3, share: 13 },
				{ pillarId: 4, share: 12 },
				{ pillarId: 5, share: 12 },
			],
			'Reihenfolge folgt der Säulenliste',
		);
	});

	it('Ziel-Säule mittendrin: 50 % wandert mit, Rest bleibt in Säulen-Reihenfolge', () => {
		erweiterteSignatur();
		const ergebnis = waehleMitSaeulen(
			{ id: 3, name: 'Soziales', weight: 20 },
			SAEULEN_LISTE,
			[],
			[vorlage('soziales-1', 3)],
			[],
			JETZT,
		);
		assert.equal(ergebnis.length, 1);
		pruefeForm(ergebnis[0]!.saeulenBeitraege, 3, 'soziales-1');
	});

	it('Task-Vorschläge geben die Aufgaben-Verteilung unverändert durch (kein Umbau)', () => {
		erweiterteSignatur();
		const eigenVerteilung = [
			{ pillarId: 1, share: 60 },
			{ pillarId: 3, share: 40 },
		];
		const ergebnis = waehleMitSaeulen(saeule, SAEULEN_LISTE, [aufgabe(7, eigenVerteilung)], [], [], JETZT);
		assert.equal(ergebnis[0]?.taskId, 7);
		assert.deepEqual(ergebnis[0]!.saeulenBeitraege, eigenVerteilung, 'Task-Verteilung bleibt unverändert');
	});

	it('Erholungsvorschläge (Überlast): dieselbe Form für jede Vorlage', () => {
		erweiterteSignatur();
		const ergebnis = waehleErholungMitSaeulen(
			SAEULEN_LISTE,
			[4],
			[vorlage('koerper-1'), vorlage('geist-1', 2), vorlage('pause-1', 2)],
			[],
			JETZT,
		);
		assert.ok(ergebnis.length >= 3, 'Pause- und Säulen-Vorschläge vorhanden');
		for (const vorschlag of ergebnis) {
			pruefeForm(vorschlag.saeulenBeitraege, vorschlag.saeuleId, vorschlag.templateKey ?? '?');
		}
	});
});
