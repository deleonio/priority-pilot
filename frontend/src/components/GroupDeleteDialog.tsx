import { KolAlert, KolButton } from '@public-ui/react-v19';
import type { Group } from 'client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';

interface GroupDeleteDialogProps {
	/** Gruppe, die gelöscht werden soll. */
	group: Group;
	onClose: () => void;
	/** Nach erfolgreichem Löschen aufgerufen (Liste neu laden + Dialog schließen). */
	onDeleted: () => void;
	/** Fallback-Fokusziel nach erfolgreichem Löschen, wenn der Trigger-Button nicht mehr im DOM ist. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Sequenzielle Bestätigung vor dem Löschen einer Gruppe (#1211 AK7) nach
 * `docs/ux-pattern-sequential-confirmation.md`: Schritt 1 fragt die Absicht
 * („… wirklich löschen?"), Schritt 2 den Scope („inkl. aller Mitglieder-Einträge") —
 * erst dessen Bestätigen löst `DELETE /groups/{id}` aus. Der Bestätigen-Button von
 * Schritt 2 erhält beim Übergang den Fokus (verbindliche Fokus-Vorgabe des Patterns);
 * beim Öffnen liegt der Fokus wie in #472 auf „Abbrechen".
 */
export const GroupDeleteDialog = ({ group, onClose, onDeleted, fallbackFocusRef }: GroupDeleteDialogProps) => {
	const { t } = useTranslation(['groups', 'common']);
	const [step, setStep] = useState<'intent' | 'scope'>('intent');
	const [error, setError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	// Schritt-2-Bestätigung: erhält beim Übergang den Fokus (KoliBri `focus()` ist async).
	const confirmRef = useRef<HTMLKolButtonElement>(null);
	// Schritt-1-Abbrechen: Initialfokus beim Öffnen (#472 — irreversible Aktion nicht per Enter).
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	useEffect(() => {
		if (step === 'scope') {
			void confirmRef.current?.focus();
		}
	}, [step]);

	const deleteGroup = async (): Promise<void> => {
		setDeleting(true);
		setError(null);
		try {
			await api.deleteGroup({ id: group.id });
			onDeleted();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setDeleting(false);
		}
	};

	return (
		<Modal
			title={t('groups:deleteDialog.title')}
			onClose={onClose}
			fallbackFocusRef={fallbackFocusRef}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			{error !== null && (
				<KolAlert _type="error" _label={t('groups:deleteDialog.errorLabel')}>
					{error}
				</KolAlert>
			)}
			{step === 'intent' ? (
				<>
					<p>
						<Trans
							t={t}
							i18nKey="groups:deleteDialog.intent"
							values={{ name: group.name }}
							components={{ strong: <strong /> }}
						/>
					</p>
					<div className="modal-actions">
						<KolButton
							ref={cancelRef}
							_label={t('common:actions.cancel')}
							_variant="secondary"
							_disabled={deleting}
							_on={{ onClick: () => onClose() }}
						/>
						<KolButton
							_label={t('common:actions.delete')}
							_icons={{ left: { icon: 'fa-solid fa-trash' } }}
							_variant="danger"
							_disabled={deleting}
							_on={{ onClick: () => setStep('scope') }}
						/>
					</div>
				</>
			) : (
				<>
					<p>
						<Trans
							t={t}
							i18nKey="groups:deleteDialog.scope"
							values={{ name: group.name }}
							components={{ strong: <strong /> }}
						/>
					</p>
					<div className="modal-actions">
						<KolButton
							_label={t('common:actions.cancel')}
							_variant="secondary"
							_disabled={deleting}
							_on={{ onClick: () => onClose() }}
						/>
						<KolButton
							ref={confirmRef}
							_label={t('groups:deleteDialog.confirm')}
							_icons={{ left: { icon: 'fa-solid fa-trash' } }}
							_variant="danger"
							_disabled={deleting}
							_on={{ onClick: () => void deleteGroup() }}
						/>
					</div>
				</>
			)}
		</Modal>
	);
};
