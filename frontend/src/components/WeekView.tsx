import { KolButton, KolCard } from '@public-ui/react-v19';
import type { CalendarEvent, Task } from 'client';
import { TaskStatus } from 'client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { formatDeadline } from '../lib/task';

/** Schlüssel der Wochentagsnamen, Montag zuerst (ISO-Wochenstart). */
const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const MS_PER_DAY = 86_400_000;

/** Kalendertag (UTC-Mitternacht) eines Datums — konsistent zur Deadline-Konvention (`lib/task.ts`). */
const utcDay = (date: Date): number => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/**
 * Die 7 Kalendertage (UTC-Mitternacht) der Woche, in der `reference` liegt — Montag zuerst.
 * `getUTCDay()` liefert 0 (Sonntag) bis 6 (Samstag); der Montags-Versatz normalisiert auf ISO-Wochenstart.
 */
const weekDatesFor = (reference: Date): Date[] => {
	const referenceDay = utcDay(reference);
	const isoWeekday = new Date(referenceDay).getUTCDay(); // 0=So..6=Sa
	const offsetToMonday = isoWeekday === 0 ? 6 : isoWeekday - 1;
	const monday = referenceDay - offsetToMonday * MS_PER_DAY;
	return Array.from({ length: 7 }, (_, index) => new Date(monday + index * MS_PER_DAY));
};

/** Prüft, ob zwei Daten denselben UTC-Kalendertag treffen. */
const sameUtcDay = (a: Date, b: Date): boolean => utcDay(a) === utcDay(b);

/**
 * Gehört ein Termin zur Tageskarte `day` (UTC-Mitternacht)? Termine mit Uhrzeit zählen nach LOKALEM
 * Starttag (23:30 Ortszeit bleibt am eigenen Tag, #2210); ganztägige Termine sind reine Daten
 * (`DATE` = UTC-Mitternacht, `server/src/logics/calendar-ics.ts`) und zählen nach dem UTC-Tag.
 */
const eventOnDay = (event: CalendarEvent, day: Date): boolean => {
	const start = new Date(event.start);
	return event.allDay
		? utcDay(start) === utcDay(day)
		: Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) === utcDay(day);
};

const pad = (value: number): string => String(value).padStart(2, '0');
const clock = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Zeitblock `HH:MM–HH:MM` in Ortszeit, ganztägig als Text. */
const eventTime = (event: CalendarEvent, t: TFunction<'capture'>): string =>
	event.allDay ? t('weekView.allDay') : `${clock(new Date(event.start))}–${clock(new Date(event.end))}`;

interface WeekViewProps {
	/** Alle Aufgaben des Nutzers (wie im Dashboard, `GET /tasks`). */
	tasks: Task[];
	/** Nächste wichtige Aufgabe (`GET /next`) — fließt in die Empfehlungen des heutigen Tages ein. */
	nextTask: Task | null;
	/** „Was ist jetzt dran?"-Vorschlagsliste (`GET /suggestions`), gehört zum heutigen Tag (s. unten). */
	suggestions?: Task[];
	/**
	 * Bezugsdatum für „heute" und die angezeigte Kalenderwoche. Optional für Tests; im Betrieb liefert
	 * `App.tsx` kein eigenes Datum, Default ist der tatsächliche Aufruf-Zeitpunkt.
	 */
	referenceDate?: Date;
	/**
	 * Wird beim Öffnen einer Tageskarte aufgerufen (#1617 AK2) — bekommt das Datum der Karte, damit
	 * der Aufrufer gezielt auf diesen Tag springen kann (Kreuzverhör-Entscheidung #5, Option 5.2:
	 * Sprung in den Aufgaben-Tab, gefiltert auf die Deadline dieses Tages).
	 */
	onSelectDay: (day: Date) => void;
	/** Kalendertermine aus verbundenen ICS-Kalendern (`GET /calendar-events`, #2210) — stehen vor den Aufgaben ihres Starttags. */
	calendarEvents?: CalendarEvent[];
}

/**
 * Wochenansicht des Tagesplans (#1617): zeigt alle 7 Tage der aktuellen Kalenderwoche mit den ihnen
 * zugeordneten Aufgaben.
 *
 * Zuordnung je Tag:
 * - **Manuell geplant**: offene Aufgaben am Deadline-Tag (#1617, dieselbe UTC-Tageskonvention wie
 *   die Deadline-Liste im Dashboard); erledigte Aufgaben (#2574) am Tag des Abhakens (`completedAt`,
 *   serverseitig aus `ScoreEntry.zeitpunkt` abgeleitet), klar abgesetzt (`week-view-done`) — nur
 *   ohne Erledigt-Zeitpunkt (kein ScoreEntry, Edge) weiter am Deadline-Tag (#2012).
 * - **Systemisch empfohlen**: die `suggestions`-Liste (`GET /suggestions`) gehört ausschließlich zum
 *   heutigen Tag (`referenceDate`) — die Empfehlungs-Engine (`server/src/logics/find.ts`) bewertet
 *   grundsätzlich nur den aktuellen Zeitpunkt (Prioritäts-/Deadline-/Balance-Score gegen den globalen
 *   Punktestand); eine Simulation dieses Scores für andere Wochentage ist bewusst nicht Teil dieses
 *   Tickets (dokumentierte Vereinfachung, PR-Body).
 */
