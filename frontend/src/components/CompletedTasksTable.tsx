import { KolToolbar } from '@public-ui/react-v19';
import type { Pillar, Task } from 'client';
import { TaskStatus } from 'client';
import { memo, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { getTaskPillarPoints } from '../lib/pillar';

interface CompletedTasksTableProps {
	tasks: Task[];
	pillars: Pillar[];
	/** Nach dem Wiedereröffnen eines Tasks neu laden (Daten aktualisieren). */
	onReloaded: () => void;
}

/** Nachkommastellen für die Punkte-Anzeige — kompakt, aber genau genug für anteilige Werte. */
const formatPoints = (value: number): string =>
	Number.isFinite(value) ? value.toLocaleString('de-DE', { maximumFractionDigits: 2 }) : '0';

/**
 * Tabelle der erledigten Aufgaben (#228): zeigt ausschließlich Tasks mit `status === Done`. Je Zeile
 * der Titel, eine Punkte-Spalte pro Säule (`estimatedEffort × share / 100`, siehe
 * `getTaskPillarPoints`) und ein „Wieder öffnen"-Schalter, der den Status per PATCH auf `Open` setzt
 * und danach einen Reload auslöst.
 *
 * Bewusst als **native** HTML-Tabelle mit kompaktem, responsivem CSS (statt `KolTableStateful`), damit
 * die Ansicht bei 375 px ohne horizontales Scrollen funktioniert (AK-6, Mobile-First).
 */
export const CompletedTasksTable = memo((props: CompletedTasksTableProps) => {
	const { tasks, pillars, onReloaded } = props;
	const [reopeningId, setReopeningId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	const doneTasks = tasks.filter((task) => task.status === TaskStatus.Done);

	const reopen = async (task: Task): Promise<void> => {
		setReopeningId(task.id);
		setError(null);
		try {
			await api.updateTask({ id: task.id, taskUpdate: { status: TaskStatus.Open } });
			onReloaded();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setReopeningId(null);
		}
	};

	if (doneTasks.length === 0) {
		return <p className="completed-tasks-empty">Noch keine erledigten Aufgaben vorhanden.</p>;
	}

	return (
		<div className="completed-tasks">
			{error !== null && (
				<p className="completed-tasks-error" role="alert">
					{error}
				</p>
			)}
			<table className="completed-tasks-table">
				<caption className="visually-hidden">Erledigte Aufgaben mit Punkten je Säule</caption>
				<thead>
					<tr>
						<th scope="col">Titel</th>
						{pillars.map((pillar) => (
							<th key={pillar.id} scope="col">
								{pillar.name}
							</th>
						))}
						<th scope="col">Aktion</th>
					</tr>
				</thead>
				<tbody>
					{doneTasks.map((task) => {
						const points = getTaskPillarPoints(task, pillars);
						return (
							<tr key={task.id}>
								<th scope="row">{task.title}</th>
								{pillars.map((pillar) => (
									<td key={pillar.id} data-label={pillar.name}>
										{formatPoints(points.get(pillar.id) ?? 0)}
									</td>
								))}
								<td>
									<KolToolbar
										_label={`Aktionen für ${task.title}`}
										_orientation="horizontal"
										_items={[
											{
												type: 'button',
												_label: 'Wieder öffnen',
												_hideLabel: true,
												_icons: { left: { icon: 'fa-solid fa-repeat' } },
												_variant: 'secondary',
												_disabled: reopeningId === task.id,
												_on: { onClick: () => void reopen(task) },
											},
										]}
									/>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
});

CompletedTasksTable.displayName = 'CompletedTasksTable';
