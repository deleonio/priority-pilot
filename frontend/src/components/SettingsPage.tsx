import { KolButton, KolHeading, KolTabs } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useState } from 'react';
import { PillarWeightsForm } from './PillarWeightsForm';

interface SettingsPageProps {
	pillars: Pillar[];
	onBack: () => void;
	onSaved: () => void;
}

// Die Tab-Leiste der Settings-Seite (#271). Modulkonstante, damit `KolTabs` nicht bei jedem Render
// eine neue Tab-Liste erhält und die Auswahl zurücksetzt. Reihenfolge: Allgemein (Index 0), Säulen
// (Index 1).
const SETTINGS_TABS = [{ _label: 'Allgemein' }, { _label: 'Säulen' }];

/**
 * Einstellungen-Seite (#271) mit `KolTabs`-Navigation: „Allgemein" (Platzhalter) und „Säulen"
 * (Säulen-Gewichtungs-Editor). Der aktive Tab wird beim initialen Laden aus der URL abgeleitet:
 * `/settings/general` → Allgemein (0), alles andere (inkl. `/settings/pillars`) → Säulen (1).
 */
export const SettingsPage = ({ pillars, onBack, onSaved }: SettingsPageProps) => {
	// `_selected` genau EINMAL aus der URL berechnen (kein Setter): so setzt ein Re-Render den
	// gewählten Tab nicht auf den URL-Wert zurück, ein manueller Tab-Wechsel bleibt erhalten.
	const [activeTab] = useState(() => (window.location.pathname.startsWith('/settings/general') ? 0 : 1));

	return (
		<main className="settings-page">
			<header className="settings-page-header">
				<KolButton
					_label="Zurück"
					_icons={{ left: { icon: 'fa-solid fa-arrow-left' } }}
					_variant="secondary"
					_on={{ onClick: onBack }}
				/>
				<KolHeading _label="Priority Pilot" _level={1} />
			</header>

			<KolTabs className="settings-tabs" _label="Einstellungen" _tabs={SETTINGS_TABS} _selected={activeTab}>
				<div slot="tab-0">
					<p className="settings-placeholder">Allgemeine Einstellungen folgen in einem späteren Update.</p>
				</div>
				<div slot="tab-1">
					<PillarWeightsForm pillars={pillars} onSaved={onSaved} />
				</div>
			</KolTabs>
		</main>
	);
};
