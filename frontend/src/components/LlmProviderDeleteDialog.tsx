import type { LlmProvider } from 'client';
import type { RefObject } from 'react';
import { api } from '../api';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

interface LlmProviderDeleteDialogProps {
	provider: LlmProvider;
	onClose: () => void;
	/** Nach erfolgreichem Löschen aufgerufen (Liste neu laden + Dialog schließen). */
	onDeleted: () => void;
	/** Fallback-Fokusziel nach erfolgreichem Löschen, wenn der Trigger-Button nicht mehr im DOM ist. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Bestätigungsdialog vor dem Löschen eines Custom-Providers. Built-in-Provider (Mistral/OpenRouter)
 * sind nicht löschbar und erreichen diesen Dialog nicht. Ist der gelöschte Provider der aktive,
 * übernimmt automatisch der Built-in-Fallback (Mistral vor OpenRouter) — die KI-Features laufen
 * dann damit weiter.
 */
export const LlmProviderDeleteDialog = ({
	provider,
	onClose,
	onDeleted,
	fallbackFocusRef,
}: LlmProviderDeleteDialogProps) => (
	<ConfirmDeleteDialog
		title="Provider löschen"
		body={
			<p>
				Soll der Provider <strong>„{provider.name}“</strong> ({provider.endpoint}) wirklich gelöscht werden?{' '}
				{provider.isActive
					? 'Er ist der AKTIVE Provider — danach übernimmt automatisch der Fallback (Mistral vor OpenRouter, je nach Server-ENV).'
					: 'Diese Aktion kann nicht rückgängig gemacht werden.'}
			</p>
		}
		confirmLabel="Endgültig löschen"
		onConfirm={() => api.deleteLlmProvider({ id: provider.id })}
		onClose={onClose}
		onDeleted={onDeleted}
		fallbackFocusRef={fallbackFocusRef}
	/>
);
