import { render, screen, within } from '@testing-library/react';
import type { TaskGraphEdge, TaskGraphNode } from 'client';
import { describe, expect, it, vi } from 'vitest';

/**
 * Die Listenansicht ist die barrierefreie Fassung des Graphen — sie trägt die gesamte Tastatur- und
 * Screenreader-Bedienung, weil der Canvas `aria-hidden` ist. Entsprechend wird hier festgehalten,
 * dass jeder Knoten samt beiden Beziehungsrichtungen und den Gewichten als Text ankommt.
 *
 * KoliBri-Komponenten sind Custom Elements und in jsdom nicht nutzbar; sie werden wie in den
 * übrigen Komponententests durch natives HTML ersetzt.
 */
vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<section>
			<h4>{_label}</h4>
			{children}
		</section>
	),
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: () => void } }) => (
		<button type="button" onClick={() => _on?.onClick?.()}>
			{_label}
		</button>
	),
}));

const { TaskGraphList } = await import('./TaskGraphList');

const node = (id: number, title: string): TaskGraphNode => ({
	id,
	title,
	priority: 3,
	estimatedEffort: 0.5,
	totalEstimatedEffort: 0.5,
	value: 1,
	status: 'Open',
	progress: null,
});

const edge = (from: number, to: number, weight: number): TaskGraphEdge => ({ from, to, weight });

describe('TaskGraphList', () => {
	it('Leerzustand ohne Knoten', () => {
		render(<TaskGraphList nodes={[]} edges={[]} onEditDependencies={null} />);
		expect(screen.getByText(/nichts zu verknüpfen/i)).toBeTruthy();
	});

	it('Zeigt jeden Knoten genau einmal', () => {
		render(
			<TaskGraphList nodes={[node(1, 'Alpha'), node(2, 'Beta')]} edges={[edge(1, 2, 1)]} onEditDependencies={null} />,
		);
		expect(screen.getByTestId('graph-list-item-1')).toBeTruthy();
		expect(screen.getByTestId('graph-list-item-2')).toBeTruthy();
	});

	it('Ordnet Vorgänger und Nachfolger richtig zu und nennt das Gewicht als Zahl', () => {
		render(
			<TaskGraphList nodes={[node(1, 'Alpha'), node(2, 'Beta')]} edges={[edge(1, 2, 0.5)]} onEditDependencies={null} />,
		);
		// Alpha ermöglicht Beta …
		const alpha = within(screen.getByTestId('graph-list-item-1'));
		expect(alpha.getByText(/#2 – Beta \(Gewicht 0,5\)/)).toBeTruthy();
		expect(alpha.getByText(/Keine Unteraufgaben/)).toBeTruthy();
		// … und Beta hängt von Alpha ab.
		const beta = within(screen.getByTestId('graph-list-item-2'));
		expect(beta.getByText(/#1 – Alpha \(Gewicht 0,5\)/)).toBeTruthy();
		expect(beta.getByText(/Keine übergeordnete Aufgabe/)).toBeTruthy();
	});

	it('Der Aktions-Button meldet die Knoten-ID zurück', () => {
		const onEditDependencies = vi.fn();
		render(<TaskGraphList nodes={[node(7, 'Gamma')]} edges={[]} onEditDependencies={onEditDependencies} />);
		screen.getByRole('button', { name: /Abhängigkeiten bearbeiten: Gamma/ }).click();
		expect(onEditDependencies).toHaveBeenCalledWith(7);
	});

	it('Ohne Bedienmöglichkeit erscheint kein Aktions-Button', () => {
		render(<TaskGraphList nodes={[node(7, 'Gamma')]} edges={[]} onEditDependencies={null} />);
		expect(screen.queryByRole('button')).toBeNull();
	});
});
