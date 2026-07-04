import { KolAlert, KolButton, KolHeading, KolInputCheckbox, KolTabs } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useState } from 'react';
import { requestMicrophonePermission } from '../lib/micPermission';
import { useVoiceAutostart } from '../lib/voiceAutostart';
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

	// #272: Schalter „Sprachaufnahme automatisch starten" (Default aus). Beim Einschalten wird die
	// Mikrofon-Berechtigung angefordert; nur bei erteilter Berechtigung wird die Einstellung aktiviert
	// und persistiert. Wird sie verweigert, bleibt der Schalter aus und ein Hinweis erscheint.
	const { enabled: voiceAutostart, setEnabled: setVoiceAutostart } = useVoiceAutostart();
	const [micDenied, setMicDenied] = useState(false);

	const onToggleVoiceAutostart = async (next: boolean): Promise<void> => {
		if (!next) {
			setVoiceAutostart(false);
			setMicDenied(false);
			return;
		}
		const granted = await requestMicrophonePermission();
		if (granted) {
			setVoiceAutostart(true);
			setMicDenied(false);
		} else {
			// Berechtigung verweigert → Einstellung nicht aktivieren, Hinweis zeigen.
			setVoiceAutostart(false);
			setMicDenied(true);
		}
	};

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
				<div slot="tab-0" className="settings-general">
					<KolInputCheckbox
						_label="Sprachaufnahme automatisch starten"
						_variant="switch"
						_checked={voiceAutostart}
						_hint="Beim Öffnen der Formulare zum Anlegen und Bearbeiten von Tasks und Serien wird das erste Eingabefeld fokussiert und dessen Mikrofon automatisch gestartet."
						_on={{
							onChange: (_event, value) => {
								void onToggleVoiceAutostart(value === true);
							},
						}}
					/>
					{micDenied && (
						<KolAlert _type="warning" _label="Mikrofon-Zugriff verweigert">
							Der Zugriff auf das Mikrofon wurde verweigert. Die automatische Sprachaufnahme bleibt deaktiviert. Bitte
							erteile die Berechtigung im Browser und versuche es erneut.
						</KolAlert>
					)}
				</div>
				<div slot="tab-1">
					<PillarWeightsForm pillars={pillars} onSaved={onSaved} />
				</div>
			</KolTabs>
		</main>
	);
};
