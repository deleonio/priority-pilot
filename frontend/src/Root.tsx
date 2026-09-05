import { useEffect, useRef, useState } from 'react';
import { KolSpin } from '@public-ui/react-v19';
import { App } from './App';
import { BahnPage } from './components/BahnPage';
import { LoginPage } from './components/LoginPage';
import type { AuthUser } from './lib/auth';
import { checkAuth, SESSION_RELOAD_KEY } from './lib/auth';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

// Issue #396 PR B — sessionStorage-Schlüssel für den stillen Google-Login.
const SILENT_ATTEMPTED_KEY = 'pp_silent_attempted';
const JUST_LOGGED_OUT_KEY = 'pp_just_logged_out';

/**
 * Entscheidet, ob ein stiller Google-Login (OAuth `prompt=none`) versucht werden soll. Die Guards
 * verhindern Endlosschleifen und respektieren aktive Logouts:
 *  - ?silent=unavailable: der stille Versuch ist gescheitert (Interaktion/Consent nötig) → manuelle Login-Seite.
 *  - ?error=…: vorheriger Login-Fehler → Fehlermeldung zeigen statt stillen Versuch.
 *  - „pp_just_logged_out": nach Abmelden KEIN stiller Re-Login (sonst ist Ausloggen praktisch unmöglich);
 *    gesetzt von handleLogout() in App.tsx.
 *  - „pp_silent_attempted": in dieser Browser-Session wurde bereits ein Versuch gestartet.
 */
const shouldAttemptSilentLogin = (): boolean => {
	const params = new URLSearchParams(window.location.search);
	if (params.get('silent') === 'unavailable') return false;
	if (params.has('error')) return false;
	if (sessionStorage.getItem(JUST_LOGGED_OUT_KEY) === '1') return false;
	if (sessionStorage.getItem(SILENT_ATTEMPTED_KEY) === '1') return false;
	return true;
};

/**
 * Authentifizierter Einstieg: prüft die Session und rendert je nach Zustand Login, App oder einen
 * Lade-/Fehlerhinweis. Bewusst als eigene Komponente ausgelagert, damit die öffentliche `/bahn`-Route
 * (siehe `Root`) den kompletten Auth-Flow inklusive seiner Hooks umgeht — ohne bedingte Hook-Aufrufe.
 *
 * Issue #396 PR B — Stiller Google-Login: Ist keine App-Session vorhanden, wird EINMALIG versucht, den
 * Nutzer über `/auth/google/silent` (Top-Level-Redirect) ohne eigenen Klick anzumelden. Während dieses
 * Versuchs erscheint der Lade-Spinner (nicht die Login-Seite), damit die manuelle Login-Seite erst nach
 * Abschluss der Navigation sichtbar wird — so kollidiert der stille Redirect nicht mit unmittelbar
 * folgenden Navigationen (z. B. einem Reload).
 */
const AuthenticatedApp = () => {
	const [authState, setAuthState] = useState<AuthState>('loading');
	const [user, setUser] = useState<AuthUser | null>(null);
	const [silentPending, setSilentPending] = useState(false);
	// Schützt vor der StrictMode-Doppelinvokation des checkAuth-Effekts: ein zweiter Aufruf darf den
	// einmal getroffenen Silent-Beschluss nicht umstoßen (keine Login-Seite vorab rendern).
	const silentInitiated = useRef(false);

	useEffect(() => {
		checkAuth()
			.then((authUser: AuthUser | null) => {
				if (authUser !== null) {
					setUser(authUser);
					setAuthState('authenticated');
					// Bei erfolgreicher Anmeldung den Logout-Marker zurücksetzen, damit ein späterer
					// Logout die Silent-Logik nicht dauerhaft sperrt.
					sessionStorage.removeItem(JUST_LOGGED_OUT_KEY);
					// #1231: Auch den „bereits versucht"-Marker zurücksetzen — sonst würde nach dem
					// Neuladen aus dem Session-Dialog (dessen Reload erneut still anmelden soll) kein
					// zweiter stiller Versuch mehr starten. Die Loop-Guards (?silent=unavailable,
					// ?error=…, pp_just_logged_out) bleiben unverändert wirksam.
					sessionStorage.removeItem(SILENT_ATTEMPTED_KEY);
					return;
				}
				// Unauthentifiziert: einmalig entscheiden, ob ein stiller Login versucht wird.
				if (silentInitiated.current) {
					return;
				}
				// #1231 (AK3): Kommt der Ablauf aus dem Neuladen des Session-Expired-Dialogs, ist genau
				// EIN weiterer stiller Versuch ausdrücklich gewollt — auch wenn in dieser Browser-Session
				// bereits einer lief (`pp_silent_attempted`). Der Bonus-Marker wird gleich entfernt, damit
				// er auf keine späteren Abläufe übertragen wird; die Loop-Guards der Silent-Logik
				// (?silent=unavailable, ?error=…, pp_just_logged_out) bleiben unverändert wirksam.
				const sessionReload = sessionStorage.getItem(SESSION_RELOAD_KEY) === '1';
				if (sessionReload) {
					sessionStorage.removeItem(SESSION_RELOAD_KEY);
				}
				if (!sessionReload && !shouldAttemptSilentLogin()) {
					setAuthState('unauthenticated');
					return;
				}
				silentInitiated.current = true;
				// Marker VOR dem Redirect setzen, damit der Neuaufbau nach Rückkehr keinen zweiten
				// Versuch startet (Loop-Guard).
				sessionStorage.setItem(SILENT_ATTEMPTED_KEY, '1');
				setSilentPending(true);
				// #1231: aktuelle Route als Return-Path mitgeben — der Erfolgs-Callback des stillen
				// Logins leitet darauf zurück statt fix auf „/". Serverseitig sanitize
				// (sanitizeReturnPath), hier nur encodeURIComponent gegen Query-Injection.
				const currentPath = `${window.location.pathname}${window.location.search}`;
				window.location.href = `/auth/google/silent?returnTo=${encodeURIComponent(currentPath)}`;
			})
			.catch(() => {
				setAuthState('error');
			});
	}, []);

	if (authState === 'loading' || silentPending) {
		return (
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
				<KolSpin _show _variant="cycle" _label="Authentifizierung wird geprüft …" />
			</div>
		);
	}

	if (authState === 'unauthenticated') {
		return <LoginPage />;
	}

	if (authState === 'error') {
		return <div role="alert">Authentifizierung fehlgeschlagen. Bitte Seite neu laden.</div>;
	}

	return <App user={user!} />;
};

/**
 * Wurzel-Komponente mit der URL-Weiche für öffentliche Routen. Der öffentliche Bahn-Routenplaner
 * unter `/bahn` (#225) wird VOR jedem Auth-Check gerendert — ohne Login-Flow und ohne Redirect.
 * Alle übrigen Pfade laufen durch den authentifizierten Einstieg (`AuthenticatedApp`).
 */
export const Root = () => {
	if (window.location.pathname === '/bahn') {
		return <BahnPage />;
	}
	return <AuthenticatedApp />;
};
