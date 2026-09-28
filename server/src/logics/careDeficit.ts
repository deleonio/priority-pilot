/**
 * Care-Defizit-Auswertung (#1790) — je Säule Defizit, Trend und Überlast über die Zeit, als reine
 * Funktion auf der KadenzTask-Form aus `heartBalance.ts`.
 *
 * Basis ist das Momentaufnahmen-Defizit `defizitᵢ` (#1474): Hier zählt eine Säule als `defizitaer`,
 * wenn im jüngeren Fenster kein erledigter Aufwand anlandete — offene Tasks ändern das nicht. Der
 * `trend` vergleicht die zwei aufeinanderfolgenden Fenster, `ueberlast` meldet Säulen mit strikt
 * mehr als `UEBERLAST_ANTEIL` des Gesamtaufwands des jüngeren Fensters. Nur explizit zugewiesene
 * Säulen tragen (`share / 100`); Done ohne `erledigtAm` zählt in keinem Fenster — der Zeitpunkt ist
 * unbekannt, die Säule bleibt konservativ defizitär sichtbar. Fenstergröße und Schwellen sind
 * exportierte Konstanten: #1793/#1794/#1796 importieren sie, statt Werte zu kopieren (AK4).
 */
import { type BalanceSaeule, type KadenzTask } from './heartBalance.js';

/** Länge des jüngeren Betrachtungsfensters in Tagen; das ältere ist das unmittelbar vorige. */
export const CARE_FENSTER_TAGE = 7;

/** Anteilsschwelle am Gesamtaufwand des jüngeren Fensters, ab der Überlast gemeldet wird (strikt). */
export const UEBERLAST_ANTEIL = 0.5;

const TAG_MS = 24 * 60 * 60 * 1000;
const TOTAL_SHARE = 100;

/** Auswertung je Säule: Defizit-Flag, Aufwandstrend über zwei Fenster und Überlast-Flag. */
export interface SaeulenDefizit {
	id: number;
	name: string;
	/** Kein erledigter Aufwand im jüngeren Fenster. */
	defizitaer: boolean;
	/** Jünger > älter → `erholt`, jünger < älter → `verschlechtert`, sonst `stabil`. */
	trend: 'erholt' | 'stabil' | 'verschlechtert';
	/** Strikt mehr als `UEBERLAST_ANTEIL` des Gesamtaufwands des jüngeren Fensters. */
	ueberlast: boolean;
}

/**
 * Wertet die erledigte Pflege je Säule über die zwei aufeinanderfolgenden `CARE_FENSTER_TAGE`-Fenster
 * aus — beide links exklusiv/rechts inklusiv (Spiegel zu `berechneKadenzFuellstand`).
 */
export const bewerteCareDefizit = (saeulen: BalanceSaeule[], tasks: KadenzTask[], jetzt: Date): SaeulenDefizit[] => {
	const jetztMs = jetzt.getTime();
	const juengerStart = jetztMs - CARE_FENSTER_TAGE * TAG_MS;
	const aelterStart = jetztMs - 2 * CARE_FENSTER_TAGE * TAG_MS;

	const aufwandJeSaeule = (start: number, ende: number): Map<number, number> => {
		const aufwand = new Map(saeulen.map((saeule) => [saeule.id, 0]));
		for (const task of tasks) {
			if (task.status !== 'Done' || task.erledigtAm === null) {
				continue;
			}
			const zeitpunkt = task.erledigtAm.getTime();
			if (zeitpunkt <= start || zeitpunkt > ende) {
				continue;
			}
			for (const beitrag of task.pillars) {
				// Beiträge auf gelöschte/fremde Säulen ignorieren — nur explizite Zuweisungen zählen.
				if (!aufwand.has(beitrag.pillarId)) {
					continue;
				}
				aufwand.set(
					beitrag.pillarId,
					(aufwand.get(beitrag.pillarId) ?? 0) + task.estimatedEffort * (beitrag.share / TOTAL_SHARE),
				);
			}
		}
		return aufwand;
	};

	const juenger = aufwandJeSaeule(juengerStart, jetztMs);
	const aelter = aufwandJeSaeule(aelterStart, juengerStart);
	const gesamtJuenger = [...juenger.values()].reduce((summe, wert) => summe + wert, 0);

	return saeulen.map((saeule) => {
		const istJuenger = juenger.get(saeule.id) ?? 0;
		const istAelter = aelter.get(saeule.id) ?? 0;
		return {
			id: saeule.id,
			name: saeule.name,
			defizitaer: istJuenger === 0,
			trend: istJuenger > istAelter ? 'erholt' : istJuenger < istAelter ? 'verschlechtert' : 'stabil',
			ueberlast: gesamtJuenger > 0 && istJuenger / gesamtJuenger > UEBERLAST_ANTEIL,
		};
	});
};
