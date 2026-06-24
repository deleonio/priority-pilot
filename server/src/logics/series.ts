import { Task } from '../models/index.js';
import type Series from '../models/series.js';
import type { SeriesRhythm } from '../models/series.js';

/** Optionen der Generierung; `until` ist der (inklusive) Materialisierungs-Horizont. */
export interface GenerateOptions {
	/** Letzter zu materialisierender Zeitpunkt (inklusive). */
	until: Date;
}

/**
 * Nächster fälliger Termin nach `date` gemäß Rhythmus. UTC-basiert (deterministisch, DST-frei):
 * `daily` +1 Tag, `weekly` +7 Tage, `monthly` +1 Monat.
 */
const nextOccurrence = (date: Date, rhythm: SeriesRhythm): Date => {
	const next = new Date(date.getTime());
	switch (rhythm) {
		case 'daily':
			next.setUTCDate(next.getUTCDate() + 1);
			break;
		case 'weekly':
			next.setUTCDate(next.getUTCDate() + 7);
			break;
		case 'monthly':
			next.setUTCMonth(next.getUTCMonth() + 1);
			// Fix: Klemme auf den letzten Tag des Monats, falls der Tag nicht existiert (z. B. 31.01. → 31.02. → 03.03.)
			if (next.getUTCDate() !== date.getUTCDate()) {
				next.setUTCDate(0); // 0 = letzter Tag des vorherigen Monats
			}
			break;
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
 */
export const generateDueInstances = async (series: Series, options: GenerateOptions): Promise<Task[]> => {
	if (!series.active) {
		return [];
	}

	const untilTime = options.until.getTime();
	const occurrences: Date[] = [];
	let current = new Date(series.startDate.getTime());
	while (current.getTime() <= untilTime) {
		occurrences.push(new Date(current.getTime()));
		current = nextOccurrence(current, series.rhythm);
	}

	// Bereits materialisierte Termine dieser Serie sammeln (Idempotenz-Anker `seriesOccurrence`).
	const existing = await Task.findAll({ where: { seriesId: series.id } });
	const materialized = new Set(
		existing
			.filter((task) => task.seriesOccurrence != null)
			.map((task) => new Date(task.seriesOccurrence as Date).getTime()),
	);

	const created: Task[] = [];
	for (const occurrence of occurrences) {
		if (materialized.has(occurrence.getTime())) {
			continue;
		}
		const instance = await Task.create({
			title: series.title,
			priority: series.defaultPriority,
			estimatedEffort: series.defaultEstimatedEffort,
			deadline: occurrence,
			seriesId: series.id,
			seriesOccurrence: occurrence,
			isException: false,
		});
		created.push(instance);
	}
	return created;
};
