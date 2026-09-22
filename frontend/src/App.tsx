import {
	KolAlert,
	KolAvatar,
	KolButton,
	KolInputCheckbox,
	KolInputText,
	KolSingleSelect,
	KolSpin,
	KolTabs,
	KolToolbar,
} from '@public-ui/react-v19';
import type { Category, ChecklistItem, Pillar, Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from './api';
import { CompletedTasksTable } from './components/CompletedTasksTable';
import { CompleteTaskDialog, hasOpenChecklistItems } from './components/CompleteTaskDialog';
import { Footer } from './components/Footer';
import { Dashboard } from './components/Dashboard';
import { WeekView } from './components/WeekView';
import { DayDoneHint } from './components/DayDoneHint';
import { DeleteTaskDialog } from './components/DeleteTaskDialog';
import { DependencyModal } from './components/DependencyModal';
import { EmptyState } from './components/EmptyState';
import { HelpPage } from './components/HelpPage';
import { InstallPrompt } from './components/InstallPrompt';
import { SessionExpiredDialog } from './components/SessionExpiredDialog';
import { UpdatePrompt } from './components/UpdatePrompt';
import { PushToast } from './components/PushToast';
import { SearchModal } from './components/SearchModal';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { SeriesTab } from './components/SeriesTab';
import { SettingsPage } from './components/SettingsPage';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskTree } from './components/TaskTree';
import { filterForest, nodeMatchesFilter } from './lib/filterForest';
import { buildBalancePriorities } from './lib/balancePriority';
import { toApiError } from './lib/apiError';
import type { AuthUser } from './lib/auth';
import { buildDependencyMap } from './lib/dependencies';
import { collectOpenParents, collectTaskValues } from './lib/forest';
import { buildPillarSummaries } from './lib/pillar';
import { useMeasuredHeaderHeight } from './lib/headerHeight';
import { useHeaderPosition } from './lib/headerPosition';
import { clearPlanMirror, PlanProvider, usePlanState } from './lib/usePlan';
import { notifyTasksChanged } from './lib/tasksChanged';
import { APP_VERSION } from './lib/version';
import { useAiFeaturesGate } from './lib/aiPreferences';
import { launchConfetti, shouldCelebrateDone } from './lib/confetti';
import { setupTabsFocusRing } from './lib/tabsFocusRing';

type Dialog =
	// `parentTask` gesetzt → die neu angelegte Aufgabe wird als Vorgänger mit ihr verknüpft (Unteraufgabe).
	| { kind: 'create'; parentTask?: Task }
	| { kind: 'edit'; task: Task }
	| { kind: 'delete'; task: Task }
	| { kind: 'complete'; task: Task }
	| { kind: 'dependencies'; taskId: number }
	| { kind: 'search' }
	| null;

// Der Aufgabengraph zieht `@xyflow/react` nach — bewusst nachgeladen, damit die Bibliothek nur im
// Bundle landet, wenn der Tab „Wald" auch geöffnet wird (der Kaltstart zeigt das Dashboard).
const TaskGraphPanel = lazy(() =>
	import('./components/TaskGraphPanel').then((module) => ({ default: module.TaskGraphPanel })),
);

// #1105: Pfad zu jedem Haupt-Tab (Index = Tab-Index) und Pfad-Segment je Settings-Tab. Der aktive
// Tab ist damit eine reine Funktion der URL (Routen-Tabelle in `docs/spec/issue-1105.md`).
const ROUTE_PATHS: string[] = ['/', '/aufgaben', '/serien', '/wald'];
// #1529: „Pakete" (Index 6) und „Abo" (Index 7) hängen HINTER „Kategorien" und VOR den
// rollenabhängigen Segmenten — so bleiben die Indizes 0–5 der bestehenden Segmente stabil.
const BASE_SETTINGS_PATH_SEGMENTS: string[] = [
	'general',
	'pillars',
	'llm',
	'standort',
	'gruppen',
	'kategorien',
	'pakete',
	'abo',
];
// #1352: „Zugriff" hängt als letzter Tab HINTER dem nur für Admins vorhandenen „Nutzerverwaltung" —
// die Segmentfolge ist deshalb rollenabhängig, damit sie index-paritätisch zu `settingsTabs` in
// `SettingsPage` bleibt (der Admin-Tab behält Index 8, „Zugriff" liegt bei 8 bzw. 9).
const settingsPathSegments = (isAdmin: boolean): string[] => [
	...BASE_SETTINGS_PATH_SEGMENTS,
	...(isAdmin ? ['nutzer'] : []),
	'zugriff',
];
// Rollensystem admin/member: Segmente, die nur Admins als Tab sehen (Index-Parität mit den in
// `SettingsPage` nur bei `isAdmin` angehängten Tabs). Für Member gelten sie als unbekannter Pfad.
const ADMIN_ONLY_SETTINGS_SEGMENTS: ReadonlySet<string> = new Set(['nutzer']);

// Modulkonstanten für Toolbar-Icons: stabile Objektidentität pro Render, damit der Icon-Watcher
// nicht unnötig erneut feuert (z. B. CREATE_ICON für „Neuen Task anlegen").
const DONE_REMOVAL_DELAY_MS = 5000;

/**
 * Sentinel-Wert des Kategorie-Filters („alle Kategorien"). Kategorie-IDs sind serverseitig `>= 1`,
 * `0` kollidiert daher mit keiner echten Kategorie (Muster `ADD_PILLAR_PLACEHOLDER`).
 */
const NO_CATEGORY_FILTER = 0;

