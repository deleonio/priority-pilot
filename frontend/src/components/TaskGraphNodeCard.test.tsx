import { ReactFlowProvider } from '@xyflow/react';
import { render } from '@testing-library/react';
import type { TaskGraphNode } from 'client';
import { describe, expect, it } from 'vitest';
import { TaskGraphNodeCard } from './TaskGraphNodeCard';

/**
 * #1465 AK A2 nennt die Graph-Kacheln ausdrücklich: die ID-Zeile (`#{node.id}`) ist entfernt
 * (`TaskGraphNodeCard.tsx:60f`, vormals `task-graph-node__id`). Knotenliste, Relationsliste und
 * Detail-Card haben dafür je einen eigenen Test — dieser deckt die Kachel ab.
 */
const node: TaskGraphNode = {
	id: 307,
	title: 'Kachel-Titel',
	priority: 3,
	estimatedEffort: 0.5,
	totalEstimatedEffort: 0.5,
	value: 1,
	status: 'Open',
	progress: null,
};

describe('TaskGraphNodeCard', () => {
	it('zeigt keine Task-ID in der Kachel', () => {
		const { container } = render(
			<ReactFlowProvider>
				<TaskGraphNodeCard
					id="307"
					type="taskGraphNode"
					data={{ node, isSelected: false, isDimmed: false }}
					selected={false}
					dragging={false}
					draggable={false}
					selectable={false}
					deletable={false}
					zIndex={0}
					isConnectable={false}
					positionAbsoluteX={0}
					positionAbsoluteY={0}
				/>
			</ReactFlowProvider>,
		);

		expect(container.textContent, 'Kachel zeigt keine Task-ID').not.toMatch(/#307/);
	});
});
