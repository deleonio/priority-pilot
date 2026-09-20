import { KolAlert, KolButton, KolInputRange } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { readNumber } from '../lib/inputValue';
import { formatNumber } from '../lib/task';
import {
	SHARE_MIN,
	SHARE_STEP,
	fillContributions,
	isDistributionUnbalanced,
	redistributeShares,
	shareMax,
} from '../lib/pillar';
import { Modal } from './Modal';

interface PillarWeightsFormProps {
	/** Aktuelle Säulen samt Gewichten (`GET /pillars`); Reihenfolge wie geliefert (nach id). */
	pillars: Pillar[];
	/** Nach erfolgreichem Speichern aufgerufen (Säulen neu laden + ggf. Dialog schließen). */
	onSaved: () => void;
	/** Optionaler Abbrechen-Handler; nur wenn gesetzt, wird der „Abbrechen"-Button gerendert (Modal). */
	onCancel?: () => void;
}

/** #1555-Hinweistext — wortgleich im Formular-Alert und im #1574-Bestätigungs-Modal. */
const UNBALANCED_HINT =
	'Diese Verteilung weicht stark vom gleichmäßigen Zustand ab — Säulen sind üblicherweise eher ausgeglichen gewichtet. Das ist nur ein Hinweis: Du kannst trotzdem speichern.';

/**
 * Gemeinsame Gewichtungs-Formularlogik für die Lebensbalance-Säulen: eine 100-%-Verteilung über die
 * fünf festen Säulen (#1596, Muster wie die Säulen-Verteilung im Aufgabenformular). Je Säule ein
 * Prozent-Regler; ein Zug verschiebt die anderen Säulen proportional mit, sodass die Summe immer
 * 100 % ergibt. Unter den Mindestanteil (`SHARE_MIN`) fällt keine Säule. Gespeichert wird via
 * `PUT /pillars/weights` — die serverseitige Repräsentation und damit das Ranking bleiben
 * unverändert.
 *
 * Wird von `PillarWeightsModal` (mit Abbrechen) und der Settings-Seite (#271, ohne Abbrechen)
 * genutzt.
 */
