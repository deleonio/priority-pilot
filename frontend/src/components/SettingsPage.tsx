import { KolAlert, KolButton, KolHeading, KolInputRange, KolTabs } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readNumber } from '../lib/inputValue';
import {
	RAW_WEIGHT_MAX,
	RAW_WEIGHT_MIN,
	RAW_WEIGHT_STEP,
	isRawDistributionValid,
	normalizeToTotalWeight,
	sumWeights,
	weightToRaw,
} from '../lib/pillar';
import { formatNumber } from '../lib/task';

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
 * Inline-Editor für die Säulen-Gewichtung (#271) — die Logik stammt aus `PillarWeightsModal`, hier
 * aber ohne Modal-Wrapper direkt im Säulen-Tab. Beim Speichern werden die Rohwerte (0,0–1,0) auf die
 * interne 100-%-Verteilung normiert und via `PUT /pillars/weights` abgelegt.
 */
const PillarWeightsEditor = ({ pillars, onSaved }: { pillars: Pillar[]; onSaved: () => void }) => {
	// Rohwerte 0,0–1,0 in einem Ref, damit die KoliBri-Felder ihren Anzeigewert selbst verwalten
	// (kein Cursor-Springen). `null` erlaubt: ein geleertes Feld setzt den Eintrag auf `null`.
	const weights = useRef<(number | null)[]>(pillars.map((pillar) => weightToRaw(pillar.weight)));
	const [sum, setSum] = useState(() => sumWeights(weights.current));
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// Gültig, sobald jeder Wert ≥ 0 ist und mindestens einer > 0 (sonst nicht auf 100 % normierbar).
	const distributionValid = isRawDistributionValid(weights.current);

	const save = async (): Promise<void> => {
		if (!isRawDistributionValid(weights.current)) {
			setError('Jedes Gewicht muss eine Zahl ≥ 0 sein und mindestens eine Säule muss > 0 sein.');
			return;
		}
		// Durch die Validierung oben sind alle Werte nicht-`null`; vor dem Speichern auf 100 % normieren.
		const normalized = normalizeToTotalWeight(weights.current.map((weight) => weight ?? 0));
		const entries = pillars.map((pillar, index) => ({ id: pillar.id, weight: normalized[index] }));

		setError(null);
		setSaving(true);
		try {
			await api.setPillarWeights({
				pillarWeightsInput: { weights: entries },
			});
			onSaved();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setSaving(false);
		}
	};

	return (
		<>
			{error !== null && (
				<KolAlert _type="error" _label="Speichern fehlgeschlagen">
					{error}
				</KolAlert>
			)}

			{pillars.length === 0 ? (
				<p>Keine Säulen vorhanden.</p>
			) : (
				<>
					<p className="hint">
						Gib je Säule einen Wert von 0,0 bis 1,0 ein. Die Werte werden beim Speichern automatisch auf 100 % normiert
						— die absolute Skala ist egal (5 × 0,1 ergibt dasselbe wie 5 × 1).
					</p>
					<div className="form-grid">
						{pillars.map((pillar, index) => (
							<div key={pillar.id} className="pillar-weight-row">
								<KolInputRange
									// Freie Roh-Skala 0,0–1,0 → Slider. Der aktuelle Wert steht im Label, da ein reiner
									// Slider den exakten Wert nicht anzeigt.
									_label={`${pillar.name}: ${formatNumber(weights.current[index] ?? 0)}`}
									_min={RAW_WEIGHT_MIN}
									_max={RAW_WEIGHT_MAX}
									_step={RAW_WEIGHT_STEP}
									// An den Ref-Wert binden (nicht den statischen `pillar.weight`): die Komponente rendert
									// bei jeder Eingabe neu (`setSum`), sonst würde `_value` pro Tastendruck zurückgesetzt.
									_value={weights.current[index] ?? undefined}
									_on={{
										onInput: (_event, value) => {
											weights.current[index] = readNumber(value);
											setSum(sumWeights(weights.current));
										},
										onChange: (_event, value) => {
											weights.current[index] = readNumber(value);
											setSum(sumWeights(weights.current));
										},
									}}
								/>
								{/* Kurzbeschreibung der Säule (globale Stammdaten) — hilft, beim Gewichten
								    sofort zu sehen, wofür die jeweilige Säule steht. */}
								<p className="hint pillar-description">{pillar.description}</p>
							</div>
						))}
					</div>
					<p
						className={
							distributionValid
								? 'pillar-weights-sum pillar-weights-sum-ok'
								: 'pillar-weights-sum pillar-weights-sum-invalid'
						}
					>
						Summe der Rohwerte: {formatNumber(sum)}{' '}
						{distributionValid ? '✓ (wird auf 100 % normiert)' : '(mindestens eine Säule muss > 0 sein)'}
					</p>
				</>
			)}

			<div className="modal-actions">
				<KolButton
					_label={saving ? 'Speichern…' : 'Speichern'}
					_variant="primary"
					_disabled={saving || pillars.length === 0 || !distributionValid}
					_on={{ onClick: () => void save() }}
				/>
			</div>
		</>
	);
};

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
					<PillarWeightsEditor pillars={pillars} onSaved={onSaved} />
				</div>
			</KolTabs>
		</main>
	);
};
