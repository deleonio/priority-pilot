import { KolAlert, KolButton, KolInputRange } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readNumber } from '../lib/inputValue';
import { formatNumber } from '../lib/task';
import { TOTAL_WEIGHT, isWeightSumValid, sumWeights } from '../lib/pillar';
import { Modal } from './Modal';

interface PillarWeightsModalProps {
	/** Aktuelle Säulen samt Gewichten (`GET /pillars`); Reihenfolge wie geliefert (nach id). */
	pillars: Pillar[];
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Säulen neu laden + Dialog schließen). */
	onSaved: () => void;
}

/**
 * Gewichtungs-Editor für die 100 %-Verteilung über die Lebensbalance-Säulen: je Säule ein
 * Eingabefeld, eine **Live-Summe** und eine sichtbare Validierung (Summe = `TOTAL_WEIGHT`).
 * Gespeichert wird die gesamte Verteilung via `PUT /pillars/weights`.
 *
 * Die Eingaben liegen — wie im übrigen UI (siehe `TaskFormModal`) — in einem Ref, damit die
 * KoliBri-Felder ihren Anzeigewert selbst verwalten (kein Cursor-Springen). Für die Live-Summe wird
 * zusätzlich ein abgeleiteter `sum`-State bei jeder Eingabe nachgeführt.
 */
export const PillarWeightsModal = ({ pillars, onClose, onSaved }: PillarWeightsModalProps) => {
	// `null` erlaubt: ein geleertes Feld setzt den Eintrag auf `null`, damit die Validierung greift,
	// statt still den alten Wert weiterzuverwenden.
	const weights = useRef<(number | null)[]>(pillars.map((pillar) => pillar.weight));
	const [sum, setSum] = useState(() => sumWeights(weights.current));
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const sumValid = isWeightSumValid(sum);

	const save = async (): Promise<void> => {
		const entries = pillars.map((pillar, index) => ({ id: pillar.id, weight: weights.current[index] }));
		const invalid = entries.find(
			(entry) => entry.weight === null || !Number.isFinite(entry.weight) || entry.weight < 0,
		);
		if (invalid !== undefined) {
			setError('Jedes Gewicht muss eine Zahl ≥ 0 sein.');
			return;
		}
		if (!isWeightSumValid(sumWeights(weights.current))) {
			setError(`Die Summe der Gewichte muss ${TOTAL_WEIGHT} ergeben.`);
			return;
		}

		setError(null);
		setSaving(true);
		try {
			// `weight` ist hier durch die Validierung oben garantiert nicht-`null`.
			await api.setPillarWeights({
				pillarWeightsInput: { weights: entries.map((entry) => ({ id: entry.id, weight: entry.weight ?? 0 })) },
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
					<p className="hint">Verteile 100 % auf die Säulen. Die Summe muss genau {TOTAL_WEIGHT} ergeben.</p>
					<div className="form-grid">
						{pillars.map((pillar, index) => (
							<KolInputRange
								key={pillar.id}
								// Begrenzte Skala (0–100 %) → Slider. Der aktuelle Wert steht im Label, da ein reiner
								// Slider den exakten Prozentwert nicht anzeigt (relevant, weil die Summe genau 100 ergibt).
								_label={`${pillar.name}: ${formatNumber(weights.current[index] ?? 0)} %`}
								_min={0}
								_max={TOTAL_WEIGHT}
								_step={1}
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
							sumValid ? 'pillar-weights-sum pillar-weights-sum-ok' : 'pillar-weights-sum pillar-weights-sum-invalid'
						}
					>
						Summe: {formatNumber(sum)} % {sumValid ? '✓' : `(Soll: ${TOTAL_WEIGHT} %)`}
					</p>
				</>
			)}

			<div className="modal-actions">
				<KolButton
					_label={saving ? 'Speichern…' : 'Speichern'}
					_variant="primary"
					_disabled={saving || pillars.length === 0 || !sumValid}
					_on={{ onClick: () => void save() }}
				/>
				<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onClose() }} />
			</div>
		</Modal>
	);
};
