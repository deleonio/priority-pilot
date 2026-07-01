import { KolAlert, KolHeading, KolPopoverButton, KolSpin, KolTabs, KolToolbar } from '@public-ui/react-v19';
import type { Pillar, Task, TaskTreeNode } from 'client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { Dashboard } from './components/Dashboard';
import { DeleteTaskDialog } from './components/DeleteTaskDialog';
import { DependencyModal } from './components/DependencyModal';
import { EmptyState } from './components/EmptyState';
import { ForestPanel } from './components/ForestPanel';
import { PillarWeightsModal } from './components/PillarWeightsModal';
import { SeriesManagementModal } from './components/SeriesManagementModal';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskTable } from './components/TaskTable';
import { useThemeToolbarItem } from './components/ThemeToggle';
import { toApiError } from './lib/apiError';
import type { AuthUser } from './lib/auth';
import { buildDependencyMap } from './lib/dependencies';

type Dialog =
	// `parentTask` gesetzt → die neu angelegte Aufgabe wird als Vorgänger mit ihr verknüpft (Unteraufgabe).
	| { kind: 'create'; parentTask?: Task }
	| { kind: 'edit'; task: Task }
	| { kind: 'delete'; task: Task }
	| { kind: 'dependencies'; taskId: number }
	| { kind: 'pillars' }
	| { kind: 'series' }
	| null;

// Die Hauptansichten als Tab-Leiste oben (Inhalt steckt in den zugehörigen `tab-N`-Slots von
// `KolTabs`). Modulkonstante, damit `KolTabs` nicht bei jedem Render eine neue Tab-Liste erhält und
// die Auswahl zurücksetzt.
const VIEW_TABS = [{ _label: 'Dashboard' }, { _label: 'Aufgaben' }, { _label: 'Aufgabenwald' }];

// Statisches Reload-Icon (Font-Awesome-Solid) für den „Aktualisieren"-Toolbar-Button. Als
// Modulkonstante, damit das Toolbar-Item nicht bei jedem Render eine neue `_icons`-Objektidentität
// erhält (sonst würde der Icon-Watcher unnötig erneut feuern).
const RELOAD_ICON = { left: { icon: 'fa-solid fa-arrows-rotate' } };

