import { KolAlert, KolButton } from '@public-ui/react-v19';
import { ResponseError } from 'client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { clearPlanMirror } from '../lib/usePlan';
import { Modal } from './Modal';

/** Gründe, aus denen der Server die Löschung mit 409 ablehnt (`code` im Fehler-Body). */
const REFUSAL_CODES = ['subscription_active', 'last_group_admin'] as const;
type RefusalCode = (typeof REFUSAL_CODES)[number];

const refusalCode = (reason: unknown): RefusalCode | null => {
	const code = reason instanceof ResponseError ? (reason.body as { code?: unknown } | undefined)?.code : undefined;
	return REFUSAL_CODES.find((known) => known === code) ?? null;
};

interface DeleteAccountDialogProps {
	onClose: () => void;
	/** Nach erfolgreichem Löschen: Aufräumen und Wechsel zur Login-Seite. */
	onDeleted: () => void;
}

/**
 * Konto löschen (#1676, Play-Pflicht) als sequenzielle Bestätigung nach
 * `docs/ux-pattern-sequential-confirmation.md`: Schritt 1 fragt die Absicht, Schritt 2 nennt den
 * Umfang, erst dessen Bestätigen ruft `DELETE /auth/me`. Initialfokus auf „Abbrechen", beim
 * Übergang auf „Endgültig löschen" (Muster `GroupDeleteDialog`). Lehnt der Server ab, erklärt der
 * Dialog Grund und nächsten Schritt in der Sprache des Nutzers.
 */
const DeleteAccountDialog = ({ onClose, onDeleted }: DeleteAccountDialogProps) => {
	const { t } = useTranslation('messages');
	const [step, setStep] = useState<'intent' | 'scope'>('intent');
	const [error, setError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);
	const cancelRef = useRef<HTMLKolButtonElement>(null);
	const confirmRef = useRef<HTMLKolButtonElement>(null);

	useEffect(() => {
		if (step === 'scope') {
			void confirmRef.current?.focus();
		}
	}, [step]);

	const deleteAccount = async (): Promise<void> => {
		setDeleting(true);
		setError(null);
		try {
			await api.deleteAccount();
			onDeleted();
		} catch (reason) {
			const code = refusalCode(reason);
			setError(code === null ? (await toApiError(reason)).message : t(`accountDelete.refused.${code}`));
			setDeleting(false);
		}
	};

	const cancelButton = (ref?: RefObject<HTMLKolButtonElement | null>) => (
		<KolButton
			ref={ref}
			_label={t('accountDelete.cancel')}
			_variant="secondary"
			_disabled={deleting}
			_on={{ onClick: () => onClose() }}
		/>
	);

	return (
		<Modal
			title={t('accountDelete.title')}
			onClose={onClose}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			{error !== null && (
				<KolAlert _type="error" _label={t('accountDelete.refusedLabel')} data-testid="delete-account-error">
					{error}
				</KolAlert>
			)}
			{step === 'intent' ? (
				<>
					<p>{t('accountDelete.intent')}</p>
					<div className="modal-actions">
						{cancelButton(cancelRef)}
						<KolButton _label={t('accountDelete.next')} _variant="danger" _on={{ onClick: () => setStep('scope') }} />
					</div>
				</>
			) : (
				<>
					<p>{t('accountDelete.scope')}</p>
					<div className="modal-actions">
						{cancelButton()}
						<KolButton
							ref={confirmRef}
							_label={deleting ? t('accountDelete.busy') : t('accountDelete.confirm')}
							_variant="danger"
							_disabled={deleting}
							_on={{ onClick: () => void deleteAccount() }}
						/>
					</div>
				</>
			)}
		</Modal>
	);
};

/**
 * „Konto löschen" in der Konto-Karte der Einstellungen. Nach dem Löschen räumt es auf wie der
 * Logout in `App.tsx`: Paket-Spiegel weg, stiller Re-Login gesperrt, weiter zur Login-Seite.
 */
export const DeleteAccountButton = ({ userId }: { userId?: number }) => {
	const { t } = useTranslation('messages');
	const [open, setOpen] = useState(false);

	const leave = (): void => {
		if (userId !== undefined) {
			clearPlanMirror(userId);
		}
		sessionStorage.setItem('pp_just_logged_out', '1');
		window.location.href = `${import.meta.env.BASE_URL}login`;
	};

	return (
		<>
			<KolButton
				className="settings-action-btn"
				data-testid="delete-account"
				_label={t('accountDelete.title')}
				_variant="danger"
				_on={{ onClick: () => setOpen(true) }}
			/>
			{open && <DeleteAccountDialog onClose={() => setOpen(false)} onDeleted={leave} />}
		</>
	);
};
