import { cleanup, render, screen, within } from '@testing-library/react';
import type { Pillar, Task } from 'client';
import { TaskStatus } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Roter Spec-Test für #1020 (Spec: docs/spec/issue-1020.md, AK1) — Umbau der Erledigt-Tabelle auf
 * `KolTableStateful` mit kurzen Headern. KoliBri-Komponenten sind in jsdom nicht lauffähig (Custom
 * Elements); `KolTableStateful` wird daher wie in `TaskTable.test.tsx` durch eine native Test-Tabelle
 * ersetzt, die die übergebenen `_headers`-Labels, `_label` und `_fixedCols` widerspiegelt — so sind
 * die Props assertionsfähig, ohne die Web Component zu benötigen. Der Test ist rot, bis
 * `CompletedTasksTable.tsx` die native `<table class="completed-tasks-table">` ersetzt.
 *
 * Der Volltext-Tooltip (UX-Empfehlung) ist bewusst NICHT Teil des Tests: KoliBri 4.3.0 hat an
 * Header-Zellen kein `title`-Prop (siehe Spec „Abgrenzung“).
 */
vi.mock('@public-ui/react-v19', () => ({
	KolTableStateful: ({
		_label,
		_headers,
		_fixedCols,
	}: {
		_label?: string;
		_headers?: { horizontal?: { label: string }[][] };
		_fixedCols?: number[];
	}) => (
		<table
			data-testid="completed-kol-table"
			data-table-label={_label ?? ''}
			data-fixed-cols={JSON.stringify(_fixedCols ?? null)}
		>
			<thead>
				<tr>
					{(_headers?.horizontal ?? []).flat().map((cell, i) => (
						<th key={i}>{cell.label}</th>
					))}
				</tr>
			</thead>
		</table>
	),
	KolToolbar: () => null,
}));

import { CompletedTasksTable } from './CompletedTasksTable';

afterEach(() => {
	cleanup();
});

/** Säule mit bewusst überlangem Namen (33 Zeichen) — nur so ist die Kürzung beobachtbar. */
const LONG_PILLAR_NAME = 'Körperliche Gesundheit & Fitness';

const pillars: Pillar[] = [
	{ id: 1, name: LONG_PILLAR_NAME },
	{ id: 2, name: 'Karriere' },
] as unknown as Pillar[];

const doneTasks: Task[] = [
	{
		id: 11,
		title: 'Wöchentlicher Rückblick',
		status: TaskStatus.Done,
		estimatedEffort: 2,
		pillars: [
			{ pillarId: 1, share: 60 },
			{ pillarId: 2, share: 40 },
		],
	},
] as unknown as Task[];

const defaultProps = {
	tasks: doneTasks,
	pillars,
	forestTaskIds: new Set<number>(),
	onReloaded: vi.fn(),
};

describe('CompletedTasksTable — KolTable-Umbau (#1020, AK1)', () => {
	it('rendert KolTableStateful mit Accessible Label und fixierten Randspalten statt nativer Tabelle', () => {
		const { container } = render(<CompletedTasksTable {...defaultProps} />);

		// AK1: KolTableStateful ist der Vertrag — die Mock-Test-ID existiert nur, wenn die Komponente
		// KolTableStateful wirklich nutzt. Heute rot: die native Tabelle rendert keine Test-ID.
		const kolTable = screen.getByTestId('completed-kol-table');
		expect(kolTable.dataset.tableLabel).toBe('Liste der erledigten Aufgaben');
		// KoliBri-Semantik: `_fixedCols={[1,1]}` = 1 Spalte vom Anfang + 1 Spalte vom Ende fixiert —
		// hält damit Titel (erste) und Aktion (letzte) Spalte beim internen horizontalen Scrollen.
		expect(kolTable.dataset.fixedCols).toBe('[1,1]');

		// … und die native Tabelle ist weg (AK4-DOM-Seite: kein Karten-/Native-Gerüst mehr).
		expect(container.querySelector('table.completed-tasks-table')).toBeNull();
	});

	it('kürzt Säulen-Header auf maximal 20 Zeichen — „Titel“ und „Aktion“ bleiben wörtlich', () => {
		render(<CompletedTasksTable {...defaultProps} />);

		const headers = within(screen.getByTestId('completed-kol-table'))
			.getAllByRole('columnheader')
			.map((th) => th.textContent ?? '');

		// Kopf-Reihenfolge wie heute: Titel · je Säule gekürzter Name · Aktion.
		expect(headers.length).toBe(pillars.length + 2);
		expect(headers[0]).toBe('Titel');
		expect(headers[headers.length - 1]).toBe('Aktion');

		// Der 33-Zeichen-Säulenname wird gekürzt (≤ 20 Zeichen, aber nicht der Volltext) …
		const longHeader = headers[1];
		expect(longHeader.length).toBeLessThanOrEqual(20);
		expect(longHeader).not.toBe(LONG_PILLAR_NAME);
		expect(longHeader.length).toBeGreaterThan(0);

		// … während kurze Säulennamen unverändert durchgereicht werden.
		expect(headers[2]).toBe('Karriere');
	});
});
