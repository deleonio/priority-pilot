import { KolButton, KolHeading } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { PillarWeightsEditor } from './PillarWeightsEditor';

interface SettingsPageProps {
	pillars: Pillar[];
	onBack: () => void;
	onSaved: () => void;
}

export const SettingsPage = ({ pillars, onBack, onSaved }: SettingsPageProps) => {
	return (
		<main className="help-page">
			<header className="help-page-header">
				<KolButton
					_label="Zurück"
					_icons={{ left: { icon: 'fa-solid fa-arrow-left' } }}
					_variant="secondary"
					_on={{ onClick: onBack }}
				/>
			</header>
			<div className="help-page-content">
				<KolHeading _label="Säulen-Gewichtung" _level={2} />
				<PillarWeightsEditor pillars={pillars} onSaved={onSaved} />
			</div>
		</main>
	);
};
