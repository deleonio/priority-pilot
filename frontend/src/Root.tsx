import { useEffect, useState } from 'react';
import { KolSpin } from '@public-ui/react-v19';
import { App } from './App';
import { LoginPage } from './components/LoginPage';
import type { AuthUser } from './lib/auth';
import { checkAuth } from './lib/auth';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export const Root = () => {
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
