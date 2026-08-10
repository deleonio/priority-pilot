import { KolButton } from '@public-ui/react-v19';
import { useState } from 'react';
import { Modal } from './Modal';

interface ConfirmSeriesActionModalProps {
	/** Wird mit der Kaskade-Entscheidung aufgerufen (`true` = auf alle Instanzen, `false` = nur Serie). */
	onConfirm: (cascade: boolean) => void;
	/** Schließt das Modal ohne Aktion (z. B. via ESC / Backdrop). */
	onClose?: () => void;
	/** Anzahl der Instanzen — falls bekannt, in der Frage ausgewiesen (sonst allgemeine Formulierung). */
	count?: number;
	/** Optionaler Fokus-Fallback nach der Bestätigung. */
	fallbackFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Bestätigungs-Modal für die Serien-Kaskade beim Bearbeiten (#553).
 *
 * Die eigentliche Speichern-Aktion steht durch den Klick auf „Bearbeiten" bereits fest — dieses
 * Modal entscheidet NUR über die Kaskade: sollen die geänderten Felder auf alle bereits generierten
 * Instanzen übertragen werden? Zwei eindeutig beschriftete Buttons (Ja/Nein), der sichere Default
 * ist „Nein" (nur das Template, künftige Instanzen). Der initial fokussierte Button ist „Nein",
 * damit die irreversible Kaskade nicht versehentlich per Enter auslösbar ist.
 */
export const ConfirmSeriesActionModal = ({
	onConfirm,
	onClose,
	count,
	fallbackFocusRef,
}: ConfirmSeriesActionModalProps) => {
	const [busy, setBusy] = useState(false);

	const decide = (cascade: boolean): void => {
		setBusy(true);
		onConfirm(cascade);
	};

	const question =
		count !== undefined
			? `Änderungen auf alle ${count} Instanzen übernehmen?`
			: 'Änderungen auf alle Instanzen übernehmen?';

	return (
		<Modal title="Änderungen übernehmen" onClose={() => onClose?.()} fallbackFocusRef={fallbackFocusRef}>
			<p>{question}</p>
			<p>
				<strong>Ja</strong>: bestehende Instanzen erhalten die neuen Werte für die geänderten Felder.{' '}
				<strong>Nein</strong>: nur das Serien-Template wird aktualisiert (künftige Instanzen).
			</p>
			<div className="modal-actions">
				<KolButton _label={busy ? 'Wird angewendet…' : 'Ja'} _disabled={busy} _on={{ onClick: () => decide(true) }} />
				<KolButton
					_label="Nein (nur Serie)"
					_variant="secondary"
					_disabled={busy}
					_on={{ onClick: () => decide(false) }}
				/>
			</div>
		</Modal>
	);
};
