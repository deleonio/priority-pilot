import { render, screen, waitFor } from '@testing-library/react';
import type { Task, TaskGraph, TaskGraphNode } from 'client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Panel-Vertrag: die drei Zustände (Laden/Fehler/Daten), die Kappung auf `MAX_GRAPH_NODES` und der
 * Weg vom Knoten zum Abhängigkeits-Dialog.
 *
 * Der Canvas wird gemockt: jsdom kennt weder `ResizeObserver` noch `DOMMatrix`, ein echtes
 * `ReactFlow` scheitert dort. KoliBri-Komponenten sind Custom Elements und ebenfalls ersetzt.
 */
vi.mock('./TaskGraphCanvas', () => ({
	TaskGraphCanvas: ({ nodes }: { nodes: TaskGraphNode[] }) => (
		<div data-testid="canvas-stub">{nodes.length} Knoten</div>
	),
}));

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<div role="alert">
			<strong>{_label}</strong>
			{children}
		</div>
	),
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: () => void } }) => (
		<button type="button" onClick={() => _on?.onClick?.()}>
			{_label}
		</button>
	),
	KolCard: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<section>
			<h4>{_label}</h4>
			{children}
		</section>
	),
	KolDetails: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<details>
			<summary>{_label}</summary>
			{children}
		</details>
	),
	KolHeading: ({ _label }: { _label?: string }) => <h2>{_label}</h2>,
	KolSpin: () => <span role="status">Lädt</span>,
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
}));

const getGraph = vi.fn();
vi.mock('../api', () => ({ api: { getGraph: (...args: unknown[]) => getGraph(...args) } }));

const { TaskGraphPanel } = await import('./TaskGraphPanel');
const { MAX_GRAPH_NODES } = await import('../lib/graphLayout');

const node = (id: number, value = 1): TaskGraphNode => ({
	id,
	title: `T${id}`,
	priority: 3,
	estimatedEffort: 0.5,
	totalEstimatedEffort: 0.5,
	value,
	status: 'Open',
	progress: null,
});

const task = (id: number): Task => ({ id, title: `T${id}`, priority: 3, estimatedEffort: 0.5, status: 'Open' }) as Task;

const graph = (nodes: TaskGraphNode[]): TaskGraph => ({ nodes, edges: [] });

beforeEach(() => {
	getGraph.mockReset();
});

describe('TaskGraphPanel', () => {
	it('Zeigt einen Ladezustand, solange der Graph unterwegs ist', () => {
		getGraph.mockReturnValue(new Promise(() => {}));
		render(<TaskGraphPanel tasks={[]} onEditDependencies={vi.fn()} />);
		expect(screen.getByRole('status')).toBeTruthy();
	});

	it('Meldet einen Ladefehler mit Wiederholen-Möglichkeit', async () => {
		getGraph.mockRejectedValue(new Error('Netzwerk weg'));
		render(<TaskGraphPanel tasks={[]} onEditDependencies={vi.fn()} />);
		await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
		expect(screen.getByRole('button', { name: /Erneut versuchen/ })).toBeTruthy();
	});

	it('Leerer Graph erklärt sich statt leer zu bleiben', async () => {
		getGraph.mockResolvedValue(graph([]));
		render(<TaskGraphPanel tasks={[]} onEditDependencies={vi.fn()} />);
		await waitFor(() => expect(screen.getByText(/Keine offenen Aufgaben/)).toBeTruthy());
	});

	it('Kappt große Graphen und sagt es dem Nutzer', async () => {
		const many = Array.from({ length: MAX_GRAPH_NODES + 5 }, (_, index) =>
			node(index + 1, MAX_GRAPH_NODES + 5 - index),
		);
		getGraph.mockResolvedValue(graph(many));
		render(<TaskGraphPanel tasks={[]} onEditDependencies={vi.fn()} />);
		await waitFor(() => expect(screen.getByTestId('canvas-stub').textContent).toBe(`${MAX_GRAPH_NODES} Knoten`));
		expect(screen.getByRole('alert').textContent).toContain(`${MAX_GRAPH_NODES} wertvollsten von ${many.length}`);
	});

	it('Der Listen-Button öffnet den Dialog für die richtige Aufgabe', async () => {
		getGraph.mockResolvedValue(graph([node(1), node(2)]));
		const onEditDependencies = vi.fn();
		render(<TaskGraphPanel tasks={[task(1), task(2)]} onEditDependencies={onEditDependencies} />);
		await waitFor(() => expect(screen.getByTestId('graph-list-item-2')).toBeTruthy());
		screen.getByRole('button', { name: /Abhängigkeiten bearbeiten: T2/ }).click();
		expect(onEditDependencies).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
	});
});
