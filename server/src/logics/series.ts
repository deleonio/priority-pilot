import { Series, Task, SeriesPillar, TaskPillar } from '../models/index.js';
import type { SeriesRhythm } from '../models/series.js';

/** Optionen der Generierung; `until` ist der (inklusive) Materialisierungs-Horizont. */
interface GenerateOptions {
	/** Letzter zu materialisierender Zeitpunkt (inklusive). */
	until: Date;
	/** Eigentümer, der den erzeugten Instanzen zugeordnet wird (Issue #244). `undefined` → `null`. */
	userId?: number;
}

/** Ob der UTC-Wochentag `day` (0=So … 6=Sa) zum Rhythmus `weekdays` (Mo–Fr) bzw. `weekend` (Sa+So) gehört. */
const matchesGroup = (day: number, rhythm: 'weekdays' | 'weekend'): boolean =>
	rhythm === 'weekdays' ? day >= 1 && day <= 5 : day === 0 || day === 6;

/**
 * Nächster fälliger Termin nach `date` gemäß Rhythmus. UTC-basiert (deterministisch, DST-frei):
 * `daily` +1 Tag, `weekly` +7 Tage, `monthly` +1 Monat.
 *
 * Für die wochentag-basierten Rhythmen (#467/#469) wird nicht ein fester Schritt pro Periode
 * addiert, sondern **auf den nächsten passenden UTC-Wochentag** vorgerückt:
 * - `weekdays` → Mo–Fr (überspringt Wochenende), `weekend` → Sa+So, `mon`…`sun` → genau dieser Tag
 *   (jeweils +7 Tage auf denselben Wochentag). Diese Rhythmen erzeugen damit **mehrere Termine
 *   pro Woche** und durchbrechen das bisherige „ein Termin je Periode\"-Modell.
 *
 * `anchorDay` ist der **unveränderliche** Ziel-Tag aus `series.startDate` (z. B. 31). Für `monthly`
 * wird der Tag in jedem Schritt frisch aus diesem Anker abgeleitet und auf den letzten gültigen Tag
 * des Zielmonats geklemmt — so driftet ein Monatsende-Anker nicht (31.01. → 28.02. → **31.03.** → 30.04.).
 */
export const nextOccurrence = (date: Date, rhythm: SeriesRhythm, anchorDay: number): Date => {
	const next = new Date(date.getTime());
	switch (rhythm) {
		case 'daily':
			next.setUTCDate(next.getUTCDate() + 1);
			break;
		case 'weekly':
			next.setUTCDate(next.getUTCDate() + 7);
			break;
		case 'monthly': {
			// Vom Anker-Tag (nicht vom evtl. geklemmten Vormonats-Tag) ausgehen: erst auf den 1. setzen,
			// damit der Monatswechsel nie überrollt, dann Monat erhöhen und Tag auf min(Anker, letzterTag) klemmen.
			next.setUTCDate(1);
			next.setUTCMonth(next.getUTCMonth() + 1);
			const lastDayOfMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
			next.setUTCDate(Math.min(anchorDay, lastDayOfMonth));
			break;
		}
		case 'weekdays':
		case 'weekend': {
			// Tageweise vorrücken, bis der nächste Termin auf einen passenden Wochentag fällt.
			do {
				next.setUTCDate(next.getUTCDate() + 1);
			} while (!matchesGroup(next.getUTCDay(), rhythm));
			break;
		}
		case 'mon':
		case 'tue':
		case 'wed':
		case 'thu':
		case 'fri':
		case 'sat':
		case 'sun': {
			// Fester Wochentag: +7 Tage bleiben auf demselben Wochentag. Der Anker liegt
			// definitionsgemäß auf diesem Tag, daher ist der einfache Schritt korrekt.
			next.setUTCDate(next.getUTCDate() + 7);
			break;
		}
	}
	return next;
};

/**
 * Materialisiert aus einem Serien-Template alle fälligen Termine im Fenster `[startDate, until]` als
 * eigenständige `Task`-Instanzen (Habits, #120). Gibt **nur die neu erzeugten** Instanzen zurück.
 *
 * - **AK1:** je fälligem Termin genau eine Instanz mit `seriesId` und eigener `deadline`.
 * - **AK3:** die Default-Werte werden zum Generierungszeitpunkt als Snapshot kopiert — eine spätere
 *   Template-Änderung wirkt damit nur auf künftige, noch nicht materialisierte Termine.
 * - **AK4 (Idempotenz):** bereits materialisierte Termine (über `seriesOccurrence` erkannt) werden
 *   übersprungen, eine erneute Generierung desselben Fensters erzeugt keine Dublette.
 *
 * Ein inaktives Template (`active=false`) erzeugt keine Instanzen.
 *
 * **Nur zukünftige Termine:** Die Generierung beginnt ab dem aktuellen Datum (heute), um zu vermeiden,
 * dass rückwirkend vergangene Serien-Aufgaben angelegt werden (z. B. wenn eine Serie gelöscht und
 * später wieder aktiviert wurde).
 */
