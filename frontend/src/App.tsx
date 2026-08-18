import {
	KolAlert,
	KolButton,
	KolInputCheckbox,
	KolInputText,
	KolSpin,
	KolTabs,
	KolToolbar,
} from '@public-ui/react-v19';
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
import { InstallPrompt } from './components/InstallPrompt';
import { UpdatePrompt } from './components/UpdatePrompt';
import { ModelSelectorButton } from './components/ModelSelectorButton';
import { PillarAdvisorModal } from './components/PillarAdvisorModal';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { SeriesTab } from './components/SeriesTab';
import { SettingsPage } from './components/SettingsPage';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskTree } from './components/TaskTree';
import { filterForestByTitle } from './lib/filterForestByTitle';
import { toApiError } from './lib/apiError';
import type { AuthUser } from './lib/auth';
import { buildDependencyMap } from './lib/dependencies';
import { collectTaskValues } from './lib/forest';
import { buildPillarSummaries } from './lib/pillar';
import { APP_VERSION } from './lib/version';

type Dialog =
	// `parentTask` gesetzt → die neu angelegte Aufgabe wird als Vorgänger mit ihr verknüpft (Unteraufgabe).
	| { kind: 'create'; parentTask?: Task; initialText?: string }
	| { kind: 'edit'; task: Task }
	| { kind: 'delete'; task: Task }
	| { kind: 'dependencies'; taskId: number }
	| { kind: 'advisor' }
	| null;

// Die Hauptansichten als Tab-Leiste oben (Inhalt steckt in den zugehörigen `tab-N`-Slots von
// `KolTabs`). Modulkonstante, damit `KolTabs` nicht bei jedem Render eine neue Tab-Liste erhält und
// die Auswahl zurücksetzt.
const VIEW_TABS = [{ _label: 'Dashboard' }, { _label: 'Aufgaben' }, { _label: 'Serien' }, { _label: 'Wald' }];

// Modulkonstanten für Toolbar-Icons: stabile Objektidentität pro Render, damit der Icon-Watcher
// nicht unnötig erneut feuert (z. B. CREATE_ICON für „Neuen Task anlegen").
const DONE_REMOVAL_DELAY_MS = 5000;

