import { KolDialog } from '@public-ui/react-v19';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { deepActiveElement } from '../lib/focus';

interface ModalProps {
	/** Überschrift des Dialogs (wird als `_label` zum Card-Titel und accessible name des Dialogs). */
	title: string;
	/** Wird ausgelöst, wenn der Nutzer schließt (Schließen-Button der Card, Escape, Backdrop). */
	onClose: () => void;
	/**
	 * Maximale Dialogbreite. Verwendet CSS-Variablen (`--pp-modal-width-*`) für responsive
	 * Breiten. Bei kleineren Viewports gilt `max-width: 100%` und `width: 100%` automatisch.
	 */
	width?: string;
	/**
	 * Fallback-Fokusziel, wenn das auslösende Element beim Schließen nicht mehr im DOM ist
	 * (z. B. nach erfolgreichem Löschen: der Trigger-Button fällt aus dem DOM). Fehlt der
	 * Fallback, landet der Fokus auf `document.body` (schlechte Zugänglichkeit).
	 */
	fallbackFocusRef?: RefObject<HTMLElement | null>;
	/**
	 * Element, das nach dem Öffnen (`showModal()`) den Initialfokus erhält. Ohne Angabe gilt
	 * der Browser-Default (erstes fokussierbares Element im Dialog, z. B. der primäre CTA).
	 *
	 * Einsatzfall #472: In Bestätigungs-Dialogen für destruktive Aktionen soll der Initialfokus
	 * auf dem „Abbrechen"-Button liegen (nicht auf „Endgültig löschen"), damit die irreversible
	 * Aktion nicht versehentlich per Enter auslösbar ist. Der Ref zeigt auf den KoliBri-Host —
	 * dessen `focus()` ist async und wird awaitet (siehe Öffnen-Effekt unten).
	 *
	 * Umgesetzt als Ref (kein direkter Callback), damit der Aufrufer den Ziel-Button deklarativ
	 * am JSX-Element hält und keine manuelle Fokus-Logik pflegt.
	 */
	initialFocusRef?: RefObject<HTMLElement | null>;
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
export const Modal = ({
	title,
	onClose,
	width = 'var(--pp-modal-width-desktop)',
	fallbackFocusRef,
	initialFocusRef,
	children,
}: ModalProps) => {
	const ref = useRef<HTMLKolDialogElement>(null);

	// `onClose` über einen Ref ansprechen, damit der Öffnen-Effekt unabhängig von der Callback-Identität
	// genau einmal (beim Mount) läuft.
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	// `initialFocusRef` ebenso über einen stabilen Ref, damit der Öffnen-Effekt seine leere
	// Abhängigkeitsliste behält (läuft exakt einmal pro Dialog-Instanz) und trotzdem den jeweils
	// aktuellen Ziel-Ref greift — auch wenn der Aufrufer ihn zwischen Rendern austauscht.
	const initialFocusRefCurrent = useRef<HTMLElement | null>(null);
	useEffect(() => {
		initialFocusRefCurrent.current = initialFocusRef?.current ?? null;
	}, [initialFocusRef]);

	// Überdauert den StrictMode-Re-Mount (Refs bleiben dabei erhalten): genau EIN `showModal()` pro
	// Dialog-Instanz. Ein zweites würfe `InvalidStateError` auf dem bereits offenen nativen Dialog.
	const openedRef = useRef(false);

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
		// `active`-Flag und `openedRef` entkoppeln StrictMode (Setup→Cleanup→Setup): es öffnet genau ein
		// Setup — auch wenn der `whenDefined`-Microtask schon ZWISCHEN erstem Setup und Cleanup lief.
		let active = true;
		void Promise.all([customElements.whenDefined('kol-dialog'), customElements.whenDefined('kol-button')]).then(
			async () => {
				if (!active || openedRef.current) {
					return;
				}
				openedRef.current = true;
				// AWAIT: KoliBris `showModal()` ist eine async Stencil-Methode, die erst über zwei
				// Komponenten-Ebenen hinweg beim nativen `<dialog>.showModal()` ankommt. Ohne `await`
				// liefe unser Initialfokus VOR dem nativen Öffnen — und das native `showModal()` setzt
				// den Fokus anschließend auf seinen Default zurück.
				await dialog.showModal();
				// Initialfokus danach setzen (#472): das native `showModal()` fokussiert per Default das
				// erste fokussierbare Element im Dialog — bei Bestätigungsdialogen soll es stattdessen
				// „Abbrechen" sein.
				//
				// Über die KoliBri-API (async, deshalb awaitet) — NICHT per Griff ins Shadow-DOM auf das
				// innere `<button>`: ein einzelnes `focus()` dort hält nicht, weil im Dialog direkt nach
				// dem Öffnen noch mehrfach der Fokus bewegt wird (gemessen). Genau dafür wiederholt
				// KoliBris `setFocus()` den Versuch über bis zu 10 Frames
				// (`utils/element-focus.js`, MAX_FOCUS_ATTEMPTS) — erst das lässt den Fokus sitzen.
				//
				// Bekannte, gemessene Nebenwirkung: in diesem Fenster (~<100 ms nach dem Öffnen) zieht
				// die Schleife einen Tab-Anschlag des Nutzers auf „Abbrechen" zurück. Danach ist der
				// Fokus frei (e2e AK4 sichert das ab). KEINEN eigenen Watchdog/`focusin`-Redirect
				// ergänzen, um das zu „verbessern" — genau der hielt den Fokus vorher 500 ms fest.
				await initialFocusRefCurrent.current?.focus();
			},
		);
		return () => {
			active = false;
			// Unmount ist KEIN User-Close: Wenn der Eigentümer das Modal unmountet (z. B. Schrittwechsel
			// Quick-Capture → Formular, #236), darf kein Close-Event mehr `onClose` aufrufen — sonst
			// schließt der Aufrufer (App `closeDialog`) auch den gerade gemounteten Folge-Dialog. Beim
			// StrictMode-Re-Mount stellt der `onCloseRef`-Effekt oben den echten Callback wieder her
			// (Effekte laufen in Deklarationsreihenfolge).
			onCloseRef.current = () => undefined;
			// BEWUSST kein `dialog.close()` im Cleanup: Das Entfernen aus dem DOM räumt einen offenen
			// Modal-Dialog laut HTML-Spec ohne Close-Event aus dem Top-Layer. Ein `close()` reihte das
			// native Close-Event dagegen als Macrotask ein — nach einem StrictMode-Re-Mount träfe es den
			// bereits wiederhergestellten `onClose`-Callback und schlösse den Dialog sporadisch sofort
			// wieder (timing-abhängiger e2e-Flake, beobachtet in balance.spec).
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
