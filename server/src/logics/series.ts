import { Series, Task } from '../models/index.js';
import type { SeriesRhythm } from '../models/series.js';
import { ownerScope } from '../express/requireAuth.js';

/** Optionen der Generierung; `until` ist der (inklusive) Materialisierungs-Horizont. */
interface GenerateOptions {
	/** Letzter zu materialisierender Zeitpunkt (inklusive). */
	until: Date;
	/** Eigentümer, der den erzeugten Instanzen zugeordnet wird (Issue #244). `undefined` ⇒ `null`. */
	userId?: number;
}

/**
 * Nächster fälliger Termin nach `date` gemäß Rhythmus. UTC-basiert (deterministisch, DST-frei):
 * `daily` +1 Tag, `weekly` +7 Tage, `monthly` +1 Monat.
 *
 * `anchorDay` ist der **unveränderliche** Ziel-Tag aus `series.startDate` (z. B. 31). Für `monthly`
 * wird der Tag in jedem Schritt frisch aus diesem Anker abgeleitet und auf den letzten gültigen Tag
 * des Zielmonats geklemmt — so driftet ein Monatsende-Anker nicht (31.01. → 28.02. → **31.03.** → 30.04.).
 */
const nextOccurrence = (date: Date, rhythm: SeriesRhythm, anchorDay: number): Date => {
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
	// Unveränderlicher Ziel-Tag aus dem Start-Anker — verhindert Drift bei `monthly` mit Monatsende-Anker.
	const anchorDay = series.startDate.getUTCDate();
	const occurrences: Date[] = [];
	let current = new Date(series.startDate.getTime());
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
			userId: options.userId ?? null,
		});
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
	const seriesList = await Series.findAll({ where: { active: true, ...ownerScope(userId) } });
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
