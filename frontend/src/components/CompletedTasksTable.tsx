import type { KoliBriTableDataType, KoliBriTableHeaderCellWithLogic } from '@public-ui/components';
import { KolTableStateful, KolToolbar } from '@public-ui/react-v19';
import type { Pillar, Task } from 'client';
import { TaskStatus } from 'client';
import { memo, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { getTaskPillarPoints } from '../lib/pillar';
import { renderIntoCell } from '../lib/reactCellRoot';

interface CompletedTasksTableProps {
	tasks: Task[];
	pillars: Pillar[];
	/**
	 * IDs aller Aufgaben, die aktuell im Aufgabenwald angezeigt werden. Frisch per Toggle erledigte
	 * Aufgaben (#315) bleiben bis zum nächsten Reload im (dann veralteten) Wald „sticky" sichtbar —
	 * solche Aufgaben hier ausblenden, damit ihr Titel nicht doppelt im DOM steht (#228).
	 */
	forestTaskIds: ReadonlySet<number>;
	/** Nach dem Wiedereröffnen eines Tasks neu laden (Daten aktualisieren). */
	onReloaded: () => void;
}

/** Nachkommastellen für die Punkte-Anzeige — kompakt, aber genau genug für anteilige Werte. */
const formatPoints = (value: number): string =>
	Number.isFinite(value) ? value.toLocaleString('de-DE', { maximumFractionDigits: 2 }) : '0';

/** Maximal-Länge gekürzter Säulen-Header (#1020 AK1): lang genug für übliche Namen, kurz genug für einzeilige Kopfzellen. */
const HEADER_MAX_CHARS = 20;

/**
 * Kürzt Säulen-Namen auf `HEADER_MAX_CHARS` Zeichen mit Auslassungszeichen (#1020 AK1). Kurze Namen
 * laufen unverändert durch. Der Volltext bleibt über den Screenreader-Kontext der Tabelle erschlossen
 * (KoliBri 4.3.0 bietet an Header-Zellen kein `title`-Prop für Tooltips, siehe Spec docs/spec/issue-1020.md).
 */
const shortPillarHeader = (name: string): string =>
	name.length > HEADER_MAX_CHARS ? `${name.slice(0, HEADER_MAX_CHARS - 1)}…` : name;

/** Header-Schlüssel der Säulen-Spalte zu einer Säule-ID (identisch in `_headers` und Datenzeilen). */
const pillarKey = (pillarId: number): string => `pillar-${pillarId}`;

/** Eine Datenzeile der Erledigt-Tabelle. Säulen-Punkte liegen unter dynamischem `pillar-<id>`-Schlüssel. */
interface DoneTaskRow extends KoliBriTableDataType {
	id: number;
	title: string;
	[key: string]: unknown;
	/** Referenz auf den Original-Task, damit der „Wieder öffnen"-Callback ihn erhält. */
	_task: Task;
}

/**
 * Tabelle der erledigten Aufgaben (#228): zeigt ausschließlich Tasks mit `status === Done`. Je Zeile
 * der Titel, eine Punkte-Spalte pro Säule (`estimatedEffort × share / 100`, siehe
 * `getTaskPillarPoints`) und ein „Wieder öffnen"-Schalter, der den Status per PATCH auf `Open` setzt
 * und danach einen Reload auslöst.
 *
 * Als `KolTableStateful` (#1020): schmale Hosts scrollen seitlich INNERHALB der Komponente, es gibt
 * keinen separaten Mobile-Karten-Modus mehr (Nutzer-Entscheidung 2026-08-25, ersetzt #228 AK-6).
 * `_fixedCols={[0, 1]}` hält Titel- und Aktion-Spalte beim Scrollen sichtbar (analog `TaskTable`).
 */
export const CompletedTasksTable = memo((props: CompletedTasksTableProps) => {
	const { tasks, pillars, forestTaskIds, onReloaded } = props;
	const [reopeningId, setReopeningId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	const doneTasks = tasks.filter((task) => task.status === TaskStatus.Done && !forestTaskIds.has(task.id));

	const reopen = async (task: Task): Promise<void> => {
		setReopeningId(task.id);
		setError(null);
		try {
			await api.updateTask({ id: task.id, taskUpdate: { status: TaskStatus.Open } });
			onReloaded();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setReopeningId(null);
		}
	};

	if (doneTasks.length === 0) {
		return <p className="completed-tasks-empty">Noch keine erledigten Aufgaben vorhanden.</p>;
	}

	const data: DoneTaskRow[] = doneTasks.map((task) => {
		const points = getTaskPillarPoints(task, pillars);
		const row: DoneTaskRow = { id: task.id, title: task.title, _task: task };
		for (const pillar of pillars) {
			row[pillarKey(pillar.id)] = formatPoints(points.get(pillar.id) ?? 0);
		}
		return row;
	});

	const headers: { horizontal: KoliBriTableHeaderCellWithLogic[][] } = {
		horizontal: [
			[
				// #1020 AK2: Titel-Spalte dominiert (feste Mindestbreite; Überschuss teilt das Auto-Layout
				// vorrangig ihr zu), Punkte-Spalten orientieren sich am (gekürzten) Header — das hält die
				// Kopfzeile einzeilig.
				{ key: 'title', label: 'Titel', width: 360 },
				...pillars.map((pillar) => ({
					key: pillarKey(pillar.id),
					label: shortPillarHeader(pillar.name),
				})),
				{
					key: 'action',
					label: 'Aktion',
					width: 96,
					// „Wieder öffnen" als KolToolbar-Icon-Button (#307). Die Web Component passt nicht
					// deklarativ in eine KoliBri-Zelle und wird über `render` in eine pro Zelle
					// gecachte React-Root gemountet (siehe reactCellRoot) — wie in `TaskTable`.
					render: (domNode: HTMLElement, _cell: unknown, tupel: unknown) => {
						const task = (tupel as DoneTaskRow)._task;
						renderIntoCell(
							domNode,
							<KolToolbar
								_label={`Aktionen für ${task.title}`}
								_orientation="horizontal"
								_items={[
									{
										type: 'button',
										_label: 'Wieder öffnen',
										_hideLabel: true,
										_icons: { left: { icon: 'fa-solid fa-repeat' } },
										_variant: 'secondary',
										_disabled: reopeningId === task.id,
										_on: { onClick: () => void reopen(task) },
									},
								]}
							/>,
						);
					},
				},
			],
		],
	};

	return (
		<div className="completed-tasks">
			{error !== null && (
				<p className="completed-tasks-error" role="alert">
					{error}
				</p>
			)}
			<KolTableStateful _label="Liste der erledigten Aufgaben" _data={data} _headers={headers} _fixedCols={[0, 1]} />
		</div>
	);
});

CompletedTasksTable.displayName = 'CompletedTasksTable';
