import { KolAlert, KolButton, KolHeading, KolSpin } from '@public-ui/react-v19';
import type { Pillar, Task, TaskTreeNode } from 'client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { Dashboard } from './components/Dashboard';
import { DeleteTaskDialog } from './components/DeleteTaskDialog';
import { DependencyModal } from './components/DependencyModal';
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
						_label="Säulen-Gewichtung"
						_variant="secondary"
						_disabled={loading || tasks === null}
						_on={{ onClick: () => setDialog({ kind: 'pillars' }) }}
					/>
					<KolButton
						_label="Aktualisieren"
						_variant="secondary"
						_disabled={loading}
						_on={{ onClick: () => void reload() }}
					/>
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

			{tasks !== null && (
				<>
					<Dashboard tasks={tasks} forest={forest} nextTask={nextTask} />
					<section className="task-section">
						<h2>Aufgaben</h2>
						<TaskTable
							tasks={tasks}
							dependencyMap={dependencyMap}
							onEdit={(task) => setDialog({ kind: 'edit', task })}
							onDelete={(task) => setDialog({ kind: 'delete', task })}
							onEditDependencies={(task) => setDialog({ kind: 'dependencies', taskId: task.id })}
						/>
					</section>
					<ForestPanel forest={forest} />
				</>
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
