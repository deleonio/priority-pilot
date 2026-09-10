import { act, cleanup, render, screen } from '@testing-library/react';
import { TaskStatus } from 'client';
import type { Task } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1346 — AK5: `CompleteTaskDialog` nennt die Task-ID als „#<id>" in
 * `var(--pp-ink-muted, #525b6a)`, statt „ID <id>" in normaler Farbe.
 *
 * Spezifikation: `docs/spec/issue-1346.md`. Rot, solange `CompleteTaskDialog.tsx:65`
 * `(ID {task.id})` ohne muted Farbe rendert.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolButton: ({
		_label,
		_disabled,
		_on,
	}: {
		_label?: string;
		_disabled?: boolean;
		_on?: { onClick?: (_e: MouseEvent) => void };
	}) => (
		<button disabled={_disabled} onClick={(e) => _on?.onClick?.(e.nativeEvent)}>
			{_label}
		</button>
	),
}));

vi.mock('./Modal', () => ({
	Modal: ({ title, children }: { title?: string; children: ReactNode }) => (
		<div data-testid="modal">
			{title !== undefined && <h2>{title}</h2>}
			{children}
		</div>
	),
}));

import { CompleteTaskDialog } from './CompleteTaskDialog';

const sampleTask = (): Task => ({
	id: 42,
	title: 'Kundenbericht fertigstellen',
	status: TaskStatus.Open,
	priority: 3,
	estimatedEffort: 0.5,
	isException: false,
	pillars: [],
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('CompleteTaskDialog — Task-ID als „#<id>" in muted Farbe (#1346, AK5)', () => {
	it('zeigt die ID als „#42" in --pp-ink-muted, nicht mehr „ID 42"', async () => {
		await act(async () => {
			render(<CompleteTaskDialog task={sampleTask()} onConfirm={vi.fn()} onClose={vi.fn()} onCompleted={vi.fn()} />);
		});

		const idText = screen.getByText('#42');
		expect(idText).toBeInTheDocument();
		expect(idText).toHaveStyle({ color: 'var(--pp-ink-muted, #525b6a)' });
		expect(screen.queryByText(/ID 42/)).toBeNull();
	});
});
