import { KolButton } from '@public-ui/react-v19';
import { useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';

interface ConfirmDiscardDialogProps {
	/** Schließt nur die Rückfrage; das Aufgabenformular bleibt offen (sicherer, initial fokussierter Button). */
	onContinueEditing: () => void;
	/** Schließt Aufgabenformular und Rückfrage, ohne zu speichern. */
	onDiscard: () => void;
}

/**
 * Rückfrage beim Verlassen des Aufgabenformulars über X/Escape/Backdrop mit ungespeicherten
 * Änderungen (#1584). Button-Reihenfolge und Initialfokus wie `ConfirmDeleteDialog` (#472): die
 * sichere Aktion „Weiter bearbeiten" steht zuerst und erhält den Initialfokus, „Verwerfen" ist die
 * destruktive Aktion (Datenverlust). Escape auf dieser Rückfrage selbst läuft über `Modal.onClose`
 * und zeigt bewusst auf `onContinueEditing` (sicherer Default, KI-UX-Empfehlung im Ticket).
 *
 * Per `createPortal` an `document.body` gehängt (statt wie `ConfirmSeriesActionModal` als reines
 * Light-DOM-Kind im bereits offenen Formular-Dialog zu rendern): `KolDialog` projiziert Kind-Inhalt
 * per Shadow-DOM-`<slot>` — ein verschachtelter Aufbau ließe den äußeren `<kol-dialog>` denselben
 * Text („Verwerfen") im `textContent()` tragen wie der innere, was Host-Tag-Locators
 * (`kol-dialog` + Text-Filter) auf zwei Treffer laufen lässt. Der Portal macht die beiden Dialoge zu
 * DOM-Geschwistern, sodass Text-Filter eindeutig bleiben (verhält sich fürs native `<dialog>`-Top-Layer-
 * Stacking identisch — die Position im DOM-Baum ist dafür irrelevant).
 */
export const ConfirmDiscardDialog = ({ onContinueEditing, onDiscard }: ConfirmDiscardDialogProps) => {
	const continueRef = useRef<HTMLKolButtonElement>(null);

	return createPortal(
		<Modal
			title="Ungespeicherte Änderungen"
			onClose={onContinueEditing}
			initialFocusRef={continueRef as RefObject<HTMLElement | null>}
		>
			<p>Es gibt ungespeicherte Änderungen. Weiter bearbeiten oder verwerfen?</p>
			<div className="modal-actions">
				<KolButton
					ref={continueRef}
					_label="Weiter bearbeiten"
					_variant="secondary"
					_on={{ onClick: () => onContinueEditing() }}
				/>
				<KolButton _label="Verwerfen" _variant="danger" _on={{ onClick: () => onDiscard() }} />
			</div>
		</Modal>,
		document.body,
	);
};
