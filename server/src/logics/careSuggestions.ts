/**
 * Auswahl-Logik der Fürsorge-Vorschläge (#1791) — reine Funktion ohne DB/HTTP. Liefert je
 * Defizit-Säule bis zu drei Vorschläge: zuerst eigene offene Aufgaben mit Säulen-Beitrag zu
 * genau dieser Säule, sonst kuratierte Vorlagen (`logics/careSuggestionData.ts`). Eine Ablehnung
 * unterdrückt ihre Vorlage für `CARE_ABLEHNUNG_TAGE` (AK4). Die Sprache ist von der Route bereits
 * aufgelöst (Vorlagen kommen mit Texten in der Zielsprache); #1804 (KI-Vorschläge Plus/Pro)
 * erweitert später dieselbe Antwortform — DTO bewusst offen über `typ`.
 */
import { type BalanceSaeule } from './heartBalance.js';

/** Wie lange eine abgelehnte Vorlage unterdrückt bleibt (AK4): davor weg, ab exakt so vielen Tagen wieder lieferbar. */
const CARE_ABLEHNUNG_TAGE = 14;

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

const istOffen = (status: string): boolean => status === 'Open' || status === 'In process';

/**
 * Wählt bis zu drei Vorschläge für eine Säule: offene Aufgaben (`Open`/`In process`, share > 0 auf
 * genau dieser Säule) zuerst, dann nicht abgelehnte Vorlagen dieser Säule. Ablehnungen jünger als
 * `CARE_ABLEHNUNG_TAGE` unterdrücken ihre Vorlage; Texte stehen bereits in der Zielsprache.
 */
export const waehleCareVorschlaege = (
	saeule: BalanceSaeule,
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
			// Vorlagen zielen voll auf die Säule — so legt `POST /tasks` daraus einen Task derselben Säule an (AK3).
			saeulenBeitraege: [{ pillarId: saeule.id, share: 100 }],
			templateKey: vorlage.key,
		}));

	return [...taskVorschlaege, ...vorlagenVorschlaege].slice(0, MAX_VORSCHLAEGE);
};
