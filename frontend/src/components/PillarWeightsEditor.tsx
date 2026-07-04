import { KolAlert, KolButton, KolInputRange } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
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

interface PillarWeightsEditorProps {
	pillars: Pillar[];
	onSaved: () => void;
	onSavingChange?: (saving: boolean) => void;
	onClose?: () => void;
}

/**
 * Reiner Gewichtungs-Editor (ohne Modal-Hülle): Slider je Säule, Normierung beim Speichern.
 * Verwendbar in Modal- und Vollseiten-Kontext.
 */
export const PillarWeightsEditor = ({ pillars, onSaved, onSavingChange, onClose }: PillarWeightsEditorProps) => {
	const weights = useRef<(number | null)[]>(pillars.map((pillar) => weightToRaw(pillar.weight)));
	const [sum, setSum] = useState(() => sumWeights(weights.current));
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const distributionValid = isRawDistributionValid(weights.current);

	const save = async (): Promise<void> => {
		if (!isRawDistributionValid(weights.current)) {
			setError('Jedes Gewicht muss eine Zahl ≥ 0 sein und mindestens eine Säule muss > 0 sein.');
			return;
		}
		const normalized = normalizeToTotalWeight(weights.current.map((weight) => weight ?? 0));
		const entries = pillars.map((pillar, index) => ({ id: pillar.id, weight: normalized[index] }));

		setError(null);
		onSavingChange?.(true);
		setSaving(true);
		try {
			await api.setPillarWeights({
				pillarWeightsInput: { weights: entries },
			});
			onSaved();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			onSavingChange?.(false);
			setSaving(false);
		}
	};

	useCtrlEnter(() => void save(), !saving && pillars.length > 0 && distributionValid);

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
									_label={`${pillar.name}: ${formatNumber(weights.current[index] ?? 0)}`}
									_min={RAW_WEIGHT_MIN}
									_max={RAW_WEIGHT_MAX}
									_step={RAW_WEIGHT_STEP}
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
				{onClose && (
					<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onClose() }} />
				)}
			</div>
		</>
	);
};
