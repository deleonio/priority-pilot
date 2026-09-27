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

function getErrorMessage(error: string): string {
	return ERROR_MESSAGES[error] ?? 'Ein unbekannter Anmeldefehler ist aufgetreten. Bitte versuche es erneut.';
}

// Bewusst rohe Elemente (h1, button, input, div-Alerts) statt KoliBri: Die Shadow-DOM-Typografie
// von kol-heading ließe sich hier nicht über --pp-Tokens steuern, KoliBri-Klicks und -Eingaben
// riskieren die etablierten Verträge (Unit-Tests lesen textContent der Alerts, E2E klickt die
// Buttons und liest getByLabelText; vgl. Locator-Erfahrung #1421). Styling zentral über
// .login-page-* in app.css. Die Heading-Namen tragen bewusst NICHT „Balamentum": Dieser Name
// (als level-1-Heading) identifiziert ausschließlich die Haupt-App (KolHeading `_level={1}` in
// `App.tsx`); die E2E-Auth-Gate-Specs (`login.spec.ts`, AK1a) prüfen, dass dieses Heading
// unauthentifiziert NICHT sichtbar ist, und `getByRole('heading', { name })` matcht per Default
// als Teilstring — das Logo-Bild ist kein Heading und kollidiert damit nicht.
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
		<div className="login-page">
			<div className="login-page__inner">
				<div className="login-page__brand">
					{/* Wortmarke je Theme als eigenes SVG: ein <img> erbt weder currentColor noch Web-Fonts (#1741, AK2) */}
					<img
						className="login-page__brand-wordmark login-page__brand-wordmark--light"
						src={`${import.meta.env.BASE_URL}logo/logo-with-name.horizontal.svg`}
						alt="Balamentum"
						width={240}
						height={35}
					/>
					<img
						className="login-page__brand-wordmark login-page__brand-wordmark--dark"
						src={`${import.meta.env.BASE_URL}logo/logo-with-name.horizontal.dark.svg`}
						alt="Balamentum"
						width={240}
						height={35}
					/>
				</div>
				<h1 className="login-page__title">Anmelden</h1>
				<p className="login-page__sub">Melde dich an, um fortzufahren.</p>

				<div className="login-page__card">
					{error !== null && (
						<div role="alert" className="login-page__alert">
							{getErrorMessage(error)}
						</div>
					)}

					<button type="button" onClick={handleLogin} className="login-page__btn login-page__btn--primary">
						<span className="login-page__btn-icon" aria-hidden="true">
							{/* Offizielles Vierfarben-G (Google-Brand), 18×18 */}
							<svg width="18" height="18" viewBox="0 0 18 18">
								<path
									fill="#4285F4"
									d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
								/>
								<path
									fill="#34A853"
									d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
								/>
								<path
									fill="#FBBC05"
									d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"
								/>
								<path
									fill="#EA4335"
									d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
								/>
							</svg>
						</span>
						Login with Google
					</button>

					{magicLinkEnabled && (
						<form
							onSubmit={handleMagicLink}
							style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pp-gap-tight)' }}
						>
							<p className="login-page__divider">oder</p>
							<label className="login-page__label" htmlFor="magic-link-email">
								Anmeldelink per E-Mail
							</label>
							<input
								id="magic-link-email"
								// Einstieg über „Mit E-Mail anmelden" auf der Website (`?login=email`).
								autoFocus={new URLSearchParams(window.location.search).get('login') === 'email'}
								type="email"
								autoComplete="email"
								required
								placeholder="name@beispiel.de"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								className="login-page__input"
							/>
							<button
								type="submit"
								disabled={magicLinkState === 'sending'}
								className="login-page__btn login-page__btn--secondary"
							>
								Anmeldelink senden
							</button>
							{magicLinkState === 'sent' && (
								<p role="status" className="login-page__status">
									Falls die Adresse zugelassen ist, ist ein Anmeldelink unterwegs. Schau in dein Postfach.
								</p>
							)}
							{magicLinkState === 'failed' && (
								<p role="alert" className="login-page__alert">
									Der Link konnte gerade nicht angefordert werden. Bitte versuche es gleich noch einmal.
								</p>
							)}
						</form>
					)}
				</div>
			</div>
		</div>
	);
};
