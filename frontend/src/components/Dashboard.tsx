import { KolBadge, KolCard, KolMeter } from '@public-ui/react-v19';
import type { Pillar, Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { useMemo } from 'react';
import { collectTaskValues } from '../lib/forest';
import { buildPillarSummaries, weightToRaw } from '../lib/pillar';
import {
	type DeadlineUrgency,
	deadlineUrgency,
	formatDeadline,
	formatNumber,
	formatRelativeDeadline,
	STATUS_OPTIONS,
	statusAccentClass,
} from '../lib/task';

/** Badge-Hintergrundfarbe je hervorzuhebender Dringlichkeit (Textfarbe berechnet KolBadge automatisch). */
const URGENCY_COLOR: Record<Exclude<DeadlineUrgency, 'later'>, string> = {
	overdue: '#b42318',
	soon: '#b54708',
};

interface DashboardProps {
	tasks: Task[];
	/** Nach Wert absteigend sortierter Aufgabenwald (`GET /forest`); Basis für die wichtigsten Tasks. */
	forest: TaskTreeNode[];
	/** Nächste wichtige Aufgabe (`GET /next`) oder `null`, falls keine ansteht. */
	nextTask: Task | null;
	/** Die fünf Lebensbalance-Säulen samt Gewichtung (`GET /pillars`) für das Widget „Meine Themen". */
	pillars: Pillar[];
}

interface StatCard {
	label: string;
	count: number;
	/** CSS-Akzentklasse für den farbcodierten Statusbezug (`total` für die Gesamtzahl). */
	accent: string;
}

/** Anzahl der im Widget „Wichtigste Tasks" angezeigten Einträge. */
const TOP_TASKS_LIMIT = 5;

/** Eine Aufgabe mit gesetzter, gültiger Deadline (für die Deadline-Liste). */
type TaskWithDeadline = Task & { deadline: Date };

/** Prüft, ob eine Aufgabe eine gesetzte, gültige Deadline trägt (Type-Guard für die Liste). */
const hasDeadline = (task: Task): task is TaskWithDeadline =>
	task.deadline != null && !Number.isNaN(task.deadline.getTime());

/**
 * Dashboard-Startbereich mit Status-Kennzahlen als Karten (Gesamtzahl + Anzahl je Status), der
 * nächsten wichtigen Aufgabe (`GET /next`), dem Widget „Wichtigste Tasks" (Top-N nach Wert
 * absteigend) sowie den anstehenden Deadlines.
 *
 * Reine Ableitung aus den bereits geladenen Daten (keine eigene API-Anfrage). Die Status-Karten
 * folgen `STATUS_OPTIONS`, damit Reihenfolge und Beschriftung mit dem Rest der UI konsistent bleiben.
 * Der `forest` ist serverseitig bereits nach Wert absteigend sortiert, daher genügt das Abschneiden
 * der ersten `TOP_TASKS_LIMIT` Wurzeln. Die Deadline-Liste zeigt nur noch nicht erledigte Aufgaben
 * mit gesetzter Deadline, aufsteigend nach Datum. Das Widget „Meine Themen" zeigt je Säule die
 * aktuelle Gewichtung sowie Anzahl, Gesamtwert und Gesamtaufwand der zugeordneten Tasks (der Wert
 * stammt aus dem `forest`, umfasst also nur offene/in Arbeit befindliche Tasks).
 */
export const Dashboard = ({ tasks, forest, nextTask, pillars }: DashboardProps) => {
	const cards = useMemo<StatCard[]>(() => {
		// Status-Häufigkeiten in einem einzigen Durchlauf zählen (O(n)).
		const counts = new Map<string, number>();
		for (const task of tasks) {
			counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
		}
		const perStatus = STATUS_OPTIONS.map((option) => ({
			label: option.label,
			count: counts.get(option.value) ?? 0,
			accent: statusAccentClass(option.value),
		}));
		return [{ label: 'Gesamt', count: tasks.length, accent: 'total' }, ...perStatus];
	}, [tasks]);

	// Einmal pro Mount bestimmter Bezugszeitpunkt für die Deadline-Dringlichkeit (stabil je Ansicht).
	const now = useMemo(() => new Date(), []);

	const topTasks = useMemo(() => forest.slice(0, TOP_TASKS_LIMIT), [forest]);

	// Wertbeiträge je Task aus dem Wald ableiten und je Säule zu Kennzahlen aggregieren.
	const pillarSummaries = useMemo(() => {
		const valueByTaskId = collectTaskValues(forest);
		return buildPillarSummaries(pillars, tasks, valueByTaskId);
	}, [pillars, tasks, forest]);

	const upcomingDeadlines = useMemo<TaskWithDeadline[]>(
		() =>
			// `filter` liefert ein neues Array, daher ist das anschließende `sort` ohne Mutation der Props.
			tasks
				.filter((task): task is TaskWithDeadline => task.status !== TaskStatus.Done && hasDeadline(task))
				.sort((a, b) => a.deadline.getTime() - b.deadline.getTime()),
		[tasks],
	);

	return (
		<section className="dashboard">
			<h2>Dashboard</h2>
			<ul className="dashboard-cards">
				{cards.map((card) => (
					<li key={card.label}>
						<KolCard _label={card.label} _level={0}>
							<span className={`dashboard-card-accent ${card.accent}`} aria-hidden="true" />
							<span className="dashboard-card-count">{card.count}</span>
						</KolCard>
					</li>
				))}
			</ul>
			<section className="dashboard-next-task">
				<h3>Nächste Aufgabe</h3>
				{nextTask === null ? (
					<p>Aktuell steht keine Aufgabe an (alle erledigt oder durch offene Vorgänger blockiert).</p>
				) : (
					<p className="dashboard-next-task-value">
						<strong>
							#{nextTask.id} – {nextTask.title}
						</strong>{' '}
						(Priorität {nextTask.priority})
					</p>
				)}
			</section>
			<section className="dashboard-top-tasks">
				<h3>Wichtigste Tasks</h3>
				{topTasks.length === 0 ? (
					<p>Keine offenen Aufgaben vorhanden.</p>
				) : (
					<ol className="dashboard-top-tasks-list">
						{topTasks.map((task) => (
							<li key={task.id} className="dashboard-top-task">
								<span className="dashboard-top-task-title">
									#{task.id} – {task.title}
								</span>
								<span className="dashboard-top-task-meta">
									(Priorität {task.priority}, Wert {formatNumber(task.value)})
								</span>
							</li>
						))}
					</ol>
				)}
			</section>
			<section className="dashboard-pillars">
				<h3>Meine Themen</h3>
				{pillars.length === 0 ? (
					<p>Keine Säulen vorhanden.</p>
				) : (
					<ul className="dashboard-pillars-list">
						{pillarSummaries.map(({ pillar, taskCount, totalValue, totalEstimatedEffort }) => (
							<li key={pillar.id} className="dashboard-pillar">
								<KolMeter _label={pillar.name} _value={weightToRaw(pillar.weight)} _max={1} />
								<span className="dashboard-pillar-meta">
									{taskCount} {taskCount === 1 ? 'Aufgabe' : 'Aufgaben'} · Wert {formatNumber(totalValue)} · Aufwand{' '}
									{formatNumber(totalEstimatedEffort)} Tage
								</span>
							</li>
						))}
					</ul>
				)}
			</section>
			<section className="dashboard-deadlines">
				<h3>Anstehende Deadlines</h3>
				{upcomingDeadlines.length === 0 ? (
					<p>Keine anstehenden Deadlines.</p>
				) : (
					<ul className="dashboard-deadlines-list">
						{upcomingDeadlines.map((task) => {
							const urgency = deadlineUrgency(task.deadline, now);
							return (
								<li key={task.id} className="dashboard-deadline">
									<span className="dashboard-deadline-title">
										#{task.id} – {task.title}
									</span>
									<span className="dashboard-deadline-aside">
										{urgency !== 'later' && (
											<KolBadge _label={formatRelativeDeadline(task.deadline, now)} _color={URGENCY_COLOR[urgency]} />
										)}
										<span className="dashboard-deadline-date">{formatDeadline(task.deadline)}</span>
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</section>
	);
};
