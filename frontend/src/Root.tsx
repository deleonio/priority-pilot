import { useEffect, useState } from 'react';
import { KolSpin } from '@public-ui/react-v19';
import { App } from './App';
import { LoginPage } from './components/LoginPage';
import type { AuthUser } from './lib/auth';
import { checkAuth } from './lib/auth';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export const Root = () => {
	const [authState, setAuthState] = useState<AuthState>('loading');

	useEffect(() => {
		checkAuth()
			.then((user: AuthUser | null) => {
				setAuthState(user !== null ? 'authenticated' : 'unauthenticated');
			})
			.catch(() => {
				setAuthState('unauthenticated');
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

	return <App />;
};
