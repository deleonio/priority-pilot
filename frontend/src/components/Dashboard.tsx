import type { Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { useMemo } from 'react';
import { formatDeadline, formatNumber, STATUS_OPTIONS } from '../lib/task';

interface DashboardProps {
	tasks: Task[];
	/** Nach Wert absteigend sortierter Aufgabenwald (`GET /forest`); Basis für die wichtigsten Tasks. */
	forest: TaskTreeNode[];
	/** Nächste wichtige Aufgabe (`GET /next`) oder `null`, falls keine ansteht. */
	nextTask: Task | null;
}

interface StatCard {
	label: string;
	count: number;
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
 * mit gesetzter Deadline, aufsteigend nach Datum.
 */
export const Dashboard = ({ tasks, forest, nextTask }: DashboardProps) => {
	const cards = useMemo<StatCard[]>(() => {
		// Status-Häufigkeiten in einem einzigen Durchlauf zählen (O(n)).
		const counts = new Map<string, number>();
		for (const task of tasks) {
			counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
		}
		const perStatus = STATUS_OPTIONS.map((option) => ({
			label: option.label,
			count: counts.get(option.value) ?? 0,
		}));
		return [{ label: 'Gesamt', count: tasks.length }, ...perStatus];
	}, [tasks]);

	const topTasks = useMemo(() => forest.slice(0, TOP_TASKS_LIMIT), [forest]);

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
					<li key={card.label} className="dashboard-card">
						<span className="dashboard-card-count">{card.count}</span>
						<span className="dashboard-card-label">{card.label}</span>
					</li>
				))}
			</ul>
			<div className="dashboard-next-task">
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
			</div>
			<div className="dashboard-top-tasks">
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
			</div>
			<div className="dashboard-deadlines">
				<h3>Anstehende Deadlines</h3>
				{upcomingDeadlines.length === 0 ? (
					<p>Keine anstehenden Deadlines.</p>
				) : (
					<ul className="dashboard-deadlines-list">
						{upcomingDeadlines.map((task) => (
							<li key={task.id} className="dashboard-deadline">
								<span className="dashboard-deadline-title">
									#{task.id} – {task.title}
								</span>
								<span className="dashboard-deadline-date">{formatDeadline(task.deadline)}</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
};
