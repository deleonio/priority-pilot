import { KolButton, KolCard } from '@public-ui/react-v19';
import type { Task } from 'client';
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
}

/**
 * Wochenansicht des Tagesplans (#1617): zeigt alle 7 Tage der aktuellen Kalenderwoche mit den ihnen
 * zugeordneten Aufgaben.
 *
 * Zuordnung je Tag:
 * - **Manuell geplant**: nicht erledigte Aufgaben, deren `deadline` auf den jeweiligen Kalendertag
 *   fällt (dieselbe UTC-Tageskonvention wie die Deadline-Liste im Dashboard).
 * - **Systemisch empfohlen**: die `suggestions`-Liste (`GET /suggestions`) gehört ausschließlich zum
 *   heutigen Tag (`referenceDate`) — die Empfehlungs-Engine (`server/src/logics/find.ts`) bewertet
 *   grundsätzlich nur den aktuellen Zeitpunkt (Prioritäts-/Deadline-/Balance-Score gegen den globalen
 *   Punktestand); eine Simulation dieses Scores für andere Wochentage ist bewusst nicht Teil dieses
 *   Tickets (dokumentierte Vereinfachung, PR-Body).
 */
export const WeekView = ({ tasks, nextTask, suggestions = [], referenceDate, onSelectDay }: WeekViewProps) => {
	const today = useMemo(() => referenceDate ?? new Date(), [referenceDate]);
	const weekDates = useMemo(() => weekDatesFor(today), [today]);

	const openTasksWithDeadline = useMemo(
		() =>
			tasks.filter(
				(task): task is Task & { deadline: Date } => task.status !== TaskStatus.Done && task.deadline != null,
			),
		[tasks],
	);

	/**
	 * Ein Empfehlungs-Datum gehört unter „heute", wenn es entweder gar keine Deadline hat ODER seine
	 * Deadline außerhalb der angezeigten Kalenderwoche liegt — liegt sie INNERHALB der Woche, erscheint
	 * dieselbe Aufgabe bereits (korrekt) unter ihrem eigenen Deadline-Tag über `openTasksWithDeadline`;
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
					const dayTasks = openTasksWithDeadline.filter((task) => sameUtcDay(task.deadline, day));
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
								{dayTasks.map((task) => (
									<li key={`manual-${task.id}`}>{task.title}</li>
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
