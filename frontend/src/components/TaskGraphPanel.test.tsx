import { render, screen, waitFor } from '@testing-library/react';
import type { Task, TaskGraph, TaskGraphEdge, TaskGraphNode } from 'client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Panel-Vertrag: die drei Zustände (Laden/Fehler/Daten), die Blätterung über die Bäume und der
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
	KolButton: ({ _label, _disabled, _on }: { _label?: string; _disabled?: boolean; _on?: { onClick?: () => void } }) => (
		<button type="button" disabled={_disabled === true} onClick={() => _on?.onClick?.()}>
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

const edge = (from: number, to: number, weight = 1): TaskGraphEdge => ({ from, to, weight });

const graph = (nodes: TaskGraphNode[], edges: TaskGraphEdge[] = []): TaskGraph => ({ nodes, edges });

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

	it('Leerer Graph (keine Kanten) erklärt sich statt leer zu bleiben (AK1/AK8)', async () => {
		getGraph.mockResolvedValue(graph([]));
		render(<TaskGraphPanel tasks={[]} onEditDependencies={vi.fn()} />);
		await waitFor(() => expect(screen.getByText(/Keine offenen Aufgaben/)).toBeTruthy());
	});

	it('Nur kantenlose Knoten ⇒ Leerzustand statt Blätter-Leiste (AK1/AK8)', async () => {
		getGraph.mockResolvedValue(graph([node(1), node(2)], []));
		render(<TaskGraphPanel tasks={[]} onEditDependencies={vi.fn()} />);
		await waitFor(() => expect(screen.getByText(/Keine offenen Aufgaben/)).toBeTruthy());
		expect(screen.queryByText(/Baum \d+ von \d+/)).toBeNull();
	});

	it('Mehrere Bäume: zeigt zuerst den ersten Baum mit Positionsangabe und blättert vor/zurück (AK2/AK3/AK4)', async () => {
		// Drei getrennte Bäume unterschiedlicher Größe/Wert, damit Knotenzahl je Baum unterscheidbar ist.
		const treeGraph = graph(
			[node(1, 99), node(2, 99), node(3, 1), node(4, 1), node(5, 1)],
			[edge(1, 2), edge(3, 4), edge(4, 5)],
		);
		getGraph.mockResolvedValue(treeGraph);
		render(<TaskGraphPanel tasks={[]} onEditDependencies={vi.fn()} />);

		await waitFor(() => expect(screen.getByText('Baum 1 von 2')).toBeTruthy());
		expect(screen.getByTestId('canvas-stub').textContent).toBe('2 Knoten');
		const back = screen.getByRole('button', { name: /Zurück/ });
		const forward = screen.getByRole('button', { name: /Vor/ });
		expect(back.hasAttribute('disabled')).toBe(true);
		expect(forward.hasAttribute('disabled')).toBe(false);

		forward.click();
		await waitFor(() => expect(screen.getByText('Baum 2 von 2')).toBeTruthy());
		expect(screen.getByTestId('canvas-stub').textContent).toBe('3 Knoten');
		expect(screen.getByRole('button', { name: /Vor/ }).hasAttribute('disabled')).toBe(true);
	});

	it('Der Listen-Button öffnet den Dialog für die richtige Aufgabe', async () => {
		getGraph.mockResolvedValue(graph([node(1), node(2)], [edge(1, 2)]));
		const onEditDependencies = vi.fn();
		render(<TaskGraphPanel tasks={[task(1), task(2)]} onEditDependencies={onEditDependencies} />);
		await waitFor(() => expect(screen.getByTestId('graph-list-item-2')).toBeTruthy());
		screen.getByRole('button', { name: /Abhängigkeiten bearbeiten: T2/ }).click();
		expect(onEditDependencies).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
	});
});
