import { KolAlert, KolBadge, KolButton, KolDetails, KolHeading, KolInputCheckbox, KolLink } from '@public-ui/react-v19';
import { ResponseError, TaskStatus, type ChecklistItem, type Task, type TaskTreeNode } from 'client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getForest, getTask, snoozeTask, unarchiveTask, updateTask } from '../api';
import { toApiError } from '../lib/apiError';
import {
	doneBlockedHint,
	formatDeadline,
	formatNumber,
	formatRelativeDeadline,
	isDoneBlockedBySubtasks,
} from '../lib/task';
import { notifyTasksChanged, TASKS_CHANGED_EVENT } from '../lib/tasksChanged';
import { TaskBadges } from './TaskBadges';

/** Zustand der Leseseite: Laden (Skelett), Erfolg, „nicht gefunden" (404) oder Ladefehler. */
type TaskViewState = { kind: 'loading' } | { kind: 'ready'; task: Task } | { kind: 'notFound' } | { kind: 'error' };

/** i18n-Schlüssel je Status für die Badge-Zeile (common:status.*). */
const STATUS_KEY: Record<TaskStatus, string> = {
	[TaskStatus.Open]: 'open',
	[TaskStatus.InProcess]: 'inProcess',
	[TaskStatus.Done]: 'done',
};

/** Fund-Knoten im Wald (GET /forest) zur eigenen ID — Quelle der Unteraufgaben-Sperre (AK2). */
const findeKnoten = (wald: TaskTreeNode[], id: number): TaskTreeNode | null => {
	for (const knoten of wald) {
		if (knoten.id === id) return knoten;
		const treffer = findeKnoten(knoten.dependents ?? [], id);
		if (treffer !== null) return treffer;
	}
	return null;
};

interface TaskViewProps {
	/** ID der angezeigten Aufgabe aus der Route `/aufgaben/<id>`. */
	taskId: number;
	/** „Zurück" — zur zuletzt aktiven Hauptansicht, ohne Vorgänger (Push/Kaltstart) auf `/`. */
	onBack: () => void;
	/** „Bearbeiten" — öffnet das vorhandene Formular (`TaskFormModal`) für diese Aufgabe. */
	onEdit: (task: Task) => void;
	/**
	 * „Erledigt" — der bestehende App-Flow (#2939): überfällig fragt zuerst die Pünktlichkeit
	 * (#1964), offene Checkliste den Erledigen-Dialog, sonst direkter PATCH. Ohne Prop bleibt
	 * der Button wirkungslos (Unit-Tests rendern ohne App).
	 */
	onMarkDone?: (task: Task) => void;
}

/**
 * Leseseite einer Aufgabe unter `/aufgaben/<id>` (#2938 Teil 1, #2939 Teil 2 des
 * Ansichten-Konzepts, `docs/ux-konzept-ansichten.md` Abschnitt 4): Checkliste direkt abhakbar
 * (PATCH mit komplettem Array, #531), genau eine Primäraktion je Zustand, Anpinnen und
 * Zurückstellen ohne Formular — Fehler als `KolAlert` über der Primäraktion (Abschnitt 7).
 * Daten aus `GET /tasks/:id` (Task) und `GET /forest` (Unteraufgaben-Sperre); das Backend
 * bleibt unverändert.
 */