export const generateDueInstances = async (series: Series, options: GenerateOptions): Promise<Task[]> => {
	if (!series.active) {
		return [];
	}

	const untilTime = options.until.getTime();
	// Unveränderlicher Ziel-Tag aus dem Start-Anker — verhindert Drift bei `monthly` mit Monatsende-Anker.
	const anchorDay = series.startDate.getUTCDate();

	// Nur zukünftige Termine generieren: ab dem aktuellen Datum (heute, UTC-Mitternacht).
	// `now` wird auf Mitternacht normalisiert, damit der Idempotenz-Anker (`seriesOccurrence`)
	// deterministisch pro Tag bleibt — sonst trüge `new Date()` Millisekunden und erzeugte bei
	// jedem Aufruf einen anderen Anker, sodass dieselbe Serie + dasselbe Fenster duplizierte (AK4).
	const now = new Date();
	now.setUTCHours(0, 0, 0, 0);
	const nowTime = now.getTime();

	const occurrences: Date[] = [];
	// Vom Serien-Anker aus in Rhythmus-Schritten voranschreiten, bis der erste Termin mindestens
	// "heute" erreicht. So liegt jeder Termin — auch der erste nach der "heute"-Verschiebung bei
	// vergangenen `startDate` — auf dem Raster: für `monthly` entspricht der erste Termin dann dem
	// Anker-Tag (z. B. der 15.) und nicht "heute", für `daily`/`weekly` ist der Anker der Schritt.
	let current = new Date(series.startDate.getTime());
	while (current.getTime() < nowTime) {
		current = nextOccurrence(current, series.rhythm, anchorDay);
	}
	while (current.getTime() <= untilTime) {
		occurrences.push(new Date(current.getTime()));
		current = nextOccurrence(current, series.rhythm, anchorDay);
	}

	// Bereits materialisierte Termine dieser Serie sammeln (Idempotenz-Anker `seriesOccurrence`).
	const existing = await Task.findAll({ where: { seriesId: series.id } });
	const materialized = new Set(
		existing
			.filter((task) => task.seriesOccurrence != null)
			.map((task) => new Date(task.seriesOccurrence as Date).getTime()),
	);

	// Snapshot der Pillar-Vorlage einmal vor der Schleife laden (AK3: Snapshot-Zeitpunkt).
	const pillarRows = await SeriesPillar.findAll({ where: { seriesId: series.id } });

	const created: Task[] = [];
	for (const occurrence of occurrences) {
		if (materialized.has(occurrence.getTime())) {
			continue;
		}
		const instance = await Task.create({
			title: series.title,
			priority: series.priority,
			estimatedEffort: series.estimatedEffort,
			description: series.description ?? null,
			deadline: occurrence,
			seriesId: series.id,
			seriesOccurrence: occurrence,
			isException: false,
			userId: options.userId ?? null,
		});
		if (pillarRows.length > 0) {
			await TaskPillar.bulkCreate(
				pillarRows.map((r) => ({
					taskId: instance.id,
					pillarId: r.pillarId,
					share: r.share,
					confidence: r.confidence,
				})),
			);
		}
		created.push(instance);
	}
	return created;
};

/**
 * Materialisiert die fälligen Instanzen **aller aktiven Serien** bis `until` (Issue #244, AK6). Optional
 * auf einen Eigentümer eingeschränkt (`userId`): im Auth-Modus sieht/materialisiert ein Nutzer nur seine
 * eigenen Serien, im Pass-Through-Modus (`undefined`) alle. Fehler einzelner Serien werden isoliert und
 * geloggt — ein Ausreißer bricht den Gesamtlauf nicht ab. Gibt alle neu erzeugten Instanzen zurück.
 */
export const materializeDueSeries = async (userId: number | undefined, until: Date): Promise<Task[]> => {
	const seriesList = await Series.findAll({ where: { active: true, ...(userId !== undefined ? { userId } : {}) } });
	const created: Task[] = [];
	for (const series of seriesList) {
		try {
			const instances = await generateDueInstances(series, { until, userId });
			created.push(...instances);
		} catch (error) {
			console.error(`Serie ${series.id} konnte nicht materialisiert werden:`, error);
		}
	}
	return created;
};
