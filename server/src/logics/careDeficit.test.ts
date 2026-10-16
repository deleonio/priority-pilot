import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	bewerteCareDefizit,
	CARE_FENSTER_TAGE,
	UEBERLAST_ANTEIL,
	UEBERLAST_MINDEST_ERLEDIGUNGEN,
} from './careDeficit.js';

/**
 * Rote Spec-Tests für #1790 (Spec docs/spec/issue-1790.md), AK1–AK4 — Auswertungsfunktion
 * `bewerteCareDefizit`: je Säule Defizit-Flag (7-Tage-Fenster), Trend aus zwei
 * aufeinanderfolgenden Fenstern und Überlast-Flag am Anteil des erledigten Aufwands.
 *
 * Reine Logik, keine DB. Synthetische Historien: Done-Tasks mit `erledigtAm` relativ zu `jetzt`,
 * je Task eine Säule mit vollem Anteil (`share: 100`), damit der Fenster-Aufwand pro Säule leicht
 * nachrechenbar ist.
 *
 * Rot, bis `server/src/logics/careDeficit.ts` existiert (heute: Modul fehlt). KEIN Produktivcode.
 */

const JETZT = new Date('2026-10-01T12:00:00Z');
const STUNDE_MS = 60 * 60 * 1000;
const TAG_MS = 24 * STUNDE_MS;

interface Saeule {
	id: number;
	name: string;
	weight: number;
}

interface TaskFixture {
	status: 'Open' | 'In process' | 'Done';
	estimatedEffort: number;
	pillars: { pillarId: number; share: number }[];
	/** `null` = Done ohne ScoreEntry — zählt in keinem Fenster (Spec: Zeitpunkt unbekannt). */
	erledigtAm: Date | null;
}

const saeulen: Saeule[] = [
	{ id: 1, name: 'Körper', weight: 50 },
	{ id: 2, name: 'Geist', weight: 50 },
	{ id: 3, name: 'Soziales', weight: 0 },
];

const task = (pillarId: number, effort: number, alterMs: number): TaskFixture => ({
	status: 'Done',
	estimatedEffort: effort,
	pillars: [{ pillarId, share: 100 }],
	erledigtAm: new Date(JETZT.getTime() - alterMs),
});

describe('bewerteCareDefizit (#1790)', () => {
	it('AK1: Säule ohne erledigte Aufgabe in den letzten 7 Tagen → defizitaer', () => {
		// Körper erledigt vor 3 Tagen; Geist hat nur OFFENE Tasks — die ändern nichts am Defizit.
		const tasks: TaskFixture[] = [task(1, 2, 3 * TAG_MS), { ...task(2, 5, 2 * TAG_MS), status: 'Open' }];
		const bericht = bewerteCareDefizit(saeulen, tasks, JETZT);
		assert.equal(bericht.find((s) => s.id === 1)?.defizitaer, false);
		assert.equal(bericht.find((s) => s.id === 2)?.defizitaer, true);
	});

	it('AK2: Trend aus zwei aufeinanderfolgenden 7-Tage-Fenstern', () => {
		// Älteres Fenster (14–7 d): Körper 4, Geist 1, Soziales 2 — jüngeres (7–0 d): 1 / 4 / 2.
		const tasks: TaskFixture[] = [
			task(1, 4, 10 * TAG_MS),
			task(1, 1, 3.5 * TAG_MS),
			task(2, 1, 10 * TAG_MS),
			task(2, 4, 3.5 * TAG_MS),
			task(3, 2, 10 * TAG_MS),
			task(3, 2, 3.5 * TAG_MS),
		];
		const bericht = bewerteCareDefizit(saeulen, tasks, JETZT);
		assert.equal(bericht.find((s) => s.id === 1)?.trend, 'verschlechtert');
		assert.equal(bericht.find((s) => s.id === 2)?.trend, 'erholt');
		assert.equal(bericht.find((s) => s.id === 3)?.trend, 'stabil');
	});

	it('AK3: Anteil am erledigten Aufwand über der Schwelle → ueberlast (strikt größer, #2521: ab Mindestmenge)', () => {
		// Jüngeres Fenster: Körper 9 aus 3 Tasks, Geist 2 aus 1 → 82 % bzw. 18 %; 4 Erledigungen ≥ Mindestmenge.
		const tasks: TaskFixture[] = [
			task(1, 8, 2 * TAG_MS),
			task(1, 0.5, 3 * TAG_MS),
			task(1, 0.5, 4 * TAG_MS),
			task(2, 2, 2 * TAG_MS),
		];
		const bericht = bewerteCareDefizit(saeulen, tasks, JETZT);
		assert.equal(bericht.find((s) => s.id === 1)?.ueberlast, true);
		assert.equal(bericht.find((s) => s.id === 2)?.ueberlast, false);
		// Exakt auf der Schwelle (je 50 %) → keine Überlast; ohne jeden Aufwand ebenso.
		const exakt: TaskFixture[] = [
			task(1, 1, 2 * TAG_MS),
			task(1, 1, 3 * TAG_MS),
			task(1, 1, 4 * TAG_MS),
			task(2, 1, 2 * TAG_MS),
			task(2, 1, 3 * TAG_MS),
			task(2, 1, 4 * TAG_MS),
		];
		assert.equal(
			bewerteCareDefizit(saeulen, exakt, JETZT).every((s) => !s.ueberlast),
			true,
		);
		assert.equal(
			bewerteCareDefizit(saeulen, [], JETZT).every((s) => !s.ueberlast),
			true,
		);
	});

	// #2521 (Spec docs/spec/issue-2521.md): Überlast erst ab Mindestmenge erledigter Aufgaben —
	// darunter kein Überlast-Flag (Ermutigungs-Pfad der Route, kein Überlast-Push).
	it('#2521 AK3: unter der Mindestmenge (2 Erledigungen) kein ueberlast, ab 3 wie bisher', () => {
		// 2 Done-Tasks auf einer Säule = 100 % Anteil — über der Schwelle, aber unter der Mindestmenge.
		const zwei: TaskFixture[] = [task(1, 1, 2 * TAG_MS), task(1, 1, 3 * TAG_MS)];
		assert.equal(
			bewerteCareDefizit(saeulen, zwei, JETZT).every((s) => !s.ueberlast),
			true,
			'2 Erledigungen reichen nicht für ueberlast',
		);
		const drei: TaskFixture[] = [...zwei, task(1, 1, 4 * TAG_MS)];
		assert.equal(bewerteCareDefizit(saeulen, drei, JETZT).find((s) => s.id === 1)?.ueberlast, true);
	});

	it('#2521 AK4: die Mindestmenge steht als exportierte Konstante neben UEBERLAST_ANTEIL und = 3', async () => {
		// Dynamischer Import + Optionalfeld: der fehlende Export lässt nur diesen Test rot, nicht
		// gleich das ganze Modul (Muster Memory 2026-08-23).
		const konstanten = (await import('./careDeficit.js')) as {
			UEBERLAST_MINDEST_ERLEDIGUNGEN?: number;
		};
		assert.equal(konstanten.UEBERLAST_MINDEST_ERLEDIGUNGEN, 3);
	});

	it('AK4: Fenstergröße und Schwelle stehen an einer Stelle (exportierte Konstanten) und steuern das Verhalten', () => {
		assert.equal(CARE_FENSTER_TAGE, 7);
		assert.equal(UEBERLAST_ANTEIL, 0.5);
		// Fenstergrenze links exklusiv (Spiegel zu berechneKadenzFuellstand): erledigt genau vor
		// CARE_FENSTER_TAGE Tagen liegt außerhalb des jüngeren Fensters → defizitär.
		const amRand = bewerteCareDefizit(saeulen, [task(1, 2, CARE_FENSTER_TAGE * TAG_MS)], JETZT);
		assert.equal(amRand.find((s) => s.id === 1)?.defizitaer, true);
		// Eine Millisekunde nach der Grenze zählt die Erledigung hinein.
		const drin = bewerteCareDefizit(saeulen, [task(1, 2, CARE_FENSTER_TAGE * TAG_MS - 1)], JETZT);
		assert.equal(drin.find((s) => s.id === 1)?.defizitaer, false);
	});
});

