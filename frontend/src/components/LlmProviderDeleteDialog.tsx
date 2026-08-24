import { KolAlert, KolButton } from '@public-ui/react-v19';
import type { LlmProvider } from 'client';
import { useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { Modal } from './Modal';

interface LlmProviderDeleteDialogProps {
	provider: LlmProvider;
	onClose: () => void;
	/** Nach erfolgreichem Löschen aufgerufen (Liste neu laden + Dialog schließen). */
	onDeleted: () => void;
	/** Fallback-Fokusziel nach erfolgreichem Löschen, wenn der Trigger-Button nicht mehr im DOM ist. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Bestätigungsdialog vor dem Löschen eines Custom-Providers — Muster: `DeleteTaskDialog`.
 * Built-in-Provider (Mistral/OpenRouter) sind nicht löschbar und erreichen diesen Dialog
 * nicht. Ist der gelöschte Provider der aktive, übernimmt automatisch der Built-in-Fallback
 * (Mistral vor OpenRouter) — die KI-Features laufen dann damit weiter.
 */
export const LlmProviderDeleteDialog = ({
	provider,
	onClose,
	onDeleted,
	fallbackFocusRef,
}: LlmProviderDeleteDialogProps) => {
	const [error, setError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	// „Abbrechen" ist der sicherere Initial-Fokus (#472): Die irreversible „Endgültig löschen"-
	// Aktion soll nicht per Enter auslösbar sein, bevor der Nutzer den Fokus bewusst verlagert.
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	const confirm = async (): Promise<void> => {
		setError(null);
		setDeleting(true);
		try {
			await api.deleteLlmProvider({ id: provider.id });
			onDeleted();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setDeleting(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst den primären CTA aus, solange kein Löschen läuft.
	useCtrlEnter(() => void confirm(), !deleting);

	return (
		<Modal
			title="Provider löschen"
			onClose={onClose}
			fallbackFocusRef={fallbackFocusRef}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			{error !== null && (
				<KolAlert _type="error" _label="Löschen fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<p>
				Soll der Provider <strong>„{provider.name}“</strong> ({provider.endpoint}) wirklich gelöscht werden?{' '}
				{provider.isActive
					? 'Er ist der AKTIVE Provider — danach übernimmt automatisch der Fallback (Mistral vor OpenRouter, je nach Server-ENV).'
					: 'Diese Aktion kann nicht rückgängig gemacht werden.'}
			</p>
			<div className="modal-actions">
				<KolButton
					_label="Endgültig löschen"
					_variant="danger"
					_disabled={deleting}
					_on={{ onClick: () => void confirm() }}
				/>
				<KolButton
					_label="Abbrechen"
					_variant="secondary"
					_disabled={deleting}
					ref={cancelRef}
					_on={{ onClick: () => onClose() }}
				/>
			</div>
		</Modal>
	);
};
