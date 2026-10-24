import { KolAlert, KolButton, KolDetails, KolHeading, KolLink } from '@public-ui/react-v19';
import { ResponseError, type Task } from 'client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTask } from '../api';
import { formatDeadline, formatNumber, formatRelativeDeadline } from '../lib/task';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';
import { TaskBadges } from './TaskBadges';

/** Zustand der Leseseite: Laden (Skelett), Erfolg, „nicht gefunden" (404) oder Ladefehler. */
type TaskViewState = { kind: 'loading' } | { kind: 'ready'; task: Task } | { kind: 'notFound' } | { kind: 'error' };

interface TaskViewProps {
	/** ID der angezeigten Aufgabe aus der Route `/aufgaben/<id>`. */
	taskId: number;
	/** „Zurück" — zur zuletzt aktiven Hauptansicht, ohne Vorgänger (Push/Kaltstart) auf `/`. */
	onBack: () => void;
	/** „Bearbeiten" — öffnet das vorhandene Formular (`TaskFormModal`) für diese Aufgabe. */
	onEdit: (task: Task) => void;
}

/**
 * Leseseite einer Aufgabe unter `/aufgaben/<id>` (#2938, Schnitt-Teil 1 des
 * Ansichten-Konzepts, `docs/ux-konzept-ansichten.md` Abschnitt 4): reine Ansicht —
 * Abhaken/Primäraktion folgen in Teil 2, Unteraufgaben/Abhängigkeiten/Herkunft/Ort in
 * Teil 3. Daten kommen aus dem vorhandenen `GET /tasks/:id`, das Backend bleibt unverändert.
 */
export const TaskView = ({ taskId, onBack, onEdit }: TaskViewProps) => {
	const { t } = useTranslation(['taskView', 'app', 'common', 'tasks']);
	const [state, setState] = useState<TaskViewState>({ kind: 'loading' });
	// Versuch-Zähler: „Erneut laden" stößt denselben Abruf erneut an (AK4).
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let aktiv = true;
		setState({ kind: 'loading' });
		getTask({ id: taskId })
			.then((task) => {
				if (aktiv) setState({ kind: 'ready', task });
			})
			.catch((reason: unknown) => {
				if (!aktiv) return;
				// Unbekannte oder fremde ID → „nicht gefunden" (Konzept Abschnitt 7: kein Zugriff
				// wird genauso dargestellt, keine Auskunft, ob es die Aufgabe gibt).
				setState(
					reason instanceof ResponseError && reason.response.status === 404 ? { kind: 'notFound' } : { kind: 'error' },
				);
			});
		return () => {
			aktiv = false;
		};
	}, [taskId, attempt]);

	// Nach dem Speichern im Formular refetchen (TASKS_CHANGED_EVENT, Muster NearbyCard) — die
	// Leseseite hält den Task-Bestand nicht selbst und sähe sonst veraltete Werte.
	useEffect(() => {
		const onTasksChanged = () => setAttempt((value) => value + 1);
		window.addEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		return () => {
			window.removeEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		};
	}, []);

	const task = state.kind === 'ready' ? state.task : null;
	// „Leer bleibt leer“: „Mehr Details“ nur mit Inhalt — hier der Ort; Einordnung (Säulen-Namen)
	// und die übrigen Meta-Angaben folgen mit Teil 3 (Säulennamen stecken nicht im Task-Objekt).
	const hatMehrDetails = task?.address != null && task.address !== '';

	return (
		<div className="task-view">
			{state.kind === 'loading' && (
				// Skelett in der Form der Ansicht (Konzept Abschnitt 7), kein Spinner.
				<div className="task-view-skeleton" aria-hidden="true">
					<div className="task-view-skeleton-title" />
					<div className="task-view-skeleton-row" />
					<div className="task-view-skeleton-row" />
				</div>
			)}
			{state.kind === 'notFound' && (
				<KolAlert _type="info" _variant="card">
					{t('app:shell.taskGone')}{' '}
					<KolLink _label={t('taskView:toTasks')} _href={`${import.meta.env.BASE_URL}aufgaben`} />
				</KolAlert>
			)}
			{state.kind === 'error' && (
				<>
					<KolAlert _type="error">{t('app:shell.loadFailed')}</KolAlert>
					<KolButton
						_label={t('taskView:retry')}
						_variant="secondary"
						_icons={{ left: { icon: 'fa-solid fa-rotate-right' } }}
						_on={{ onClick: () => setAttempt((value) => value + 1) }}
					/>
				</>
			)}
			{task !== null && (
				<>
					<div className="task-view-toolbar">
						<KolButton
							_label={t('common:actions.back')}
							_variant="secondary"
							_icons={{ left: { icon: 'fa-solid fa-arrow-left' } }}
							_on={{ onClick: onBack }}
						/>
						<KolButton
							_label={t('common:actions.edit')}
							_variant="secondary"
							_icons={{ left: { icon: 'fa-solid fa-pen' } }}
							_on={{ onClick: () => onEdit(task) }}
						/>
					</div>
					{/* `_label` trägt den Accessible Name (e2e role query), die children den Text für
					    den Unit-Test-Mock — derselbe Titel in beiden Welten. */}
					<KolHeading _level={1} _label={task.title} className="task-view-title">
						{task.title}
					</KolHeading>
					<TaskBadges task={task} />
					<div className="task-view-columns">
						<div className="task-view-content">
							{task.description != null && task.description !== '' && (
								// Fließtext mit erhaltenen Zeilenumbrüchen (Konzept Abschnitt 4.2).
								<p className="task-view-description">{task.description}</p>
							)}
						</div>
						<div className="task-view-facts">
							<ul className="task-view-facts-list">
								{task.deadline != null && !Number.isNaN(task.deadline.getTime()) && (
									// Dringlichkeit nie nur über Farbe: relativ UND absolut als Text (Konzept Abschnitt 4.2).
									<li className="task-view-fact">
										<span className="task-view-fact-label">{t('taskView:deadline')}</span>
										<span className="task-view-fact-value">
											{formatRelativeDeadline(task.deadline, new Date())} · {formatDeadline(task.deadline)}
										</span>
									</li>
								)}
								{task.estimatedEffort != null && (
									<li className="task-view-fact">
										<span className="task-view-fact-label">{t('taskView:effort')}</span>
										<span className="task-view-fact-value">{formatNumber(task.estimatedEffort)}</span>
									</li>
								)}
							</ul>
							{hatMehrDetails && (
								// Felder ohne Wert erscheinen nicht (Konzept Grundsatz 6) — „Mehr Details"
								// nur mit Inhalt. Einordnung (Säulen) steht hier, bis Teil 3 die Blöcke bringt.
								<KolDetails _label={t('taskView:moreDetails')}>
									<ul className="task-view-facts-list">
										<li className="task-view-fact">
											<span className="task-view-fact-label">{t('taskView:address')}</span>
											<span className="task-view-fact-value">{task.address}</span>
										</li>
									</ul>
								</KolDetails>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
};
