import type { Pillar } from 'client';
import { Modal } from './Modal';
import { PillarWeightsEditor } from './PillarWeightsEditor';

interface PillarWeightsModalProps {
	pillars: Pillar[];
	onClose: () => void;
	onSaved: () => void;
}

export const PillarWeightsModal = ({ pillars, onClose, onSaved }: PillarWeightsModalProps) => {
	return (
		<Modal title="Säulen-Gewichtung" onClose={onClose}>
			<PillarWeightsEditor pillars={pillars} onSaved={onSaved} onClose={onClose} />
		</Modal>
	);
};
