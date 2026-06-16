import type { Task } from 'client';
import { useMemo } from 'react';
import { STATUS_OPTIONS } from '../lib/task';

interface DashboardProps {
	tasks: Task[];
}

interface StatCard {
	label: string;
	count: number;
}

/**
 * Dashboard-Startbereich mit Status-Kennzahlen als Karten (Gesamtzahl + Anzahl je Status).
 *
 * Reine Ableitung aus den bereits geladenen `tasks` (keine eigene API-Anfrage). Die Status-Karten
 * folgen `STATUS_OPTIONS`, damit Reihenfolge und Beschriftung mit dem Rest der UI konsistent bleiben.
 */
export const Dashboard = ({ tasks }: DashboardProps) => {
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
		</section>
	);
};
