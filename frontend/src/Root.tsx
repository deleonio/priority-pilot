import { useEffect, useState } from 'react';
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
		return null;
	}

	if (authState === 'unauthenticated') {
		return <LoginPage />;
	}

	return <App />;
};
