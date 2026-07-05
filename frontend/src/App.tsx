import { KolAlert, KolAvatar, KolHeading, KolSpin, KolTabs, KolToolbar } from '@public-ui/react-v19';
import type { Pillar, Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { CompletedTasksTable } from './components/CompletedTasksTable';
import { Footer } from './components/Footer';
import { Dashboard } from './components/Dashboard';
import { DeleteTaskDialog } from './components/DeleteTaskDialog';
import { DependencyModal } from './components/DependencyModal';
import { EmptyState } from './components/EmptyState';
import { ForestPanel } from './components/ForestPanel';
import { HelpPage } from './components/HelpPage';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { SeriesManagementModal } from './components/SeriesManagementModal';
import { SettingsPage } from './components/SettingsPage';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskTree } from './components/TaskTree';
import { toApiError } from './lib/apiError';
import type { AuthUser } from './lib/auth';
import { calculateProgress } from './lib/calculateProgress';
import { buildDependencyMap } from './lib/dependencies';
import { APP_VERSION } from './lib/version';

type Dialog =
	// `parentTask` gesetzt → die neu angelegte Aufgabe wird als Vorgänger mit ihr verknüpft (Unteraufgabe).
	| { kind: 'create'; parentTask?: Task }
	| { kind: 'edit'; task: Task }
	| { kind: 'delete'; task: Task }
	| { kind: 'dependencies'; taskId: number }
	| { kind: 'series' }
	| null;

// Die Hauptansichten als Tab-Leiste oben (Inhalt steckt in den zugehörigen `tab-N`-Slots von
// `KolTabs`). Modulkonstante, damit `KolTabs` nicht bei jedem Render eine neue Tab-Liste erhält und
// die Auswahl zurücksetzt.
const VIEW_TABS = [
	{ _label: 'Dashboard' },
	{ _label: 'Aufgaben' },
	{ _label: 'Aufgabenwald' },
	{ _label: 'Erledigte Aufgaben' },
];

// Modulkonstanten für Toolbar-Icons: stabile Objektidentität pro Render, damit der Icon-Watcher
// nicht unnötig erneut feuert (z. B. CREATE_ICON für „Neuen Task anlegen").
const CREATE_ICON = { left: { icon: 'fa-solid fa-plus' } };
const SERIES_ICON = { left: { icon: 'fa-solid fa-repeat' } };
const HELP_ICON = { left: { icon: 'fa-solid fa-circle-question' } };
const SETTINGS_ICON = { left: { icon: 'fa-solid fa-gear' } };
const LOGOUT_ICON = { left: { icon: 'fa-solid fa-right-from-bracket' } };