export const WeekView = ({
	tasks,
	nextTask,
	suggestions = [],
	referenceDate,
	onSelectDay,
	calendarEvents = [],
}: WeekViewProps) => {
	const { t } = useTranslation('capture');
	const today = useMemo(() => referenceDate ?? new Date(), [referenceDate]);
	const weekDates = useMemo(() => weekDatesFor(today), [today]);

	// Offene Aufgaben bleiben am Deadline-Tag (#1617/#2012); erledigte ordnet `doneAnchorOf` zu (#2574).
	const openTasksWithDeadline = useMemo(
		() =>
			tasks.filter(
				(task): task is Task & { deadline: Date } => task.status !== TaskStatus.Done && task.deadline != null,
			),
		[tasks],
	);

	/**
	 * Kalendertag einer erledigten Aufgabe (#2574): der Tag des Abhakens (`completedAt`, serverseitig
	 * aus `ScoreEntry.zeitpunkt` abgeleitet) — nicht mehr der Deadline-Tag. Ohne Erledigt-Zeitpunkt
	 * (kein ScoreEntry, Edge) gilt weiter der Deadline-Tag (#2012-Verhalten).
	 */
	const doneTasks = useMemo(() => tasks.filter((task) => task.status === TaskStatus.Done), [tasks]);
	const doneAnchorOf = (task: Task): Date | null => {
		if (task.completedAt) {
			return new Date(task.completedAt);
		}
		return task.deadline != null ? new Date(task.deadline) : null;
	};

	/**
	 * Ein Empfehlungs-Datum gehört unter „heute", wenn es entweder gar keine Deadline hat ODER seine
	 * Deadline außerhalb der angezeigten Kalenderwoche liegt — liegt sie INNERHALB der Woche, erscheint
	 * dieselbe Aufgabe bereits (korrekt) unter ihrem eigenen Deadline-Tag über `tasksWithDeadline`;
	 * eine zweite Anzeige unter „heute" wäre ein Duplikat (Fund Kreuzverhör-Runde 1, PR #1620). Der
	 * vorherige Guard `deadline == null` blendete Empfehlungen mit einer Deadline VOR/NACH der Woche
	 * (überfällig, oder weit in der Zukunft) fälschlich komplett aus (Kreuzverhör-Runde 2, Finding #3).
	 */
	const deadlineOutsideWeek = (deadline: Date | null | undefined): boolean =>
		deadline == null || !weekDates.some((day) => sameUtcDay(day, deadline));

	return (
		<section className="week-view">
			<div className="week-view-heading">
				<h2>{t('weekView.heading')}</h2>
			</div>
			<div className="week-view-grid">
				{weekDates.map((day, index) => {
					const isToday = sameUtcDay(day, today);
					// #2012/#2574: erst die offenen Aufgaben am Deadline-Tag, dann die erledigten am Erledigt-Tag.
					const openDayTasks = openTasksWithDeadline.filter((task) => sameUtcDay(task.deadline, day));
					const doneDayTasks = doneTasks.filter((task) => {
						const anchor = doneAnchorOf(task);
						return anchor !== null && sameUtcDay(anchor, day);
					});
					// Ganztägige Termine zuerst, sonst in der Reihenfolge der API (nach Start sortiert).
					const dayEvents = calendarEvents
						.filter((event) => eventOnDay(event, day))
						.sort((a, b) => Number(b.allDay) - Number(a.allDay));
					const dayRecommendations = isToday
						? suggestions.filter(
								(task) => deadlineOutsideWeek(task.deadline) && (nextTask === null || task.id !== nextTask.id),
							)
						: [];

					return (
						<KolCard
							key={day.getTime()}
							className="week-view-day"
							_label={t('weekView.dayLabel', {
								weekday: t(`weekView.weekdays.${WEEKDAY_KEYS[index]}`),
								date: formatDeadline(day),
							})}
							_level={3}
						>
							<ul className="week-view-tasks">
								{dayEvents.map((event, eventIndex) => (
									<li key={`event-${event.sourceId}-${event.start}-${eventIndex}`} className="week-view-event">
										<span className="week-view-event__time">{eventTime(event, t)}</span> {event.title}
									</li>
								))}
								{openDayTasks.map((task) => (
									<li key={`manual-${task.id}`}>{task.title}</li>
								))}
								{doneDayTasks.map((task) => (
									<li key={`manual-${task.id}`} className="week-view-done">
										{task.title}
									</li>
								))}
								{dayRecommendations.map((task) => (
									<li key={`empfohlen-${task.id}`}>{t('weekView.recommended', { title: task.title })}</li>
								))}
								{isToday && nextTask !== null && deadlineOutsideWeek(nextTask.deadline) && (
									<li key={`next-${nextTask.id}`}>{t('weekView.nextTask', { title: nextTask.title })}</li>
								)}
							</ul>
							<KolButton
								_label={t('weekView.openDay')}
								_variant="secondary"
								_on={{ onClick: () => onSelectDay(day) }}
							/>
						</KolCard>
					);
				})}
			</div>
		</section>
	);
};
