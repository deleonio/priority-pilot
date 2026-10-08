/**
 * Auswahl-Logik der Fürsorge-Vorschläge (#1791) — reine Funktion ohne DB/HTTP. Liefert je
 * Defizit-Säule bis zu drei Vorschläge: zuerst eigene offene Aufgaben mit Säulen-Beitrag zu
 * genau dieser Säule, sonst kuratierte Vorlagen (`logics/careSuggestionData.ts`). Eine Ablehnung
 * unterdrückt ihre Vorlage für `CARE_ABLEHNUNG_TAGE` (AK4). Die Sprache ist von der Route bereits
 * aufgelöst (Vorlagen kommen mit Texten in der Zielsprache). Den KI-Vorschlag für Plus/Pro
 * (`typ: 'ki'`, #1804) ergänzt die Route in derselben Antwortform.
 */
import { type BalanceSaeule } from './heartBalance.js';
import { suggestRankedShares } from './pillarShares.js';
import { CARE_GENERISCH, CARE_VORLAGEN, type CareSprache } from './careSuggestionData.js';
import { SEED_PILLARS } from '../models/pillarData.js';

/** Wie lange eine abgelehnte Vorlage unterdrückt bleibt (AK4): davor weg, ab exakt so vielen Tagen wieder lieferbar. */
const CARE_ABLEHNUNG_TAGE = 14;

/** Vorlage „Pause" (#1795): nur Überlast-Vorschlag, nie Defizit-Vorschlag ihrer Säule. */
export const PAUSE_VORLAGE_KEY = 'pause-1';

/** Säulen-IDs (Körper, Mentale Gesundheit), aus denen Erholungsvorschläge bei Überlast kommen (#1795). */
const ERHOLUNGS_SAEULEN_IDS = [1, 2];

/** Präfix des `templateKey` der generischen Vorlage (#2146); mit der Säulen-ID je Säule eindeutig. */
const GENERISCH_KEY_PRAEFIX = 'eigene-saeule-';

const TAG_MS = 24 * 60 * 60 * 1000;
const MAX_VORSCHLAEGE = 3;

/** Eine eigene offene Aufgabe des Nutzers in der Form, die die Auswahl braucht. */
export interface CareAufgabe {
	id: number;
	titel: string;
	beschreibung: string | null;
	status: string;
	pillars: { pillarId: number; share: number }[];
}

/** Eine kuratierte Vorlage einer Säule mit Texten in der (von der Route aufgelösten) Sprache. */
export interface CareVorlage {
	key: string;
	saeuleId: number;
	texte: { titel: string; beschreibung: string };
}

/** Ein Vorschlag: eigener Task (`taskId`) oder Vorlage (`templateKey`); die Route reichert saeuleId/saeuleName an. */
export interface CareVorschlag {
	typ: 'task' | 'vorlage';
	titel: string;
	beschreibung: string | null;
	saeulenBeitraege: { pillarId: number; share: number }[];
	taskId?: number;
	templateKey?: string;
}

/**
 * Vollständige Verteilung über alle Säulen des Nutzers (#2075): die Ziel-Säule bekommt Rang 1 der
 * Rang-Treppe (50 %), die übrigen teilen den Rest gleichmäßig (13/13/12/12) — Reihenfolge folgt
 * der Säulenliste. Damit besteht der Payload der strengen Prüfung (#2077) und `POST /tasks`
 * legt die Aufgabe exakt so an (AK3). Vorlagen- und KI-Pfad teilen sich diese Hilfe.
 */
export const saeulenBeitraegeFuerZiel = (
	zielSaeuleId: number,
	saeulen: { id: number }[],
): { pillarId: number; share: number }[] => {
	const zielIndex = saeulen.findIndex((saeule) => saeule.id === zielSaeuleId);
	const anteile = suggestRankedShares(zielIndex >= 0 ? [zielIndex] : [], saeulen.length);
	return saeulen
		.map((saeule, index) => ({ pillarId: saeule.id, share: anteile[index] ?? 0 }))
		.filter((beitrag) => beitrag.share > 0);
};

/**
 * Löst die Vorlagen gegen die Säulen EINES Nutzers auf (#2146): der Katalog zeigt über die Seed-Position
 * auf einen Säulen-Key (`SEED_PILLARS`), die `saeuleId` der Vorlage ist die ID der Nutzer-Säule mit
 * diesem Key — Säulen-IDs gibt es pro Nutzer. Jede Säule ohne kuratierte Vorlage (eigene Säule, Key
 * `null` oder unbekannt) bekommt eine generische Vorlage mit ihrem Namen (`templateKey` je Säule).
 */
export const loeseVorlagenAuf = (saeulen: BalanceSaeule[], sprache: CareSprache): CareVorlage[] => {
	const idProKey = new Map(saeulen.flatMap((saeule) => (saeule.key ? [[saeule.key, saeule.id] as const] : [])));
	const katalog = CARE_VORLAGEN.flatMap((vorlage) => {
		const saeuleId = idProKey.get(SEED_PILLARS[vorlage.saeuleId - 1]?.key ?? '');
		return saeuleId === undefined ? [] : [{ key: vorlage.key, saeuleId, texte: vorlage.texte[sprache] }];
	});
	const mitVorlage = new Set(katalog.map((vorlage) => vorlage.saeuleId));
	const generisch = saeulen
		.filter((saeule) => !mitVorlage.has(saeule.id))
		.map((saeule) => ({
			key: `${GENERISCH_KEY_PRAEFIX}${saeule.id}`,
			saeuleId: saeule.id,
			texte: {
				titel: CARE_GENERISCH[sprache].titel.replace(/\{name\}/g, saeule.name),
				beschreibung: CARE_GENERISCH[sprache].beschreibung.replace(/\{name\}/g, saeule.name),
			},
		}));
	return [...katalog, ...generisch];
};

