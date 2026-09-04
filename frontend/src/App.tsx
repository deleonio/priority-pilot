import {
	KolAlert,
	KolAvatar,
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
import { flushSync } from 'react-dom';
import { BrowserRouter, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from './api';
import { CompletedTasksTable } from './components/CompletedTasksTable';
import { CompleteTaskDialog } from './components/CompleteTaskDialog';
import { Footer } from './components/Footer';
import { Dashboard } from './components/Dashboard';
import { DeleteTaskDialog } from './components/DeleteTaskDialog';
import { DependencyModal } from './components/DependencyModal';
import { EmptyState } from './components/EmptyState';
import { ForestPanel } from './components/ForestPanel';
import { HelpPage } from './components/HelpPage';
import { InstallPrompt } from './components/InstallPrompt';
import { UpdatePrompt } from './components/UpdatePrompt';
import { PillarAdvisorModal } from './components/PillarAdvisorModal';
import { SearchModal } from './components/SearchModal';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { SeriesTab } from './components/SeriesTab';
import { SettingsPage } from './components/SettingsPage';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskTree } from './components/TaskTree';
import { filterForestByTitle } from './lib/filterForestByTitle';
import { buildBalancePriorities, type BalancePriority } from './lib/balancePriority';
import { toApiError } from './lib/apiError';
import type { AuthUser } from './lib/auth';
import { buildDependencyMap } from './lib/dependencies';
import { collectTaskValues } from './lib/forest';
import { buildPillarSummaries } from './lib/pillar';
import { APP_VERSION } from './lib/version';
import { isQuickCaptureEffective, readAiPreferences } from './lib/aiPreferences';
import { launchConfetti, shouldCelebrateDone } from './lib/confetti';

type Dialog =
	// `parentTask` gesetzt → die neu angelegte Aufgabe wird als Vorgänger mit ihr verknüpft (Unteraufgabe).
	| { kind: 'create'; parentTask?: Task; initialText?: string }
	| { kind: 'edit'; task: Task }
	| { kind: 'delete'; task: Task }
	| { kind: 'complete'; task: Task }
	| { kind: 'dependencies'; taskId: number }
	| { kind: 'search' }
	| { kind: 'advisor' }
	| null;

// Die Hauptansichten als Tab-Leiste oben (Inhalt steckt in den zugehörigen `tab-N`-Slots von
// `KolTabs`). Modulkonstante, damit `KolTabs` nicht bei jedem Render eine neue Tab-Liste erhält und
// die Auswahl zurücksetzt.
const VIEW_TABS = [{ _label: 'Dashboard' }, { _label: 'Aufgaben' }, { _label: 'Serien' }, { _label: 'Wald' }];

// #1105: Pfad zu jedem Haupt-Tab (Index = Tab-Index) und Pfad-Segment je Settings-Tab. Der aktive
// Tab ist damit eine reine Funktion der URL (Routen-Tabelle in `docs/spec/issue-1105.md`).
const ROUTE_PATHS: string[] = ['/', '/aufgaben', '/serien', '/wald'];
const SETTINGS_PATH_SEGMENTS: string[] = ['general', 'pillars', 'llm', 'standort', 'gruppen'];

// Modulkonstanten für Toolbar-Icons: stabile Objektidentität pro Render, damit der Icon-Watcher
// nicht unnötig erneut feuert (z. B. CREATE_ICON für „Neuen Task anlegen").
const DONE_REMOVAL_DELAY_MS = 5000;

const CREATE_ICON = { left: { icon: 'fa-solid fa-plus' } };
const SEARCH_ICON = { left: { icon: 'fa-solid fa-magnifying-glass' } };
const ADVISOR_ICON = { left: { icon: 'fa-solid fa-lightbulb' } };
const HELP_ICON = { left: { icon: 'fa-solid fa-circle-question' } };
const SETTINGS_ICON = { left: { icon: 'fa-solid fa-gear' } };
const LOGOUT_ICON = { left: { icon: 'fa-solid fa-right-from-bracket' } };

/**
 * #1220: Ist-Verteilung für die Balance-Priorisierung — erledigter `estimatedEffort` je Säule,
 * anteilig nach `share`, exakt die Quelle des Dashboards (`buildPillarSummaries`). Der Wert-Beitrag
 * fließt hier nicht ein, daher die leere Map.
 */
const buildDoneEffortByPillar = (pillars: Pillar[], tasks: Task[]): Map<number, number> => {
	const doneEffortByPillar = new Map<number, number>();
	for (const summary of buildPillarSummaries(pillars, tasks, new Map<number, number>())) {
		doneEffortByPillar.set(summary.pillar.id, summary.doneEstimatedEffort);
	}
	return doneEffortByPillar;
};

const AppShell = ({ user }: { user: AuthUser }) => {
	const location = useLocation();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	// #1105: Hilfe und Einstellungen sind Routen statt State-Flags — Back/Forward und Deep-Links
	// funktionieren dadurch browser-nativ (AK1–AK4).
	const showHelp = location.pathname.startsWith('/hilfe');
	const showSettings = location.pathname.startsWith('/settings');
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
	const doneRemovalTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

	// Aufgaben-Tab: Suchtext und Offen/Erledigt-Switch (#1105 AK5) leben in den Query-Parametern von
	// `/aufgaben` (`?q=` bzw. `?view=done`) — Deep-Links und Browser-Back stellen dadurch auch den
	// Filterzustand wieder her. `searchDraft` bleibt lokaler State: der Eingabe-Entwurf im Suchfeld;
	// der Filter wird erst per „Filtern"-Button oder Enter übernommen (deferred filter).
	const taskSearch = searchParams.get('q') ?? '';
	const taskViewMode: 'open' | 'done' = searchParams.get('view') === 'done' ? 'done' : 'open';
	const [searchDraft, setSearchDraft] = useState(taskSearch);
	// Hält den Entwurf mit der URL synchron (z. B. nach Back/Forward oder Suchdialog), ohne das Tippen zu stören.
	useEffect(() => setSearchDraft(taskSearch), [taskSearch]);

	// #1220: Balance-Priorisierung der Aufgabenliste — session-lokal (keine Persistenz). Der
	// Snapshot ist der **eingefrorene** Berechnungsstand (AK2): Er entsteht beim Aktivieren und auf
	// „Ausbalancieren" und bleibt bis dahin unverändert stehen, auch wenn die App zwischendurch
	// lädt. `balanceSortedAt` speist die aria-live-Bekanntgabe der Umsortierung (KI-UX, WCAG 4.1.3).
	const [balanceMode, setBalanceMode] = useState(false);
	const [balanceSnapshot, setBalanceSnapshot] = useState<ReadonlyMap<number, BalancePriority> | null>(null);
	const [balanceSortedAt, setBalanceSortedAt] = useState('');
	// #1220: Vorschauf-Datenstand für „Ausbalancieren" — der PointerEnter auf den Button startet
	// die Ladevorgänge vorab, der Klick wendet sie nur noch an (sichtbar ohne Verzögerung).
	const rebalancePrefetchRef = useRef<Promise<[Task[], Pillar[]]> | null>(null);

	// Übernimmt den aktuellen Eingabe-Entwurf als aktiven Filter und spiegelt ihn als `?q=` in die URL.
	const applyTaskFilter = useCallback(
		(value: string): void => {
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				if (value.trim() === '') {
					next.delete('q');
				} else {
					next.set('q', value);
				}
				return next;
			});
		},
		[setSearchParams],
	);

	/** Aktiver Haupt-Tab: reine Funktion des Pfads (AK4). */
	const activeTab = Math.max(0, ROUTE_PATHS.indexOf(location.pathname));

	/** Aktiver Settings-Tab: aus `/settings/:tab` abgeleitet; unbekannter Pfad → Säulen (bisheriges Default). */
	const settingsSegment = /\/settings\/([^/]+)/.exec(location.pathname)?.[1] ?? '';
	const settingsTabIndex = SETTINGS_PATH_SEGMENTS.indexOf(settingsSegment);
	const settingsTab = settingsTabIndex < 0 ? 1 : settingsTabIndex;

	/** Offen/Erledigt umschalten und die Auswahl als `?view=` in die URL spiegeln. */
	const changeTaskViewMode = useCallback(
		(done: boolean): void => {
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				if (done) {
					next.set('view', 'done');
				} else {
					next.delete('view');
				}
				return next;
			});
		},
		[setSearchParams],
	);

	// #1220: Snapshot der virtuellen Balance-Prioritäten aus dem übergebenen Stand berechnen und
	// einfrieren. Bewusst Parameter statt State-Lesung: „Ausbalancieren" rechnet aus frisch
	// geladenen Daten, dieser Closure hielte sonst den veralteten Stand.
	const applyBalanceSnapshot = useCallback((pillarStand: Pillar[], taskStand: Task[]): void => {
		setBalanceSnapshot(buildBalancePriorities(pillarStand, buildDoneEffortByPillar(pillarStand, taskStand), taskStand));
		setBalanceSortedAt(new Date().toLocaleTimeString('de-DE'));
	}, []);

	/** #1220: Balance-Modus (de)aktivieren; beim Aktivieren wird der Snapshot aus dem aktuellen Stand berechnet. */
	const activateBalanceMode = useCallback(
		(active: boolean): void => {
			setBalanceMode(active);
			if (active) {
				applyBalanceSnapshot(pillars, tasks ?? []);
			}
		},
		[applyBalanceSnapshot, pillars, tasks],
	);

	/** #1220: „Ausbalancieren" (AK2) — Datenbasis frisch laden, dann den Snapshot neu berechnen. */
	const rebalanceTasks = useCallback(async (): Promise<void> => {
		// Bereits vorgeladene Daten vom PointerEnter verwenden (und dafür verbrauchen), sonst neu laden.
		const pending = rebalancePrefetchRef.current;
		rebalancePrefetchRef.current = null;
		try {
			const [freshTasks, freshPillars] = await (pending ?? Promise.all([api.listTasks(), api.listPillars()]));
			// flushSync: Die Umsortierung wird noch im Klick-Verarbeitungsschritt sichtbar —
			// assistierende Technologien (und die E2E) lesen die Reihenfolge unmittelbar nach dem Klick.
			flushSync(() => {
				setTasks(freshTasks);
				setPillars(freshPillars);
				applyBalanceSnapshot(freshPillars, freshTasks);
			});
		} catch (reason) {
			const apiError = await toApiError(reason);
			setLoadError(apiError.message);
		}
	}, [applyBalanceSnapshot]);

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
				// Query-Parameter (`?q=`, `?view=`) sind Aufgaben-Filterzustand und bleiben beim
				// Tab-Wechsel erhalten — ein nackter Pfad würde sie verwerfen; der Klick auf den
				// bereits aktiven Tab lieferte dann dasselbe Ziel ohne Query und rivalisierte mit
				// dem Offen/Erledigt-Switch (CI-Bruch completed-tasks/issue-1063).
				navigate({ pathname: ROUTE_PATHS[selected] ?? '/', search: searchParams.toString() });
			},
		}),
		// dass sich `onSelect` bei jeder Query-Änderung neu verdrahtet (Auswahl bleibt prop-getrieben).
		[navigate, searchParams],
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

	// Filterfeld im Aufgaben-Tab (#1067): Ziel des programmatischen Fokus nach der Suche im Suchdialog.
	const taskFilterInputRef = useRef<HTMLKolInputTextElement>(null);

	// #1067: Nach der Suche im Suchdialog liegt der Fokus im Filterfeld des Aufgaben-Tabs, damit direkt
	// weitergetippt werden kann. Der Modal-Cleanup gibt den Fokus per `setTimeout(0)` erst an den
	// Auslöser (Toolbar-Such-Button) zurück (Modal.tsx) — dieser Aufruf läuft also NACH der Rückgabe
	// und muss sie überdauern; deshalb Retry über mehrere Frames statt eines einzelnen `focus()`.
	const focusTaskFilter = useCallback((): void => {
		let attempts = 0;
		const attempt = (): void => {
			const host = taskFilterInputRef.current;
			if (!host) {
				return;
			}
			host.focus();
			if (document.activeElement === host.shadowRoot?.querySelector('input') || attempts >= 20) {
				return;
			}
			attempts += 1;
			requestAnimationFrame(attempt);
		};
		// Erst hinter der `setTimeout(0)`-Fokus-Rückgabe des Modals beginnen.
		setTimeout(() => requestAnimationFrame(attempt), 0);
	}, []);

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

	// #1105: Navigation läuft über React Router (kein handgestricktes pushState mehr, AK4).
	const openHelp = useCallback((): void => navigate('/hilfe'), [navigate]);

	const closeHelp = useCallback((): void => navigate('/'), [navigate]);

	const openSettings = useCallback((): void => navigate('/settings/general'), [navigate]);

	const closeSettings = useCallback((): void => navigate('/'), [navigate]);

	/** Settings-Tab-Wechsel: URL auf `/settings/:tab` bringen — der Tab folgt der Route. */
	const changeSettingsTab = useCallback(
		(selected: number): void => {
			navigate(`/settings/${SETTINGS_PATH_SEGMENTS[selected] ?? 'pillars'}`);
		},
		[navigate],
	);

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
	const openComplete = useCallback((task: Task): void => setDialog({ kind: 'complete', task }), []);
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
					// #1169: Konfetti als Erfolgs-Feedback — nur für den Übergang auf „Erledigt"
					// (shouldCelebrateDone), nie beim Wieder-Öffnen; reduce wird in launchConfetti geprüft.
					if (shouldCelebrateDone(task.status, next)) {
						launchConfetti();
					}
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

	// #1168: Signal-Panel-Aktion „Erledigt" — setzt die Aufgabe auf `Done`. Anders als
	// `handleDoneToggle` kein sticky-Pfad (`DONE_REMOVAL_DELAY_MS`): der greift für die Aufgabenliste,
	// das Panel lädt stattdessen sofort per `reload()` die nächste Aufgabe (`afterMutation`).
	const completeTask = useCallback(async (task: Task): Promise<void> => {
		await api.updateTask({
			id: task.id,
			taskUpdate: {
				title: task.title,
				description: task.description,
				status: TaskStatus.Done,
				priority: task.priority,
				estimatedEffort: task.estimatedEffort,
				deadline: task.deadline,
			},
		});
		// #1182: Konfetti auch über den Dashboard-Pfad (Signal-Panel → Dialog) — dieselbe
		// Übergangs-Regel wie in `handleDoneToggle` (#1169); reduce prüft `launchConfetti` selbst.
		if (shouldCelebrateDone(task.status, TaskStatus.Done)) {
			launchConfetti();
		}
	}, []);

	// Bei einer Dependency-Änderung bleibt der Dialog offen; nur die Daten werden aktualisiert.
	const refreshKeepingDialog = useCallback((): void => {
		void reload();
	}, [reload]);

	const handleLogoDashboard = useCallback((): void => {
		navigate('/');
		void reload();
	}, [navigate, reload]);

	const dependencyTask =
		dialog?.kind === 'dependencies' ? (tasks?.find((task) => task.id === dialog.taskId) ?? null) : null;

	const openCreateDialog = useCallback((): void => {
		setDialog({ kind: 'create' });
	}, []);
	const openSearch = useCallback((): void => {
		setDialog({ kind: 'search' });
	}, []);
	const openAdvisor = useCallback((): void => {
		setDialog({ kind: 'advisor' });
	}, []);

	// #1080: KI-Einstellungen (clientseitig, localStorage). `aiEnabled` blendet die KI-Bedienelemente
	// aus (Toolbar-Button „Säulen-Berater", Lektorat-Buttons im TaskForm); `quickCaptureEnabled`
	// entscheidet, ob „Neuen Task anlegen" den Capture-Schritt zeigt oder direkt das Task-Formular.
	// Absichtlich **kein** State-Hook: `SettingsPage` besitzt die eigene Hook-Instanz und `App`
	// remountet beim „Zurück" nicht (`showSettings` ist interner State) — ein hier gepufferter Wert
	// wäre veraltet. Jeder Render liest daher frisch aus dem `localStorage`; der Wechsel zurück aus
	// den Einstellungen ist selbst ein Re-Render, sodass die Änderung sofort wirkt.
	const preferences = readAiPreferences();
	const { aiEnabled } = preferences;
	// #1085: Die Schnellerfassung ist ein KI-Feature — bei deaktivierter KI wird die gespeicherte
	// Präferenz ignoriert und „Neuen Task anlegen" öffnet direkt das Task-Formular.
	const quickCaptureEnabled = isQuickCaptureEffective(preferences);

	// Toolbar-Buttons sind auf allen Viewports identisch — keine unterschiedliche Menüstruktur je nach
	// Viewport-Breite (#691). `_label`s und Reihenfolge sind stabil, damit Accessible Names konsistent bleiben.
	// Die KI-Modellwahl lebt seit dem Provider-System in den Einstellungen (Tab „KI-Provider“).
	// KoliBri liefert die Button-Semantik im Shadow-DOM; zusätzliche ARIA-Attribute
	// am Item werden von `kol-toolbar` still verworfen: nativer Button, A11y trägt KoliBri.
	const toolbarItems = useMemo(() => {
		return [
			{
				type: 'button' as const,
				_label: 'Suche',
				_hideLabel: true,
				_icons: SEARCH_ICON,
				_variant: 'secondary' as const,
				_on: { onClick: openSearch },
			},
			{
				type: 'button' as const,
				_label: 'Neuen Task anlegen',
				_hideLabel: true,
				_icons: CREATE_ICON,
				_variant: 'secondary' as const,
				_on: { onClick: openCreateDialog },
			},
			// #1080: Ohne aktive KI wird der Säulen-Berater gar nicht erst gerendert (nicht nur
			// ausgeblendet), damit er weder fokussierbar noch per Accessibility-Baum auffindbar ist.
			...(aiEnabled
				? [
						{
							type: 'button' as const,
							_label: 'Säulen-Berater',
							_hideLabel: true,
							_icons: ADVISOR_ICON,
							_variant: 'secondary' as const,
							_on: { onClick: openAdvisor },
						},
					]
				: []),
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
	}, [logoutLoading, openSearch, openCreateDialog, openAdvisor, openSettings, openHelp, handleLogout, aiEnabled]);

	if (showSettings) {
		return (
			<SettingsPage
				pillars={pillars}
				tab={settingsTab}
				onTabChange={changeSettingsTab}
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
				{/* P1: Header in 3 semantische Gruppen (Brand | Primary | User) */}
				<div className="app-header__brand">
					<button type="button" className="logo-btn" aria-label="Zum Dashboard" onClick={handleLogoDashboard}>
						<img src="/logo/logo.png" alt="Priority Pilot" />
					</button>
					<span className="app-name">Priority Pilot</span>
				</div>
				<div className="app-header__primary">
					{/*
					 * Gemeinsamer Container für die Kopf-Aktionen (#787): Die KI-Modell-Auswahl steht links
					 * neben den Toolbar-Buttons und teilt deren Ausrichtung und Höhe.
					 *
					 * BEWUSST ohne eigenes `role="toolbar"`: `kol-toolbar` bringt die Rolle (inkl. der von ihr
					 * erwarteten Pfeiltasten-Navigation) bereits in seinem Shadow-DOM mit. Ein zweites
					 * `role="toolbar"` am Wrapper erzeugte eine verschachtelte Toolbar mit identischem
					 * Accessible Name — Screenreader kündigten zwei Toolbars an, und der Wrapper verspräche
					 * eine Pfeiltasten-Navigation, die er nicht implementiert.
					 */}
					<KolToolbar _label="Kopf-Aktionen" _orientation="horizontal" _items={toolbarItems} />
				</div>
				{/* Avatar wiederhergestellt per Issue #865 Korrektur — Full Name bleibt entfernt; seit #912 am rechten Rand */}
				<div className="app-header__user">
					<KolAvatar _label={user.displayName} _src={user.avatarUrl ?? undefined} />
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
							onCompleteTask={openComplete}
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
											changeTaskViewMode(checked === true);
										},
									}}
								/>
								<KolInputCheckbox
									className="task-view-switch"
									_label="Balance-Priorisierung"
									_variant="switch"
									_checked={balanceMode}
									_on={{
										onChange: (_event, checked) => {
											// flushSync: Umsortierung wird noch im Klick-Event angewendet —
											// Readers (AT, E2E) sehen direkt nach dem Klick die neue Reihenfolge.
											flushSync(() => activateBalanceMode(checked === true));
										},
									}}
								/>
								{balanceMode && (
									// KI-UX (#1220): Die Umsortierung wird per Live-Region angekündigt (WCAG 4.1.3);
									// der Zeitpunkt macht den eingefrorenen Stand greifbar („Stand …").
									<p className="task-filter-bar__hint" aria-live="polite">
										Liste nach Balance-Priorität sortiert (Stand: {balanceSortedAt})
									</p>
								)}
								<div className="task-filter-search">
									<KolInputText
										ref={taskFilterInputRef}
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
										_variant="secondary"
										_icons="fa-solid fa-magnifying-glass"
										_on={{ onClick: () => applyTaskFilter(searchDraft) }}
									/>
								</div>
								{/* #1220: Der Span fängt den PointerEnter, um die Daten für „Ausbalancieren"
								    vorzuladen (KolButton bietet dafür keinen Callback); der Klick bleibt am
								    Button. flex-shrink:0 liegt jetzt auf dem Span als Flex-Item. */}
								<span
									className="task-balance-button"
									onPointerEnter={() => {
										if (rebalancePrefetchRef.current === null) {
											const pending = Promise.all([api.listTasks(), api.listPillars()]);
											// Ohne Klick konsumierter Prefetch darf keine unbehandelte Ablehnung hinterlassen.
											void pending.catch(() => undefined);
											rebalancePrefetchRef.current = pending;
										}
									}}
								>
									<KolButton
										_label="Ausbalancieren"
										_variant="secondary"
										_on={{
											onClick: () => {
												// #1220: Bei aktivem Modus Neuberechnung aus frischem Stand (AK2); aus
												// (sichtbar, damit er auch ohne Modus auffindbar bleibt) schaltet er ihn ein.
												if (balanceMode) {
													void rebalanceTasks();
												} else {
													flushSync(() => activateBalanceMode(true));
												}
											},
										}}
									/>
								</span>
							</div>
							{taskViewMode === 'open' ? (
								filteredForest.length === 0 ? (
									taskSearch.trim() === '' ? (
										<TaskTree
											forest={filteredForest}
											tasks={tasks}
											progressMap={progressMap}
											userId={user.id}
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
										userId={user.id}
										balancePriorities={balanceMode ? balanceSnapshot : null}
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
					<div slot="tab-2">
						<SeriesTab pillars={pillars} />
					</div>
					<div slot="tab-3">
						<ForestPanel forest={forest} />
					</div>
				</KolTabs>
			)}

			{dialog?.kind === 'create' &&
				// #1080: Ohne Schnellerfassung entfällt der Capture-Schritt — direkt das Task-Formular
				// (inkl. Übernahme eines Berater-Textes als Beschreibungs-Vorbelegung, #327).
				(quickCaptureEnabled ? (
					<QuickCaptureModal
						parentTask={dialog.parentTask ?? null}
						initialText={dialog.initialText}
						pillars={pillars}
						onClose={closeDialog}
						onSaved={afterMutation}
					/>
				) : (
					<TaskFormModal
						task={null}
						parentTask={dialog.parentTask ?? null}
						initialValues={{ description: dialog.initialText }}
						pillars={pillars}
						onClose={closeDialog}
						onSaved={afterMutation}
					/>
				))}
			{dialog?.kind === 'search' && (
				<SearchModal
					onClose={closeDialog}
					onSearch={(query) => {
						// Eine einzige Navigation mit explizitem Ziel: `navigate('/aufgaben')` +
						// `applyTaskFilter()` (`setSearchParams`) konkurrieren sonst — `setSearchParams`
						// löst `?q=` gegen die Location der Render-Closure auf (noch `/` oder `/wald`),
						// nicht gegen das eben gesetzte Ziel, und der Suchbegriff geht verloren.
						// Der View-Mode (`?view=`) bleibt beim Nutzer-Modus — beide Listen filtern über `taskSearch`.
						const next = new URLSearchParams(searchParams);
						if (query.trim() === '') {
							next.delete('q');
						} else {
							next.set('q', query);
						}
						navigate({ pathname: '/aufgaben', search: next.toString() });
						// `searchDraft` mitschreiben, damit das Filterfeld im Aufgaben-Tab den aktiven
						// Suchbegriff anzeigt und „Filtern“ ihn nicht sofort verwirft; `?q=` setzt
						// `taskSearch` bereits selbst.
						setSearchDraft(query);
						focusTaskFilter();
					}}
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
			{dialog?.kind === 'complete' && (
				<CompleteTaskDialog
					task={dialog.task}
					onConfirm={() => completeTask(dialog.task)}
					onClose={closeDialog}
					onCompleted={afterMutation}
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

/**
 * #1105: Der `BrowserRouter` liegt bewusst um `AppShell` INNERHALB von `App` (statt in `main.tsx`),
 * damit Bestands-Unit-Tests `App` weiterhin ohne Router rendern können. Der App-State (Tasks,
 * Säulen …) lebt außerhalb des Routers — eine Navigation remountet die App also nicht.
 */
export const App = ({ user }: { user: AuthUser }) => (
	// `future`-Flags opt-in: ohne sie loggt der Router bei jedem Start zwei Future-Flag-Warnings
	// in die Konsole (e2e-Vertrag #865 AK6: keine console.warnings). Splat-Routen gibt es hier
	// nicht, daher ist `v7_relativeSplatPath` verhaltensneutral.
	<BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
		<AppShell user={user} />
	</BrowserRouter>
);
