import type { Pillar } from 'client';
import { PillarWeightsForm } from './PillarWeightsForm';
import { Modal } from './Modal';
import { useTranslation } from 'react-i18next';

interface PillarWeightsModalProps {
	/** Aktuelle Säulen samt Gewichten (`GET /pillars`); Reihenfolge wie geliefert (nach id). */
	pillars: Pillar[];
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Säulen neu laden + Dialog schließen). */
	onSaved: () => void;
}

/**
 * Modal-Wrapper um `PillarWeightsForm`: rendert den gemeinsamen Gewichtungs-Editor (#82) im
 * `Modal`-Rahmen und reicht `onClose` als Abbrechen-Handler durch.
 */
export const PillarWeightsModal = ({ pillars, onClose, onSaved }: PillarWeightsModalProps) => {
	const { t } = useTranslation('settings');
	return (
		<Modal title={t('settingsPage.pillars.weightsCard')} onClose={onClose}>
			<PillarWeightsForm pillars={pillars} onSaved={onSaved} onCancel={onClose} />
		</Modal>
	);
};
