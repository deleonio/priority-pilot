import { KolDialog } from '@public-ui/react-v19';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Das tatsächlich fokussierte Element ermitteln — auch über (offene) Shadow-DOM-Grenzen hinweg.
 * Nötig, weil KoliBri-Trigger verschachtelt sein können (Button in `kol-toolbar` im Shadow der
 * `kol-table-stateful`); `document.activeElement` allein liefert nur den äußersten Host.
 */
const deepActiveElement = (): Element | null => {
	let element = document.activeElement;
	while (element?.shadowRoot?.activeElement != null) {
		element = element.shadowRoot.activeElement;
	}
	return element;
};

interface ModalProps {
	/** Überschrift des Dialogs (wird als `_label` zum Card-Titel und accessible name des Dialogs). */
	title: string;
	/** Wird ausgelöst, wenn der Nutzer schließt (Schließen-Button der Card, Escape, Backdrop). */
	onClose: () => void;
	/** Maximale Dialogbreite (CSS-Wert für KolDialog `_width`; bei kleineren Viewports gilt max-width:100%). */
	width?: string;
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
export const Modal = ({ title, onClose, width = '40rem', children }: ModalProps) => {
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
			void dialog.close();
			if (trigger instanceof HTMLElement) {
				trigger.focus();
			}
		};
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