export const TaskView = ({ taskId, onBack, onEdit, onMarkDone }: TaskViewProps) => {
	const { t } = useTranslation(['taskView', 'app', 'common', 'tasks']);
	const [state, setState] = useState<TaskViewState>({ kind: 'loading' });
	// Versuch-Zähler: „Erneut laden“ stößt denselben Abruf erneut an (AK4).
	const [attempt, setAttempt] = useState(0);
	// Direkte Unteraufgaben aus dem Wald (AK2) — `null`: Wald nicht ladbar, Sperre aus (der
	// Server-Guard bleibt und die Ansicht zeigt seinen Grund als Alert, AK5).
	const [unteraufgaben, setUnteraufgaben] = useState<{ status: TaskStatus }[] | null>(null);
	// Fehlgeschlagene Aktion (AK5): KolAlert über der Primäraktion statt Toast (Konzept Abschnitt 7).
	const [actionError, setActionError] = useState<string | null>(null);
	// Sichtbare Snooze-Bestätigung (AK4) — das Task-DTO kennt kein snoozedUntil, daher die
	// Bestands-Notice (Spec #2939).
	const [snoozeNotice, setSnoozeNotice] = useState('');
	// Doppelklick-Schutz je Lauf (Muster App.tsx snooze) + Spiegel für die Checkbox-Sperre:
	// In-Flight am Checklisten-Array sperren, sonst verlieren sich parallele Haken (#531, KI-UX).
	const inAktion = useRef(false);
	const [checklistBusy, setChecklistBusy] = useState(false);
	// Markiert das eigene TASKS_CHANGED_EVENT: die Mutation spiegelt den POST-Response bereits —
	// der daraus folgende eigene Refetch würde ihn mit dem älteren GET-Stand überschreiben.
	const eigeneAenderung = useRef(false);

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

	// Unteraufgaben-Sperre (AK2): GET /tasks/:id liefert keine Unteraufgaben — der Wald liefert
	// die Kanten (`dependents`, Muster TaskTree). Scheitert er, bleibt „Erledigt" aktiv; der
	// Server-Guard (tasks.ts) fängt den Fall trotzdem ab und die Ansicht zeigt ihn (AK5).
	useEffect(() => {
		let aktiv = true;
		getForest()
			.then((wald) => {
				if (!aktiv) return;
				const knoten = findeKnoten(wald, taskId);
				setUnteraufgaben(knoten === null ? [] : knoten.dependents);
			})
			.catch(() => {
				if (aktiv) setUnteraufgaben(null);
			});
		return () => {
			aktiv = false;
		};
	}, [taskId, attempt]);

	// Nach dem Speichern im Formular refetchen (TASKS_CHANGED_EVENT, Muster NearbyCard) — die
	// Leseseite hält den Task-Bestand nicht selbst und sähe sonst veraltete Werte.
	useEffect(() => {
		const onTasksChanged = () => {
			if (eigeneAenderung.current) {
				eigeneAenderung.current = false;
				return;
			}
			setAttempt((value) => value + 1);
		};
		window.addEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		return () => {
			window.removeEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		};
	}, []);

	const task = state.kind === 'ready' ? state.task : null;
	const offeneUnteraufgaben = (unteraufgaben ?? []).filter((eintrag) => eintrag.status !== TaskStatus.Done).length;
	const gesperrt = isDoneBlockedBySubtasks(unteraufgaben ?? []);
	// „Leer bleibt leer“: „Mehr Details“ nur mit Inhalt — hier der Ort; Einordnung (Säulen-Namen)
	// und die übrigen Meta-Angaben folgen mit Teil 3 (Säulennamen stecken nicht im Task-Objekt).
	const hatMehrDetails = task?.address != null && task.address !== '';

	/** Menschenlesbare Fehlermeldung aus einer fehlgeschlagenen Aktion (AK5). */
	const fehlerText = async (reason: unknown): Promise<string> => {
		const apiError = await toApiError(reason);
		return apiError.message !== '' ? apiError.message : t('taskView:actionFailed');
	};

	/**
	 * Führt eine Mutation mit optimistischem Spiegel aus: Zustand sofort anwenden, bei Fehlschlag
	 * auf den vorherigen Stand zurück (AK5) und der Grund als Alert über der Primäraktion.
	 */
	const mitOptimismus = (
		vorher: Task,
		optimistisch: Task,
		aktion: () => Promise<Task>,
		nachErfolg?: (aktualisiert: Task) => void,
	): void => {
		if (inAktion.current) return;
		inAktion.current = true;
		setActionError(null);
		setState({ kind: 'ready', task: optimistisch });
		void (async () => {
			try {
				const aktualisiert = await aktion();
				setState({ kind: 'ready', task: aktualisiert });
				eigeneAenderung.current = true;
				notifyTasksChanged();
				nachErfolg?.(aktualisiert);
			} catch (reason) {
				setState({ kind: 'ready', task: vorher });
				setActionError(await fehlerText(reason));
			} finally {
				inAktion.current = false;
				setChecklistBusy(false);
			}
		})();
	};

	/** Basisfelder eines PATCH — dieselbe Menge wie der Pin-Toggle in App.tsx (#1582). */
	const basisUpdate = (aufgabe: Task) => ({
		title: aufgabe.title,
		description: aufgabe.description,
		status: aufgabe.status,
		priority: aufgabe.priority,
		estimatedEffort: aufgabe.estimatedEffort,
		deadline: aufgabe.deadline,
	});

	/** Checklistenpunkt umschalten (AK1): PATCH mit dem KOMPLETTEN Array (#531), In-Flight gesperrt. */
	const handleChecklistToggle = (item: ChecklistItem): void => {
		if (task === null || inAktion.current || checklistBusy) return;
		const checklist = (task.checklist ?? []).map((eintrag) =>
			eintrag.id === item.id ? { ...eintrag, completed: !eintrag.completed } : eintrag,
		);
		setChecklistBusy(true);
		mitOptimismus(task, { ...task, checklist }, () =>
			updateTask({ id: task.id, taskUpdate: { ...basisUpdate(task), checklist } }),
		);
	};

	/** Anpinnen/Lösen (AK4) — spiegelt sofort über die Badge-Zeile. */
	const handlePinToggle = (): void => {
		if (task === null) return;
		mitOptimismus(task, { ...task, pinned: !task.pinned }, () =>
			updateTask({ id: task.id, taskUpdate: { ...basisUpdate(task), pinned: !task.pinned } }),
		);
	};

	/** Kurz zurückstellen (AK4): Server blendet die Aufgabe 3 h aus; Bestätigung als Notice. */
	const handleSnooze = (): void => {
		if (task === null) return;
		mitOptimismus(
			task,
			task,
			async () => snoozeTask({ id: task.id }),
			() => setSnoozeNotice(t('common:actions.snoozed')),
		);
	};

	/** Wieder öffnen (AK3): Status zurück auf Offen, `completedAt` entfällt (Server räumt auf). */
	const handleReopen = (): void => {
		if (task === null) return;
		mitOptimismus(task, { ...task, status: TaskStatus.Open, completedAt: null }, () =>
			updateTask({ id: task.id, taskUpdate: { ...basisUpdate(task), status: TaskStatus.Open } }),
		);
	};

	/** Wiederherstellen (AK3) aus dem Archiv. */
	const handleRestore = (): void => {
		if (task === null) return;
		mitOptimismus(task, { ...task, archivedAt: null }, async () => unarchiveTask({ id: task.id }));
	};

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
						<div className="task-view-toolbar-actions">
							<KolButton
								_label={t(task.pinned ? 'tasks:actions.unpin' : 'tasks:actions.pin')}
								_variant="secondary"
								_icons={{ left: { icon: 'fa-solid fa-thumbtack' } }}
								_on={{ onClick: handlePinToggle }}
							/>
							<KolButton
								_label={t('common:actions.snooze')}
								_variant="secondary"
								_icons={{ left: { icon: 'fa-solid fa-pause' } }}
								_on={{ onClick: handleSnooze }}
							/>
							<KolButton
								_label={t('common:actions.edit')}
								_variant="secondary"
								_icons={{ left: { icon: 'fa-solid fa-pen' } }}
								_on={{ onClick: () => onEdit(task) }}
							/>
						</div>
					</div>
					{/* `_label` trägt den Accessible Name (e2e role query), die children den Text für
					    den Unit-Test-Mock — derselbe Titel in beiden Welten. */}
					<KolHeading _level={1} _label={task.title} className="task-view-title">
						{task.title}
					</KolHeading>
					<TaskBadges task={task} />
					{/* Status und Pin als Text-Badges (AK3/AK4) — der Zustandswechsel ist ohne Farbe
					    lesbar (WCAG 1.4.1); TaskBadges zeigt den Status bewusst nicht (Baum teilt sie). */}
					<div className="task-view-status">
						<KolBadge _label={t(`common:status.${STATUS_KEY[task.status]}`)} className="task-view-status-badge" />
						{task.pinned === true && <KolBadge _label={t('tasks:badges.pinned')} className="task-view-status-badge" />}
					</div>
					<div className="task-view-columns">
						<div className="task-view-content">
							{task.description != null && task.description !== '' && (
								// Fließtext mit erhaltenen Zeilenumbrüchen (Konzept Abschnitt 4.2).
								<p className="task-view-description">{task.description}</p>
							)}
							{(task.checklist?.length ?? 0) > 0 && (
								// Checkliste (AK1): jeder Punkt direkt abhakbar, Zähler in der
								// Überschriftenzeile, ganze Zeile tappbar (KI-UX Regel 2).
								<div className="task-view-checklist">
									<p className="task-view-checklist-counter">
										{t('taskView:checklistCounter', {
											done: task.checklist!.filter((eintrag) => eintrag.completed).length,
											total: task.checklist!.length,
										})}
									</p>
									{task.checklist!.map((item) => (
										<KolInputCheckbox
											key={item.id}
											_label={item.title}
											_checked={item.completed}
											_disabled={checklistBusy}
											_on={{ onChange: () => handleChecklistToggle(item) }}
										/>
									))}
								</div>
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
					{/* Aktionsbereich (AK2/AK3/AK5): sticky unten, Alerts und Sperr-Grund mit im
					    Blick (Konzept Abschnitt 7), genau eine Aktion je Zustand. */}
					<div className="task-view-actions">
						{task.archivedAt != null && (
							<KolAlert _type="info" _variant="card">
								{t('taskView:archivedBanner')}
							</KolAlert>
						)}
						{snoozeNotice !== '' && <KolAlert _type="info">{snoozeNotice}</KolAlert>}
						{actionError !== null && <KolAlert _type="error">{actionError}</KolAlert>}
						{gesperrt && task.status !== TaskStatus.Done && task.archivedAt == null && (
							// Grund dauerhaft sichtbar (nicht erst auf Klickversuch) und ohne
							// Interaktion lesbar — der disabled Button selbst trägt keinen Text (KI-UX).
							<p className="task-view-blocked-hint">{doneBlockedHint(offeneUnteraufgaben)}</p>
						)}
						{task.archivedAt != null ? (
							<KolButton
								_label={t('taskView:restore')}
								_variant="secondary"
								_icons={{ left: { icon: 'fa-solid fa-box-archive' } }}
								_on={{ onClick: handleRestore }}
							/>
						) : task.status === TaskStatus.Done ? (
							<KolButton
								_label={t('taskView:reopen')}
								_variant="secondary"
								_icons={{ left: { icon: 'fa-solid fa-rotate-right' } }}
								_on={{ onClick: handleReopen }}
							/>
						) : (
							<KolButton
								_label={t('taskView:markDone')}
								_variant="primary"
								_disabled={gesperrt}
								_icons={{ left: { icon: 'fa-solid fa-check' } }}
								_on={{ onClick: () => onMarkDone?.(task) }}
							/>
						)}
					</div>
				</>
			)}
		</div>
	);
};
