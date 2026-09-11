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
const tagIn = (zeitpunkt: Date, zeitZone: string): string => {
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

/** Der Kalendertag vor `tag` (Zivilrechnung, unabhängig von Sommerzeit-Sprüngen). */
const vortag = (tag: string): string => new Date(alsZeitstempel(tag) - TAG_MS).toISOString().slice(0, 10);

export interface StreakErgebnis {
	/** Länge der ununterbrochenen Tagesfolge, die auf „heute" oder „gestern" endet; sonst 0. */
	aktuell: number;
	/** Länge der längsten ununterbrochenen Tagesfolge über alle Daten. */
	best: number;
	/** Aufsteigend sortierte, duplikatfreie Kalendertage (`YYYY-MM-DD`) mit mindestens einer Erledigung. */
	aktiveTage: string[];
}

/**
 * Streak-Kennzahlen aus den Erledigungszeitpunkten.
 *
 * Mehrere Erledigungen am selben Kalendertag zählen als ein aktiver Tag. `aktuell` bleibt auch dann
 * stehen, wenn heute noch nichts erledigt wurde, die Folge aber bis gestern reicht — der Tag ist ja
 * noch nicht vorbei; erst eine Lücke bis gestern bricht den Streak sichtbar auf 0. `best` überdauert
 * einen Bruch und bleibt die persönliche Bestmarke.
 */
export const berechneStreak = (erledigungsZeitpunkte: Date[], heute: Date, zeitZone: string): StreakErgebnis => {
	const aktiveTage = [...new Set(erledigungsZeitpunkte.map((zeitpunkt) => tagIn(zeitpunkt, zeitZone)))].sort();
	if (aktiveTage.length === 0) {
		return { aktuell: 0, best: 0, aktiveTage };
	}

	let best = 1;
	let laufend = 1;
	// Länge der Folge, die am letzten aktiven Tag endet — sie entscheidet über `aktuell`.
	for (let i = 1; i < aktiveTage.length; i++) {
		const luecke = alsZeitstempel(aktiveTage[i]) - alsZeitstempel(aktiveTage[i - 1]);
		laufend = luecke === TAG_MS ? laufend + 1 : 1;
		best = Math.max(best, laufend);
	}

	const heuteTag = tagIn(heute, zeitZone);
	const letzterTag = aktiveTage[aktiveTage.length - 1];
	const aktuell = letzterTag === heuteTag || letzterTag === vortag(heuteTag) ? laufend : 0;

	return { aktuell, best, aktiveTage };
};
