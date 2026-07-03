import { KolDialog } from '@public-ui/react-v19';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { deepActiveElement } from '../lib/focus';

interface ModalProps {
	/** Überschrift des Dialogs (wird als `_label` zum Card-Titel und accessible name des Dialogs). */
	title: string;
	/** Wird ausgelöst, wenn der Nutzer schließt (Schließen-Button der Card, Escape, Backdrop). */
	onClose: () => void;
	/** Maximale Dialogbreite (CSS-Wert für KolDialog `_width`; bei kleineren Viewports gilt max-width:100%). */
	width?: string;
	/**
	 * Fallback-Fokusziel, wenn das auslösende Element beim Schließen nicht mehr im DOM ist
	 * (z. B. nach erfolgreichem Löschen: der Trigger-Button fällt aus dem DOM). Fehlt der
	 * Fallback, landet der Fokus auf `document.body` (schlechte Zugänglichkeit).
	 */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
	children: ReactNode;
}

/**
 * Modal-Overlay auf Basis von `KolDialog` mit Variant `card` — die Card liefert Titel, Rahmen und
 * einen Schließen-Button; das zugrunde liegende native `<dialog>` (`role="dialog"`) bringt Fokus-Falle,
 * Escape-zum-Schließen und Backdrop mit.
 *
 * KolDialog wird imperativ über `showModal()` geöffnet. Das überbrücken wir deklarativ: beim Mount
 * öffnen, und wenn der Dialog schließt (`onClose`), den State im Aufrufer zurücksetzen (der das Modal
 * unmountet). Die Cleanup-`close()` macht den Öffnen-Effekt idempotent gegenüber StrictMode — sonst
 * liefe beim simulierten Re-Mount ein zweites `showModal()` auf den bereits offenen Dialog.
 */
export const Modal = ({ title, onClose, width = '40rem', fallbackFocusRef, children }: ModalProps) => {
	const ref = useRef<HTMLKolDialogElement>(null);

	// `onClose` über einen Ref ansprechen, damit der Öffnen-Effekt unabhängig von der Callback-Identität
	// genau einmal (beim Mount) läuft.
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	useEffect(() => {
		const dialog = ref.current;
		if (dialog === null) {
			return;
		}
		// Auslöser (auch tief im Shadow-DOM, z. B. ein Button der Tabellen-Toolbar) merken, um den Fokus
		// beim Schließen dorthin zurückzugeben — sonst landet er im `<body>`. Vor `showModal()` ausgelesen,
		// da das Öffnen den Fokus in den Dialog zieht.
		const trigger = deepActiveElement();
		// Fallback-Element beim Mount einmalig lesen — der Ref zeigt auf ein stabiles DOM-Element,
		// das beim Cleanup noch vorhanden ist (z. B. <main>).
		const fallback = fallbackFocusRef?.current ?? null;
		// `showModal()` erst aufrufen, wenn das Custom-Element registriert/aufgewertet ist — sonst ist die
		// Methode beim Mount evtl. noch nicht vorhanden und der Dialog bleibt geschlossen. Das
		// `active`-Flag entkoppelt StrictMode (Setup→Cleanup→Setup) sauber: nur das letzte Setup öffnet.
		let active = true;
		void customElements.whenDefined('kol-dialog').then(() => {
			if (active) {
				void dialog.showModal();
			}
		});
		return () => {
			active = false;
			// Unmount ist KEIN User-Close: Wenn der Eigentümer das Modal unmountet (z. B. Schrittwechsel
			// Quick-Capture → Formular, #236), darf das durch `close()` ausgelöste KolDialog-Close-Event
			// nicht mehr `onClose` aufrufen — sonst schließt der Aufrufer (App `closeDialog`) auch den
			// gerade gemounteten Folge-Dialog. Beim StrictMode-Re-Mount stellt der `onCloseRef`-Effekt
			// oben den echten Callback wieder her (Effekte laufen in Deklarationsreihenfolge).
			onCloseRef.current = () => undefined;
			void dialog.close();
			// dialog.close() gibt ein Promise zurück; die native-Dialog-Fokus-Wiederherstellung
			// läuft asynchron. setTimeout(0) stellt sicher, dass wir NACH dem Close-Callback fokussieren.
			setTimeout(() => {
				// `document.body` ist nie ein legitimer Auslöser: Es steht hier nur, wenn der Fokus beim
				// Mount bereits verloren war (z. B. Dialog-Wechsel capture→form, #236). Dann soll das
				// Fallback greifen statt den Fokus erneut auf `<body>` zu setzen.
				if (trigger instanceof HTMLElement && trigger.isConnected && trigger !== document.body) {
					trigger.focus();
				} else if (fallback != null) {
					fallback.focus();
				}
			}, 0);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<KolDialog
			ref={ref}
			_label={title}
			_level={2}
			_variant="card"
			_width={width}
			_on={{ onClose: () => onCloseRef.current() }}
		>
			<div className="modal-body">{children}</div>
		</KolDialog>
	);
};
