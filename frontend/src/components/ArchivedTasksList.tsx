import { KolButton } from '@public-ui/react-v19';
import type { Task } from 'client';
import { useTranslation } from 'react-i18next';
import { formatDeadline } from '../lib/task';

interface ArchivedTasksListProps {
	/** Archivierte Aufgaben (`GET /tasks?archived=1`), bereits nach Titel/Kategorie gefiltert. */
	tasks: Task[];
	/** „Wiederherstellen" — einstufig, holt die Aufgabe zurück in die Liste. */
	onRestore: (task: Task) => void;
	/** „Löschen" — über den bestehenden Bestätigungsdialog (`DeleteTaskDialog`). */
	onDelete: (task: Task) => void;
}

/**
 * Archiv-Ansicht des Aufgaben-Tabs (Switch „Archivierte anzeigen"): schlichte Liste je Aufgabe mit
 * „Wiederherstellen" / „Löschen". Nutzt bewusst die `missed-*`-Klassen des Verpasst-Bereichs
 * (gleiche mobile Aktionszeile, Touch-Targets >= 44px) statt einer zweiten Stilvariante.
 */
export const ArchivedTasksList = ({ tasks, onRestore, onDelete }: ArchivedTasksListProps) => {
	const { t } = useTranslation(['tasks', 'common']);
	if (tasks.length === 0) {
		return <p className="empty-state">{t('archived.empty')}</p>;
	}
	return (
		<ul className="missed-list" data-testid="archived-list">
			{tasks.map((task) => (
				<li key={task.id} className="missed-item" data-testid="archived-item">
					<div className="missed-item-main">
						<span className="missed-item-title">{task.title}</span>
						{task.deadline != null && (
							<div className="missed-item-meta">
								<span className="missed-item-deadline">
									{t('actions.deadline', { date: formatDeadline(task.deadline) })}
								</span>
							</div>
						)}
					</div>
					<div className="missed-item-actions">
						<KolButton _label={t('archived.restore')} _variant="secondary" _on={{ onClick: () => onRestore(task) }} />
						<KolButton _label={t('common:actions.delete')} _variant="danger" _on={{ onClick: () => onDelete(task) }} />
					</div>
				</li>
			))}
		</ul>
	);
};