const CREATE_ICON = { left: { icon: 'fa-solid fa-plus' } };
const SEARCH_ICON = { left: { icon: 'fa-solid fa-magnifying-glass' } };
const HELP_ICON = { left: { icon: 'fa-solid fa-circle-question' } };
const SETTINGS_ICON = { left: { icon: 'fa-solid fa-gear' } };
const LOGOUT_ICON = { left: { icon: 'fa-solid fa-right-from-bracket' } };
const HOME_ICON = { left: { icon: 'fa-solid fa-house' } };

// #1320: Aktiv-Zustand der Kopf-Aktionen „Einstellungen"/„Hilfe" — der Button der gerade offenen
// Seite hebt sich sichtbar ab (`primary` gegen `secondary`), damit der Umschalter als verlässliche
// Regel lesbar ist und nicht als Zufallstreffer. Farbe allein reicht nicht (WCAG 1.4.1); da
// `kol-button` weder `aria-current` noch `aria-pressed` als Prop anbietet (nur `kol-link` kennt
// `_ariaCurrentValue`), trägt die Zustandsansage die von KoliBri als `aria-describedby`
// eingehängte, visuell verborgene Beschreibung. Der Accessible Name bleibt dabei unverändert —
// die Kopf-Aktionen sind app-weit über ihn adressiert.
const ACTIVE_VARIANT = 'primary' as const;
const INACTIVE_VARIANT = 'secondary' as const;

/**
 * Ist-Verteilung für die Balance-Priorisierung — erledigter `estimatedEffort` je Säule, anteilig
 * nach `share`, exakt die Quelle des Dashboards (`buildPillarSummaries`). Der Wert-Beitrag fließt
 * hier nicht ein, daher die leere Map.
 */
const buildDoneEffortByPillar = (pillars: Pillar[], tasks: Task[]): Map<number, number> => {
	const doneEffortByPillar = new Map<number, number>();
	for (const summary of buildPillarSummaries(pillars, tasks, new Map<number, number>())) {
		doneEffortByPillar.set(summary.pillar.id, summary.doneEstimatedEffort);
	}
	return doneEffortByPillar;
};

