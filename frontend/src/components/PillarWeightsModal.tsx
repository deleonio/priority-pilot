import type { Pillar } from 'client';
import { PillarWeightsForm } from './PillarWeightsForm';
import { Modal } from './Modal';

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
	return (
		<Modal title="Säulen-Gewichtung" onClose={onClose}>
			<PillarWeightsForm pillars={pillars} onSaved={onSaved} onCancel={onClose} />
		</Modal>
	);
};
