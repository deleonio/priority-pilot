import { KolButton } from '@public-ui/react-v19';
import type { Task } from 'client';
import type { DependencyRef } from '../lib/dependencies';
import { formatDeadline, statusLabel } from '../lib/task';

interface TaskTableProps {
	tasks: Task[];
	/** Vorgänger je Task-ID (aus dem Aufgabenwald abgeleitet) — für die Spalte „Vorgänger". */
	dependencyMap: Map<number, DependencyRef[]>;
	onEdit: (task: Task) => void;
	onDelete: (task: Task) => void;
	onEditDependencies: (task: Task) => void;
}

/** Tabellarische Übersicht aller Tasks mit Aktionen je Zeile. */
export const TaskTable = ({ tasks, dependencyMap, onEdit, onDelete, onEditDependencies }: TaskTableProps) => {
	if (tasks.length === 0) {
		return <p>Noch keine Tasks vorhanden. Lege oben einen neuen Task an.</p>;
	}

	return (
		<table className="task-table">
			<caption className="visually-hidden">Liste aller Tasks</caption>
			<thead>
				<tr>
					<th scope="col">ID</th>
					<th scope="col">Titel</th>
					<th scope="col">Status</th>
					<th scope="col">Priorität</th>
					<th scope="col">Aufwand (Tage)</th>
					<th scope="col">Deadline</th>
					<th scope="col">Vorgänger</th>
					<th scope="col">Aktionen</th>
				</tr>
			</thead>
			<tbody>
				{tasks.map((task) => (
					<tr key={task.id}>
						<td>{task.id}</td>
						<td>{task.title}</td>
						<td>{statusLabel(task.status)}</td>
						<td>{task.priority}</td>
						<td>{task.estimatedEffort}</td>
						<td>{formatDeadline(task.deadline)}</td>
						<td>{dependencyMap.get(task.id)?.length ?? 0}</td>
						<td className="task-actions">
							<KolButton _label="Bearbeiten" _variant="secondary" _on={{ onClick: () => onEdit(task) }} />
							<KolButton
								_label="Abhängigkeiten"
								_variant="secondary"
								_on={{ onClick: () => onEditDependencies(task) }}
							/>
							<KolButton _label="Löschen" _variant="danger" _on={{ onClick: () => onDelete(task) }} />
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
};
