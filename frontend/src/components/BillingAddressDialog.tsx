import { KolButton } from '@public-ui/react-v19';
import { useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { BillingAddressForm } from './BillingAddressForm';
import { Modal } from './Modal';

interface BillingAddressDialogProps {
	onClose: () => void;
}

/**
 * Kompakter Dialog „Rechnungsadresse" in der Abrechnungs-Sektion: Nutzer mit bestehendem Abo
 * pflegen ihre Anschrift ohne Bestellvorgang — dasselbe Formular wie im CheckoutDialog
 * (`BillingAddressForm`, EINE Quelle für Felder, Validierung, Laden und Speichern). Erfolgreiches
 * Speichern schließt den Dialog, Abbrechen verwirft die Eingaben.
 */
export const BillingAddressDialog = ({ onClose }: BillingAddressDialogProps) => {
	const { t } = useTranslation(['billing', 'common']);
	const cancelRef = useRef<HTMLKolButtonElement>(null);
	return (
		<Modal
			title={t('addressDialog.title')}
			onClose={onClose}
			initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
		>
			<p>{t('addressDialog.text')}</p>
			<BillingAddressForm onSaved={onClose} />
			<KolButton ref={cancelRef} _label={t('common:actions.cancel')} _variant="tertiary" _on={{ onClick: onClose }} />
		</Modal>
	);
};
