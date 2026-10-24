import { KolAlert, KolButton, KolHeading, KolLink } from '@public-ui/react-v19';
import { TaskStatus, ResponseError, type Category, type Pillar, type Series, type Task, type components } from 'client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCategories, getPillars, getSeries, getTask } from '../api';
import { client } from '../apiClient';
import { formatDeadline, formatNumber, formatRelativeDeadline } from '../lib/task';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';
import { TaskBadges } from './TaskBadges';

type TaskDependencies = components['schemas']['TaskDependencies'];
type TaskRef = components['schemas']['TaskRef'];

/** Status-Icon einer Kanten-Zeile: Haken für erledigt, offener Kreis sonst (nie nur Farbe). */
const statusIcon = (status: TaskRef['status']): string =>
	status === TaskStatus.Done ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';

/** Zeile einer Kante (Unteraufgabe/wartende Aufgabe): Status-Icon mit Text-Alternative + Titel-Link. */
const TaskRefRow = ({ kante }: { kante: TaskRef }) => {
	const { t } = useTranslation(['tasks']);
	const statusLabel =
		kante.status === TaskStatus.Done
			? t('tasks:status.done')
			: kante.status === TaskStatus.InProcess
				? t('tasks:status.inProcess')
				: t('tasks:status.open');
	return (
		<li className="task-view-dep">
			<i className={`${statusIcon(kante.status)} task-view-dep-status`} role="img" aria-label={statusLabel} />
			<KolLink _label={kante.title} _href={`${import.meta.env.BASE_URL}aufgaben/${kante.id}`} />
		</li>
	);
};

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
 * Abhaken/Primäraktion folgen in Teil 2. Seit Teil 3 (#2940) stehen die Zusammenhänge
 * als Blöcke dabei (Unteraufgaben, Blockiert, Herkunft, Ort, Einordnung) — jeder nur
 * mit gefüllten Werten („Leer bleibt leer"); der Kanten-Endpunkt ist `GET
 * /tasks/:id/dependencies`, aufgerufen direkt über den Client, weil der Unit-Test die
 * api-Fassade als Ganzes mockt.
 */
export const TaskView = ({ taskId, onBack, onEdit }: TaskViewProps) => {
	const { t } = useTranslation(['taskView', 'app', 'common', 'tasks']);
	const [state, setState] = useState<TaskViewState>({ kind: 'loading' });
	// Versuch-Zähler: „Erneut laden" stößt denselben Abruf erneut an (AK4).
	const [attempt, setAttempt] = useState(0);
	// Teil 3 (#2940) — Nebendaten der Blöcke; jeder Abruf versagt still (Block entfällt).
	const [deps, setDeps] = useState<TaskDependencies | null>(null);
	const [series, setSeries] = useState<Series | null>(null);
	const [pillars, setPillars] = useState<Pillar[] | null>(null);
	const [categories, setCategories] = useState<Category[] | null>(null);

	const task = state.kind === 'ready' ? state.task : null;

	useEffect(() => {
		let aktiv = true;
		setState({ kind: 'loading' });
		setDeps(null);
		setSeries(null);
		setPillars(null);
		setCategories(null);
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

	// Teil 3 (#2940): Kanten (Unteraufgaben/Blockiert), Herkunfts-Serie und Namen für die
	// Einordnung — erst laden, wenn die Aufgabe steht; ein Fehlschlag lässt den Block weg.
	useEffect(() => {
		if (task === null) return;
		let aktiv = true;
		client
			.GET('/tasks/{id}/dependencies', { params: { path: { id: task.id } } })
			.then(({ data }) => {
				if (aktiv && data !== undefined) setDeps(data);
			})
			.catch(() => {
				// Keine Kanten-Ansicht — die Blöcke bleiben weg.
			});
		if (task.seriesId != null) {
			getSeries({ id: task.seriesId })
				.then((geladen) => {
					if (aktiv) setSeries(geladen);
				})
				.catch(() => {
					// Serie nicht mehr auflösbar → Herkunfts-Block entfällt ohne Fehlermeldung (AK3).
				});
		}
		if ((task.pillars?.length ?? 0) > 0) {
			getPillars()
				.then((geladen) => {
					if (aktiv) setPillars(geladen);
				})
				.catch(() => {
					// Namen nicht auflösbar → Zeilen entfallen, Block bleibt leer.
				});
		}
		if (task.categoryId != null) {
			getCategories()
				.then((geladen) => {
					if (aktiv) setCategories(geladen);
				})
				.catch(() => {
					// Namen nicht auflösbar → Zeile entfällt.
				});
		}
		return () => {
			aktiv = false;
		};
	}, [task]);

	// Nach dem Speichern im Formular refetchen (TASKS_CHANGED_EVENT, Muster NearbyCard) — die
	// Leseseite hält den Task-Bestand nicht selbst und sähe sonst veraltete Werte.
	useEffect(() => {
		const onTasksChanged = () => setAttempt((value) => value + 1);
		window.addEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		return () => {
			window.removeEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		};
	}, []);

	// Zähler „X von Y“ (AK1): erledigte Kinder zählen mit — der Server liefert Done-Kinder mit.
	const doneSubtasks = deps?.subtasks.filter((kante) => kante.status === TaskStatus.Done).length ?? 0;
	const categoryName =
		task !== null && task.categoryId != null
			? categories?.find((kategorie) => kategorie.id === task.categoryId)?.name
			: undefined;
	// Aufgelöste Säulennamen in Task-Reihenfolge — nicht auflösbar → Zeile entfällt (AK5).
	const pillarNamen = (task?.pillars ?? [])
		.map((beitrag) => pillars?.find((p) => p.id === beitrag.pillarId)?.name)
		.filter((name): name is string => name != null);

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
							{task.address != null && task.address !== '' && (
								// AK4 (#2940): Der Ort ist eigener Block — „Mehr Details" entfällt ganz.
								<section className="task-view-block">
									<KolHeading _level={2} _label={t('taskView:address')}>
										{t('taskView:address')}
									</KolHeading>
									<p className="task-view-address">{task.address}</p>
									{task.latitude != null && task.longitude != null && (
										// Karten-Link als externes Ziel gekennzeichnet (AK4).
										<KolLink
											_label={t('taskView:openInMaps')}
											_href={`https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`}
											_target="_blank"
										/>
									)}
								</section>
							)}
							{deps !== null && deps.subtasks.length > 0 && (
								// AK1 (#2940): Unteraufgaben mit Zähler „X von Y" — der Zähler steht
								// neben der Überschrift, damit der Heading-Name sauber bleibt.
								<section className="task-view-block">
									<div className="task-view-block-head">
										<KolHeading _level={2} _label={t('taskView:subtasks')}>
											{t('taskView:subtasks')}
										</KolHeading>
										<span className="task-view-count">
											{t('taskView:subtaskCount', { done: doneSubtasks, total: deps.subtasks.length })}
										</span>
									</div>
									<ul className="task-view-dep-list">
										{deps.subtasks.map((kante) => (
											<TaskRefRow key={kante.id} kante={kante} />
										))}
									</ul>
								</section>
							)}
							{deps !== null && deps.dependents.length > 0 && (
								// AK2 (#2940): „Blockiert" — die Aufgaben, die auf diese warten
								// (getDependents); keine zweite Liste für dieselbe Kante (#336).
								<section className="task-view-block">
									<KolHeading _level={2} _label={t('taskView:blocked')}>
										{t('taskView:blocked')}
									</KolHeading>
									<ul className="task-view-dep-list">
										{deps.dependents.map((kante) => (
											<TaskRefRow key={kante.id} kante={kante} />
										))}
									</ul>
								</section>
							)}
							{task.seriesId != null && series !== null && (
								// AK3 (#2940): Herkunft — Link auf die Serie/Vorlage; die Abweichung
								// steht als Text darunter (nie nur Farbe).
								<section className="task-view-block">
									<KolHeading _level={2} _label={t('taskView:origin')}>
										{t('taskView:origin')}
									</KolHeading>
									<KolLink
										_label={
											series.autoCreate === false
												? t('taskView:fromTemplate', { name: series.title })
												: t('taskView:fromSeries', { name: series.title })
										}
										_href={`${import.meta.env.BASE_URL}serien/${series.id}`}
									/>
									{task.isException === true && <p className="task-view-exception">{t('taskView:seriesException')}</p>}
								</section>
							)}
							{(pillarNamen.length > 0 || categoryName != null) && (
								// AK5 (#2940): Einordnung — Säulen- und Kategorienamen als Text (Relief-Regel:
								// nie Farbe allein). Der Block erscheint erst mit dem ersten aufgelösten
								// Namen — keine leere Überschrift („Leer bleibt leer“).
								<section className="task-view-block">
									<KolHeading _level={2} _label={t('taskView:classification')}>
										{t('taskView:classification')}
									</KolHeading>
									<ul className="task-view-facts-list">
										{pillarNamen.map((name) => (
											<li key={name}>{name}</li>
										))}
										{categoryName != null && <li>{categoryName}</li>}
									</ul>
								</section>
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
						</div>
					</div>
				</>
			)}
		</div>
	);
};
