import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { startNativeGoogleLogin } from '../lib/nativeAuth';
import { isNativeChannel } from '../lib/platform';

type ErrorParam = string | null;

const ERROR_MESSAGES: Record<string, string> = {
	access_denied: 'Der Zugriff wurde verweigert. Bitte versuche es erneut.',
	invalid_email: 'Deine E-Mail-Adresse ist nicht zugelassen. Bitte wende dich an den Administrator.',
	magic_link_invalid: 'Der Anmeldelink ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an.',
	native_login_failed: 'Die Anmeldung in der App ist fehlgeschlagen. Bitte versuche es erneut.',
};

function getErrorFromSearch(): ErrorParam {
	const params = new URLSearchParams(window.location.search);
	return params.get('error');
}

type MagicLinkState = 'idle' | 'sending' | 'sent' | 'failed';

const inputStyle = {
	width: '100%',
	padding: '0.75rem 1rem',
	border: '1px solid var(--pp-border, #d0d5dd)',
	borderRadius: '0.5rem',
	fontSize: '1rem',
	boxSizing: 'border-box',
} as const;

function getErrorMessage(error: string): string {
	return ERROR_MESSAGES[error] ?? 'Ein unbekannter Anmeldefehler ist aufgetreten. Bitte versuche es erneut.';
}

export const LoginPage = () => {
	const [error] = useState<ErrorParam>(getErrorFromSearch);
	// Magic Link nur anbieten, wenn die Instanz SMTP konfiguriert hat (GET /auth/providers).
	const [magicLinkEnabled, setMagicLinkEnabled] = useState(false);
	const [email, setEmail] = useState('');
	const [magicLinkState, setMagicLinkState] = useState<MagicLinkState>('idle');

	useEffect(() => {
		api
			.getAuthProviders()
			.then((providers) => setMagicLinkEnabled(providers.magicLink))
			.catch(() => setMagicLinkEnabled(false));
	}, []);

	const handleMagicLink = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMagicLinkState('sending');
		api
			.requestMagicLink(email)
			.then(() => setMagicLinkState('sent'))
			.catch(() => setMagicLinkState('failed'));
	};

	const handleLogin = () => {
		// In der App blockiert Google den Login im WebView, er läuft dort im System-Browser.
		if (isNativeChannel()) {
			void startNativeGoogleLogin();
			return;
		}
		// Bewusst /auth/google statt /api/v1/auth/google: Der OAuth-Flow liegt laut
		// docs/oauth-migration.md unter /auth/* (Caddy reicht ihn ohne Präfix-Strip durch).
		window.location.href = '/auth/google';
	};

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				minHeight: '100dvh',
				padding: '2rem',
				boxSizing: 'border-box',
				background: 'var(--pp-bg, #ffffff)',
				color: 'var(--pp-text, #1a1a1a)',
			}}
		>
			<div
				style={{
					maxWidth: '24rem',
					width: '100%',
					display: 'flex',
					flexDirection: 'column',
					gap: '1.5rem',
					alignItems: 'center',
					textAlign: 'center',
				}}
			>
				{/* Bewusst KEIN „Balamentum"-Heading: Dieser Name (als level-1-Heading) identifiziert
				    ausschließlich die Haupt-App (KolHeading `_level={1}` in `App.tsx`). Die E2E-Auth-Gate-Specs
				    (`login.spec.ts`, AK1a) prüfen, dass dieses Heading unauthentifiziert NICHT sichtbar ist;
				    da `getByRole('heading', { name })` per Default als Teilstring matcht, darf der Anmelde-Titel
				    den Text „Balamentum" auch nicht enthalten. */}
				<h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>Anmelden</h1>
				<p style={{ margin: 0, color: 'var(--pp-text-muted, #555)' }}>Melde dich an, um fortzufahren.</p>

				{error !== null && (
					<div
						role="alert"
						style={{
							width: '100%',
							padding: '0.75rem 1rem',
							background: '#fef3f2',
							border: '1px solid #fda29b',
							borderRadius: '0.5rem',
							color: '#b42318',
							fontSize: '0.9rem',
							boxSizing: 'border-box',
						}}
					>
						{getErrorMessage(error)}
					</div>
				)}

				<button
					onClick={handleLogin}
					style={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						gap: '0.75rem',
						width: '100%',
						padding: '0.75rem 1.5rem',
						background: '#1570ef',
						color: '#ffffff',
						border: 'none',
						borderRadius: '0.5rem',
						fontSize: '1rem',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					Login with Google
				</button>

				{magicLinkEnabled && (
					<form
						onSubmit={handleMagicLink}
						style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}
					>
						<p style={{ margin: 0, textAlign: 'center', color: 'var(--pp-text-muted, #555)' }}>oder</p>
						<label htmlFor="magic-link-email" style={{ fontWeight: 600 }}>
							Anmeldelink per E-Mail
						</label>
						<input
							id="magic-link-email"
							// Einstieg über „Mit E-Mail anmelden" auf der Website (`?login=email`).
							autoFocus={new URLSearchParams(window.location.search).get('login') === 'email'}
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							style={inputStyle}
						/>
						<button
							type="submit"
							disabled={magicLinkState === 'sending'}
							style={{
								width: '100%',
								padding: '0.75rem 1.5rem',
								background: 'transparent',
								color: '#1570ef',
								border: '1px solid #1570ef',
								borderRadius: '0.5rem',
								fontSize: '1rem',
								fontWeight: 600,
								cursor: 'pointer',
							}}
						>
							Anmeldelink senden
						</button>
						{magicLinkState === 'sent' && (
							<p role="status" style={{ margin: 0 }}>
								Falls die Adresse zugelassen ist, ist ein Anmeldelink unterwegs. Schau in dein Postfach.
							</p>
						)}
						{magicLinkState === 'failed' && (
							<p role="alert" style={{ margin: 0, color: '#b42318' }}>
								Der Link konnte gerade nicht angefordert werden. Bitte versuche es gleich noch einmal.
							</p>
						)}
					</form>
				)}
			</div>
		</div>
	);
};
