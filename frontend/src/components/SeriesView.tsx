import { api } from '../api';
import { KolAlert, KolBadge, KolButton, KolDetails, KolHeading, KolLink } from '@public-ui/react-v19';
import { ResponseError as ClientResponseError, type Series, type Task } from 'client';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PRIORITY_COLOR } from '../lib/badgeColors';
import { formatDeadline, formatNumber, priorityBadge } from '../lib/task';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';

// Dialog dynamisch: der Chunk lädt beim ersten Öffnen — vorher nie („Leer bleibt leer“).
const SeriesInstanceDialog = lazy(() =>
	import('./SeriesInstanceDialog').then((module) => ({ default: module.SeriesInstanceDialog })),
);

/** Zustand der Leseseite: Laden (Skelett), Erfolg, "nicht gefunden" (404) oder Ladefehler. */
type SeriesViewState =
	{ kind: 'loading' } | { kind: 'ready'; series: Series; instanzen: Task[] } | { kind: 'notFound' } | { kind: 'error' };

interface SeriesViewProps {
	/** ID der angezeigten Serie/Vorlage aus der Route `/serien/<id>`. */
	seriesId: number;
	/** „Zurück" — zur zuletzt aktiven Hauptansicht, ohne Vorgänger (Kaltstart) auf `/`. */
	onBack: () => void;
	/** „Bearbeiten" — öffnet den vorhandenen Serien-Dialog (`TaskForm` im Serie-Modus). */
	onEdit: (series: Series) => void;
}

/** `completedAt` kommt als ISO-String (Client-Vertrag) — Millisekunden-Schlüssel für die Sortierung. */
const dateValue = (completedAt: string | null | undefined): number => new Date(completedAt ?? 0).getTime();

/**
 * Leseseite einer Serie bzw. Vorlage unter `/serien/<id>` (#2942, Ansichten Teil 5,
 * `docs/ux-konzept-ansichten.md` Abschnitt 5): eine Komponente, zwei Ausprägungen via
 * `autoCreate` (ADR 0020). Daten: `GET /series/:id` plus Instanz-Liste über den neuen
 * `GET /tasks?originSeriesId=`-Filter (deckt auch erledigte, archivierte und abgekoppelte
 * Instanzen ab). Primäraktion öffnet den vorhandenen `SeriesInstanceDialog` (#2359).
 */
