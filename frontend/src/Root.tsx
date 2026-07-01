import { useEffect, useState } from 'react';
import { KolSpin } from '@public-ui/react-v19';
import { App } from './App';
import { BahnPage } from './components/BahnPage';
import { LoginPage } from './components/LoginPage';
import type { AuthUser } from './lib/auth';
import { checkAuth } from './lib/auth';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

/**
 * Authentifizierter Einstieg: prüft die Session und rendert je nach Zustand Login, App oder einen
 * Lade-/Fehlerhinweis. Bewusst als eigene Komponente ausgelagert, damit die öffentliche `/bahn`-Route
 * (siehe `Root`) den kompletten Auth-Flow inklusive seiner Hooks umgeht — ohne bedingte Hook-Aufrufe.
 */
const AuthenticatedApp = () => {
	const [authState, setAuthState] = useState<AuthState>('loading');
	const [user, setUser] = useState<AuthUser | null>(null);

	useEffect(() => {
		checkAuth()
			.then((user: AuthUser | null) => {
				if (user !== null) {
					setUser(user);
					setAuthState('authenticated');
				} else {
					setAuthState('unauthenticated');
				}
			})
			.catch(() => {
				setAuthState('error');
			});
	}, []);

	if (authState === 'loading') {
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
