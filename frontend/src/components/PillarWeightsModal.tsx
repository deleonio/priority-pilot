import { KolButton } from '@public-ui/react-v19';
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
			<PillarWeightsEditor pillars={pillars} onSaved={onSaved} />
			<KolButton _label="Abbrechen" _variant="secondary" _on={{ onClick: () => onClose() }} />
		</Modal>
	);
};
