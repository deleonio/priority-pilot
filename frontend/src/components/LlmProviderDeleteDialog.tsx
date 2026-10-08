import type { LlmProvider } from 'client';
import type { RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
}: LlmProviderDeleteDialogProps) => {
	const { t } = useTranslation('settings');
	return (
		<ConfirmDeleteDialog
			title={t('llmProviderDeleteDialog.title')}
			body={
				<p>
					<Trans
						t={t}
						i18nKey="llmProviderDeleteDialog.body"
						values={{ name: provider.name, endpoint: provider.endpoint }}
						components={{ strong: <strong /> }}
					/>{' '}
					{provider.isActive ? t('llmProviderDeleteDialog.activeHint') : t('llmProviderDeleteDialog.irreversible')}
				</p>
			}
			confirmLabel={t('llmProviderDeleteDialog.confirm')}
			onConfirm={() => api.deleteLlmProvider({ id: provider.id })}
			onClose={onClose}
			onDeleted={onDeleted}
			fallbackFocusRef={fallbackFocusRef}
		/>
	);
};
