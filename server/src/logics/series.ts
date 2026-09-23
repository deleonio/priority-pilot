import { Series, Task, SeriesPillar, TaskPillar, User } from '../models/index.js';
import type { SeriesRhythm } from '../models/series.js';
import { notifySeriesGenerated } from './seriesGeneratedNotification.js';
import type { PushSender } from './push.js';

/** Optionen der Generierung; `until` ist der (inklusive) Materialisierungs-Horizont. */
interface GenerateOptions {
	/** Letzter zu materialisierender Zeitpunkt (inklusive). */
	until: Date;
	/** Eigentümer, der den erzeugten Instanzen zugeordnet wird (Issue #244). `undefined` → `null`. */
	userId?: number;
	/** Injizierbarer Web-Push-Versand für den Serien-Benachrichtigungstrigger #1253 (Default: web-push). */
	pushSender?: PushSender;
}

/**
 * Höchstzahl offener Instanzen (`status != 'Done'`) je Serie, die die Generierung vorhält (#1518).
 * Der Horizont `until` bleibt als Obergrenze bestehen — für tägliche Serien greift die Fünfer-Grenze,
 * wöchentliche/monatliche erreichen sie innerhalb der 30 Tage nicht. Bestand über der Grenze wird
 * nicht gelöscht; er verschwindet über {@link selectSeriesRepresentatives} aus den Lesestellen.
 */
const MAX_OPEN_INSTANCES = 5;

/** Minimalvertrag der Auswahlregel — passt auf `Task`-Modelle wie auf serialisierte DTOs. */
interface SeriesCandidate {
	seriesId?: number | null;
	deadline?: Date | string | null;
	status?: string;
}

/**
 * Auswahlregel #1518: je `seriesId` genau EINE Instanz — die früheste offene mit Deadline ab heute
 * (UTC-Kalendertag von `now`), sonst die jüngste vergangene offene. Erledigte Instanzen sind nie
 * Repräsentant; Aufgaben ohne `seriesId` (auch abgekoppelte mit `originSeriesId`) bleiben unverändert.
 * Die Eingabereihenfolge bleibt erhalten — nur nicht gewählte Instanzen fallen weg. Zentrale Funktion
 * für Wald, `/next`, `/suggestions`, `/tasks/nearby` und die drei Push-Collector.
 */
export const selectSeriesRepresentatives = <T extends SeriesCandidate>(tasks: T[], now: Date = new Date()): T[] => {
	const today = new Date(now.getTime());
	today.setUTCHours(0, 0, 0, 0);
	const todayTime = today.getTime();
	const deadlineTime = (task: T): number | null => (task.deadline == null ? null : new Date(task.deadline).getTime());

	// Rang je Instanz: kommende (ab heute) vor vergangenen, jeweils näher an heute = besser;
	// ohne Deadline nur als letzter Fallback.
	const rank = (task: T): number => {
		const time = deadlineTime(task);
		if (time === null) {
			return Number.POSITIVE_INFINITY;
		}
		return time >= todayTime ? time - todayTime : Number.MAX_SAFE_INTEGER / 2 + (todayTime - time);
	};

	const chosen = new Map<number, T>();
	for (const task of tasks) {
		if (task.seriesId == null || task.status === 'Done') {
			continue;
		}
		const current = chosen.get(task.seriesId);
		if (current === undefined || rank(task) < rank(current)) {
			chosen.set(task.seriesId, task);
		}
	}
	return tasks.filter((task) => task.seriesId == null || chosen.get(task.seriesId) === task);
};

/** Vorlauf (Issue #1641): Aufgaben mit `deadline` mehr als so viele Kalendertage in der Zukunft werden zurückgehalten. */
const VORLAUF_TAGE = 3;

/**
 * Filtert Aufgaben mit `deadline` mehr als {@link VORLAUF_TAGE} Kalendertage in der Zukunft heraus
 * (Issue #1641). Ohne `deadline`, innerhalb des Vorlaufs (Grenze inklusiv) oder überfällig bleiben
 * unverändert erhalten. Setzt nach {@link selectSeriesRepresentatives} an, damit bei Serien das
 * Datum der aktuellen Instanz entscheidet.
 */
