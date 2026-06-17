import { KolAlert, KolButton, KolHeading, KolPopoverButton, KolSpin, KolTabs, KolToolbar } from '@public-ui/react-v19';
import type { Pillar, Task, TaskTreeNode } from 'client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { Dashboard } from './components/Dashboard';
import { DeleteTaskDialog } from './components/DeleteTaskDialog';
import { DependencyModal } from './components/DependencyModal';
import { EmptyState } from './components/EmptyState';
import { ForestPanel } from './components/ForestPanel';
import { PillarWeightsModal } from './components/PillarWeightsModal';
import { TaskFormModal } from './components/TaskFormModal';
import { TaskTable } from './components/TaskTable';
import { toApiError } from './lib/apiError';
import { buildDependencyMap } from './lib/dependencies';

type Dialog =
	| { kind: 'create' }
	| { kind: 'edit'; task: Task }
	| { kind: 'delete'; task: Task }
	| { kind: 'dependencies'; taskId: number }
	| { kind: 'pillars' }
	| null;

// Die Hauptansichten als Tab-Leiste oben (Inhalt steckt in den zugehörigen `tab-N`-Slots von
// `KolTabs`). Modulkonstante, damit `KolTabs` nicht bei jedem Render eine neue Tab-Liste erhält und
// die Auswahl zurücksetzt.
const VIEW_TABS = [{ _label: 'Dashboard' }, { _label: 'Aufgaben' }, { _label: 'Aufgabenwald' }];

// Statisches Reload-Icon (Font-Awesome-Solid) für den „Aktualisieren"-Button. Als Modulkonstante,
// damit `KolButton` nicht bei jedem Render eine neue `_icons`-Objektidentität erhält (sonst würde
// dessen Icon-Watcher unnötig erneut feuern).
const RELOAD_ICON = { left: { icon: 'fa-solid fa-arrows-rotate' } };

export const App = () => {
	const [tasks, setTasks] = useState<Task[] | null>(null);
	const [forest, setForest] = useState<TaskTreeNode[]>([]);
	const [nextTask, setNextTask] = useState<Task | null>(null);
	const [pillars, setPillars] = useState<Pillar[]>([]);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [dialog, setDialog] = useState<Dialog>(null);

	const reload = useCallback(async (signal?: AbortSignal): Promise<void> => {
		setLoading(true);
		try {
			const [loadedTasks, loadedForest, loadedNext, loadedPillars] = await Promise.all([
				api.listTasks({ signal }),
				api.getForest({ signal }),
				api.getNextTask({ signal }),
				api.listPillars({ signal }),
			]);
			setTasks(loadedTasks);
			setForest(loadedForest);
			setNextTask(loadedNext ?? null);
			setPillars(loadedPillars);
			setLoadError(null);
		} catch (reason) {
			if (signal?.aborted === true) {
				return;
			}
			const apiError = await toApiError(reason);
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

	/** Nach erfolgreicher Mutation: Dialog schließen und Daten neu laden. */
	const afterMutation = useCallback((): void => {
		setDialog(null);
		void reload();
	}, [reload]);

	const closeDialog = useCallback((): void => setDialog(null), []);

	// Referenz auf den Einstellungs-PopoverButton, um das Popover beim Öffnen eines Unterpunkts
	// (z. B. der Säulen-Verteilung) wieder zu schließen.
	const settingsRef = useRef<HTMLKolPopoverButtonElement>(null);

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

	// Bei einer Dependency-Änderung bleibt der Dialog offen; nur die Daten werden aktualisiert.
	const refreshKeepingDialog = useCallback((): void => {
		void reload();
	}, [reload]);

	const dependencyTask =
		dialog?.kind === 'dependencies' ? (tasks?.find((task) => task.id === dialog.taskId) ?? null) : null;

	return (
		<main className="app">
			<header className="app-header">
				<KolHeading _label="Priority Pilot" _level={1} />
				<div className="toolbar">
					<KolButton
						_label="Neuen Task anlegen"
						_variant="primary"
						_on={{ onClick: () => setDialog({ kind: 'create' }) }}
					/>
					<KolButton
						_label="Aktualisieren"
						_hideLabel
						_icons={RELOAD_ICON}
						_variant="secondary"
						_disabled={loading}
						_on={{ onClick: () => void reload() }}
					/>
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
						<Dashboard tasks={tasks} forest={forest} nextTask={nextTask} pillars={pillars} />
					</div>
					<div slot="tab-1">
						<section className="task-section">
							<TaskTable
								tasks={tasks}
								dependencyMap={dependencyMap}
								onEdit={openEdit}
								onDelete={openDelete}
								onEditDependencies={openDependencies}
							/>
						</section>
					</div>
					<div slot="tab-2">
						<ForestPanel forest={forest} />
					</div>
				</KolTabs>
			)}

			{dialog?.kind === 'create' && (
				<TaskFormModal task={null} pillars={pillars} onClose={closeDialog} onSaved={afterMutation} />
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
			{dialog?.kind === 'delete' && (
				<DeleteTaskDialog task={dialog.task} onClose={closeDialog} onDeleted={afterMutation} />
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
