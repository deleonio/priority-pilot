import { act, cleanup, render, screen } from '@testing-library/react';
import { TaskStatus } from 'client';
import type { ChecklistItem, Task } from 'client';
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
	KolInputCheckbox: ({
		_label,
		_checked,
		_on,
	}: {
		_label?: string;
		_checked?: boolean;
		_on?: { onChange?: (_e: unknown, v: boolean) => void };
	}) => (
		<input
			type="checkbox"
			role="switch"
			aria-label={_label}
			checked={_checked ?? false}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.checked)}
		/>
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

const sampleTask = (checklist?: ChecklistItem[]): Task => ({
	id: 42,
	title: 'Kundenbericht fertigstellen',
	status: TaskStatus.Open,
	priority: 3,
	estimatedEffort: 0.5,
	isException: false,
	pinned: false,
	pillars: [],
	...(checklist !== undefined ? { checklist } : {}),
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

// #1465 löst #1346 AK5 ab: Der Dialog benennt die Aufgabe beim Titel, die interne ID entfällt.
describe('CompleteTaskDialog — Aufgabe wird beim Titel benannt, ohne ID (#1465)', () => {
	it('nennt den Titel und zeigt keine „#42"', async () => {
		await act(async () => {
			render(<CompleteTaskDialog task={sampleTask()} onConfirm={vi.fn()} onClose={vi.fn()} onCompleted={vi.fn()} />);
		});

		expect(screen.getByText(/Kundenbericht fertigstellen/)).toBeInTheDocument();
		expect(screen.queryByText(/#42/)).toBeNull();
	});
});

const twoItemChecklist = (): ChecklistItem[] => [
	{ id: 'a', title: 'Vertrag pruefen', completed: true },
	{ id: 'b', title: 'Rechnung stellen', completed: false },
];

// #1583 TF1 (AK2): Checklisten-Sektion zeigt beide Einträge, vorbelegt mit dem gespeicherten Stand,
// und lässt jeden Eintrag in beide Richtungen umschalten.
describe('CompleteTaskDialog — Checklisten-Sektion (#1583 TF1, AK2)', () => {
	it('zeigt beide Titel, vorbelegt mit dem gespeicherten Zustand, und kippt beide Richtungen', async () => {
		await act(async () => {
			render(
				<CompleteTaskDialog
					task={sampleTask(twoItemChecklist())}
					onConfirm={vi.fn()}
					onClose={vi.fn()}
					onCompleted={vi.fn()}
				/>,
			);
		});

		expect(screen.getByText('Vertrag pruefen')).toBeInTheDocument();
		expect(screen.getByText('Rechnung stellen')).toBeInTheDocument();

		const switches = screen.getAllByRole('switch') as HTMLInputElement[];
		expect(switches).toHaveLength(2);
		expect(switches[0].checked).toBe(true);
		expect(switches[1].checked).toBe(false);

		await act(async () => {
			switches[1].click();
		});
		expect((screen.getAllByRole('switch')[1] as HTMLInputElement).checked).toBe(true);

		await act(async () => {
			switches[0].click();
		});
		expect((screen.getAllByRole('switch')[0] as HTMLInputElement).checked).toBe(false);
	});
});

// #1583 TF2 (AK3): Sammel-Knopf hakt alle Einträge auf einmal ab.
describe('CompleteTaskDialog — Sammel-Knopf „Alle abhaken" (#1583 TF2, AK3)', () => {
	it('setzt beide Einträge auf abgehakt', async () => {
		await act(async () => {
			render(
				<CompleteTaskDialog
					task={sampleTask(twoItemChecklist())}
					onConfirm={vi.fn()}
					onClose={vi.fn()}
					onCompleted={vi.fn()}
				/>,
			);
		});

		await act(async () => {
			screen.getByRole('button', { name: 'Alle abhaken' }).click();
		});

		const switches = screen.getAllByRole('switch') as HTMLInputElement[];
		expect(switches[0].checked).toBe(true);
		expect(switches[1].checked).toBe(true);
	});
});

// #1583 TF3 (AK4): Hauptknopf ist nie deaktiviert und wechselt seine Beschriftung mit dem
// Checklisten-Zustand.
describe('CompleteTaskDialog — Hauptknopf-Beschriftung folgt dem Checklisten-Zustand (#1583 TF3, AK4)', () => {
	it('heißt „Checkliste speichern" bei offenem Eintrag, „Als erledigt markieren" wenn alles abgehakt ist', async () => {
		await act(async () => {
			render(
				<CompleteTaskDialog
					task={sampleTask(twoItemChecklist())}
					onConfirm={vi.fn()}
					onClose={vi.fn()}
					onCompleted={vi.fn()}
				/>,
			);
		});

		const mainButton = () => screen.getByRole('button', { name: /Checkliste speichern|Als erledigt markieren/ });
		expect(mainButton()).toHaveTextContent('Checkliste speichern');
		expect(mainButton()).not.toBeDisabled();

		await act(async () => {
			screen.getByRole('button', { name: 'Alle abhaken' }).click();
		});

		expect(mainButton()).toHaveTextContent('Als erledigt markieren');
		expect(mainButton()).not.toBeDisabled();
	});
});

// #1583 TF4 (AK5/AK6): Speichern ruft `onConfirm` mit dem aktuellen Checklisten-Zustand und der
// Done-Absicht (true nur, wenn beim Speichern alle Einträge abgehakt sind).
describe('CompleteTaskDialog — onConfirm-Vertrag Checkliste + Done-Absicht (#1583 TF4, AK5/AK6)', () => {
	it('ruft onConfirm ohne Done-Absicht, solange ein Eintrag offen ist', async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		await act(async () => {
			render(
				<CompleteTaskDialog
					task={sampleTask(twoItemChecklist())}
					onConfirm={onConfirm}
					onClose={vi.fn()}
					onCompleted={vi.fn()}
				/>,
			);
		});

		await act(async () => {
			screen.getByRole('button', { name: 'Checkliste speichern' }).click();
		});

		expect(onConfirm).toHaveBeenCalledWith(
			[
				{ id: 'a', title: 'Vertrag pruefen', completed: true },
				{ id: 'b', title: 'Rechnung stellen', completed: false },
			],
			false,
		);
	});

	it('ruft onConfirm mit Done-Absicht, wenn beim Speichern alle Einträge abgehakt sind', async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		await act(async () => {
			render(
				<CompleteTaskDialog
					task={sampleTask(twoItemChecklist())}
					onConfirm={onConfirm}
					onClose={vi.fn()}
					onCompleted={vi.fn()}
				/>,
			);
		});

		await act(async () => {
			screen.getByRole('button', { name: 'Alle abhaken' }).click();
		});
		await act(async () => {
			screen.getByRole('button', { name: 'Als erledigt markieren' }).click();
		});

		expect(onConfirm).toHaveBeenCalledWith(
			[
				{ id: 'a', title: 'Vertrag pruefen', completed: true },
				{ id: 'b', title: 'Rechnung stellen', completed: true },
			],
			true,
		);
	});
});

// #1583 TF5 (AK7): Abbrechen und das Schließen-X rufen ausschließlich onClose, nie onConfirm.
describe('CompleteTaskDialog — Abbrechen/Schließen ohne Persistenz (#1583 TF5, AK7)', () => {
	it('Abbrechen ruft onClose und nicht onConfirm', async () => {
		const onConfirm = vi.fn();
		const onClose = vi.fn();
		await act(async () => {
			render(
				<CompleteTaskDialog
					task={sampleTask(twoItemChecklist())}
					onConfirm={onConfirm}
					onClose={onClose}
					onCompleted={vi.fn()}
				/>,
			);
		});

		await act(async () => {
			screen.getByRole('button', { name: 'Abbrechen' }).click();
		});

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
	});
});
