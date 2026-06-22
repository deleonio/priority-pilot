import { KolAlert, KolButton, KolInputRange } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readNumber } from '../lib/inputValue';
import { formatNumber } from '../lib/task';
import {
	RAW_WEIGHT_MAX,
	RAW_WEIGHT_MIN,
	RAW_WEIGHT_STEP,
	isRawDistributionValid,
	normalizeToTotalWeight,
	sumWeights,
	weightToRaw,
} from '../lib/pillar';
import { Modal } from './Modal';

interface PillarWeightsModalProps {
	/** Aktuelle Säulen samt Gewichten (`GET /pillars`); Reihenfolge wie geliefert (nach id). */
	pillars: Pillar[];
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Säulen neu laden + Dialog schließen). */
	onSaved: () => void;
}

/**
 * Gewichtungs-Editor für die Lebensbalance-Säulen: je Säule ein freier Rohwert von **0,0 bis 1,0**
 * (#82) statt einer Verteilung, die exakt 100 % ergeben muss. Beim Speichern werden die Rohwerte auf
 * die interne 100-%-Verteilung **normiert** (`normalizeToTotalWeight`) und via `PUT /pillars/weights`
 * abgelegt — die gespeicherte Repräsentation und damit das Ranking bleiben unverändert.
 *
 * Die Eingaben liegen — wie im übrigen UI (siehe `TaskFormModal`) — in einem Ref, damit die
 * KoliBri-Felder ihren Anzeigewert selbst verwalten (kein Cursor-Springen). Für die Live-Summe wird
 * zusätzlich ein abgeleiteter `sum`-State bei jeder Eingabe nachgeführt.
 */
export const PillarWeightsModal = ({ pillars, onClose, onSaved }: PillarWeightsModalProps) => {
	// Rohwerte 0,0–1,0: der gespeicherte Prozentwert wird für die Anzeige zurückgerechnet (#82).
	// `null` erlaubt: ein geleertes Feld setzt den Eintrag auf `null`, damit die Validierung greift,
	// statt still den alten Wert weiterzuverwenden.
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
		<Modal title="Säulen-Gewichtung" onClose={onClose}>
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
							<KolInputRange
								key={pillar.id}
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
				<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onClose() }} />
			</div>
		</Modal>
	);
};
