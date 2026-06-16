import type { Task, TaskTreeNode } from 'client';
import { useMemo } from 'react';
import { formatNumber, STATUS_OPTIONS } from '../lib/task';

interface DashboardProps {
	tasks: Task[];
	/** Nach Wert absteigend sortierter Aufgabenwald (`GET /forest`); Basis für die wichtigsten Tasks. */
	forest: TaskTreeNode[];
}

interface StatCard {
	label: string;
	count: number;
}

/** Anzahl der im Widget „Wichtigste Tasks" angezeigten Einträge. */
const TOP_TASKS_LIMIT = 5;

/**
 * Dashboard-Startbereich mit Status-Kennzahlen als Karten (Gesamtzahl + Anzahl je Status) sowie dem
 * Widget „Wichtigste Tasks" (Top-N nach Wert absteigend).
 *
 * Reine Ableitung aus den bereits geladenen Daten (keine eigene API-Anfrage). Die Status-Karten
 * folgen `STATUS_OPTIONS`, damit Reihenfolge und Beschriftung mit dem Rest der UI konsistent bleiben.
 * Der `forest` ist serverseitig bereits nach Wert absteigend sortiert, daher genügt das Abschneiden
 * der ersten `TOP_TASKS_LIMIT` Wurzeln.
 */
export const Dashboard = ({ tasks, forest }: DashboardProps) => {
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
		</section>
	);
};
