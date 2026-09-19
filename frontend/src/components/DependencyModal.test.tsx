import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { TaskStatus } from 'client';
import type { Task } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanProvider } from '../lib/usePlan';

/**
 * Rote Spec-Tests für #1429 — AK7/AK8: der Abhängigkeits-Dialog zeigt und ändert das Gewicht
 * eines BESTEHENDEN Vorgängers (bisher nur beim Hinzufügen möglich, DependencyModal.tsx:112-137).
 *
 * Spezifikation: `docs/spec/issue-1429.md`. Vertrag für diese Tests (noch nicht implementiert):
 * `DependencyRef` trägt ein `weight`-Feld; jede Zeile der Liste „Aktuelle Vorgänger" bekommt einen
 * eigenen `KolInputRange`-Regler mit zugänglichem Namen `Gewicht: <Titel>`, dessen Änderung
 * `api.addDependency({ id: task.id, dependencyInput: { dependingTaskId: <id>, weight: <neu> } })`
 * aufruft und danach `onChanged()`. Rot, solange die Zeile kein Gewicht zeigt/ändern lässt.
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	// #1528-Test-Pflege: das Badge rendert im Modal sichtbar (PlanProvider siehe unten) — deshalb
	// braucht der Mock jetzt auch KolBadge.
	KolBadge: ({ _label }: { _label?: string }) => <span data-testid="badge">{_label}</span>,
	KolButton: ({
		_label,
		_hideLabel,
		_disabled,
		_on,
	}: {
		_label?: string;
		_hideLabel?: boolean;
		_disabled?: boolean;
		_on?: { onClick?: () => void };
	}) => (
		<button aria-label={_label} disabled={_disabled} onClick={() => _on?.onClick?.()}>
			{_hideLabel ? null : _label}
		</button>
	),
	KolInputRange: ({
		_label,
		_value,
		_min,
		_max,
		_step,
		_on,
	}: {
		_label?: string;
		_value?: number;
		_min?: number;
		_max?: number;
		_step?: number;
		_on?: { onChange?: (event: unknown, value: number) => void };
	}) => (
		<input
			type="range"
			aria-label={_label}
			value={_value}
			min={_min}
			max={_max}
			step={_step}
			onChange={(e) => _on?.onChange?.(undefined, Number(e.target.value))}
		/>
	),
	KolSingleSelect: ({
		_label,
		_options,
		_on,
	}: {
		_label?: string;
		_options?: { label: string; value: number }[];
		_on?: { onChange?: (event: unknown, value: number) => void };
	}) => (
		<select aria-label={_label} onChange={(e) => _on?.onChange?.(undefined, Number(e.target.value))}>
			<option value="" />
			{_options?.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	),
}));

vi.mock('./Modal', () => ({
	Modal: ({ title, children }: { title?: string; children?: ReactNode }) => (
		<div data-testid="modal">
			<h2>{title}</h2>
			{children}
		</div>
	),
}));

vi.mock('../lib/useCtrlEnter', () => ({ useCtrlEnter: () => undefined }));

vi.mock('../api', () => ({
	api: { addDependency: vi.fn().mockResolvedValue({}), removeDependency: vi.fn().mockResolvedValue(undefined) },
}));

import { api } from '../api';
import { DependencyModal } from './DependencyModal';

const mockAddDependency = api.addDependency as ReturnType<typeof vi.fn>;

afterEach(() => {
	vi.clearAllMocks();
});

const sampleTask = (id: number, title: string): Task => ({
	id,
	title,
	status: TaskStatus.Open,
	priority: 3,
	estimatedEffort: 0.5,
	isException: false,
	pillars: [],
});

/** `DependencyRef` führt heute (noch) kein `weight` — Vertrag der Spec, Cast bis zur Implementierung. */
type DependencyRefWithWeight = { id: number; title: string; weight: number };

describe('DependencyModal — Gewicht eines bestehenden Vorgängers (#1429, AK7/AK8)', () => {
	it('AK7: jede Zeile der Liste "Aktuelle Vorgänger" zeigt ihr aktuelles Gewicht', async () => {
		const task = sampleTask(1, 'Ziel');
		const dependencies: DependencyRefWithWeight[] = [
			{ id: 2, title: 'Vorgänger A', weight: 0.5 },
			{ id: 3, title: 'Vorgänger B', weight: 1 },
		];

		await act(async () => {
			render(
				<DependencyModal
					task={task}
					allTasks={[task]}
					dependencies={dependencies as unknown as import('../lib/dependencies').DependencyRef[]}
					onClose={vi.fn()}
					onChanged={vi.fn()}
				/>,
			);
		});

		const rows = screen.getAllByRole('listitem');
		expect(within(rows[0]).getByRole('slider', { name: 'Gewicht: Vorgänger A' })).toHaveValue('0.5');
		expect(within(rows[1]).getByRole('slider', { name: 'Gewicht: Vorgänger B' })).toHaveValue('1');
	});

	it('AK8: Ändern des Gewichts einer bestehenden Zeile speichert den neuen Wert (ein addDependency-Aufruf)', async () => {
		const task = sampleTask(1, 'Ziel');
		const dependencies: DependencyRefWithWeight[] = [{ id: 2, title: 'Vorgänger A', weight: 0.5 }];
		const onChanged = vi.fn();

		await act(async () => {
			render(
				<DependencyModal
					task={task}
					allTasks={[task]}
					dependencies={dependencies as unknown as import('../lib/dependencies').DependencyRef[]}
					onClose={vi.fn()}
					onChanged={onChanged}
				/>,
			);
		});

		const slider = screen.getByRole('slider', { name: 'Gewicht: Vorgänger A' });
		await act(async () => {
			fireEvent.change(slider, { target: { value: '0.4' } });
		});

		expect(mockAddDependency).toHaveBeenCalledTimes(1);
		expect(mockAddDependency).toHaveBeenCalledWith({
			id: task.id,
			dependencyInput: { dependingTaskId: 2, weight: 0.4 },
		});
		expect(onChanged).toHaveBeenCalledTimes(1);
	});
});

// ── #1528 AK3: Badge im Modal ohne Klickziel ────────────────────────────────────────────────────

/**
 * Test-Pflege (#1528): der globale Angebots-Dialog und das `useClosingOnPlanRequired`-Weichen sind
 * entfallen (AK1) — der frühere „weicht dem Angebots-Dialog"-Test (Entscheidung 7.1) ist damit
 * gegenstandslos. Entscheidung B des Autors (2026-09-17) stattdessen: das Badge ist im Modal reine
 * Beschriftung (`inModal`, kein Klickziel) und schließt das Modal nicht.
 */
describe('DependencyModal — Badge im Modal ohne Klickziel (#1528 AK3)', () => {
	it('Badge-Klick schließt das Modal nicht', async () => {
		const task = sampleTask(1, 'Ziel');
		const onClose = vi.fn();

		const { container } = await act(async () => {
			return render(
				<PlanProvider value={{ plan: 'free', entitlements: { graph_write: { allowed: false, requiredPlan: 'pro' } } }}>
					<DependencyModal task={task} allTasks={[task]} dependencies={[]} onClose={onClose} onChanged={vi.fn()} />
				</PlanProvider>,
			);
		});

		const badge = screen.getByTestId('plan-badge-graph_write');
		expect(badge.closest('a')).toBeNull();

		fireEvent.click(badge);

		expect(onClose).not.toHaveBeenCalled();
		expect(container).toBeTruthy();
	});
});
