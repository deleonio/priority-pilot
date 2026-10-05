/**
 * Streak-Auswertung (#1360) — Kalendertage in Folge mit mindestens einer Erledigung.
 *
 * Bewusst getrennt vom Gamification-Scoring (`score.ts`): Dort zählen Punkte je Task, hier zählt
 * allein die Frage „wurde an diesem Kalendertag überhaupt etwas abgehakt?". Die Tages-Erkennung
 * (`aktiveTage`) ist die Datengrundlage, auf die die Folge-Tickets (Tag-geschafft-Moment,
 * Meilenstein-Badges, Push-Meldung) aufsetzen — sie erfinden sie nicht neu.
 *
 * Reine Logik ohne DB-Zugriff; die Erledigungszeitpunkte reicht die Route aus `ScoreEntry.zeitpunkt`
 * herein (genau eine Zeile je erledigtem Task).
 */

/** Millisekunden eines Kalendertages — Abstand zweier benachbarter Tage in der UTC-Zivilrechnung. */
const TAG_MS = 24 * 60 * 60 * 1000;

/**
 * Kalendertag (`YYYY-MM-DD`) eines Zeitpunkts in der gegebenen IANA-Zeitzone.
 *
 * Die Teile werden einzeln aus `formatToParts` zusammengesetzt statt über ein Locale-Format:
 * Welches Locale `YYYY-MM-DD` liefert, ist Umgebungssache — die Teile sind es nicht.
 */
export const tagIn = (zeitpunkt: Date, zeitZone: string): string => {
	const teile = new Intl.DateTimeFormat('en-US', {
		timeZone: zeitZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(zeitpunkt);
	const teil = (type: Intl.DateTimeFormatPartTypes): string => teile.find((p) => p.type === type)?.value ?? '';
	return `${teil('year')}-${teil('month')}-${teil('day')}`;
};

/**
 * Ob `zeitZone` eine gültige IANA-Zeitzone ist. Ungültige Werte lässt `Intl` mit `RangeError`
 * auflaufen — die Route fällt in dem Fall auf die Serverzeit zurück, statt einen Fehler zu liefern.
 */
export const istGueltigeZeitzone = (zeitZone: string | undefined): zeitZone is string => {
	if (zeitZone === undefined || zeitZone === '') return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: zeitZone });
		return true;
	} catch {
		return false;
	}
};

/** Ein Kalendertag `YYYY-MM-DD` als UTC-Zeitstempel seiner Mitternacht (nur für Tagesabstände). */
const alsZeitstempel = (tag: string): number => {
	const [jahr, monat, tagImMonat] = tag.split('-').map(Number);
	return Date.UTC(jahr, monat - 1, tagImMonat);
};

/** Der Kalendertag nach `tag` (Zivilrechnung, unabhängig von Sommerzeit-Sprüngen). */
const folgetag = (tag: string): string => new Date(alsZeitstempel(tag) + TAG_MS).toISOString().slice(0, 10);

/** Montag der Vorwoche zu einem Wochen-Montag. */
const vorwoche = (montag: string): string => new Date(alsZeitstempel(montag) - 7 * TAG_MS).toISOString().slice(0, 10);

/** Montag (`YYYY-MM-DD`) der Kalenderwoche Mo–So, in der `tag` liegt — Schlüssel für die Ruhetag-Regel (#1971). */
const wochenStart = (tag: string): string => {
	const zeitstempel = alsZeitstempel(tag);
	const tageSeitMontag = (new Date(zeitstempel).getUTCDay() + 6) % 7;
	return new Date(zeitstempel - tageSeitMontag * TAG_MS).toISOString().slice(0, 10);
};

export interface StreakErgebnis {
	/** Aktive Tage der Kette, die bis „heute" reicht (heute selbst darf noch offen sein); sonst 0. */
	aktuell: number;
	/** Aktive Tage der längsten Kette über alle Daten. */
	best: number;
	/** Aufsteigend sortierte, duplikatfreie Kalendertage (`YYYY-MM-DD`) mit mindestens einer Erledigung. */
	aktiveTage: string[];
}

/**
 * Zeitpunkte, die für die Streak zählen (#1820): der Abhake-Zeitpunkt und — bei verspäteter
 * Erledigung (Fälligkeitstag vor Abhake-Tag) — zusätzlich die Fälligkeit, damit der verpasste
 * Fälligkeitstag als erfüllt gilt. Pünktliche Einträge und solche ohne `deadline` bleiben unverändert.
 */
export const streakZeitpunkte = (eintraege: { zeitpunkt: Date; deadline?: Date | null }[], zeitZone: string): Date[] =>
	eintraege.flatMap(({ zeitpunkt, deadline }) =>
		deadline && tagIn(deadline, zeitZone) < tagIn(zeitpunkt, zeitZone) ? [zeitpunkt, deadline] : [zeitpunkt],
	);

