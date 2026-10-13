import { KolButton, KolCard, KolPopoverButton, KolToolbar } from '@public-ui/react-v19';
import type { Task } from 'client';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { setupPopoverAlignment } from '../lib/popoverAlign';
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

interface MissedTaskItemProps {
	task: Task;
	onComplete: (task: Task) => void;
	onEdit: (task: Task) => void;
	onArchive: (task: Task) => void;
	onDelete: (task: Task) => void;
}

/**
 * Je verpasster Aufgabe bleibt „Erledigt" der einzige Inline-Button (#2524); „Neu planen",
 * „Archivieren" und „Löschen" liegen hinter dem „…"-Popover „Weitere Aktionen" (Muster
 * TaskTree #361). Der Ref dient nur dazu, das Panel nach einer Aktion programmatisch zu schließen.
 */
const MissedTaskItem = ({ task, onComplete, onEdit, onArchive, onDelete }: MissedTaskItemProps) => {
	const { t } = useTranslation(['tasks', 'common']);
	const popoverRef = useRef<HTMLKolPopoverButtonElement | null>(null);

	useEffect(() => setupPopoverAlignment(popoverRef.current), []);

	return (
		<li className="missed-item" data-testid="missed-item">
			<div className="missed-item-main">
				<span className="missed-item-title">{task.title}</span>
				<div className="missed-item-meta">
					<span className="missed-item-deadline">{t('actions.deadline', { date: formatDeadline(task.deadline) })}</span>
					{(task.postponeCount ?? 0) > 0 && (
						<span className="missed-item-badge">{t('missedSection.postponed', { count: task.postponeCount })}</span>
					)}
				</div>
			</div>
			<div className="missed-item-actions">
				<KolButton _label={t('actions.done')} _variant="primary" _on={{ onClick: () => onComplete(task) }} />
				<KolPopoverButton
					ref={popoverRef}
					className="missed-item-more"
					_label={t('taskTree.moreActions')}
					_hideLabel
					_icons={{ left: { icon: 'fa-solid fa-ellipsis' } }}
					_variant="secondary"
					_popoverAlign="left"
				>
					<KolToolbar
						_label={t('actions.actionsFor', { title: task.title })}
						_orientation="vertical"
						_items={[
							{
								type: 'button',
								_label: t('missedSection.reschedule'),
								_variant: 'secondary',
								_on: {
									onClick: () => {
										void Promise.resolve(popoverRef.current?.hidePopover()).then(() => onEdit(task));
									},
								},
							},
							{
								type: 'button',
								_label: t('missedSection.archive'),
								_variant: 'secondary',
								_on: {
									onClick: () => {
										void Promise.resolve(popoverRef.current?.hidePopover()).then(() => onArchive(task));
									},
								},
							},
							{
								// Beschriftungstext bleibt sichtbar — danger ist nur zusätzlich (Farbe nie allein als Signal).
								type: 'button',
								_label: t('common:actions.delete'),
								_icons: { left: { icon: 'fa-solid fa-trash' } },
								_variant: 'danger',
								_on: {
									onClick: () => {
										void Promise.resolve(popoverRef.current?.hidePopover()).then(() => onDelete(task));
									},
								},
							},
						]}
					/>
				</KolPopoverButton>
			</div>
		</li>
	);
};

/**
 * Bereich „Verpasst" (#1964): überfällige, nicht erledigte Aufgaben ohne Auto-Lösch-Häkchen —
 * abgeleitete Ansicht über `GET /tasks?missed=1`, kein neuer Status. Je Aufgabe die vier
 * Aktionen „Erledigt" / „Neu planen" / „Archivieren" / „Löschen" — seit #2524 nur „Erledigt" inline,
 * die drei Sekundäraktionen hinter dem „…"-Popover (siehe `MissedTaskItem`); der Verschiebe-Zähler liegt
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
					<MissedTaskItem
						key={task.id}
						task={task}
						onComplete={onComplete}
						onEdit={onEdit}
						onArchive={onArchive}
						onDelete={onDelete}
					/>
				))}
			</ul>
		</KolCard>
	);
};