const istOffen = (status: string): boolean => status === 'Open' || status === 'In process';

/**
 * Wählt bis zu drei Vorschläge für eine Säule: offene Aufgaben (`Open`/`In process`, share > 0 auf
 * genau dieser Säule) zuerst, dann nicht abgelehnte Vorlagen dieser Säule. Ablehnungen jünger als
 * `CARE_ABLEHNUNG_TAGE` unterdrücken ihre Vorlage; Texte stehen bereits in der Zielsprache.
 * `saeulen` ist die Nutzer-Säulenliste (#2075): Task-Vorschläge geben ihre Aufgaben-Verteilung
 * 1:1 durch, Vorlagen tragen die vollständige Verteilung (Ziel-Säule 50 %, Rest gleichmäßig).
 */
export const waehleCareVorschlaege = (
	saeule: BalanceSaeule,
	saeulen: BalanceSaeule[],
	aufgaben: CareAufgabe[],
	vorlagen: CareVorlage[],
	ablehnungen: { templateKey: string; abgelehntAm: Date }[],
	jetzt: Date,
): CareVorschlag[] => {
	const unterdrueckt = new Set(
		ablehnungen
			.filter((ablehnung) => jetzt.getTime() - ablehnung.abgelehntAm.getTime() < CARE_ABLEHNUNG_TAGE * TAG_MS)
			.map((ablehnung) => ablehnung.templateKey),
	);

	const taskVorschlaege: CareVorschlag[] = aufgaben
		.filter(
			(aufgabe) =>
				istOffen(aufgabe.status) &&
				aufgabe.pillars.some((beitrag) => beitrag.pillarId === saeule.id && beitrag.share > 0),
		)
		.map((aufgabe) => ({
			typ: 'task' as const,
			titel: aufgabe.titel,
			beschreibung: aufgabe.beschreibung,
			saeulenBeitraege: aufgabe.pillars,
			taskId: aufgabe.id,
		}));

	const vorlagenVorschlaege: CareVorschlag[] = vorlagen
		.filter((vorlage) => vorlage.saeuleId === saeule.id && !unterdrueckt.has(vorlage.key))
		.map((vorlage) => ({
			typ: 'vorlage' as const,
			titel: vorlage.texte.titel,
			beschreibung: vorlage.texte.beschreibung,
			// Vorlage bekommt die vollständige Verteilung (#2075, AK2): Ziel-Säule 50 %, Rest gleichmäßig —
			// `POST /tasks` legt daraus einen Task mit fünf gültigen Beiträgen an (AK3).
			saeulenBeitraege: saeulenBeitraegeFuerZiel(saeule.id, saeulen),
			templateKey: vorlage.key,
		}));

	return [...taskVorschlaege, ...vorlagenVorschlaege].slice(0, MAX_VORSCHLAEGE);
};

/**
 * Erholungsvorschläge bei Überlast (#1795): zuerst die Pause-Vorlage, dann je bis zu zwei nicht
 * abgelehnte Vorlagen aus Körper und Mentale Gesundheit — die überlastete Säule selbst bleibt
 * ausgenommen. Nutzt `waehleCareVorschlaege` für die Ablehnungs-Logik; `saeuleId` kennzeichnet
 * die Säule des Vorschlags (die Route ergänzt den Namen). `saeulen` ist die Nutzer-Säulenliste
 * (#2075) — sie fließt in die vollständige Verteilung der Vorschläge ein. `erholungsSaeuleIds` sind
 * die Säulen-IDs des Nutzers für Körper und Mentale Gesundheit (#2146, Säulen-IDs gibt es pro Nutzer).
 */
export const waehleErholungsVorschlaege = (
	saeulen: BalanceSaeule[],
	ueberlasteSaeulenIds: number[],
	vorlagen: CareVorlage[],
	ablehnungen: { templateKey: string; abgelehntAm: Date }[],
	jetzt: Date,
	erholungsSaeuleIds: number[] = ERHOLUNGS_SAEULEN_IDS,
): (CareVorschlag & { saeuleId: number })[] => {
	const pauseVorlagen = vorlagen.filter((vorlage) => vorlage.key === PAUSE_VORLAGE_KEY);
	const uebrige = vorlagen.filter((vorlage) => vorlage.key !== PAUSE_VORLAGE_KEY);
	const pause = pauseVorlagen.flatMap((vorlage) =>
		waehleCareVorschlaege(
			{ id: vorlage.saeuleId, name: '', weight: 0 },
			saeulen,
			[],
			[vorlage],
			ablehnungen,
			jetzt,
		).map((vorschlag) => ({ ...vorschlag, saeuleId: vorlage.saeuleId })),
	);
	const ausSaeulen = erholungsSaeuleIds
		.filter((id) => !ueberlasteSaeulenIds.includes(id))
		.flatMap((id) =>
			waehleCareVorschlaege({ id, name: '', weight: 0 }, saeulen, [], uebrige, ablehnungen, jetzt)
				.slice(0, 2)
				.map((vorschlag) => ({ ...vorschlag, saeuleId: id })),
		);
	return [...pause, ...ausSaeulen];
};
