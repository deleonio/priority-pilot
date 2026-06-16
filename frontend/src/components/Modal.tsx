import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
	/** Überschrift des Dialogs (auch als `aria-label` der Dialog-Region). */
	title: string;
	/** Wird ausgelöst, wenn der Nutzer schließt (Escape, Backdrop-Klick, Schließen-Button). */
	onClose: () => void;
	children: ReactNode;
}

/**
 * Schlankes, vollständig React-gesteuertes Overlay (`role="dialog"`, `aria-modal`).
 *
 * Bewusst kein `KolModal`: dessen Anzeige wird imperativ über `showModal()`/`close()` am
 * Custom-Element gesteuert, was sich mit Reacts deklarativem Mount/Unmount (inkl. StrictMode)
 * schlecht verträgt. Das Overlay wird stattdessen einfach konditional gerendert; KoliBri-Komponenten
 * werden im Inhalt unverändert verwendet.
 */
export const Modal = ({ title, onClose, children }: ModalProps) => {
	const dialogRef = useRef<HTMLDivElement>(null);
	const titleId = useId();

	// `onClose` über einen Ref ansprechen, damit der Setup-Effekt unabhängig von der Identität des
	// Callbacks genau einmal läuft. Sonst würde ein nicht-memoisiertes `onClose` den Effekt erneut
	// ausführen und dabei das falsche Element als „zuvor fokussiert" merken (Fokus-Wiederherstellung
	// schlägt fehl).
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	useEffect(() => {
		const previouslyFocused = document.activeElement;
		dialogRef.current?.focus();

		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				onCloseRef.current();
			}
		};
		document.addEventListener('keydown', onKeyDown);
		const { overflow } = document.body.style;
		document.body.style.overflow = 'hidden';

		return () => {
			document.removeEventListener('keydown', onKeyDown);
			document.body.style.overflow = overflow;
			if (previouslyFocused instanceof HTMLElement) {
				previouslyFocused.focus();
			}
		};
	}, []);

	return (
		<div
			className="modal-backdrop"
			onClick={(event) => {
				if (event.target === event.currentTarget) {
					onClose();
				}
			}}
		>
			<div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
				<header className="modal-header">
					<h2 id={titleId}>{title}</h2>
				</header>
				<div className="modal-body">{children}</div>
			</div>
		</div>
	);
};