export const PillarWeightsForm = ({ pillars, onSaved, onCancel }: PillarWeightsFormProps) => {
	// Prozentwerte (0–100) je Säule, Summe stets 100. Der gespeicherte Stand wird beim Mount über
	// `fillContributions` auf ganzzahlige Anteile ≥ `SHARE_MIN` gebracht — Altbestände, die den
	// Mindestanteil unterschreiten, rücken damit beim ersten Speichern glatt.
	const [weights, setWeights] = useState<number[]>(() =>
		fillContributions(
			pillars,
			pillars.map((pillar) => ({ pillarId: pillar.id, share: pillar.weight, confidence: 100 })),
		).map((entry) => entry.share),
	);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	// #1574: Bestätigungs-Modal für stark unausgewogene Verteilungen — `true` heißt „offen",
	// geschlossen wird per `setConfirmOpen(false)` (Button, Esc, Backdrop via `Modal.onClose`).
	const [confirmOpen, setConfirmOpen] = useState(false);

	// „Abbrechen" im Bestätigungs-Modal ist der sicherere Initialfokus (#472-Muster aus
	// ConfirmDeleteDialog): Bestätigen soll nicht versehentlich per Enter auslösbar sein.
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	// Obergrenze eines einzelnen Reglers: Was bleibt, wenn alle anderen Säulen am Mindestanteil
	// stehen (bei fünf Säulen 80 %).
	const weightCeiling = shareMax(weights.length);

	// #1555: rein informativer Hinweis auf starke Unausgewogenheit (Anteil > 2× oder < ½ des
	// gleichmäßigen Anteils) — blockiert das Speichern nicht, fragt seit #1574 aber nach.
	const unbalanced = isDistributionUnbalanced(weights);

	// Ein Reglerzug verschiebt die ganze Verteilung: Die anderen Säulen ziehen proportional nach,
	// die Summe bleibt 100 % (#1596).
	const setWeight = (index: number, next: number | null): void => {
		if (next === null) {
			return;
		}
		setWeights((prev) => redistributeShares(prev, index, next));
	};

	// Der eigentliche Speichervorgang (PUT) — vom #1574-Gate in `save()` entkoppelt, damit der
	// Bestätigungspfad denselben Code unmittelbar (ohne Wartefrist, AK5) auslösen kann.
	const performSave = async (): Promise<void> => {
		const entries = pillars.map((pillar, index) => ({ id: pillar.id, weight: weights[index] }));

		setError(null);
		setSaving(true);
		try {
			await api.setPillarWeights({
				pillarWeightsInput: { weights: entries },
			});
			// `setSaving(false)` auch im Erfolgsfall: die Settings-Seite unmountet nicht (anders als das
			// Modal), sonst bliebe der Speichern-Button dauerhaft deaktiviert.
			setSaving(false);
			onSaved();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setSaving(false);
		}
	};

	// Gate vor dem PUT (#1574) — Speichern-Button und Strg+Enter laufen beide hier durch, beide
	// Einbindungen (Settings-Seite, PillarWeightsModal) erben es.
	const save = async (): Promise<void> => {
		// #1574 AK4 (0 %/100 %) braucht keine eigene Prüfung mehr: Der Mindestanteil der gekoppelten
		// Regler (#1596) macht solche Verteilungen unerreichbar.
		// AK1: Bei starker Unausgewogenheit (#1555-Warnung) nach Bestätigung fragen — erst „Trotzdem speichern"
		// sendet den PUT. Die Sliderwerte bleiben unverändert, erneutes Speichern ist möglich.
		if (unbalanced) {
			setConfirmOpen(true);
			return;
		}
		await performSave();
	};

	// Bestätigen im #1574-Modal: Modal schließen und den PUT unmittelbar auslösen (AK5 — keine
	// Wartefrist im Save-Pfad). Strg+Enter im Modal läuft über denselben Weg.
	const confirmSave = (): void => {
		setConfirmOpen(false);
		void performSave();
	};

	// Strg+Enter (bzw. ⌘+Enter) im Bestätigungs-Modal bestätigt (ConfirmDeleteDialog-Muster). Der
	// Formular-Shortcut unten ist bei offenem Modal gesperrt, damit ein Kürzel nicht doppelt feuert
	// (kein zweites Modal, kein zweiter PUT).
	useCtrlEnter(() => confirmSave(), confirmOpen && !saving);

	// Strg+Enter (bzw. ⌘+Enter) löst den primären CTA „Speichern" aus — nur wenn er nicht deaktiviert ist
	// (kein laufendes Speichern, Säulen vorhanden, Bestätigungs-Modal zu), analog zu dessen `_disabled`.
	useCtrlEnter(() => void save(), !saving && !confirmOpen && pillars.length > 0);

	return (
		<>
			{error !== null && (
				<KolAlert _type="error" _label="Speichern fehlgeschlagen">
					{error}
				</KolAlert>
			)}

			{/* #1555: freundlicher, nicht blockierender Hinweis bei starker Unausgewogenheit — über
			    den Slidern, damit die Ursache vor den Reglern steht (gleicher Slot wie der
			    Fehler-Alert, semantisch über das eigene Label getrennt; beide können gleichzeitig
			    sichtbar sein). `aria-live="polite"` statt KoliBris `_alert` (assertiv): der Hinweis
			    schlägt live bei jedem Reglerzug um und soll den Slider-Fokus nicht zusätzlich
			    beschreien — die ohnehin höfliche Summenzeile unten bleibt die zweite Rückmeldung. */}
			{unbalanced && (
				<div aria-live="polite">
					<KolAlert _type="warning" _label="Verteilung stark unausgewogen">
						{UNBALANCED_HINT}
					</KolAlert>
				</div>
			)}

			{pillars.length === 0 ? (
				<p>Keine Säulen vorhanden.</p>
			) : (
				<>
					<p className="hint">
						Verteile 100 % auf die fünf Säulen. Ziehst du einen Regler, ziehen die anderen mit — jede Säule behält
						mindestens {SHARE_MIN} %.
					</p>
					<div className="form-grid pillar-weights-grid">
						{pillars.map((pillar, index) => (
							<div key={pillar.id} className="pillar-weight-row">
								<KolInputRange
									// Der aktuelle Wert steht im Label, da ein reiner Slider ihn nicht anzeigt.
									_label={`${pillar.name}: ${formatNumber(weights[index] ?? 0)} %`}
									_min={SHARE_MIN}
									_max={weightCeiling}
									_step={SHARE_STEP}
									_value={weights[index] ?? SHARE_MIN}
									_on={{
										onInput: (_event, value) => setWeight(index, readNumber(value)),
										onChange: (_event, value) => setWeight(index, readNumber(value)),
									}}
								/>
								{/* #934: Keine Säulen-Beschreibung mehr je Slider — dieselben Beschreibungen
								    stehen bereits in der Säulenliste darüber (`.pillar-list-description`). */}
							</div>
						))}
					</div>
				</>
			)}

			<div className="form-actions">
				<KolButton
					_label={saving ? 'Speichern…' : 'Speichern'}
					_variant="primary"
					_disabled={saving || pillars.length === 0}
					_on={{ onClick: () => void save() }}
				/>
				{onCancel !== undefined && (
					<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onCancel() }} />
				)}
			</div>

			{/* #1574: Bestätigungs-Modal bei aktiver #1555-Warnung (AK1/AK2). Esc und Backdrop wirken wie
			    „Abbrechen" (kein PUT) — `Modal.onClose` deckt alle drei Wege ab. Der Warn-Alert zeigt den
			    Hinweistext wortgleich zum Formular; „Abbrechen" erhält den Initialfokus (#472-Muster). */}
			{confirmOpen && (
				<Modal
					title="Verteilung stark unausgewogen"
					onClose={() => setConfirmOpen(false)}
					initialFocusRef={cancelRef as RefObject<HTMLElement | null>}
				>
					<KolAlert _type="warning" _label="Verteilung stark unausgewogen">
						{UNBALANCED_HINT}
					</KolAlert>
					<div className="modal-actions pillar-confirm-actions">
						<KolButton
							ref={cancelRef}
							_label="Abbrechen"
							_variant="secondary"
							_disabled={saving}
							_on={{ onClick: () => setConfirmOpen(false) }}
						/>
						<KolButton
							_label={saving ? 'Speichern…' : 'Trotzdem speichern'}
							_variant="primary"
							_disabled={saving}
							_on={{ onClick: () => confirmSave() }}
						/>
					</div>
				</Modal>
			)}
		</>
	);
};