describe('#2623: seedMindestErledigungen leitet die Schleifen-Obergrenze aus UEBERLAST_MINDEST_ERLEDIGUNGEN ab', () => {
	// Spiegel-Guard zwischen Server-Konstante und E2E-Test-Infrastruktur (Spec docs/spec/issue-2623.md):
	// akzeptiert Direkt-Import (Typsystem sichert die Quelle) oder benannte Spiegel-Konstante;
	// rot bei Literal in der Schleife oder bei Spiegel-Abweichung nach Server-Änderung.
	const HELPERS_PFAD = new URL('../../../frontend/e2e/helpers.ts', import.meta.url);

	it('AK1: die Obergrenze ist der importierte Identifier oder eine benannte Konstante mit dem Server-Wert', () => {
		const quelltext = readFileSync(HELPERS_PFAD, 'utf8');
		const funktion = quelltext.match(/export const seedMindestErledigungen[\s\S]*?\n\};/);
		assert.ok(funktion, 'seedMindestErledigungen in frontend/e2e/helpers.ts nicht gefunden');
		const schleife = funktion[0].match(/for \(let i = 0; i < ([^;]+); i\+\+\)/);
		assert.ok(schleife, 'Schleifen-Obergrenze in seedMindestErledigungen nicht gefunden');
		const obergrenze = schleife[1].trim();
		if (obergrenze === 'UEBERLAST_MINDEST_ERLEDIGUNGEN') {
			return; // Direkt-Import-Variante: Kopplung über das Typsystem (frontend-tsc über e2e)
		}
		const esc = obergrenze.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const spiegel = quelltext.match(new RegExp(`(?:const|let)\\s+${esc}\\s*=\\s*(\\d+)`));
		assert.ok(
			spiegel,
			`Obergrenze "${obergrenze}" ist weder der Import von UEBERLAST_MINDEST_ERLEDIGUNGEN noch eine benannte Spiegel-Konstante (Literal in der Schleife, #2623)`,
		);
		assert.equal(
			Number(spiegel[1]),
			UEBERLAST_MINDEST_ERLEDIGUNGEN,
			`Spiegelwert ${spiegel[1]} in frontend/e2e/helpers.ts weicht von UEBERLAST_MINDEST_ERLEDIGUNGEN (${UEBERLAST_MINDEST_ERLEDIGUNGEN}) ab — Spiegel nachziehen oder Direkt-Import nutzen (#2623)`,
		);
	});
});
