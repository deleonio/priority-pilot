import { KolButton, KolCard } from '@public-ui/react-v19';
import type { Task } from 'client';
import { useTranslation } from 'react-i18next';
import { formatDeadline } from '../lib/task';

interface MissedTasksSectionProps {
	/** Verpasste Aufgaben (`GET /tasks?missed=1`, geladen in `App.reload`). */
	tasks: Task[];
	/** „Erledigt" — setzt die Aufgabe auf Done (offene Checkliste: über den Erledigen-Dialog). */
	onComplete: (task: Task) => void;
	/** „Neu planen" — öffnet die bestehende Task-Bearbeitung (spätere Deadline zählt den Zähler). */
	onEdit: (task: Task) => void;
	/** „Archivieren" — einstufig, ohne Bestätigungsdialog (#1964). */
	onArchive: (task: Task) => void;
	/** „Löschen" — über den bestehenden Bestätigungsdialog (`DeleteTaskDialog`). */
	onDelete: (task: Task) => void;
}

/**
 * Bereich „Verpasst" (#1964): überfällige, nicht erledigte Aufgaben ohne Auto-Lösch-Häkchen —
 * abgeleitete Ansicht über `GET /tasks?missed=1`, kein neuer Status. Je Aufgabe die vier
 * Aktionen „Erledigt" / „Neu planen" / „Archivieren" / „Löschen"; der Verschiebe-Zähler liegt
 * als Text-Badge („N× verschoben", nur bei N ≥ 1 — AK3; Status nie allein über Farbe, WCAG 1.4.1)
 * in der Meta-Zeile unter dem Titel. Bewusst neutrale Tonalität ohne Warnfarbe (Muster
 * `MissedTasksCard`). Liste statt Tabelle — `KolTableStateful` wäre bei 375px unbedienbar (KI-UX #1964).
 */
export const MissedTasksSection = ({ tasks, onComplete, onEdit, onArchive, onDelete }: MissedTasksSectionProps) => {
	const { t } = useTranslation(['tasks', 'common']);
	if (tasks.length === 0) {
		return null;
	}
	return (
		<KolCard
			className="missed-section"
			role="region"
			aria-label={t('missedSection.regionLabel')}
			_label={t('missedSection.title')}
			_level={2}
			data-testid="missed-section"
		>
			<ul className="missed-list">
				{tasks.map((task) => (
					<li key={task.id} className="missed-item" data-testid="missed-item">
						<div className="missed-item-main">
							<span className="missed-item-title">{task.title}</span>
							<div className="missed-item-meta">
								<span className="missed-item-deadline">
									{t('actions.deadline', { date: formatDeadline(task.deadline) })}
								</span>
								{(task.postponeCount ?? 0) > 0 && (
									<span className="missed-item-badge">
										{t('missedSection.postponed', { count: task.postponeCount })}
									</span>
								)}
							</div>
						</div>
						<div className="missed-item-actions">
							<KolButton _label={t('actions.done')} _variant="primary" _on={{ onClick: () => onComplete(task) }} />
							<KolButton
								_label={t('missedSection.reschedule')}
								_variant="secondary"
								_on={{ onClick: () => onEdit(task) }}
							/>
							<KolButton
								_label={t('missedSection.archive')}
								_variant="secondary"
								_on={{ onClick: () => onArchive(task) }}
							/>
							<KolButton
								_label={t('common:actions.delete')}
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
