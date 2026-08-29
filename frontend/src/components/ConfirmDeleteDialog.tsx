import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { Modal } from './Modal';

interface ConfirmDeleteDialogProps {
	/** Überschrift des Dialogs (an `Modal` durchgereicht). */
	title: string;
	/** Fragetext des Dialogs. */
	body: ReactNode;
	/** Label des destruktiven Buttons (z. B. „Endgültig löschen“). */
	confirmLabel: string;
	/** Lösch-Aktion des Aufrufers (z. B. `api.deleteTask`). */
	onConfirm: () => Promise<void>;
	/** Schließen ohne Löschung. */
	onClose: () => void;
	/** Nach erfolgreichem Löschen aufgerufen (Liste neu laden + Dialog schließen). */
	onDeleted: () => void;
	/** Fallback-Fokusziel nach erfolgreichem Löschen, wenn der Trigger-Button nicht mehr im DOM ist. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
	/**
	 * Dritter Button für den Kaskaden-Fall (z. B. „Serie + alle Aufgaben“). Läuft — wie der
	 * Danger-Button — durch dieselbe Fehler-/`deleting`-Behandlung; ein async `onClick` wird
	 * abgewartet, obwohl der Vertrag `() => void` bleibt.
	 */
	secondaryAction?: { label: string; onClick: () => void };
	/**
	 * Wohin Strg+Enter (⌘+Enter) führt. `'confirm'` (Default) löst den Danger-Button aus.
	 * `'safeDefault'` bindet das Kürzel an die `secondaryAction` — für Dialoge mit zwei
	 * destruktiven Varianten (#553): die weiterreichende Kaskade darf nie per Tastenkürzel
	 * auslösbar sein. Ohne `secondaryAction` bleibt das Kürzel wirkungslos.
	 */
	hotkeyTarget?: 'confirm' | 'safeDefault';
}

/**
 * Gemeinsames Skelett aller Bestätigungs-Lösch-Dialoge (#1106): Fehler-Alert
 * „Löschen fehlgeschlagen“ (`toApiError`), `deleting`-Zustand (Buttons deaktiviert, Danger-Label
 * „Löschen…“), Strg+Enter-Konfirmation und einheitliche Button-Reihenfolge mit sicherem
 * Initialfokus (#472/#553): „Abbrechen“ steht vor dem Danger-Button und erhält den Initialfokus —
 * die irreversible Aktion ist nicht per Enter auslösbar.
 */
export const ConfirmDeleteDialog = ({
	title,
	body,
	confirmLabel,
	onConfirm,
	onClose,
	onDeleted,
	fallbackFocusRef,
	secondaryAction,
	hotkeyTarget = 'confirm',
}: ConfirmDeleteDialogProps) => {
	const [error, setError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	// „Abbrechen" ist der sicherere Initialfokus (#472): Die irreversible Aktion soll nicht per
	// Enter auslösbar sein, bevor der Nutzer den Fokus bewusst verlagert.
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	// Ein Wrapper für beide Lösch-Wege (Danger-Button und optionale Sekundär-Aktion): setzt
	// `deleting`, zeigt den Fehler des fehlgeschlagenen Versuchs und räumt den Zustand wieder auf.
	const run = async (action: () => Promise<void> | void): Promise<void> => {
		setError(null);
		setDeleting(true);
		try {
			await action();
			onDeleted();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setDeleting(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst den primären CTA aus, solange kein Löschen läuft. Im
	// Kaskaden-Fall (`hotkeyTarget="safeDefault"`, #553/#472) zeigt das Kürzel stattdessen auf den
	// sicheren Default (`secondaryAction`) — keine versehentliche Kaskade über das Tastenkürzel.
	const hotkeyAction =
		hotkeyTarget === 'confirm'
			? () => void run(onConfirm)
			: secondaryAction
				? () => void run(() => Promise.resolve(secondaryAction.onClick()))
				: undefined;
	useCtrlEnter(() => void hotkeyAction?.(), !deleting);

	return (
		<Modal
			title={title}
			onClose={onClose}
			fallbackFocusRef={fallbackFocusRef}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			{error !== null && (
				<KolAlert _type="error" _label="Löschen fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			{body}
			<div className="modal-actions">
				<KolButton
					ref={cancelRef}
					_label="Abbrechen"
					_variant="secondary"
					_disabled={deleting}
					_on={{ onClick: () => onClose() }}
				/>
				{secondaryAction && (
					<KolButton
						_label={secondaryAction.label}
						_variant="secondary"
						_disabled={deleting}
						_on={{ onClick: () => void run(() => Promise.resolve(secondaryAction.onClick())) }}
					/>
				)}
				<KolButton
					_label={deleting ? 'Löschen…' : confirmLabel}
					_variant="danger"
					_disabled={deleting}
					_on={{ onClick: () => void run(onConfirm) }}
				/>
			</div>
		</Modal>
	);
};