export const SeriesView = ({ seriesId, onBack, onEdit }: SeriesViewProps) => {
	const { t } = useTranslation(['seriesView', 'capture', 'taskView', 'common', 'app']);
	const [state, setState] = useState<SeriesViewState>({ kind: 'loading' });
	const [attempt, setAttempt] = useState(0);
	const [dialogOpen, setDialogOpen] = useState(false);

	useEffect(() => {
		let aktiv = true;
		setState({ kind: 'loading' });
		setDialogOpen(false);
		void Promise.all([api.getSeries({ id: seriesId }), api.listTasks({}, { originSeriesId: seriesId })])
			.then(([series, instanzen]) => {
				if (aktiv) setState({ kind: 'ready', series, instanzen });
			})
			.catch((reason: unknown) => {
				if (!aktiv) return;
				// Unbekannte oder fremde ID → „nicht gefunden“ (Konzept Abschnitt 7: kein Zugriff wird
				// genauso dargestellt, keine Auskunft, ob es die Serie gibt).
				setState(
					reason instanceof ClientResponseError && reason.response.status === 404
						? { kind: 'notFound' }
						: { kind: 'error' },
				);
			});
		return () => {
			aktiv = false;
		};
	}, [seriesId, attempt]);

	// Nach dem Speichern im Serien-Dialog refetchen (TASKS_CHANGED_EVENT, Muster TaskView) — die
	// Ansicht übernimmt die Werte ohne Neuladen.
	useEffect(() => {
		const onTasksChanged = () => setAttempt((value) => value + 1);
		window.addEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		return () => {
			window.removeEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		};
	}, []);

	if (state.kind === 'loading') {
		// Skelett in der Form der Ansicht (Konzept Abschnitt 7), kein Spinner.
		return (
			<div className="series-view">
				<div className="series-view-skeleton" aria-hidden="true">
					<div className="series-view-skeleton-title" />
					<div className="series-view-skeleton-row" />
					<div className="series-view-skeleton-row" />
				</div>
			</div>
		);
	}
	if (state.kind === 'notFound') {
		return (
			<div className="series-view">
				<KolAlert _type="info" _variant="card">
					{t('seriesView:seriesGone')}{' '}
					{/* Pfad hart kodiert (ADR 0015: App liegt fest unter /app/) — der Unit-Mock prüft
					    die exakte href `/app/serien`; `import.meta.env.BASE_URL` ist in Vitest `/`. */}
					<KolLink _label={t('seriesView:toSeries')} _href="/app/serien" />
				</KolAlert>
			</div>
		);
	}
	if (state.kind === 'error') {
		return (
			<div className="series-view">
				<KolAlert _type="error">{t('app:shell.loadFailed')}</KolAlert>
				<KolButton
					_label={t('taskView:retry')}
					_variant="secondary"
					_icons={{ left: { icon: 'fa-solid fa-rotate-right' } }}
					_on={{ onClick: () => setAttempt((value) => value + 1) }}
				/>
			</div>
		);
	}

	const { series, instanzen } = state;
	const offen = instanzen.filter((task) => task.status !== 'Done' && task.archivedAt == null);
	const erledigt = instanzen
		.filter((task) => task.status === 'Done' && task.archivedAt == null)
		.sort((a, b) => dateValue(b.completedAt) - dateValue(a.completedAt))
		.slice(0, 5);
	const badge = priorityBadge(series.priority);
	const zeile = (task: Task, mitDatum: boolean) => (
		<li key={task.id} className="series-view-task">
			<KolLink _label={task.title} _href={`${import.meta.env.BASE_URL}aufgaben/${task.id}`} />
			{mitDatum && task.completedAt != null && (
				<span className="series-view-task-date">{formatDeadline(new Date(task.completedAt))}</span>
			)}
		</li>
	);
	// „Jede Aufgabe bekommt" / „Die Aufgabe bekommt" — vererbbare Werte (Konzept §5), Checkliste
	// nur lesbar als Zähler + aufklappbare Titel (KEINE Checkbox, KI-UX).
	const getsBlock = (
		<>
			<KolHeading _level={2} _label={t(series.autoCreate ? 'seriesView:everyTaskGets' : 'seriesView:templateTaskGets')}>
				{t(series.autoCreate ? 'seriesView:everyTaskGets' : 'seriesView:templateTaskGets')}
			</KolHeading>
			<ul className="task-view-facts-list">
				<li className="task-view-fact">
					<span className="task-view-fact-label">{t('taskView:effort')}</span>
					<span className="task-view-fact-value">{formatNumber(series.estimatedEffort)}</span>
				</li>
				{series.address != null && series.address !== '' && (
					<li className="task-view-fact">
						<span className="task-view-fact-label">{t('taskView:address')}</span>
						<span className="task-view-fact-value">{series.address}</span>
					</li>
				)}
				{(series.pillars?.length ?? 0) > 0 && (
					<li className="task-view-fact">
						<span className="task-view-fact-label">{t('seriesView:pillars')}</span>
						<span className="task-view-fact-value">{series.pillars?.length}</span>
					</li>
				)}
				<li className="task-view-fact">
					<span className="task-view-fact-label">{t('seriesView:autoDelete')}</span>
					<span className="task-view-fact-value">
						{series.autoDeleteAfterDeadline ? t('seriesView:autoDeleteOn') : t('seriesView:autoDeleteOff')}
					</span>
				</li>
			</ul>
			{(series.checklist?.length ?? 0) > 0 && (
				<KolDetails _label={t('seriesView:checklist', { count: series.checklist?.length ?? 0 })}>
					<ul className="series-view-checklist">
						{(series.checklist ?? []).map((item) => (
							<li key={item.id}>{item.title}</li>
						))}
					</ul>
				</KolDetails>
			)}
		</>
	);

	return (
		<div className="series-view">
			<div className="series-view-toolbar">
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
					_on={{ onClick: () => onEdit(series) }}
				/>
			</div>
			{/* `_label` trägt den Accessible Name (e2e role query), die children den Text für
			    den Unit-Test-Mock — derselbe Titel in beiden Welten (Muster TaskView). */}
			<div className="series-view-head">
				<KolHeading _level={1} _label={series.title} className="series-view-title">
					{series.title}
				</KolHeading>
				<div className="task-tree-badges">
					<KolBadge _label={badge.label} _color={PRIORITY_COLOR[badge.type]} />
				</div>
			</div>
			<div className="series-view-content">
				{series.autoCreate &&
					// Rhythmus-Klartext mit Startdatum; „Nächste:"-Termine sind Teil 6 (#2943). Ruhende
					// Serie: „Pausiert" statt Terminen.
					(series.active ? (
						<p className="series-view-rhythm">
							{t(`capture:seriesTab.rhythm.${series.rhythm}`)} · {formatDeadline(series.startDate)}
						</p>
					) : (
						<p className="series-view-rhythm">{t('seriesView:paused')}</p>
					))}
				{!series.autoCreate && <p className="series-view-ondemand">{t('seriesView:onDemand')}</p>}
				{series.autoCreate ? (
					<>
						{offen.length > 0 && (
							<>
								<KolHeading _level={2} _label={t('seriesView:openTasks')}>
									{t('seriesView:openTasks')}
								</KolHeading>
								<ul className="series-view-tasks">{offen.map((task) => zeile(task, false))}</ul>
							</>
						)}
						{erledigt.length > 0 && (
							<>
								<KolHeading _level={2} _label={t('seriesView:lastCompleted')}>
									{t('seriesView:lastCompleted')}
								</KolHeading>
								<ul className="series-view-tasks">{erledigt.map((task) => zeile(task, true))}</ul>
							</>
						)}
					</>
				) : (
					<>
						{getsBlock}
						{offen.length + erledigt.length > 0 && (
							<>
								<KolHeading _level={2} _label={t('seriesView:fromTemplate')}>
									{t('seriesView:fromTemplate')}
								</KolHeading>
								<ul className="series-view-tasks">
									{offen.map((task) => zeile(task, false))}
									{erledigt.map((task) => zeile(task, true))}
								</ul>
							</>
						)}
					</>
				)}
				{series.description != null && series.description !== '' && (
					<p className="series-view-description">{series.description}</p>
				)}
			</div>
			{series.autoCreate && <div className="series-view-facts">{getsBlock}</div>}
			<div className="series-view-primary">
				<KolButton
					_variant="primary"
					_label={t(series.autoCreate ? 'seriesView:primarySeries' : 'seriesView:primaryTemplate')}
					_on={{ onClick: () => setDialogOpen(true) }}
				/>
			</div>
			{dialogOpen && (
				<Suspense fallback={null}>
					<SeriesInstanceDialog
						series={series}
						onClose={() => setDialogOpen(false)}
						onCreated={(task) => {
							setDialogOpen(false);
							// Volle Navigation auf die Aufgabenansicht der neuen Aufgabe (Präzedenz
							// PushToast: `location.assign`; kein Router-Kontext in der Komponente).
							window.location.assign(`${import.meta.env.BASE_URL}aufgaben/${task.id}`);
						}}
					/>
				</Suspense>
			)}
		</div>
	);
};