export const App = ({ user }: { user: AuthUser }) => {
	const [showHelp, setShowHelp] = useState(() => window.location.pathname.startsWith('/hilfe'));
	const [showSettings, setShowSettings] = useState(() => window.location.pathname.startsWith('/settings'));
	const [tasks, setTasks] = useState<Task[] | null>(null);
	const [forest, setForest] = useState<TaskTreeNode[]>([]);
	const [nextTask, setNextTask] = useState<Task | null>(null);
	const [suggestions, setSuggestions] = useState<Task[]>([]);
	const [pillars, setPillars] = useState<Pillar[]>([]);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [dialog, setDialog] = useState<Dialog>(null);
	const [logoutLoading, setLogoutLoading] = useState(false);
	const [logoutError, setLogoutError] = useState<string | null>(null);
	const [updateError, setUpdateError] = useState<string | null>(null);

	const reload = useCallback(async (signal?: AbortSignal): Promise<void> => {
		setLoading(true);
		try {
			const [loadedTasks, loadedForest, loadedNext, loadedSuggestions, loadedPillars] = await Promise.all([
				api.listTasks({ signal }),
				api.getForest({ signal }),
				api.getNextTask({ signal }),
				api.getSuggestions({ signal }),
				api.listPillars({ signal }),
			]);
			setTasks(loadedTasks);
			setForest(loadedForest);
			setNextTask(loadedNext ?? null);
			setSuggestions(loadedSuggestions);
			setPillars(loadedPillars);
			setLoadError(null);
		} catch (reason) {
			if (signal?.aborted === true) {
				return;
			}
			const apiError = await toApiError(reason);
			if (apiError.status === 401) {
				return;
			}
			setLoadError(apiError.message);
		} finally {
			if (signal?.aborted !== true) {
				setLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void reload(controller.signal);
		return () => controller.abort();
	}, [reload]);

	useEffect(() => {
		const onPop = () => {
			const path = window.location.pathname;
			setShowHelp(path.startsWith('/hilfe'));
			setShowSettings(path.startsWith('/settings'));
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	const dependencyMap = useMemo(() => buildDependencyMap(forest), [forest]);

	// Fortschritt (erledigt/gesamt inkl. aller Unter-Tasks) je Task-ID aus dem Aufgabenwald ableiten.
	// Tasks ohne Unter-Tasks liefern `null` und tauchen bewusst nicht in der Map auf (AK3).
	const progressMap = useMemo(() => {
		const map = new Map<number, { done: number; total: number }>();
		const visited = new Set<TaskTreeNode>();
		const visit = (node: TaskTreeNode): void => {
			if (visited.has(node)) return;
			visited.add(node);
			const progress = calculateProgress(node);
			if (progress !== null) {
				map.set(node.id, progress);
			}
			for (const dep of node.dependents) {
				visit(dep);
			}
		};
		forest.forEach(visit);
		return map;
	}, [forest]);

	const handleLogout = useCallback(async (): Promise<void> => {
		setLogoutLoading(true);
		setLogoutError(null);
		try {
			await api.logout();
			window.location.href = '/login';
		} catch (reason) {
			setLogoutError(reason instanceof Error ? reason.message : 'Logout fehlgeschlagen');
			setLogoutLoading(false);
		}
	}, []);

	/** Nach erfolgreicher Mutation: Dialog schließen und Daten neu laden. */
	const afterMutation = useCallback((): void => {
		setDialog(null);
		void reload();
	}, [reload]);

	const closeDialog = useCallback((): void => setDialog(null), []);

	// Fallback-Fokusziel für Dialoge, nach denen das auslösende Element nicht mehr im DOM ist
	// (z. B. nach erfolgreichem Löschen: der Löschen-Button fällt mit der Zeile aus dem DOM).
	// tabIndex={-1} erlaubt programmatischen Fokus ohne visuelle Tab-Stop-Wirkung.
	const deleteFallbackRef = useRef<HTMLElement>(null);

	// Nach erfolgreichem Löschen ist der auslösende Button mit seiner Tabellenzeile aus dem DOM
	// gefallen, sobald `reload()` aufgelöst und die Tabelle re-rendert hat. Der Modal-Cleanup setzt
	// den Fokus zu früh (vor dem Reload, Trigger noch verbunden), sodass er anschließend auf `body`
	// fällt. Daher den Fallback-Fokus explizit erst NACH dem Reload setzen.
	const afterDelete = useCallback((): void => {
		setDialog(null);
		void reload().then(() => {
			deleteFallbackRef.current?.focus();
		});
	}, [reload]);

	const openHelp = useCallback((): void => {
		window.history.pushState({}, '', '/hilfe');
		setShowHelp(true);
	}, []);

	const closeHelp = useCallback((): void => {
		window.history.pushState({}, '', '/');
		setShowHelp(false);
	}, []);

	const openSettings = useCallback((): void => {
		window.history.pushState({}, '', '/settings/pillars');
		setShowSettings(true);
	}, []);

	const closeSettings = useCallback((): void => {
		window.history.pushState({}, '', '/');
		setShowSettings(false);
	}, []);

	// Nach dem Speichern auf der Einstellungen-Seite: zurück zum Dashboard (#270) und die Daten neu
	// laden, damit die geänderten Säulen-Gewichte sofort in Dashboard und Ranking sichtbar sind.
	const afterSettingsSaved = useCallback((): void => {
		closeSettings();
		void reload();
	}, [closeSettings, reload]);

	// Stabile Callback-Identitäten, damit die memoisierte `TaskTable` beim Öffnen eines Dialogs nicht
	// neu rendert (sonst Zellen-/Toolbar-Neuaufbau samt Fokusverlust am auslösenden Button).
	const openEdit = useCallback((task: Task): void => setDialog({ kind: 'edit', task }), []);
	const openDelete = useCallback((task: Task): void => setDialog({ kind: 'delete', task }), []);
	const openDependencies = useCallback((task: Task): void => setDialog({ kind: 'dependencies', taskId: task.id }), []);
	const openAddSubtask = useCallback((task: Task): void => setDialog({ kind: 'create', parentTask: task }), []);

	// Binärer Erledigt-Toggle (#315): schaltet die Aufgabe zwischen „Erledigt" und „Offen" um und lädt
	// die Daten neu. Der Toggle-Guard gegen offene Unteraufgaben sitzt in der Liste (`TaskTree`).
	const handleDoneToggle = useCallback(
		async (task: Task): Promise<void> => {
			const next = task.status === TaskStatus.Done ? TaskStatus.Open : TaskStatus.Done;
			const markingDone = task.status !== TaskStatus.Done;
			try {
				setUpdateError(null);
				await api.updateTask({
					id: task.id,
					taskUpdate: {
						title: task.title,
						description: task.description,
						status: next,
						priority: task.priority,
						estimatedEffort: task.estimatedEffort,
						deadline: task.deadline,
					},
				});
				if (markingDone) {
					// Optimistic update: keeps the task in the forest view so the Done→Open
					// toggle remains accessible. Forest API only returns Open/In-process tasks.
					setTasks((prev) => (prev === null ? null : prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))));
				} else {
					await reload();
				}
			} catch (reason) {
				const apiError = await toApiError(reason);
				setUpdateError(apiError.message);
			}
		},
		[reload],
	);

	// Bei einer Dependency-Änderung bleibt der Dialog offen; nur die Daten werden aktualisiert.
	const refreshKeepingDialog = useCallback((): void => {
		void reload();
	}, [reload]);

	const dependencyTask =
		dialog?.kind === 'dependencies' ? (tasks?.find((task) => task.id === dialog.taskId) ?? null) : null;

	if (showSettings) {
		return <SettingsPage pillars={pillars} onBack={closeSettings} onSaved={afterSettingsSaved} />;
	}

	if (showHelp) {
		return <HelpPage onBack={closeHelp} />;
	}

	return (
		<main className="app" ref={deleteFallbackRef} tabIndex={-1} data-focus-fallback>
			<header className="app-header">
				<KolHeading _label="Priority Pilot" _level={1} />
				<div className="toolbar">
					<KolToolbar
						_label="Kopf-Aktionen"
						_orientation="horizontal"
						_items={[
							{
								type: 'button',
								_label: 'Neuen Task anlegen',
								_hideLabel: true,
								_icons: CREATE_ICON,
								_variant: 'primary',
								_on: { onClick: () => setDialog({ kind: 'create' }) },
							},
							{
								type: 'button',
								_label: 'Serien verwalten',
								_hideLabel: true,
								_icons: SERIES_ICON,
								_variant: 'secondary',
								_on: { onClick: () => setDialog({ kind: 'series' }) },
							},
							{
								type: 'button' as const,
								_label: 'Einstellungen',
								_hideLabel: true,
								_icons: SETTINGS_ICON,
								_variant: 'secondary' as const,
								_on: { onClick: openSettings },
							},
							{
								type: 'button' as const,
								_label: 'Hilfe',
								_hideLabel: true,
								_icons: HELP_ICON,
								_variant: 'secondary' as const,
								_on: { onClick: openHelp },
							},
							{
								type: 'button' as const,
								_label: 'Abmelden',
								_hideLabel: true,
								_icons: LOGOUT_ICON,
								_variant: 'secondary' as const,
								_disabled: logoutLoading,
								_on: { onClick: () => void handleLogout() },
							},
						]}
					/>
					<div className="user-info">
						<KolAvatar _label={user.name} _src={user.avatarUrl ?? undefined} />
						<span className="user-display-name">{user.name}</span>
					</div>
				</div>
			</header>

			{loadError !== null && (
				<KolAlert _type="error" _label="Daten konnten nicht geladen werden">
					{loadError}
				</KolAlert>
			)}
			{logoutError !== null && (
				<div role="alert">
					<KolAlert _type="error" _label="Logout fehlgeschlagen">
						{logoutError}
					</KolAlert>
				</div>
			)}
			{updateError !== null && (
				<div role="alert">
					<KolAlert _type="error" _label="Aufgabe konnte nicht aktualisiert werden">
						{updateError}
					</KolAlert>
				</div>
			)}
			{tasks === null && loading && (
				<div className="loading">
					<KolSpin _show _variant="cycle" _label="Lädt" />
					<span>Lade Tasks…</span>
				</div>
			)}

			{tasks !== null && tasks.length === 0 && <EmptyState onCreate={() => setDialog({ kind: 'create' })} />}

			{tasks !== null && tasks.length > 0 && (
				<KolTabs className="app-tabs" _label="Ansichten" _tabs={VIEW_TABS}>
					<div slot="tab-0">
						<Dashboard
							tasks={tasks}
							forest={forest}
							nextTask={nextTask}
							suggestions={suggestions}
							pillars={pillars}
							displayName={user.name}
						/>
					</div>
					<div slot="tab-1">
						<section className="task-section">
							<TaskTree
								forest={forest}
								tasks={tasks}
								progressMap={progressMap}
								onEdit={openEdit}
								onDelete={openDelete}
								onEditDependencies={openDependencies}
								onAddSubtask={openAddSubtask}
								onDoneToggle={handleDoneToggle}
							/>
						</section>
					</div>
					<div slot="tab-2">
						<ForestPanel forest={forest} />
					</div>
					<div slot="tab-3">
						<section className="task-section">
							<CompletedTasksTable tasks={tasks} pillars={pillars} onReloaded={reload} />
						</section>
					</div>
				</KolTabs>
			)}

			{dialog?.kind === 'create' && (
				<QuickCaptureModal
					parentTask={dialog.parentTask ?? null}
					pillars={pillars}
					onClose={closeDialog}
					onSaved={afterMutation}
				/>
			)}
			{dialog?.kind === 'edit' && (
				<TaskFormModal
					key={dialog.task.id}
					task={dialog.task}
					pillars={pillars}
					onClose={closeDialog}
					onSaved={afterMutation}
				/>
			)}
			{dialog?.kind === 'series' && <SeriesManagementModal onClose={closeDialog} />}
			{dialog?.kind === 'delete' && (
				<DeleteTaskDialog
					task={dialog.task}
					onClose={closeDialog}
					onDeleted={afterDelete}
					fallbackFocusRef={deleteFallbackRef}
				/>
			)}
			{dialog?.kind === 'dependencies' && dependencyTask !== null && tasks !== null && (
				<DependencyModal
					key={dependencyTask.id}
					task={dependencyTask}
					allTasks={tasks}
					dependencies={dependencyMap.get(dependencyTask.id) ?? []}
					onClose={closeDialog}
					onChanged={refreshKeepingDialog}
				/>
			)}
			<Footer version={APP_VERSION} />
		</main>
	);
};
