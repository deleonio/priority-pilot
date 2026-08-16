import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useRef, type RefObject } from 'react';
import { Modal } from './Modal';

interface LektoratDiffModalProps {
	/** Ursprünglicher Text (vor der Lektorat). */
	original: string;
	/** Lektorierter Text (vom Server zurückgegeben). */
	lektoriert: string;
	/** Label für das Feld (z. B. „Titel" oder „Beschreibung"). */
	fieldLabel: string;
	/** Wird aufgerufen, wenn der Nutzer „Übernehmen" klickt (mit lektoriertem Text). */
	onConfirm: () => void;
	/** Wird aufgerufen, wenn der Nutzer „Abbrechen" klickt (schließt Modal ohne Änderung). */
	onCancel: () => void;
	/** Optionaler Fokus-Fallback nach dem Schließen. */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
	/** Optionale Fehlermeldung vom Server (z. B. bei Lektorat-Fehlern). */
	error?: string | null;
}

/**
 * Diff-Modal für Lektorat-Vorschläge (Issue #687).
 *
 * Zeigt den Original-Text und den lektorierten Text nebeneinander,
 * damit die Nutzerperson entscheiden kann, ob die Änderung übernommen
 * werden soll. Zwei Schalter: „Übernehmen" (primär) und „Abbrechen".
 *
 * Fokus-Management gemäß UX-Pattern (docs/ux-pattern-sequential-confirmation.md):
 * - Beim Öffnen liegt der Fokus auf dem primären Button (Übernehmen)
 * - Beim Abbrechen kehrt der Fokus zum auslösenden Element zurück
 * - ESC verhält sich wie „Abbrechen"
 */
export const LektoratDiffModal = ({
	original,
	lektoriert,
	fieldLabel,
	onConfirm,
	onCancel,
	fallbackFocusRef,
	error,
}: LektoratDiffModalProps) => {
	// Ref für den primären Button (Übernehmen) – wird als Initialfokus verwendet
	const confirmButtonRef = useRef<HTMLKolButtonElement>(null);

	const handleConfirm = (): void => {
		onConfirm();
	};

	const handleCancel = (): void => {
		onCancel();
	};

	return (
		<Modal
			title={`Lektorat – ${fieldLabel}`}
			onClose={handleCancel}
			fallbackFocusRef={fallbackFocusRef}
			initialFocusRef={confirmButtonRef}
		>
			<div className="lektorat-diff-modal">
				{error && (
					<KolAlert _type="error" _label="Lektorat fehlgeschlagen">
						{error}
					</KolAlert>
				)}
				<div className="lektorat-diff-content">
					<div className="lektorat-diff-section">
						<h3 className="lektorat-diff-label">Original</h3>
						<p className="lektorat-diff-text">{original}</p>
					</div>
					<div className="lektorat-diff-section">
						<h3 className="lektorat-diff-label">Lektorierter Text</h3>
						<p className="lektorat-diff-text">{lektoriert}</p>
					</div>
				</div>
				<div className="modal-actions">
					<KolButton ref={confirmButtonRef} _label="Übernehmen" _variant="primary" _on={{ onClick: handleConfirm }} />
					<KolButton _label="Abbrechen" _variant="secondary" _on={{ onClick: handleCancel }} />
				</div>
			</div>
		</Modal>
	);
};
