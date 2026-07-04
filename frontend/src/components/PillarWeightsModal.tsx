import { KolButton } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useState } from 'react';
import { Modal } from './Modal';
import { PillarWeightsEditor } from './PillarWeightsEditor';

interface PillarWeightsModalProps {
	pillars: Pillar[];
	onClose: () => void;
	onSaved: () => void;
}

export const PillarWeightsModal = ({ pillars, onClose, onSaved }: PillarWeightsModalProps) => {
	const [saving, setSaving] = useState(false);

	return (
		<Modal title="Säulen-Gewichtung" onClose={onClose}>
			<PillarWeightsEditor pillars={pillars} onSaved={onSaved} onSavingChange={(s) => setSaving(s)} />
			<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onClose() }} />
		</Modal>
	);
};
