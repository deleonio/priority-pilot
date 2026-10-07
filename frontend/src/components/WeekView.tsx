import { KolButton, KolCard } from '@public-ui/react-v19';
import type { CalendarEvent, Task } from 'client';
import { TaskStatus } from 'client';
import { useMemo } from 'react';
import { formatDeadline } from '../lib/task';

/** Deutsche Wochentagsnamen, Montag zuerst (ISO-Wochenstart). */
const WEEKDAY_LABELS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

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
const eventTime = (event: CalendarEvent): string =>
	event.allDay ? 'ganztägig' : `${clock(new Date(event.start))}–${clock(new Date(event.end))}`;

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
 * - **Manuell geplant**: Aufgaben (offen und erledigt, #2012), deren `deadline` auf den jeweiligen
 *   Kalendertag fällt (dieselbe UTC-Tageskonvention wie die Deadline-Liste im Dashboard); erledigte
 *   erscheinen unter den offenen, klar abgesetzt (`week-view-done`).
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
	const today = useMemo(() => referenceDate ?? new Date(), [referenceDate]);
	const weekDates = useMemo(() => weekDatesFor(today), [today]);

	const tasksWithDeadline = useMemo(
		() => tasks.filter((task): task is Task & { deadline: Date } => task.deadline != null),
		[tasks],
	);

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
				<h2>Wochenansicht</h2>
			</div>
			<div className="week-view-grid">
				{weekDates.map((day, index) => {
					const isToday = sameUtcDay(day, today);
					const dayTasks = tasksWithDeadline.filter((task) => sameUtcDay(task.deadline, day));
					// #2012: erledigte Aufgaben erscheinen unter den offenen — erst offene, dann Done.
					const openDayTasks = dayTasks.filter((task) => task.status !== TaskStatus.Done);
					const doneDayTasks = dayTasks.filter((task) => task.status === TaskStatus.Done);
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
							_label={`${WEEKDAY_LABELS[index]}, ${formatDeadline(day)}`}
							_level={3}
						>
							<ul className="week-view-tasks">
								{dayEvents.map((event, eventIndex) => (
									<li key={`event-${event.sourceId}-${event.start}-${eventIndex}`} className="week-view-event">
										<span className="week-view-event__time">{eventTime(event)}</span> {event.title}
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
									<li key={`empfohlen-${task.id}`}>{task.title} (empfohlen)</li>
								))}
								{isToday && nextTask !== null && deadlineOutsideWeek(nextTask.deadline) && (
									<li key={`next-${nextTask.id}`}>{nextTask.title} (nächste Aufgabe)</li>
								)}
							</ul>
							<KolButton _label="Tag öffnen" _variant="secondary" _on={{ onClick: () => onSelectDay(day) }} />
						</KolCard>
					);
				})}
			</div>
		</section>
	);
};