export const App = ({ user }: { user: AuthUser }) => {
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

	const dependencyMap = useMemo(() => buildDependencyMap(forest), [forest]);

	// Zustandsabhängiger Theme-Umschalter als Toolbar-Button-Deskriptor (Label/Icon/onClick).
	const themeItem = useThemeToolbarItem();

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

	// Referenz auf den Einstellungs-PopoverButton, um das Popover beim Öffnen eines Unterpunkts
	// (z. B. der Säulen-Verteilung) wieder zu schließen.
	const settingsRef = useRef<HTMLKolPopoverButtonElement>(null);

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

	/** Öffnet die persönliche Säulen-Verteilung aus dem Einstellungs-Menü und schließt das Popover. */
	const openPillars = useCallback((): void => {
		void settingsRef.current?.hidePopover();
		setDialog({ kind: 'pillars' });
	}, []);

	// Stabile Callback-Identitäten, damit die memoisierte `TaskTable` beim Öffnen eines Dialogs nicht
	// neu rendert (sonst Zellen-/Toolbar-Neuaufbau samt Fokusverlust am auslösenden Button).
	const openEdit = useCallback((task: Task): void => setDialog({ kind: 'edit', task }), []);
	const openDelete = useCallback((task: Task): void => setDialog({ kind: 'delete', task }), []);
	const openDependencies = useCallback((task: Task): void => setDialog({ kind: 'dependencies', taskId: task.id }), []);
	const openAddSubtask = useCallback((task: Task): void => setDialog({ kind: 'create', parentTask: task }), []);

	// Bei einer Dependency-Änderung bleibt der Dialog offen; nur die Daten werden aktualisiert.
	const refreshKeepingDialog = useCallback((): void => {
		void reload();
	}, [reload]);

	const dependencyTask =
		dialog?.kind === 'dependencies' ? (tasks?.find((task) => task.id === dialog.taskId) ?? null) : null;

	return (
		<main className="app" ref={deleteFallbackRef} tabIndex={-1} data-focus-fallback>
			<header className="app-header">
				<KolHeading _label="Priority Pilot" _level={1} />
				<div className="toolbar">
					{/* Die einfachen Header-Aktionen als echte `KolToolbar` (Toolbar-Rolle + Pfeiltasten-
					    Navigation, sprechendes Label „Kopf-Aktionen"): „Neuen Task anlegen", „Aktualisieren"
					    und der Darstellungs-Umschalter. Der `KolPopoverButton` „Einstellungen" bleibt bewusst
					    außerhalb (Geschwister), da sein Kind-Inhalt sich nicht über `_items` abbilden lässt. */}
					<KolToolbar
						_label="Kopf-Aktionen"
						_orientation="horizontal"
						_items={[
							{
								type: 'button',
								_label: 'Neuen Task anlegen',
								_variant: 'primary',
								_on: { onClick: () => setDialog({ kind: 'create' }) },
							},
							{
								type: 'button',
								_label: 'Serien verwalten',
								_variant: 'secondary',
								_on: { onClick: () => setDialog({ kind: 'series' }) },
							},
							{
								type: 'button',
								_label: 'Aktualisieren',
								_hideLabel: true,
								_icons: RELOAD_ICON,
								_variant: 'secondary',
								_disabled: loading,
								_on: { onClick: () => void reload() },
							},
							{
								// Farbschema-Umschalter: System/Hell/Dunkel (OS-Erkennung + Override).
								type: 'button',
								_label: themeItem._label,
								_hideLabel: true,
								_icons: themeItem._icons,
								_variant: 'secondary',
								_on: { onClick: themeItem.onClick },
							},
							{
								type: 'button' as const,
								_label: 'Abmelden',
								_variant: 'secondary' as const,
								_disabled: logoutLoading,
								_on: { onClick: () => void handleLogout() },
							},
						]}
					/>
					<div className="user-info">
						<span className="user-email">{user.email}</span>
						<span className="user-display-name">{user.name}</span>
					</div>
					{/* Einstellungen rechts oben: ein icon-only Zahnrad öffnet ein Popover mit einer
					    vertikalen Toolbar als Menü. Erster Unterpunkt ist die persönliche Säulen-Verteilung;
					    der Bereich ist so für weitere Einstellungen erweiterbar. */}
					<KolPopoverButton
						ref={settingsRef}
						_label="Einstellungen"
						_hideLabel
						_icons={{ left: { icon: 'kolicon-settings' } }}
						_variant="secondary"
						_popoverAlign="bottom"
					>
						<KolToolbar
							className="settings-menu"
							_label="Einstellungen"
							_orientation="vertical"
							_items={[
								{
									type: 'button',
									_label: 'Persönliche Säulen-Verteilung',
									_variant: 'secondary',
									_disabled: loading || tasks === null,
									_on: { onClick: openPillars },
								},
							]}
						/>
					</KolPopoverButton>
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
			<KolAlert _type="info" _label="Hallo, Christian!">
				Hallo, Christian!
			</KolAlert>

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
							<TaskTable
								tasks={tasks}
								dependencyMap={dependencyMap}
								onEdit={openEdit}
								onDelete={openDelete}
								onEditDependencies={openDependencies}
								onAddSubtask={openAddSubtask}
							/>
						</section>
					</div>
					<div slot="tab-2">
						<ForestPanel forest={forest} />
					</div>
				</KolTabs>
			)}

			{dialog?.kind === 'create' && (
				<TaskFormModal
					task={null}
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
			{dialog?.kind === 'pillars' && (
				<PillarWeightsModal pillars={pillars} onClose={closeDialog} onSaved={afterMutation} />
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
		</main>
	);
};
