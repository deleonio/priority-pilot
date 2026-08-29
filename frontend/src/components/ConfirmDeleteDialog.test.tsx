import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode, RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1106 — gemeinsamer Bestätigungs-Lösch-Dialog.
 *
 * Spezifikation: `docs/spec/issue-1106.md`. Die Komponente `ConfirmDeleteDialog` existiert noch
 * nicht — der fehlende Export ist der legitime erste rote Zustand. Sobald sie implementiert ist,
 * wird sichergestellt, dass alle vier Lösch-Dialoge dasselbe Skelett teilen: Fehler-Alert
 * „Löschen fehlgeschlagen", `deleting`-Zustand, Initialfokus auf dem nicht-destruktiven Button
 * (#472/#553) und einheitliche Button-Reihenfolge (Abbrechen zuerst, Danger zuletzt).
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
		_variant,
		_disabled,
		_on,
		// React 19: `ref` ist ein normaler Prop — so landet der Button selbst im Ref
		// (im Echt-Code der KoliBri-Host), was die Fokus-Assertion erlaubt.
		ref,
	}: {
		_label?: string;
		_variant?: string;
		_disabled?: boolean;
		_on?: { onClick?: (_e: MouseEvent) => void };
		ref?: RefObject<HTMLButtonElement | null>;
	}) => (
		<button data-variant={_variant} disabled={_disabled} onClick={(e) => _on?.onClick?.(e.nativeEvent)} ref={ref}>
			{_label}
		</button>
	),
}));

// Modal wird gemockt (wie in DeleteTaskDialog.test.tsx), aber die Props gecaptured, um den
// Durchreich-Vertrag (`title`, `fallbackFocusRef`, `initialFocusRef`) zu prüfen.
type ModalProps = {
	title?: string;
	fallbackFocusRef?: RefObject<HTMLElement | null>;
	initialFocusRef?: RefObject<HTMLElement | null>;
	children?: ReactNode;
};
let modalProps: ModalProps | undefined;
vi.mock('./Modal', () => ({
	Modal: (props: ModalProps) => {
		modalProps = props;
		return <div data-testid="modal">{props.children}</div>;
	},
}));

const useCtrlEnter = vi.fn();
vi.mock('../lib/useCtrlEnter', () => ({
	useCtrlEnter: (cb: () => void, enabled: boolean) => useCtrlEnter(cb, enabled),
}));

const toApiError = vi.fn();
vi.mock('../lib/apiError', () => ({ toApiError: (reason: unknown) => toApiError(reason) }));

import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

afterEach(() => {
	cleanup();
	modalProps = undefined;
	vi.clearAllMocks();
});

const setup = (
	onConfirm: () => Promise<void> = vi.fn().mockResolvedValue(undefined),
	secondaryAction?: { label: string; onClick: () => void },
) => {
	const onClose = vi.fn();
	const onDeleted = vi.fn();
	const fallbackFocusRef: RefObject<HTMLElement | null> = { current: null };
	render(
		<ConfirmDeleteDialog
			title="Task löschen"
			body={<p>Soll der Task wirklich gelöscht werden?</p>}
			confirmLabel="Endgültig löschen"
			onConfirm={onConfirm}
			onClose={onClose}
			onDeleted={onDeleted}
			fallbackFocusRef={fallbackFocusRef}
			secondaryAction={secondaryAction}
		/>,
	);
	return { onClose, onDeleted, fallbackFocusRef };
};

describe('ConfirmDeleteDialog (#1106, docs/spec/issue-1106.md)', () => {
	it('AK1/AK4: rendert Abbrechen vor dem Danger-Button und reicht title/fallbackFocusRef/initialFocusRef an Modal durch', () => {
		setup();

		const buttons = screen.getAllByRole('button');
		expect(buttons).toHaveLength(2);
		expect(buttons[0]).toHaveTextContent('Abbrechen');
		expect(buttons[1]).toHaveTextContent('Endgültig löschen');
		// Der nicht-destruktive Button ist kein Danger-Button (#1106 AK4).
		expect(buttons[0].dataset.variant).not.toBe('danger');

		expect(modalProps?.title).toBe('Task löschen');
		// #472: Der Ref für den Initialfokus zeigt auf den Abbrechen-Button, nicht auf den Danger-Button.
		expect(modalProps?.initialFocusRef).toBeDefined();
		expect(modalProps?.initialFocusRef?.current).toBe(buttons[0]);
		expect(modalProps?.fallbackFocusRef).toBeDefined();
	});

	it('AK1: Abbrechen schließt ohne Löschung', () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		const { onClose, onDeleted } = setup(onConfirm);

		fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();
		expect(onDeleted).not.toHaveBeenCalled();
	});

	it('AK1: Erfolg ruft onConfirmed → onDeleted, ohne Fehler-Alert', async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		const { onDeleted } = setup(onConfirm);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
		});

		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onDeleted).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('AK1: während des Löschens sind alle Buttons deaktiviert und das Danger-Label zeigt „Löschen…“', async () => {
		let resolveConfirm: () => void = () => undefined;
		const onConfirm = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveConfirm = resolve;
				}),
		);
		setup(onConfirm);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
		});

		const buttons = screen.getAllByRole('button');
		expect(buttons.map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, true]);
		expect(screen.getByRole('button', { name: 'Löschen…' })).toBeDefined();

		await act(async () => {
			resolveConfirm();
		});
	});

	it('AK1: Fehlschlag zeigt KolAlert „Löschen fehlgeschlagen“ mit der toApiError-Meldung und hebt `deleting` wieder auf', async () => {
		const onConfirm = vi.fn().mockRejectedValue(new Error('boom'));
		toApiError.mockResolvedValue({ message: 'Netzwerkfehler' });
		setup(onConfirm);

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
		});

		expect(toApiError).toHaveBeenCalledTimes(1);
		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent('Löschen fehlgeschlagen');
		expect(alert).toHaveTextContent('Netzwerkfehler');
		// Nach dem Fehlschlag ist der Danger-Button wieder aktiv (zweiter Versuch möglich).
		const danger = screen.getByRole('button', { name: 'Endgültig löschen' }) as HTMLButtonElement;
		expect(danger.disabled).toBe(false);
	});

	it('AK1: `secondaryAction` (Kaskaden-Fall) rendert einen dritten Button, Reihenfolge bleibt Abbrechen zuerst / Danger zuletzt', () => {
		const secondary = vi.fn();
		setup(undefined, { label: 'Ja (Serie + alle Aufgaben)', onClick: secondary });

		const buttons = screen.getAllByRole('button');
		expect(buttons).toHaveLength(3);
		expect(buttons[0]).toHaveTextContent('Abbrechen');
		expect(buttons[1]).toHaveTextContent('Ja (Serie + alle Aufgaben)');
		expect(buttons[2]).toHaveTextContent('Endgültig löschen');

		fireEvent.click(screen.getByRole('button', { name: 'Ja (Serie + alle Aufgaben)' }));
		expect(secondary).toHaveBeenCalledTimes(1);
	});

	it('AK1: Strg+Enter löst die Konfirmation aus', async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		setup(onConfirm);

		expect(useCtrlEnter).toHaveBeenCalled();
		const ctrlEnterHandler = useCtrlEnter.mock.calls.at(-1)?.[0] as () => void;
		await act(async () => {
			ctrlEnterHandler();
		});

		expect(onConfirm).toHaveBeenCalledTimes(1);
	});
});