export const filterVorlauf = <T extends { deadline?: Date | string | null }>(tasks: T[], now: Date): T[] => {
	const today = new Date(now.getTime());
	today.setUTCHours(0, 0, 0, 0);
	const maxTime = today.getTime() + VORLAUF_TAGE * 24 * 60 * 60 * 1000;
	return tasks.filter((task) => {
		if (task.deadline == null) {
			return true;
		}
		const deadlineDay = new Date(task.deadline);
		deadlineDay.setUTCHours(0, 0, 0, 0);
		return deadlineDay.getTime() <= maxTime;
	});
};

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
 * **Fünfer-Grenze (#1518):** je Serie werden höchstens {@link MAX_OPEN_INSTANCES} offene Instanzen
 * vorgehalten; erledigte Instanzen geben ihren Platz frei, sodass der nächste Lauf nachfüllt.
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

	// Fünfer-Grenze (#1518): nur so viele neue Instanzen, wie bis MAX_OPEN_INSTANCES offen fehlen.
	let budget = MAX_OPEN_INSTANCES - existing.filter((task) => task.status !== 'Done').length;

	const created: Task[] = [];
	for (const occurrence of occurrences) {
		if (budget <= 0) {
			break;
		}
		if (materialized.has(occurrence.getTime())) {
			continue;
		}
		budget -= 1;
		const instance = await Task.create({
			title: series.title,
			priority: series.priority,
			estimatedEffort: series.estimatedEffort,
			description: series.description ?? null,
			// #1063: Serien-Ortsbezug wird als Snapshot auf jede Instanz vererbt (Semantik wie
			// `description`): Template-Änderungen wirken nur auf künftige Instanzen.
			address: series.address ?? null,
			// #1066: Koordinaten-Snapshot analog `address` — Koordinaten sind stabil, spätere
			// Template-Änderungen wirken nur auf künftige Instanzen (#553-Muster).
			latitude: series.latitude ?? null,
			longitude: series.longitude ?? null,
			deadline: occurrence,
			seriesId: series.id,
			seriesOccurrence: occurrence,
			isException: false,
			// #553: Provenienz einmalig und dauerhaft festhalten. `seriesId` ist der Live-Link (fällt beim
			// Abkoppeln auf null), `originSeriesId` bleibt als Herkunftsnachweis auch nach Serien-Löschung.
			originSeriesId: series.id,
			// #1222: Die Instanz gehört dem Serien-Eigentümer — bei einer Serie für ein anderes
			// Gruppenmitglied (#1222) trägt sie dessen `userId`, nicht den des auslösenden Laufs.
			// `options.userId` (Sammel-Lauf des Eigentümers) bleibt harmlos identisch.
			userId: options.userId ?? series.userId ?? null,
			// #523: Auto-Lösch-Option wird vom Template auf jede generierte Instanz vererbt (Snapshot zum
			// Generierungszeitpunkt, wie die übrigen Default-Werte — AK3/AK4).
			autoDeleteAfterDeadline: series.autoDeleteAfterDeadline,
			// Kategorie-Snapshot analog `address`: Eine spätere Template-Änderung wirkt nur auf künftige
			// Instanzen (die Kaskade in PATCH /series zieht offene Instanzen auf Wunsch mit).
			categoryId: series.categoryId ?? null,
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

	// #1253: Erzeugt dieser Lauf Instanzen einer fremd angelegten Serie (A für B), erhält B genau
	// eine gebündelte Nachricht. Der Auslöser sitzt bewusst in der Generierungslogik (nicht im
	// Router), damit beide Endpunkte und künftige Aufrufer ihn teilen; die Stille-Entscheidung
	// (Selbst-Anlage/Alt-Bestand) trifft `notifySeriesGenerated`. Restfehler werden gefangen und
	// nur protokolliert, damit die Generierung unberührt bleibt (AK5, Muster routes/tasks.ts #1224).
	if (created.length > 0 && series.createdById != null && series.createdById !== series.userId) {
		try {
			const creator = await User.findByPk(series.createdById);
			await notifySeriesGenerated(series, created, creator, options.pushSender);
		} catch (error) {
			console.warn(`Benachrichtigung zur Serie ${series.id} fehlgeschlagen:`, error);
		}
	}
	return created;
};

/**
 * Materialisiert die fälligen Instanzen **aller aktiven Serien** bis `until` (Issue #244, AK6). Optional
 * auf einen Eigentümer eingeschränkt (`userId`): im Auth-Modus sieht/materialisiert ein Nutzer nur seine
 * eigenen Serien, im Pass-Through-Modus (`undefined`) alle. Fehler einzelner Serien werden isoliert und
 * geloggt — ein Ausreißer bricht den Gesamtlauf nicht ab. Gibt alle neu erzeugten Instanzen zurück.
 */
export const materializeDueSeries = async (
	userId: number | undefined,
	until: Date,
	pushSender?: PushSender,
): Promise<Task[]> => {
	const seriesList = await Series.findAll({ where: { active: true, ...(userId !== undefined ? { userId } : {}) } });
	const created: Task[] = [];
	for (const series of seriesList) {
		try {
			const instances = await generateDueInstances(series, { until, userId, pushSender });
			created.push(...instances);
		} catch (error) {
			console.error(`Serie ${series.id} konnte nicht materialisiert werden:`, error);
		}
	}
	return created;
};
