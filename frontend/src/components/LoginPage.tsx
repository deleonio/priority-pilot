import { useState } from 'react';

type ErrorParam = string | null;

const ERROR_MESSAGES: Record<string, string> = {
	access_denied: 'Der Zugriff wurde verweigert. Bitte versuche es erneut.',
	invalid_email: 'Deine E-Mail-Adresse ist nicht zugelassen. Bitte wende dich an den Administrator.',
};

function getErrorFromSearch(): ErrorParam {
	const params = new URLSearchParams(window.location.search);
	return params.get('error');
}

function getErrorMessage(error: string): string {
	return ERROR_MESSAGES[error] ?? 'Ein unbekannter Anmeldefehler ist aufgetreten. Bitte versuche es erneut.';
}

export const LoginPage = () => {
	const [error] = useState<ErrorParam>(getErrorFromSearch);

	const handleLogin = () => {
		window.location.href = '/api/v1/auth/google';
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
				{/* Bewusst KEIN „Priority Pilot"-Heading: Dieser Name (als level-1-Heading) identifiziert
				    ausschließlich die Haupt-App (KolHeading `_level={1}` in `App.tsx`). Die E2E-Auth-Gate-Specs
				    (`login.spec.ts`, AK1a) prüfen, dass dieses Heading unauthentifiziert NICHT sichtbar ist;
				    da `getByRole('heading', { name })` per Default als Teilstring matcht, darf der Anmelde-Titel
				    den Text „Priority Pilot" auch nicht enthalten. */}
				<h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>Anmelden</h1>
				<p style={{ margin: 0, color: 'var(--pp-text-muted, #555)' }}>
					Melde dich mit deinem Google-Konto an, um fortzufahren.
				</p>

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
			</div>
		</div>
	);
};