/**
 * Streak-Kennzahlen aus den Erledigungszeitpunkten.
 *
 * Mehrere Erledigungen am selben Kalendertag zählen als ein aktiver Tag. Ein Ruhetag je
 * Kalenderwoche (Mo–So, #1971) hält die Kette, zählt aber nicht mit; ein zweiter freier Tag derselben
 * Woche bricht sie, ungenutzte Ruhetage verfallen mit der Woche. Heute ist noch offen und nie eine
 * Lücke. `best` überdauert einen Bruch und bleibt die persönliche Bestmarke.
 */
export const berechneStreak = (erledigungsZeitpunkte: Date[], heute: Date, zeitZone: string): StreakErgebnis => {
	const aktiveTage = [...new Set(erledigungsZeitpunkte.map((zeitpunkt) => tagIn(zeitpunkt, zeitZone)))].sort();
	if (aktiveTage.length === 0) {
		return { aktuell: 0, best: 0, aktiveTage };
	}

	let best = 1;
	let laufend = 1;
	// Woche, deren Ruhetag die laufende Kette schon verbraucht hat — freie Tage kommen chronologisch.
	let ruhetagWoche: string | null = null;
	/** Ob die freien Tage von `ab` bis vor `bis` die Kette halten; verbraucht dabei die Ruhetage. */
	const haeltLuecke = (ab: string, bis: string): boolean => {
		for (let tag = ab; tag < bis; tag = folgetag(tag)) {
			const woche = wochenStart(tag);
			if (woche === ruhetagWoche) return false;
			ruhetagWoche = woche;
		}
		return true;
	};
	// Länge der Folge, die am letzten aktiven Tag endet — sie entscheidet über `aktuell`.
	for (let i = 1; i < aktiveTage.length; i++) {
		if (haeltLuecke(folgetag(aktiveTage[i - 1]), aktiveTage[i])) {
			laufend++;
		} else {
			laufend = 1;
			ruhetagWoche = null;
		}
		best = Math.max(best, laufend);
	}

	const heuteTag = tagIn(heute, zeitZone);
	const letzterTag = aktiveTage[aktiveTage.length - 1];
	const aktuell =
		letzterTag === heuteTag || (letzterTag < heuteTag && haeltLuecke(folgetag(letzterTag), heuteTag)) ? laufend : 0;

	return { aktuell, best, aktiveTage };
};

/**
 * Ob heute als Ruhetag der laufenden Woche zählt (#1971): heute noch nichts erledigt und Montag bis
 * gestern lückenlos aktiv. Die Streak-Erinnerung schweigt dann.
 */
export const istHeuteRuhetag = (aktiveTage: string[], heute: Date, zeitZone: string): boolean => {
	const heuteTag = tagIn(heute, zeitZone);
	const aktiv = new Set(aktiveTage);
	if (aktiv.has(heuteTag)) return false;
	for (let tag = wochenStart(heuteTag); tag < heuteTag; tag = folgetag(tag)) {
		if (!aktiv.has(tag)) return false;
	}
	return true;
};

/**
 * Anzahl aufeinanderfolgender ausgewogener Kalenderwochen (#1971): jede der drei Säulen mit dem
 * höchsten `weight` (Gleichstand: kleinere id; weniger als drei: alle) hat eine Erledigung. Die
 * laufende Woche zählt, sobald sie ausgewogen ist, bricht die Folge aber nicht, solange sie offen ist.
 *
 * @param eintraege Erledigungen mit den Säulen (`share` > 0) ihrer Aufgabe.
 */
export const berechneWochenAusgewogen = (
	eintraege: { zeitpunkt: Date; saeulenIds: number[] }[],
	saeulen: { id: number; weight: number }[],
	heute: Date,
	zeitZone: string,
): number => {
	if (saeulen.length === 0) return 0;
	const topSaeulen = [...saeulen]
		.sort((a, b) => b.weight - a.weight || a.id - b.id)
		.slice(0, 3)
		.map(({ id }) => id);
	const saeulenJeWoche = new Map<string, Set<number>>();
	for (const { zeitpunkt, saeulenIds } of eintraege) {
		const woche = wochenStart(tagIn(zeitpunkt, zeitZone));
		const erledigt = saeulenJeWoche.get(woche) ?? new Set<number>();
		saeulenIds.forEach((id) => erledigt.add(id));
		saeulenJeWoche.set(woche, erledigt);
	}
	const ausgewogen = (woche: string): boolean => topSaeulen.every((id) => saeulenJeWoche.get(woche)?.has(id));

	const laufendeWoche = wochenStart(tagIn(heute, zeitZone));
	let anzahl = ausgewogen(laufendeWoche) ? 1 : 0;
	for (let woche = vorwoche(laufendeWoche); ausgewogen(woche); woche = vorwoche(woche)) {
		anzahl++;
	}
	return anzahl;
};
