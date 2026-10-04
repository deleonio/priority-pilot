import { KolButton, KolCard } from '@public-ui/react-v19';
import type { Task } from 'client';
import { formatDeadline } from '../lib/task';

interface MissedTasksSectionProps {
	/** Verpasste Aufgaben (`GET /tasks?missed=1`, geladen in `App.reload`). */
	tasks: Task[];
	/** „Neu planen" — öffnet die bestehende Task-Bearbeitung (spätere Deadline zählt den Zähler). */
	onEdit: (task: Task) => void;
	/** „Archivieren" — einstufig, ohne Bestätigungsdialog (#1964). */
	onArchive: (task: Task) => void;
	/** „Löschen" — über den bestehenden Bestätigungsdialog (`DeleteTaskDialog`). */
	onDelete: (task: Task) => void;
}

/**
 * Bereich „Verpasst" (#1964): überfällige, nicht erledigte Aufgaben ohne Auto-Lösch-Häkchen —
 * abgeleitete Ansicht über `GET /tasks?missed=1`, kein neuer Status. Je Aufgabe die drei
 * Aktionen „Neu planen" / „Archivieren" / „Löschen" und der Verschiebe-Zähler als Text-Badge
 * („N× verschoben", nur bei N ≥ 1 — AK3; Status nie allein über Farbe, WCAG 1.4.1). Bewusst
 * neutrale Tonalität ohne Warnfarbe (Muster `MissedTasksCard`). Liste statt Tabelle —
 * `KolTableStateful` wäre bei 375px unbedienbar (KI-UX #1964).
 */
export const MissedTasksSection = ({ tasks, onEdit, onArchive, onDelete }: MissedTasksSectionProps) => {
	if (tasks.length === 0) {
		return null;
	}
	return (
		<KolCard
			className="missed-section"
			role="region"
			aria-label="Verpasste Aufgaben"
			_label="Verpasst"
			_level={2}
			data-testid="missed-section"
		>
			<ul className="missed-list">
				{tasks.map((task) => (
					<li key={task.id} className="missed-item" data-testid="missed-item">
						<div className="missed-item-head">
							<span className="missed-item-title">{task.title}</span>
							<span className="missed-item-deadline">Deadline {formatDeadline(task.deadline)}</span>
							{(task.postponeCount ?? 0) > 0 && (
								<span className="missed-item-badge">{task.postponeCount}× verschoben</span>
							)}
						</div>
						<div className="missed-item-actions">
							<KolButton _label="Neu planen" _variant="secondary" _on={{ onClick: () => onEdit(task) }} />
							<KolButton _label="Archivieren" _variant="secondary" _on={{ onClick: () => onArchive(task) }} />
							<KolButton
								_label="Löschen"
								_icons={{ left: { icon: 'fa-solid fa-trash' } }}
								_variant="danger"
								_on={{ onClick: () => onDelete(task) }}
							/>
						</div>
					</li>
				))}
			</ul>
		</KolCard>
	);
};