const AppShell = ({ user }: { user: AuthUser }) => {
	const { t } = useTranslation('navigation');
	const location = useLocation();
	const navigate = useNavigate();
	// #1428: Kopfzeilen-Position — die Verschiebung passiert rein per Layout (`.app.header-bottom`),
	// die DOM-Reihenfolge (banner bleibt first) bleibt unverändert.
	const { position: headerPosition } = useHeaderPosition();

	// Die randbündige Kopfzeile steht `fixed` und damit außerhalb des Flusses; die Shell reserviert
	// ihren Platz als Padding. Bei starker Textvergrößerung bricht die Leiste um und wird höher als
	// die rein rechnerische Reservierung — dann meldet dieser Hook die tatsächliche Höhe nach
	// (Begründung und Messwerte in `lib/headerHeight.ts`).
	const headerRef = useRef<HTMLElement>(null);
	useMeasuredHeaderHeight(headerRef);

	// Die Hauptansichten als Tab-Leiste oben (Inhalt steckt in den zugehörigen `tab-N`-Slots von
	// `KolTabs`). Das `useMemo` hält die Objektidentität stabil, weil `KolTabs` bei einer neuen
	// Tab-Liste die Auswahl zurücksetzt; `t` wechselt nur beim Sprachwechsel — genau dann sollen
	// die Beschriftungen auch neu entstehen.
	const viewTabs = useMemo(
		() => [
			{ _label: t('tabs.dashboard') },
			{ _label: t('tabs.tasks') },
			{ _label: t('tabs.series') },
			{ _label: t('tabs.forest') },
		],
		[t],
	);
	const [searchParams, setSearchParams] = useSearchParams();
	// #1105: Hilfe und Einstellungen sind Routen statt State-Flags — Back/Forward und Deep-Links
	// funktionieren dadurch browser-nativ (AK1–AK4).
	const showHelp = location.pathname.startsWith('/hilfe');
	const showSettings = location.pathname.startsWith('/settings');
	// Hauptansichten (Dashboard-Tabs) teilen dasselbe Aktiv-Muster: Der Home-Schalter hebt sich
	// nur ab, wenn Einstellungen oder Hilfe als Seite darüber liegen.
	const showMainView = !showHelp && !showSettings;
	const [tasks, setTasks] = useState<Task[] | null>(null);
	const [forest, setForest] = useState<TaskTreeNode[]>([]);
	const [nextTask, setNextTask] = useState<Task | null>(null);
	const [suggestions, setSuggestions] = useState<Task[]>([]);
	const [pillars, setPillars] = useState<Pillar[]>([]);
	const [categories, setCategories] = useState<Category[]>([]);
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
	// #1617: Tag/Woche-Umschalter des Dashboards — eigener Query-Parameter (`planview`), damit er
	// nicht mit `view` (Offen/Erledigt-Umschalter des Aufgaben-Tabs) kollidiert. Deep-Link-fähig wie
	// die übrigen Filterzustände.
	const dashboardView: 'day' | 'week' = searchParams.get('planview') === 'week' ? 'week' : 'day';
	const [searchDraft, setSearchDraft] = useState(taskSearch);
	// Hält den Entwurf mit der URL synchron (z. B. nach Back/Forward oder Suchdialog), ohne das Tippen zu stören.
	useEffect(() => setSearchDraft(taskSearch), [taskSearch]);

	// Balance-Priorisierung der Aufgabenliste — session-lokal (keine Persistenz). Der Schalter
	// wechselt nur die Sicht; gerechnet wird live an der Datenlage, ohne eingefrorenen Stand.
	const [balanceMode, setBalanceMode] = useState(false);

	// #1345: „Oberaufgaben anzeigen" — session-lokal wie `balanceMode` (kein localStorage/URL, AK10).
	const [showParents, setShowParents] = useState(false);

	// Kategorie-Filter (`?cat=`) — Filterzustand wie `?q=`, damit Deep-Link und Zurück-Taste ihn
	// wiederherstellen. `null` = keine Einschränkung; ein Wert, zu dem es keine Kategorie (mehr) gibt,
	// wird als „keine Einschränkung" behandelt (gelöschte Kategorie in einem alten Link).
	const categoryFilterParam = Number(searchParams.get('cat'));
	const categoryFilter =
		Number.isInteger(categoryFilterParam) && categories.some((entry) => entry.id === categoryFilterParam)
			? categoryFilterParam
			: null;

	/** Optionen des Kategorie-Filters: „alle" plus die Kategorien des Nutzers. */
	const taskCategoryFilterOptions = useMemo(
		() => [
			{ label: '— alle Kategorien —', value: NO_CATEGORY_FILTER },
			...categories.map((category) => ({ label: category.name, value: category.id })),
		],
		[categories],
	);

	/** Setzt den Kategorie-Filter (`null` entfernt ihn) und spiegelt ihn in die URL. */
	const applyCategoryFilter = useCallback(
		(value: number | null): void => {
			setSearchParams((prev) => {
				const next = new URLSearchParams(prev);
				if (value === null) {
					next.delete('cat');
				} else {
					next.set('cat', String(value));
				}
				return next;
			});
		},
		[setSearchParams],
	);

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

	/** Aktiver Settings-Tab: aus `/settings/:tab` abgeleitet; unbekannter Pfad → Säulen (bisheriges Default).
	 * Rollensystem admin/member: Das Segment `nutzer` (Index 5) existiert nur für Admins — für Member
	 * gilt es als unbekannt, sonst zeigte `KolTabs` mit `_selected=5` bei fünf Tabs ein leeres Panel. */
	const isAdmin = user.role === 'admin';
	// #1566: Tester arbeitet wie ein Admin, sieht aber die Nutzerverwaltung nicht — das Tab-Gating
	// unten bleibt an `isAdmin` gebunden, nur die eigene Paket-Karte öffnet sich zusätzlich.
	const isTester = user.role === 'tester';
	const settingsSegment = /\/settings\/([^/]+)/.exec(location.pathname)?.[1] ?? '';
	const settingsTabIndex =
		!isAdmin && ADMIN_ONLY_SETTINGS_SEGMENTS.has(settingsSegment)
			? -1
			: settingsPathSegments(isAdmin).indexOf(settingsSegment);
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

	/** Wechselt zwischen Tages- und Wochenansicht des Dashboards und spiegelt es als `?planview=`. */
	const changeDashboardView = useCallback(
		(next: 'day' | 'week'): void => {
			setSearchParams((prev) => {
				const params = new URLSearchParams(prev);
				if (next === 'week') {
					params.set('planview', 'week');
				} else {
					params.delete('planview');
				}
				return params;
			});
		},
		[setSearchParams],
	);

	// Balance-Stand zur aktuellen Datenlage; außerhalb des Modus wird nicht gerechnet.
	const balancePriorities = useMemo(
		() =>
			balanceMode ? buildBalancePriorities(pillars, buildDoneEffortByPillar(pillars, tasks ?? []), tasks ?? []) : null,
		[balanceMode, pillars, tasks],
	);

	const reload = useCallback(async (signal?: AbortSignal): Promise<void> => {
		setLoading(true);
		try {
			const [loadedTasks, loadedForest, loadedNext, loadedSuggestions, loadedPillars, loadedCategories] =
				await Promise.all([
					api.listTasks({ signal }),
					api.getForest({ signal }),
					api.getNextTask({ signal }),
					api.getSuggestions({ signal }),
					api.listPillars({ signal }),
					api.listCategories({ signal }),
				]);
			setTasks(loadedTasks);
			setForest(loadedForest);
			setNextTask(loadedNext ?? null);
			setSuggestions(loadedSuggestions);
			setPillars(loadedPillars);
			setCategories(loadedCategories);
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

	// Tab-Wechsel navigiert nur; `App` bleibt dabei gemountet und lädt NICHT nach. Die Aktualität der
	// Daten kommt aus den Mutations-Callbacks (`afterMutation`, `handleDoneToggle`,
	// `handleMasterDataChanged` — letzterer auch für den Serien-Tab, dessen Aktionen Instanzen
	// erzeugen, löschen oder mitziehen). Stabile Callback-Identität, damit `KolTabs` nicht bei jedem
	// Render neu verdrahtet.
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

	// #1336: sichtbarer Fokus-Ring für die Shadow-DOM-Tab-Buttons der Hauptnavigation. Callback-Ref
	// statt `useEffect(…, [])`, weil `KolTabs` erst nach dem ersten Tasks-Ladevorgang mountet
	// (`tasks !== null`) — ein Effekt mit leeren Deps liefe vorher ins Leere.
	const appTabsRef = useCallback((node: HTMLKolTabsElement | null) => setupTabsFocusRing(node), []);

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

	// Gefilterter Aufgabenwald für den offenen Baum (Titel-Suche + Kategorie).
	const filteredForest = useMemo(
		() => filterForest(forest, { search: taskSearch, categoryId: categoryFilter }),
		[forest, taskSearch, categoryFilter],
	);

	// #1345: bei eingeschaltetem Schalter „Oberaufgaben anzeigen" zusätzlich einzublendende
	// Oberaufgaben — aus dem UNGEFILTERTEN Wald (AK9: Guard/Badge unabhängig vom Filter), aber selbst
	// nach denselben Titel-/Kategoriekriterien gefiltert wie Blätter (`nodeMatchesFilter`, kein
	// Kontextpfad-Erhalt für Oberaufgaben).
	const openParentNodes = useMemo(() => collectOpenParents(forest), [forest]);
	const visibleParentNodes = useMemo(
		() =>
			showParents
				? openParentNodes.filter((node) => nodeMatchesFilter(node, { search: taskSearch, categoryId: categoryFilter }))
				: [],
		[openParentNodes, showParents, taskSearch, categoryFilter],
	);

	// Gefilterte erledigte Aufgaben für die Tabelle (Titel-Suche + Kategorie).
	const filteredCompletedTasks = useMemo(() => {
		if (tasks === null) return [];
		const doneTasks = tasks.filter((task) => task.status === TaskStatus.Done && !forestTaskIds.has(task.id));
		const query = taskSearch.trim().toLowerCase();
		return doneTasks.filter(
			(task) =>
				(query === '' || task.title.toLowerCase().includes(query)) &&
				(categoryFilter === null || task.categoryId === categoryFilter),
		);
	}, [tasks, forestTaskIds, taskSearch, categoryFilter]);

	const handleLogout = useCallback(async (): Promise<void> => {
		setLogoutLoading(true);
		setLogoutError(null);
		try {
			await api.logout();
			// #1458 AK2: Paket-Spiegel des Kontos löschen — auf einem geteilten Gerät darf das nächste
			// Konto nie die Badges des vorigen sehen.
			clearPlanMirror(user.id);
			// Issue #396 PR B — Logout-Sperre: „gerade abgemeldet"-Marker unterdrückt den nächsten
			// stillen Re-Login (s. Root.tsx), sonst wäre ein Ausloggen praktisch unmöglich.
			sessionStorage.setItem('pp_just_logged_out', '1');
			window.location.href = '/login';
		} catch (reason) {
			setLogoutError(reason instanceof Error ? reason.message : 'Logout fehlgeschlagen');
			setLogoutLoading(false);
		}
	}, [user.id]);

	/** Nach erfolgreicher Mutation: Dialog schließen und Daten neu laden. */
	const afterMutation = useCallback((): void => {
		setDialog(null);
		void reload();
	}, [reload]);

	const closeDialog = useCallback((): void => setDialog(null), []);

	// Fallback-Fokusziel für Dialoge, nach denen das auslösende Element nicht mehr im DOM ist
	// (z. B. nach erfolgreichem Löschen: der Löschen-Button fällt mit der Zeile aus dem DOM).
	// tabIndex={-1} erlaubt programmatischen Fokus ohne visuelle Tab-Stop-Wirkung.
	const deleteFallbackRef = useRef<HTMLDivElement>(null);

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

	// #1320: Rückweg aus Einstellungen/Hilfe. Gemerkt wird die zuletzt aktive HAUPTansicht (inkl.
	// Aufgaben-Filter in `?q=`/`?view=`), nicht `navigate(-1)`: Der Rückweg soll an der App-Ansicht
	// hängen, nicht an der Browser-History — sonst landete er nach einem Tab-Wechsel innerhalb der
	// Einstellungen wieder in den Einstellungen. Ohne vorherige Hauptansicht (Deep-Link/Kaltstart
	// direkt auf `/settings/*` oder `/hilfe`) gilt `/` als Fallback (AK5).
	const lastMainViewRef = useRef('/');
	useEffect(() => {
		if (!showSettings && !showHelp) {
			lastMainViewRef.current = `${location.pathname}${location.search}`;
		}
	}, [location.pathname, location.search, showSettings, showHelp]);

	// #1320: Beim Wechsel auf Einstellungen/Hilfe einen offenen Task-Dialog schließen. Die Dialoge
	// hängen am `dialog`-State, nicht an der Route, und rendern seit dem Layout-Umbau auf allen drei
	// Ansichten — vorher schnitten die frühen Returns sie beim Seitenwechsel ab. Ohne diesen Schnitt
	// bliebe ein per Browser-Zurück/-Vor verlassener Dialog (der einzige Weg an einem modalen
	// `<dialog>` vorbei) über der Einstellungen- oder Hilfe-Seite stehen, obwohl die URL dort steht.
	useEffect(() => {
		if (showSettings || showHelp) {
			setDialog(null);
		}
	}, [showSettings, showHelp]);

	// #1105: Navigation läuft über React Router (kein handgestricktes pushState mehr, AK4).
	// #1320: Die beiden Kopf-Aktionen sind Umschalter — auf der jeweils offenen Seite führt ein
	// erneuter Klick zurück zur zuletzt aktiven Hauptansicht, sonst wird direkt gewechselt (AK4/AK5).
	const backToMainView = useCallback((): void => navigate(lastMainViewRef.current), [navigate]);

	const toggleHelp = useCallback((): void => {
		if (showHelp) {
			backToMainView();
			return;
		}
		navigate('/hilfe');
	}, [showHelp, backToMainView, navigate]);

	const toggleSettings = useCallback((): void => {
		if (showSettings) {
			backToMainView();
			return;
		}
		navigate('/settings/general');
	}, [showSettings, backToMainView, navigate]);

	/** Settings-Tab-Wechsel: URL auf `/settings/:tab` bringen — der Tab folgt der Route. */
	const changeSettingsTab = useCallback(
		(selected: number): void => {
			navigate(`/settings/${settingsPathSegments(isAdmin)[selected] ?? 'pillars'}`);
		},
		[navigate, isAdmin],
	);

	// Nach dem Speichern auf der Einstellungen-Seite: zurück zur Hauptansicht (#270, seit #1320 zur
	// zuletzt aktiven statt fest zum Dashboard) und die Daten neu laden, damit die geänderten
	// Säulen-Gewichte sofort in Dashboard und Ranking sichtbar sind.
	const afterSettingsSaved = useCallback((): void => {
		backToMainView();
		void reload();
	}, [backToMainView, reload]);

	// Nach Stammdaten-Mutationen in den Einstellungen (Säulen anlegen/umbenennen/löschen — #439
	// Review Finding 3; ebenso Kategorien) die globalen Daten neu laden, damit Formulare, Filter,
	// PillarWeightsForm und Dashboard den aktuellen Stand zeigen.
	const handleMasterDataChanged = useCallback((): void => {
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
			// #1583 AK1: offene Checklisten-Einträge stoppen den Direkt-Toggle — der Erledigen-Dialog
			// übernimmt (Checkliste + Status in einem Aufruf). Zurücksetzen auf Offen bleibt ungefragt.
			if (markingDone && hasOpenChecklistItems(task.checklist)) {
				setDialog({ kind: 'complete', task });
				return;
			}
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

	// #1582: Pinnt eine Aufgabe an bzw. wieder ab. Bleibt (anders als `handleDoneToggle`) im
	// `forest` sichtbar — kein sticky-Removal-Pfad nötig, ein `reload()` genügt, damit die neue
	// `pinned`/`pinnedAt`-Sortierung (`sortPinnedFirst` in `TaskTree`) sofort greift.
	const handlePinToggle = useCallback(
		(task: Task): void => {
			void (async () => {
				try {
					setUpdateError(null);
					await api.updateTask({
						id: task.id,
						taskUpdate: {
							title: task.title,
							description: task.description,
							status: task.status,
							priority: task.priority,
							estimatedEffort: task.estimatedEffort,
							deadline: task.deadline,
							pinned: !task.pinned,
						},
					});
					await reload();
				} catch (reason) {
					const apiError = await toApiError(reason);
					setUpdateError(apiError.message);
				}
			})();
		},
		[reload],
	);

	// #1168: Signal-Panel-Aktion „Erledigt" — setzt die Aufgabe auf `Done`. Anders als
	// `handleDoneToggle` kein sticky-Pfad (`DONE_REMOVAL_DELAY_MS`): der greift für die Aufgabenliste,
	// das Panel lädt stattdessen sofort per `reload()` die nächste Aufgabe (`afterMutation`).
	const completeTask = useCallback(
		async (task: Task, checklist: ChecklistItem[], allChecked: boolean): Promise<void> => {
			// #1583 AK5/AK6/AK8: nur bei einer beim Öffnen unvollständigen Checkliste geht der Stand
			// mit ins Payload; Status wechselt dann nur, wenn beim Speichern alle Einträge abgehakt sind.
			// Ohne (oder bereits vollständige) Checkliste bleibt das Payload unverändert wie vor #1583.
			const hasEditableChecklist = hasOpenChecklistItems(task.checklist);
			const markingDone = !hasEditableChecklist || allChecked;
			await api.updateTask({
				id: task.id,
				taskUpdate: {
					title: task.title,
					description: task.description,
					...(markingDone ? { status: TaskStatus.Done } : {}),
					priority: task.priority,
					estimatedEffort: task.estimatedEffort,
					deadline: task.deadline,
					...(hasEditableChecklist ? { checklist } : {}),
				},
			});
			// #1182: Konfetti auch über den Dashboard-Pfad (Signal-Panel → Dialog) — dieselbe
			// Übergangs-Regel wie in `handleDoneToggle` (#1169); reduce prüft `launchConfetti` selbst.
			if (markingDone && shouldCelebrateDone(task.status, TaskStatus.Done)) {
				launchConfetti();
			}
		},
		[],
	);

	// Bei einer Dependency-Änderung bleibt der Dialog offen; nur die Daten werden aktualisiert.
	// Das Signal zieht zusätzlich den Aufgabengraphen nach, der seine Daten selbst lädt.
	const refreshKeepingDialog = useCallback((): void => {
		void reload();
		notifyTasksChanged();
	}, [reload]);

	const handleHomeNavigate = useCallback((): void => {
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
	// #1080/#1335: KI-Einstellung (clientseitig, localStorage). `aiEnabled` blendet die
	// KI-Bedienelemente aus (Lektorat-Buttons im TaskForm) und entscheidet, ob „Neuen Task anlegen"
	// den KI-Freitext-Einstieg zeigt oder direkt das Task-Formular öffnet.
	// #1525: zusätzlich an die Paket-Freischaltung `ai_assist` (oder einen eigenen Provider)
	// gekoppelt — `useAiFeaturesGate` liest die Präferenz weiterhin pro Render frisch aus dem
	// `localStorage` (kein gepufferter State, `SettingsPage` besitzt die eigene Hook-Instanz und
	// `App` remountet beim Verlassen der Einstellungen nicht), kombiniert sie aber mit der
	// Berechtigung aus dem `PlanProvider`-Kontext.
	const aiEnabled = useAiFeaturesGate();

	// Toolbar-Buttons sind auf allen Viewports identisch — keine unterschiedliche Menüstruktur je nach
	// Viewport-Breite (#691). `_label`s und Reihenfolge sind stabil, damit Accessible Names konsistent bleiben.
	// Die KI-Modellwahl lebt seit dem Provider-System in den Einstellungen (Tab „KI-Provider“).
	// KoliBri liefert die Button-Semantik im Shadow-DOM; zusätzliche ARIA-Attribute
	// am Item werden von `kol-toolbar` still verworfen: nativer Button, A11y trägt KoliBri.
	const toolbarItems = useMemo(() => {
		return [
			{
				type: 'button' as const,
				_label: t('menu.home'),
				_hideLabel: true,
				_icons: HOME_ICON,
				_variant: showMainView ? ACTIVE_VARIANT : INACTIVE_VARIANT,
				...(showMainView ? { _ariaDescription: t('menu.activeViewDescription') } : {}),
				_on: { onClick: handleHomeNavigate },
			},
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
			{
				type: 'button' as const,
				_label: t('menu.settings'),
				_hideLabel: true,
				_icons: SETTINGS_ICON,
				_variant: showSettings ? ACTIVE_VARIANT : INACTIVE_VARIANT,
				...(showSettings ? { _ariaDescription: t('menu.activeViewDescription') } : {}),
				_on: { onClick: toggleSettings },
			},
			{
				type: 'button' as const,
				_label: t('menu.help'),
				_hideLabel: true,
				_icons: HELP_ICON,
				_variant: showHelp ? ACTIVE_VARIANT : INACTIVE_VARIANT,
				...(showHelp ? { _ariaDescription: t('menu.activeViewDescription') } : {}),
				_on: { onClick: toggleHelp },
			},
			{
				type: 'button' as const,
				_label: t('menu.logout'),
				_hideLabel: true,
				_icons: LOGOUT_ICON,
				_variant: 'secondary' as const,
				_disabled: logoutLoading,
				_on: { onClick: (): void => void handleLogout() },
			},
		];
	}, [
		logoutLoading,
		handleHomeNavigate,
		openSearch,
		openCreateDialog,
		toggleSettings,
		toggleHelp,
		handleLogout,
		showSettings,
		showHelp,
		showMainView,
		t,
	]);

	// #1320: Einstellungen und Hilfe sind normale Seiten der App — kein früher Return mehr vor dem
	// Layout. Header (Logo, Kopf-Aktionen, Avatar), Dialoge und Fußzeile bleiben auf allen drei
	// Ansichten stehen, nur der Seiteninhalt wechselt. Genau deshalb entfällt der „Zurück"-Button.
	// #1320: Seitentitel der einen `<h1>` je Ansicht (AK7). Die Hauptansichten teilen sich den
	// Dashboard-Titel, weil die Ansichten-Tabs innerhalb derselben Seite umschalten.
	const pageTitle = showSettings ? t('menu.settings') : showHelp ? t('menu.help') : t('tabs.dashboard');

	return (
		/*
		 * Die Shell ist bewusst ein neutrales `div`, kein `<main>`: `banner` (Kopfzeile) und
		 * `contentinfo` (Fußzeile) sind Landmarks der obersten Ebene und dürfen laut ARIA nicht in
		 * `main` verschachtelt sein — dort verlieren sie ihre Bedeutung für die Landmark-Navigation.
		 * Das eine `<main>` der Ansicht umschließt deshalb genau den Seiteninhalt zwischen beiden
		 * (#1320 AK7 bleibt erfüllt: weiterhin genau ein `<main>` und eine `<h1>` je Ansicht).
		 */
		<div
			className={headerPosition === 'bottom' ? 'app header-bottom' : 'app'}
			ref={deleteFallbackRef}
			tabIndex={-1}
			data-focus-fallback
		>
			<header ref={headerRef} role="banner" className="app-header">
				{/* Die sichtbare Leiste trägt `.app-header__bar` — der Header selbst ist der am Viewport
				    fixierte Rahmen mit Abstandsschild (siehe `.app-header` in app.css): Die Leiste schließt
				    randbündig mit der gewählten Viewport-Kante ab, der Schild hält in beiden Positionen
				    (--pp-header-gap) Abstand zwischen Leiste und Inhalt. */}
				<div className="app-header__bar">
					{/* P1: Header in 3 semantische Gruppen (Brand | Primary | User) */}
					<div className="app-header__brand">
						{/* Zusätzlich zum Home-Schalter in der Kopf-Aktionen-Toolbar navigiert auch das Logo
						    selbst zum Dashboard (reaktiviert nach #395) — gleicher Handler, gleicher a11y-Name. */}
						<button type="button" className="logo-btn" onClick={handleHomeNavigate} aria-label={t('menu.home')}>
							<img src="/logo/logo.png" alt="" />
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
						<KolToolbar _label={t('menu.headerActions')} _orientation="horizontal" _items={toolbarItems} />
					</div>
					{/* Avatar wiederhergestellt per Issue #865 Korrektur — Full Name bleibt entfernt; seit #912 am rechten Rand */}
					<div className="app-header__user">
						<KolAvatar _label={user.displayName} _src={user.avatarUrl ?? undefined} />
					</div>
				</div>
			</header>
			<main>
				{/* #1320: Die eine `<h1>` je Ansicht benennt die geöffnete Seite (AK7) — vorher stand hier
			    fest „Dashboard", während `SettingsPage`/`HelpPage` ihre eigene Überschrift mitbrachten. */}
				<h1 className="visually-hidden">{pageTitle}</h1>

				{/* Der Logout läuft über die Kopf-Aktionen und ist damit auf allen drei Ansichten
			    auslösbar — seine Fehlermeldung steht deshalb außerhalb der Inhalts-Verzweigung. */}
				{logoutError !== null && (
					<div role="alert">
						<KolAlert _type="error" _label="Logout fehlgeschlagen">
							{logoutError}
						</KolAlert>
					</div>
				)}

				{showSettings ? (
					<SettingsPage
						pillars={pillars}
						tab={settingsTab}
						onTabChange={changeSettingsTab}
						onSaved={afterSettingsSaved}
						onCategoryChanged={handleMasterDataChanged}
						isAdmin={isAdmin}
						isTester={isTester}
						currentUserId={user.id}
					/>
				) : showHelp ? (
					<HelpPage />
				) : (
					<>
						{loadError !== null && (
							<KolAlert _type="error" _label="Daten konnten nicht geladen werden">
								{loadError}
							</KolAlert>
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

						{/* #1259: Der Dashboard-Leerzustand gehört nur auf das Dashboard (aktiver Tab 0) — bisher
			    renderte die Karte tab-unabhängig ÜBER der Tab-Leiste und drückte auf Serien/Wald den
			    Listenstart um ~230px nach unten (bei 375px+812 blieben statt ≥4 Serien nur 3 ohne
			    Scrollen sichtbar). Aufgaben- und Wald-Tab haben eigene Leerzustände (TaskTree, #510). */}
						{tasks !== null && tasks.length === 0 && activeTab === 0 && (
							<EmptyState onCreate={() => setDialog({ kind: 'create' })} />
						)}

						{tasks !== null && (
							<KolTabs
								ref={appTabsRef}
								className="app-tabs"
								_label={t('tabs.ariaLabel')}
								_tabs={viewTabs}
								_selected={activeTab}
								_on={tabsCallbacks}
							>
								<div slot="tab-0">
									{/* #1617: Tag/Woche-Umschalter — reines Anzeigeumschalten, kein eigener Tab (der
									    Wechsel bleibt Teil desselben Dashboard-Slots, deep-link-fähig über `?planview=`). */}
									<div className="dashboard-view-switch">
										<KolButton
											_label="Tagesansicht"
											_variant={dashboardView === 'day' ? ACTIVE_VARIANT : INACTIVE_VARIANT}
											_on={{ onClick: () => changeDashboardView('day') }}
										/>
										<KolButton
											_label="Wochenansicht"
											_variant={dashboardView === 'week' ? ACTIVE_VARIANT : INACTIVE_VARIANT}
											_on={{ onClick: () => changeDashboardView('week') }}
										/>
									</div>
									{dashboardView === 'week' ? (
										<WeekView
											tasks={tasks}
											nextTask={nextTask}
											suggestions={suggestions}
											onSelectDay={() => changeDashboardView('day')}
										/>
									) : (
										<Dashboard
											tasks={tasks}
											forest={forest}
											nextTask={nextTask}
											suggestions={suggestions}
											pillars={pillars}
											displayName={user.displayName}
											onCompleteTask={openComplete}
											onEditTask={openEdit}
											showDayDoneHint={activeTab === 0}
										/>
									)}
								</div>
								<div slot="tab-1">
									<section className="task-section">
										{/* Filterleiste: Die beiden Umschalter sind Ansichtsschalter, keine Filter — sie stehen
									    als eigene Gruppe über der Filterzeile. Darunter, in Lesereihenfolge und zugleich
									    Tab-Reihenfolge: Suchfeld, Kategorie, „Filtern". Die Breitenverhältnisse
									    (50/30/Rest ab Tablet, mobil gestapelt) macht `.task-filter-bar` in app.css. */}
										<div className="task-filter-bar">
											<div className="task-filter-switches">
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
															setBalanceMode(checked === true);
														},
													}}
												/>
												<KolInputCheckbox
													className="task-view-switch"
													_label="Oberaufgaben anzeigen"
													_variant="switch"
													_checked={showParents}
													_on={{
														onChange: (_event, checked) => {
															setShowParents(checked === true);
														},
													}}
												/>
											</div>
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
											{/* Kategorie-Filter neben dem Titel-Filter; er wirkt sofort (anders als der Suchtext,
										    der erst auf „Filtern"/Enter greift) — eine Auswahl ist eine abgeschlossene Eingabe.
										    Ohne angelegte Kategorien bleibt das Feld aus; Suchfeld und „Filtern" teilen sich
										    dann die Zeile (siehe Flex-Verhältnisse in app.css). */}
											{categories.length > 0 && (
												<KolSingleSelect
													className="task-filter-category"
													_label="Nach Kategorie filtern"
													_hideLabel
													_options={taskCategoryFilterOptions}
													_value={categoryFilter ?? NO_CATEGORY_FILTER}
													_on={{
														onChange: (_event, value) => {
															const next = Number(value);
															applyCategoryFilter(Number.isInteger(next) && next !== NO_CATEGORY_FILTER ? next : null);
														},
													}}
												/>
											)}
											<KolButton
												className="task-filter-search__submit"
												_label="Filtern"
												_variant="secondary"
												_icons="fa-solid fa-magnifying-glass"
												_on={{ onClick: () => applyTaskFilter(searchDraft) }}
											/>
										</div>
										{/* #1361: An der ungefilterten `tasks`-Liste hängen, nicht an `filteredForest` — ein
									    aktiver Titel-/Kategoriefilter darf die Sichtbarkeit des Hinweises nicht ändern.
									    Nur bei aktivem Tab mounten (Muster TaskGraphPanel, Zeile ~970): KolTabs hält
									    inaktive Panels per `hidden` im DOM statt sie zu entfernen — sonst doppelt sich
									    `data-testid="day-done"` mit der Dashboard-Instanz. */}
										{taskViewMode === 'open' && activeTab === 1 && <DayDoneHint tasks={tasks} />}
										{taskViewMode === 'open' ? (
											filteredForest.length === 0 ? (
												taskSearch.trim() === '' ? (
													<TaskTree
														forest={filteredForest}
														fullForest={forest}
														parentNodes={visibleParentNodes}
														tasks={tasks}
														progressMap={progressMap}
														userId={user.id}
														categories={categories}
														pillars={pillars}
														balancePriorities={balancePriorities}
														onEdit={openEdit}
														onDelete={openDelete}
														onEditDependencies={openDependencies}
														onAddSubtask={openAddSubtask}
														onDoneToggle={handleDoneToggle}
														onPinToggle={handlePinToggle}
													/>
												) : (
													<p className="empty-state">Keine Aufgaben gefunden. Passen Sie ggf. die Filter an.</p>
												)
											) : (
												<TaskTree
													forest={filteredForest}
													fullForest={forest}
													parentNodes={visibleParentNodes}
													tasks={tasks}
													progressMap={progressMap}
													userId={user.id}
													categories={categories}
													pillars={pillars}
													balancePriorities={balancePriorities}
													onEdit={openEdit}
													onDelete={openDelete}
													onEditDependencies={openDependencies}
													onAddSubtask={openAddSubtask}
													onDoneToggle={handleDoneToggle}
													onPinToggle={handlePinToggle}
												/>
											)
										) : filteredCompletedTasks.length === 0 ? (
											taskSearch.trim() === '' ? (
												<CompletedTasksTable
													tasks={filteredCompletedTasks}
													pillars={pillars}
													categories={categories}
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
												categories={categories}
												forestTaskIds={forestTaskIds}
												onReloaded={reload}
											/>
										)}
									</section>
								</div>
								<div slot="tab-2">
									<SeriesTab pillars={pillars} categories={categories} onTasksChanged={handleMasterDataChanged} />
								</div>
								<div slot="tab-3">
									{/* Nur bei aktivem Tab mounten: KolTabs hält inaktive Panels per `hidden`-Attribut im DOM
						    (nicht entfernt), und die Knoten-/Listentitel sind wortgleich zum Aufgaben-Tab —
						    dauerhaft gemountet würden sie dort exakte Text-Locators (z. B. in E2E-Tests) doppeln. */}
									{activeTab === 3 && (
										<Suspense fallback={<KolSpin _show _variant="cycle" aria-label="Graph wird geladen" />}>
											<TaskGraphPanel tasks={tasks} onEditDependencies={openDependencies} />
										</Suspense>
									)}
								</div>
							</KolTabs>
						)}
					</>
				)}

				{dialog?.kind === 'create' &&
					// #1335: „Neuen Task anlegen" ist der einzige Einstieg — bei aktiver KI der verschmolzene
					// Freitext-Dialog (Verarbeiten/Beraten/Überspringen), ohne KI direkt das Task-Formular.
					(aiEnabled ? (
						<QuickCaptureModal
							parentTask={dialog.parentTask ?? null}
							pillars={pillars}
							categories={categories}
							distribution={advisorDistribution}
							onClose={closeDialog}
							onSaved={afterMutation}
						/>
					) : (
						<TaskFormModal
							task={null}
							parentTask={dialog.parentTask ?? null}
							pillars={pillars}
							categories={categories}
							onClose={closeDialog}
							onSaved={afterMutation}
						/>
					))}
				{dialog?.kind === 'search' && (
					<SearchModal
						categories={categories}
						onClose={closeDialog}
						onSearch={(query, categoryId) => {
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
							// Kategorie-Filter aus der Suche in denselben Navigations-Schritt legen — ein
							// separates `applyCategoryFilter()` liefe gegen die alte Location (siehe oben).
							if (categoryId === null) {
								next.delete('cat');
							} else {
								next.set('cat', String(categoryId));
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
						categories={categories}
						onClose={closeDialog}
						onSaved={afterMutation}
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
						onConfirm={(checklist, allChecked) => completeTask(dialog.task, checklist, allChecked)}
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
			</main>
			{/* App-weite Einblendungen und die Fußzeile stehen außerhalb von `<main>`: Sie gehören
			    nicht zum Seiteninhalt, und `contentinfo` ist ein Landmark der obersten Ebene. */}
			<InstallPrompt />
			<UpdatePrompt />
			<PushToast />
			<SessionExpiredDialog />
			<Footer version={APP_VERSION} />
		</div>
	);
};

/**
 * #1105: Der `BrowserRouter` liegt bewusst um `AppShell` INNERHALB von `App` (statt in `main.tsx`),
 * damit Bestands-Unit-Tests `App` weiterhin ohne Router rendern können. Der App-State (Tasks,
 * Säulen …) lebt außerhalb des Routers — eine Navigation remountet die App also nicht.
 */
/**
 * Paket-Kontext (#1458): Der Zustand (Spiegel + `/auth/me`) hängt EINMAL hier oben, damit jedes
 * Badge ihn über `usePlan()` liest, statt selbst zu laden.
 */
const AppWithPlan = ({ user }: { user: AuthUser }) => {
	const planState = usePlanState(user.id);
	return (
		<PlanProvider value={planState}>
			<MemoAppShell user={user} />
		</PlanProvider>
	);
};

/**
 * `AppShell` hängt seit #1458 unter `AppWithPlan`, dessen Zustand sich nach dem Mount asynchron
 * ändert (Spiegel → `/auth/me`, erneut bei App-Fokus). Ohne `memo` würde jede dieser Antworten den
 * kompletten Baum neu rendern — und dabei kontrollierte KoliBri-Props auf ihren abgeleiteten Wert
 * zurücksetzen. Konkret schloss das in den Einstellungen das manuell geöffnete `KolAccordion`
 * „Einzelne Animationen" (`_open={animationsEnabled}`) wieder zu; der Touch-Target-Test aus #971 maß
 * danach die Höhe 0. Den Paket-Zustand brauchen ohnehin nur die `usePlan()`-Verbraucher, und die
 * hängen am Context, nicht an diesem Render-Pfad.
 */
const MemoAppShell = memo(AppShell);

export const App = ({ user }: { user: AuthUser }) => (
	// `future`-Flags opt-in: ohne sie loggt der Router bei jedem Start zwei Future-Flag-Warnings
	// in die Konsole (e2e-Vertrag #865 AK6: keine console.warnings). Splat-Routen gibt es hier
	// nicht, daher ist `v7_relativeSplatPath` verhaltensneutral.
	<BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
		<AppWithPlan user={user} />
	</BrowserRouter>
);
