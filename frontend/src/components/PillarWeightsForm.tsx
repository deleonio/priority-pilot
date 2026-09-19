import { KolAlert, KolButton, KolInputRange } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { readNumber } from '../lib/inputValue';
import { formatNumber } from '../lib/task';
import {
	RAW_WEIGHT_MAX,
	RAW_WEIGHT_MIN,
	RAW_WEIGHT_STEP,
	hasExtremeShare,
	isDistributionUnbalanced,
	isRawDistributionValid,
	normalizeToTotalWeight,
	sumWeights,
	weightToRaw,
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
 * Gemeinsame Gewichtungs-Formularlogik für die Lebensbalance-Säulen: je Säule ein freier Rohwert von
 * **0,0 bis 1,0** (#82). Beim Speichern werden die Rohwerte auf die interne 100-%-Verteilung
 * **normiert** (`normalizeToTotalWeight`) und via `PUT /pillars/weights` abgelegt — die gespeicherte
 * Repräsentation und damit das Ranking bleiben unverändert.
 *
 * Wird von `PillarWeightsModal` (mit Abbrechen) und der Settings-Seite (#271, ohne Abbrechen)
 * genutzt. Die Eingaben liegen — wie im übrigen UI (siehe `TaskFormModal`) — in einem Ref, damit die
 * KoliBri-Felder ihren Anzeigewert selbst verwalten (kein Cursor-Springen). Für die Live-Summe wird
 * zusätzlich ein abgeleiteter `sum`-State bei jeder Eingabe nachgeführt.
 */
export const PillarWeightsForm = ({ pillars, onSaved, onCancel }: PillarWeightsFormProps) => {
	// Rohwerte 0,0–1,0: der gespeicherte Prozentwert wird für die Anzeige zurückgerechnet (#82).
	// `null` erlaubt: ein geleertes Feld setzt den Eintrag auf `null`, damit die Validierung greift,
	// statt still den alten Wert weiterzuverwenden.
	const weights = useRef<(number | null)[]>(pillars.map((pillar) => weightToRaw(pillar.weight)));
	const [sum, setSum] = useState(() => sumWeights(weights.current));
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	// #1574: Bestätigungs-Modal für stark unausgewogene Verteilungen — `true` heißt „offen",
	// geschlossen wird per `setConfirmOpen(false)` (Button, Esc, Backdrop via `Modal.onClose`).
	const [confirmOpen, setConfirmOpen] = useState(false);

	// „Abbrechen" im Bestätigungs-Modal ist der sicherere Initialfokus (#472-Muster aus
	// ConfirmDeleteDialog): Bestätigen soll nicht versehentlich per Enter auslösbar sein.
	const cancelRef = useRef<HTMLKolButtonElement>(null);

	// Gültig, sobald jeder Wert ≥ 0 ist und mindestens einer > 0 (sonst nicht auf 100 % normierbar).
	const distributionValid = isRawDistributionValid(weights.current);

	// #1555: rein informativer Hinweis auf starke Unausgewogenheit (Anteil > 2× oder < ½ des
	// gleichmäßigen Anteils) — blockiert das Speichern nicht, fragt seit #1574 aber nach. Wie
	// `distributionValid` bei jedem Render aus dem Ref abgeleitet; das Re-Render-Signal liefert
	// der bestehende `setSum`-Aufruf, der bei jeder Slider-Eingabe feuert.
	const unbalanced = isDistributionUnbalanced(weights.current);

	// Der eigentliche Speichervorgang (normieren → PUT) — vom #1574-Gate in `save()` entkoppelt,
	// damit der Bestätigungspfad denselben Code unmittelbar (ohne Wartefrist, AK5) auslösen kann.
	const performSave = async (): Promise<void> => {
		// `save()` hat die Verteilung vorab geprüft; alle Werte sind dort nicht-`null`.
		const normalized = normalizeToTotalWeight(weights.current.map((weight) => weight ?? 0));
		const entries = pillars.map((pillar, index) => ({ id: pillar.id, weight: normalized[index] }));

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
		if (!isRawDistributionValid(weights.current)) {
			setError('Jedes Gewicht muss eine Zahl ≥ 0 sein und mindestens eine Säule muss > 0 sein.');
			return;
		}
		// AK4: Nach der Normierung würde eine Säule komplett leer (0 %) oder voll (100 %) — mit
		// mehreren Säulen fast sicher ein Versehen, daher blockierend statt bestätigbar. Die
		// Sliderwerte bleiben unverändert, der Nutzer kann die Regler nachziehen.
		if (hasExtremeShare(weights.current)) {
			setError(
				'Nach der Normierung würde eine Säule 0 % oder 100 % erhalten — jede Säule braucht einen Anteil größer 0 (bei nur einer Säule ist 100 % in Ordnung).',
			);
			return;
		}
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
	// (kein laufendes Speichern, Säulen vorhanden, gültige Verteilung, Bestätigungs-Modal zu), analog
	// zu dessen `_disabled`.
	useCtrlEnter(() => void save(), !saving && !confirmOpen && pillars.length > 0 && distributionValid);

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
						Gib je Säule einen Wert von 0,0 bis 1,0 ein. Die Werte werden beim Speichern automatisch auf 100 % normiert
						— die absolute Skala ist egal (5 × 0,1 ergibt dasselbe wie 5 × 1).
					</p>
					<div className="form-grid pillar-weights-grid">
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
								{/* #934: Keine Säulen-Beschreibung mehr je Slider — dieselben Beschreibungen
								    stehen bereits in der Säulenliste darüber (`.pillar-list-description`). */}
							</div>
						))}
					</div>
					{/* `aria-live`: Die Summe ist die einzige Rückmeldung darauf, ob die Verteilung speicherbar
					    ist — sie ändert sich bei jedem Reglerzug, ohne dass der Fokus sie berührt. Ohne
					    Live-Region erfährt ein Screenreader den Umschlag gültig/ungültig nie.
					    Das frühere „✓“-Zeichen ist raus: als Glyphe im Fließtext wird es je nach
					    Screenreader vorgelesen („Häkchen“) oder verschluckt — die Aussage steht im Text. */}
					<p
						aria-live="polite"
						className={
							distributionValid
								? 'pillar-weights-sum pillar-weights-sum-ok'
								: 'pillar-weights-sum pillar-weights-sum-invalid'
						}
					>
						Summe der Rohwerte: {formatNumber(sum)}{' '}
						{distributionValid ? '— wird auf 100 % normiert' : '— mindestens eine Säule muss > 0 sein'}
					</p>
				</>
			)}

			<div className="form-actions">
				<KolButton
					_label={saving ? 'Speichern…' : 'Speichern'}
					_variant="primary"
					_disabled={saving || pillars.length === 0 || !distributionValid}
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
