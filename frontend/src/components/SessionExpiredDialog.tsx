import { KolButton } from '@public-ui/react-v19';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { SESSION_EXPIRED_EVENT } from '../lib/apiError';
import { SESSION_RELOAD_KEY } from '../lib/auth';
import { Modal } from './Modal';

/**
 * Globaler Dialog „Session abgelaufen" (#1231). Läuft die Session im Hintergrund ab, erscheint bei
 * der nächsten fehlschlagenden API-Aktion — zusätzlich zur Fehlermeldung der Aktion — ein Dialog mit
 * dem Angebot, die App neu zu laden. Der Reload startet den stillen Google-Login erneut (Root.tsx
 * setzt `pp_silent_attempted` bei erfolgreicher Auth zurück) und landet dank `?returnTo=` auf der
 * bisherigen Route — dazu setzt der Reload den Marker `pp_session_reload` (`SESSION_RELOAD_KEY`),
 * den Root.tsx als Bonus für genau einen weiteren stillen Versuch wertet; zusätzlich räumt
 * Root.tsx den Marker `pp_silent_attempted` bei erfolgreicher Auth weg.
 *
 * Reagiert ausschließlich auf das `pp:session-expired`-Event aus `toApiError` (#948-Weiche): ein
 * 401 anderer Ursache (LLM-/Proxy-401), 403 oder ein Netzwerkfehler öffnen ihn nicht. Solange der
 * Dialog offen ist, stauen wiederholte Events (z. B. parallele 401-Requests) nicht an — es bleibt
 * bei genau einem Dialog. Kein Auto-Reload, kein Timeout: Nur „Neu laden" reloadet; „Abbrechen"
 * (wie Escape/Backdrop über `Modal.onClose`) schließt ohne Neuladen.
 *
 * Klick-Naht wie beim `UpdatePrompt`: KoliBris `KolButton` ist ein Web Component, dessen
 * `_on.onClick` in JSDOM nicht über einen echten DOM-Klick auslösbar ist — der Handler sitzt auf
 * einem nativen `<span>`-Wrapper mit `data-testid`, an den der Shadow-DOM-Klick bubbelt.
 * Zusätzlich trägt der „Neu laden"-Wrapper `tabIndex={-1}` und erhält über `initialFocusRef` den
 * Fokus, wenn der Dialog öffnet (AK5: Bestätigung per Enter). Das Enter verdrahtet hier einen
 * eigenen Keydown-Handler, weil ein `<span>` — anders als ein echter Button — keinen nativen
 * Enter-Klick kennt.
 */
export const SessionExpiredDialog = () => {
	const [open, setOpen] = useState(false);
	const reloadRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const onSessionExpired = (): void => {
			// flushSync (Präzedenz App.tsx): Der Dialog muss sofort sichtbar sein — das Event trifft
			// mitten in der Fehlerverarbeitung einer Aktion ein, und der Nutzer soll es ohne Verzögerung
			// sehen, ohne dass Reacts Batch-Flush den Zeitpunkt bestimmt.
			flushSync(() => {
				setOpen(true);
			});
		};
		window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
		return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
	}, []);

	const reload = (): void => {
		// AK3: Der Reload soll den stillen Re-Login ermöglichen — der in dieser Browser-Session
		// gesetzte Marker (Root.tsx, `pp_silent_attempted`) würde den Versuch sonst blocken und der
		// Nutzer landete auf der LoginPage. Der Marker gewährt Root.tsx genau EINEN weiteren stillen
		// Versuch; die Loop-Guards (?silent=unavailable, ?error=…, pp_just_logged_out) bleiben
		// wirksam: Scheitert der stille Login, greift weiterhin der LoginPage-Pfad.
		sessionStorage.setItem(SESSION_RELOAD_KEY, '1');
		window.location.reload();
	};

	// Enter/Space auf dem fokussierten „Neu laden"-Wrapper löst wie ein Button-Klick aus.
	const onReloadKeyDown = (event: KeyboardEvent<HTMLSpanElement>): void => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			reload();
		}
	};

	if (!open) {
		return null;
	}

	return (
		<Modal title="Session abgelaufen" onClose={() => setOpen(false)} initialFocusRef={reloadRef}>
			<p>Deine Anmeldung ist abgelaufen. Ungespeicherte Änderungen gehen beim Neuladen verloren.</p>
			<div className="modal-actions session-dialog-actions">
				<span ref={reloadRef} data-testid="session-reload" tabIndex={-1} onClick={reload} onKeyDown={onReloadKeyDown}>
					<KolButton _label="Neu laden" _variant="primary" />
				</span>
				<span data-testid="session-cancel" onClick={() => setOpen(false)}>
					<KolButton _label="Abbrechen" _variant="secondary" />
				</span>
			</div>
		</Modal>
	);
};