const CREATE_ICON = { left: { icon: 'fa-solid fa-plus' } };
const ADVISOR_ICON = { left: { icon: 'fa-solid fa-lightbulb' } };
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
	const [activeTab, setActiveTab] = useState(0);
	const doneRemovalTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

	// Aufgaben-Tab: Suchtext und Offen/Erledigt-Switch (State wird beim Umschalten erhalten, AK6).
	// `searchDraft` ist der Eingabe-Entwurf im Suchfeld; der Filter wird erst per „Filtern"-Button
	// oder Enter in `taskSearch` übernommen (deferred filter). `taskSearch` treibt die gefilterten Listen.
	const [taskSearch, setTaskSearch] = useState('');
	const [searchDraft, setSearchDraft] = useState('');
	const [taskViewMode, setTaskViewMode] = useState<'open' | 'done'>('open');
	// Übernimmt den aktuellen Eingabe-Entwurf als aktiven Filter (Button-Klick oder Enter im Suchfeld).
	const applyTaskFilter = useCallback((value: string): void => setTaskSearch(value), []);

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

	useEffect(() => {
		const timers = doneRemovalTimers.current;
		return () => {
			for (const handle of timers.values()) {
				clearTimeout(handle);
			}
			timers.clear();
		};
	}, []);

	// Bei jedem Tab-Wechsel die Daten neu laden: So zeigt jede Ansicht den aktuellen Server-Stand —
	// insbesondere wandert eine frisch per Toggle erledigte Aufgabe (#315) erst mit diesem Reload
	// atomar (ein React-Commit) aus dem Aufgabenbaum in die Erledigte-Tabelle (#228). Stabile
	// Callback-Identität, damit `KolTabs` nicht bei jedem Render neu verdrahtet.
	const tabsCallbacks = useMemo(
		() => ({
			onSelect: (_event: Event, selected: number): void => {
				setActiveTab(selected);
				void reload();
			},
		}),
		[reload],
	);

	const dependencyMap = useMemo(() => buildDependencyMap(forest), [forest]);

	// Aktuelle Säulen-Verteilung (Soll `weight` vs. Ist `actualShare`), exakt wie im Dashboard-Widget
	// „Meine Themen" berechnet — wird dem Säulen-Berater mitgeschickt, damit er die Vorschläge primär
	// auf die schwächsten (am stärksten unterversorgten) Säulen ausrichtet. `undefined`, solange die
	// Aufgaben noch nicht geladen sind (dann berät er ohne Verteilung über alle Säulen hinweg).
	const advisorDistribution = useMemo(() => {
		if (tasks === null) {
			return undefined;
		}
		const valueByTaskId = collectTaskValues(forest);
		return buildPillarSummaries(pillars, tasks, valueByTaskId).map((summary) => ({
			pillarId: summary.pillar.id,
			weight: summary.pillar.weight,
			actualShare: summary.actualShare,
		}));
	}, [pillars, tasks, forest]);

	// Alle Aufgaben-IDs, die aktuell im Aufgabenwald stehen (inkl. Unteraufgaben). Frisch per Toggle
	// erledigte Aufgaben bleiben bis zum nächsten Reload im (dann veralteten) Wald „sticky" — die
	// Erledigte-Tabelle blendet genau diese IDs aus, damit ein Titel nie doppelt im DOM steht (#228).
	const forestTaskIds = useMemo(() => {
		const ids = new Set<number>();
		const visit = (node: TaskTreeNode): void => {
			if (ids.has(node.id)) return;
			ids.add(node.id);
			node.dependents.forEach(visit);
		};
		forest.forEach(visit);
		return ids;
	}, [forest]);

	// Fortschritt (erledigt/gesamt inkl. aller Unter-Tasks) je Task-ID aus dem Aufgabenwald ableiten.
	// Der Wert kommt serverseitig berechnet aus `node.progress` (#241): Er zählt über die UNGEFILTERTE
	// Abhängigkeitskette — also auch über erledigte Unteraufgaben, die aus `dependents` ausgeblendet sind
	// (#392) — und bleibt dadurch korrekt. Tasks ohne Unter-Tasks liefern `null` und tauchen bewusst
	// nicht in der Map auf (AK3).
	const progressMap = useMemo(() => {
		const map = new Map<number, { done: number; total: number }>();
		const visited = new Set<TaskTreeNode>();
		const visit = (node: TaskTreeNode): void => {
			if (visited.has(node)) return;
			visited.add(node);
			if (node.progress != null) {
				map.set(node.id, node.progress);
			}
			for (const dep of node.dependents) {
				visit(dep);
			}
		};
		forest.forEach(visit);
		return map;
	}, [forest]);

	// Gefilterter Aufgabenwald für den offenen Baum (Titel-Suchfilter).
	const filteredForest = useMemo(() => filterForestByTitle(forest, taskSearch), [forest, taskSearch]);

	// Gefilterte erledigte Aufgaben für die Tabelle (Titel-Suchfilter).
	const filteredCompletedTasks = useMemo(() => {
		if (tasks === null) return [];
		const doneTasks = tasks.filter((task) => task.status === TaskStatus.Done && !forestTaskIds.has(task.id));
		if (taskSearch.trim() === '') return doneTasks;
		const query = taskSearch.trim().toLowerCase();
		return doneTasks.filter((task) => task.title.toLowerCase().includes(query));
	}, [tasks, forestTaskIds, taskSearch]);

	const handleLogout = useCallback(async (): Promise<void> => {
		setLogoutLoading(true);
		setLogoutError(null);
		try {
			await api.logout();
			// Issue #396 PR B — Logout-Sperre: „gerade abgemeldet"-Marker unterdrückt den nächsten
			// stillen Re-Login (s. Root.tsx), sonst wäre ein Ausloggen praktisch unmöglich.
			sessionStorage.setItem('pp_just_logged_out', '1');
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
		setActiveTab(0);
	}, []);

	const openSettings = useCallback((): void => {
		window.history.pushState({}, '', '/settings/general');
		setShowSettings(true);
	}, []);

	const closeSettings = useCallback((): void => {
		window.history.pushState({}, '', '/');
		setShowSettings(false);
		setActiveTab(0);
	}, []);

	// Nach dem Speichern auf der Einstellungen-Seite: zurück zum Dashboard (#270) und die Daten neu
	// laden, damit die geänderten Säulen-Gewichte sofort in Dashboard und Ranking sichtbar sind.
	const afterSettingsSaved = useCallback((): void => {
		closeSettings();
		void reload();
	}, [closeSettings, reload]);

	// Nach PillarList-Mutationen (anlegen/umbenennen/löschen) die globalen Pillar-Daten neu laden,
	// damit PillarWeightsForm und Dashboard die aktuellen Daten anzeigen (#439 Review Finding 3).
	const handlePillarChanged = useCallback((): void => {
		void reload();
	}, [reload]);

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
					// Kein reload(): Der Wald (`GET /forest`) enthält nur offene Aufgaben — nach einem Reload
					// verschwände die Zeile samt Toggle sofort. Der optimistische Status-Update hält die Zeile
					// im Aufgabenbaum „sticky" für ein Sofort-Undo (#315 AK1); die Erledigte-Tabelle blendet
					// solche noch im Wald stehenden Aufgaben aus (`forestTaskIds`), damit der Titel nicht
					// doppelt im DOM steht (#228). Nach DONE_REMOVAL_DELAY_MS löst ein automatischer Reload
					// die Zeile auf (#392).
					setTasks((prev) => (prev === null ? null : prev.map((t) => (t.id === task.id ? { ...t, status: next } : t))));
					const handle = setTimeout(() => {
						doneRemovalTimers.current.delete(task.id);
						void reload();
					}, DONE_REMOVAL_DELAY_MS);
					doneRemovalTimers.current.set(task.id, handle);
				} else {
					const handle = doneRemovalTimers.current.get(task.id);
					if (handle !== undefined) {
						clearTimeout(handle);
						doneRemovalTimers.current.delete(task.id);
					}
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

	const handleLogoDashboard = useCallback((): void => {
		setActiveTab(0);
		void reload();
	}, [reload]);

	const dependencyTask =
		dialog?.kind === 'dependencies' ? (tasks?.find((task) => task.id === dialog.taskId) ?? null) : null;

	const openCreateDialog = useCallback((): void => {
		setDialog({ kind: 'create' });
	}, []);
	const openAdvisor = useCallback((): void => {
		setDialog({ kind: 'advisor' });
	}, []);

	// Toolbar-Buttons sind auf allen Viewports identisch — keine unterschiedliche Menüstruktur je nach
	// Viewport-Breite (#691). `_label`s und Reihenfolge sind stabil, damit Accessible Names konsistent bleiben.
	const toolbarItems = useMemo(() => {
		return [
			{
				type: 'button' as const,
				_label: 'Neuen Task anlegen',
				_hideLabel: true,
				_icons: CREATE_ICON,
				_variant: 'primary' as const,
				_on: { onClick: openCreateDialog },
			},
			{
				type: 'button' as const,
				_label: 'Säulen-Berater',
				_hideLabel: true,
				_icons: ADVISOR_ICON,
				_variant: 'secondary' as const,
				_on: { onClick: openAdvisor },
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
				_on: { onClick: (): void => void handleLogout() },
			},
		];
	}, [logoutLoading, openCreateDialog, openAdvisor, openSettings, openHelp, handleLogout]);

	if (showSettings) {
		return (
			<SettingsPage
				pillars={pillars}
				onBack={closeSettings}
				onSaved={afterSettingsSaved}
				onPillarChanged={handlePillarChanged}
			/>
		);
	}

	if (showHelp) {
		return <HelpPage onBack={closeHelp} />;
	}

	return (
		<main className="app" ref={deleteFallbackRef} tabIndex={-1} data-focus-fallback>
			<header role="banner" className="app-header">
				<button type="button" className="logo-btn" aria-label="Zum Dashboard" onClick={handleLogoDashboard}>
					<img src="/logo/logo.png" alt="Priority Pilot" />
				</button>
				<span className="app-name">Priority Pilot</span>
				{/*
				 * Gemeinsamer Container für die Kopf-Aktionen (#787): Die KI-Modell-Auswahl steht links
				 * neben den Toolbar-Buttons und teilt deren Ausrichtung und Höhe.
				 *
				 * BEWUSST ohne eigenes `role="toolbar"`: `kol-toolbar` bringt die Rolle (inkl. der von ihr
				 * erwarteten Pfeiltasten-Navigation) bereits in ihrem Shadow-DOM mit. Ein zweites
				 * `role="toolbar"` am Wrapper erzeugte eine verschachtelte Toolbar mit identischem
				 * Accessible Name — Screenreader kündigten zwei Toolbars an, und der Wrapper verspräche
				 * eine Pfeiltasten-Navigation, die er nicht implementiert.
				 */}
				<div className="toolbar">
					<ModelSelectorButton />
					<KolToolbar _label="Kopf-Aktionen" _orientation="horizontal" _items={toolbarItems} />
				</div>
			</header>
			<h1 className="visually-hidden">Dashboard</h1>

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

			{tasks !== null && (
				<KolTabs className="app-tabs" _label="Ansichten" _tabs={VIEW_TABS} _selected={activeTab} _on={tabsCallbacks}>
					<div slot="tab-0">
						<Dashboard
							tasks={tasks}
							forest={forest}
							nextTask={nextTask}
							suggestions={suggestions}
							pillars={pillars}
							displayName={user.displayName}
						/>
					</div>
					<div slot="tab-1">
						<section className="task-section">
							<div className="task-filter-bar">
								<KolInputCheckbox
									className="task-view-switch"
									_label="Erledigte Aufgaben anzeigen"
									_variant="switch"
									_checked={taskViewMode === 'done'}
									_on={{
										onChange: (_event, checked) => {
											setTaskViewMode(checked === true ? 'done' : 'open');
										},
									}}
								/>
								<div className="task-filter-search">
									<KolInputText
										className="task-filter-search__field"
										_label="Nach Titel filtern"
										_hideLabel
										_type="search"
										_placeholder="Nach Titel filtern…"
										_value={searchDraft}
										_on={{
											onInput: (event: Event) => {
												setSearchDraft((event.target as HTMLInputElement).value);
											},
											// Enter übernimmt den Entwurf sofort als aktiven Filter (neben dem „Filtern"-Button).
											onKeyDown: (event: KeyboardEvent) => {
												if (event.key === 'Enter') {
													applyTaskFilter((event.target as HTMLInputElement).value);
												}
											},
										}}
									/>
									<KolButton
										className="task-filter-search__submit"
										_label="Filtern"
										_variant="primary"
										_icons="fa-solid fa-magnifying-glass"
										_on={{ onClick: () => applyTaskFilter(searchDraft) }}
									/>
								</div>
							</div>
							{taskViewMode === 'open' ? (
								filteredForest.length === 0 ? (
									taskSearch.trim() === '' ? (
										<TaskTree
											forest={filteredForest}
											tasks={tasks}
											progressMap={progressMap}
											onEdit={openEdit}
											onDelete={openDelete}
											onEditDependencies={openDependencies}
											onAddSubtask={openAddSubtask}
											onDoneToggle={handleDoneToggle}
										/>
									) : (
										<p className="empty-state">Keine Aufgaben gefunden. Passen Sie ggf. die Filter an.</p>
									)
								) : (
									<TaskTree
										forest={filteredForest}
										tasks={tasks}
										progressMap={progressMap}
										onEdit={openEdit}
										onDelete={openDelete}
										onEditDependencies={openDependencies}
										onAddSubtask={openAddSubtask}
										onDoneToggle={handleDoneToggle}
									/>
								)
							) : filteredCompletedTasks.length === 0 ? (
								taskSearch.trim() === '' ? (
									<CompletedTasksTable
										tasks={filteredCompletedTasks}
										pillars={pillars}
										forestTaskIds={forestTaskIds}
										onReloaded={reload}
									/>
								) : (
									<p className="empty-state">Keine Aufgaben gefunden. Passen Sie ggf. die Filter an.</p>
								)
							) : (
								<CompletedTasksTable
									tasks={filteredCompletedTasks}
									pillars={pillars}
									forestTaskIds={forestTaskIds}
									onReloaded={reload}
								/>
							)}
						</section>
					</div>
					<div slot="tab-2">{activeTab === 2 && <SeriesTab pillars={pillars} />}</div>
					<div slot="tab-3">
						<ForestPanel forest={forest} />
					</div>
				</KolTabs>
			)}

			{dialog?.kind === 'create' && (
				<QuickCaptureModal
					parentTask={dialog.parentTask ?? null}
					initialText={dialog.initialText}
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
			{dialog?.kind === 'advisor' && (
				<PillarAdvisorModal
					pillars={pillars}
					distribution={advisorDistribution}
					onClose={closeDialog}
					onAdoptActivity={(text) => setDialog({ kind: 'create', initialText: text })}
				/>
			)}
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
			<InstallPrompt />
			<UpdatePrompt />
			<Footer version={APP_VERSION} />
		</main>
	);
};
