import { Task, TaskPillar } from '../models/index.js';
import type Series from '../models/series.js';

/**
 * Vorlauf-Fenster in Tagen: Aus einer Serie werden nur Termine **im Horizont** `[now, now + 14 Tage]`
 * vorab materialisiert. So bleibt der Aufgabenbestand überschaubar und das Fenster rollt mit der Zeit
 * weiter — künftige Template-Änderungen wirken dadurch nur auf noch nicht erzeugte Termine.
 */
export const HORIZONT_TAGE = 14;

const MS_PRO_TAG = 86_400_000;

/** Standardtitel einer materialisierten Instanz, wenn die Vorlage keinen eigenen Titel trägt. */
const STANDARD_TITEL = 'Serientermin';

/**
 * Ermittelt alle fälligen Termine der Serie im Fenster `[fensterStart, fensterEnde]` (inklusiv) als
 * UTC-Mitternacht-Daten. Anker ist `startDate`; die Schrittweite ergibt sich aus `frequency`
 * (DAILY/WEEKLY) × `interval`. Der erste Termin im Fenster wird arithmetisch bestimmt, statt vom weit
 * zurückliegenden Anker zu iterieren.
 */
const ermittleTermine = (series: Series, fensterStart: Date, fensterEnde: Date): Date[] => {
	const ankerMs = new Date(`${series.startDate}T00:00:00.000Z`).getTime();
	const schrittTage = series.frequency === 'DAILY' ? series.interval : series.interval * 7;
	const schrittMs = schrittTage * MS_PRO_TAG;

	// Index des ersten Termins, der nicht vor dem Fensterstart liegt (nie negativ).
	const ersterIndex = Math.max(0, Math.ceil((fensterStart.getTime() - ankerMs) / schrittMs));
	const termine: Date[] = [];
	for (let ms = ankerMs + ersterIndex * schrittMs; ms <= fensterEnde.getTime(); ms += schrittMs) {
		termine.push(new Date(ms));
	}
	return termine;
};

/**
 * Materialisiert je fälligem Termin der Serie im Horizont `[now, now + HORIZONT_TAGE]` genau **eine**
 * `Task`-Instanz (AC1). Eigenschaften der Instanz:
 * - `seriesId` zeigt auf die Vorlage, `seriesOccurrence` ist der Idempotenz-Anker (Periodendatum),
 *   `deadline` entspricht dem Termin, `priority` übernimmt die aktuelle `defaultPriority`.
 * - Die Säulen-Verteilung der Vorlage wird als **Snapshot** (`series_pillars` → `task_pillars`) kopiert
 *   (AC3) — spätere Template-Edits berühren bestehende Instanzen nicht.
 *
 * **Idempotent** (AC4): Über `(seriesId, seriesOccurrence)` wird je Periode höchstens eine Instanz
 * angelegt; ein erneuter Aufruf für dieselbe Periode erzeugt keine Dublette. Eine inaktive Serie
 * (`active=false`) erzeugt nichts. Gibt die in diesem Aufruf **neu** erzeugten Instanzen zurück.
 */
export const generateDueInstances = async (series: Series, now: Date): Promise<Task[]> => {
	if (!series.active) {
		return [];
	}

	const fensterEnde = new Date(now.getTime() + HORIZONT_TAGE * MS_PRO_TAG);
	const termine = ermittleTermine(series, now, fensterEnde);

	// Säulen-Snapshot der Vorlage einmalig laden (gilt für alle in diesem Lauf erzeugten Instanzen).
	const vorlagenSaeulen = await series.getPillars();
	const neueInstanzen: Task[] = [];

	for (const termin of termine) {
		const [task, wurdeErzeugt] = await Task.findOrCreate({
			where: { seriesId: series.id, seriesOccurrence: termin },
			defaults: {
				title: STANDARD_TITEL,
				priority: series.defaultPriority,
				seriesId: series.id,
				seriesOccurrence: termin,
				deadline: termin,
			},
		});
		if (!wurdeErzeugt) {
			continue;
		}
		if (vorlagenSaeulen.length > 0) {
			await TaskPillar.bulkCreate(
				vorlagenSaeulen.map((saeule) => ({
					taskId: task.id,
					pillarId: saeule.id,
					share: saeule.SeriesPillar.share,
					confidence: saeule.SeriesPillar.confidence,
				})),
				{ validate: true },
			);
		}
		neueInstanzen.push(task);
	}

	return neueInstanzen;
};
