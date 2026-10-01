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

/** Empfehlungs-Code aus dem persönlichen Link (`?ref=…`), falls der Einstieg darüber erfolgt (#1982). */
function getRefFromSearch(): string | null {
	return new URLSearchParams(window.location.search).get('ref');
}

type MagicLinkState = 'idle' | 'sending' | 'sent' | 'failed';
type WaitlistState = 'idle' | 'sending' | 'done' | 'failed';

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
	// Tab-Session-Cache: Wiederkehrende Besuche (OAuth-Redirect, Logout, Session-Ablauf) rendern die
	// Sektion sofort und ohne Layout-Shift; der Fetch im Hintergrund bestätigt den Stand frisch.
	const [magicLinkEnabled, setMagicLinkEnabled] = useState(() => {
		try {
			return sessionStorage.getItem('pp-magic-link-enabled') === '1';
		} catch {
			return false;
		}
	});
	const [email, setEmail] = useState('');
	const [magicLinkState, setMagicLinkState] = useState<MagicLinkState>('idle');
	const [referralRef] = useState(getRefFromSearch);
	const [waitlistEmail, setWaitlistEmail] = useState('');
	const [waitlistState, setWaitlistState] = useState<WaitlistState>('idle');
	const [waitlistResult, setWaitlistResult] = useState<{ position: number; total?: number; link: string } | null>(null);
	const [referralCopied, setReferralCopied] = useState(false);

	useEffect(() => {
		api
			.getAuthProviders()
			.then((providers) => {
				try {
					sessionStorage.setItem('pp-magic-link-enabled', providers.magicLink ? '1' : '0');
				} catch {
					// Storage verweigert — der Fetch entscheidet weiterhin live je Antwort.
				}
				setMagicLinkEnabled(providers.magicLink);
			})
			// Fetch-Fehler überschreiben den Cache nicht — ein Netzwerkblipp ist keine Config-Änderung.
			.catch(() => undefined);
	}, []);

	const handleMagicLink = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMagicLinkState('sending');
		api
			.requestMagicLink(email)
			.then(() => setMagicLinkState('sent'))
			.catch(() => setMagicLinkState('failed'));
	};

	// Wartelisten-Eintrag (#1982): idempotent — ein wiederholter Eintrag (auch Duplikat) ist
	// Erfolg und zeigt dieselbe Position erneut. Der ref-Code kommt aus dem persönlichen Link.
	const handleWaitlistJoin = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setWaitlistState('sending');
		api
			.addToWaitlist(waitlistEmail, referralRef ?? undefined)
			.then(({ position, referralCode, total }) => {
				setWaitlistResult({
					position,
					total,
					link: `${window.location.origin}/app/?ref=${referralCode}`,
				});
				setWaitlistState('done');
			})
			.catch(() => setWaitlistState('failed'));
	};

	const copyReferralLink = async () => {
		if (waitlistResult === null) {
			return;
		}
		try {
			await navigator.clipboard.writeText(waitlistResult.link);
			setReferralCopied(true);
			window.setTimeout(() => setReferralCopied(false), 2000);
		} catch {
			// Clipboard verweigert — der Link bleibt lesbar sichtbar, das Kopieren entfällt nur.
		}
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
					{/* Wortmarke je Theme als eigenes SVG: ein <img> erbt weder currentColor noch Web-Fonts
					    (#1741, AK2). Bewusst EIN img: zwei Varianten im DOM würden beide geladen (je 38 KB).
					    applyInitialTheme() läuft vor dem ersten Render, und auf der Login-Seite gibt es keinen
					    Theme-Umschalter — daher reicht die einmalige Entscheidung hier. */}
					<img
						className="login-page__brand-wordmark"
						src={`${import.meta.env.BASE_URL}logo/logo-with-name.horizontal${
							document.documentElement.dataset.theme === 'dark' ? '.dark' : ''
						}.svg`}
						alt="Balamentum"
						width={240}
						height={35}
					/>
				</div>
				<div className="login-page__card">
					<h1 className="login-page__title">Anmelden</h1>
					<p className="login-page__sub">Melde dich an, um fortzufahren.</p>

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
						Mit Google anmelden
					</button>

					{magicLinkEnabled && (
						<form onSubmit={handleMagicLink} className="login-page__form">
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
								{magicLinkState === 'sending' ? 'Wird gesendet …' : 'Anmeldelink senden'}
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

				{/* Warteliste des Launch-Zugangs (#1982, ADR 0019) — eigene Card, getrennt von der
					    Anmeldung (immer sichtbar, nicht an SMTP/magicLink gebunden). Duplikat-Eintrag ist
					    Erfolg: Position + Empfehlungs-Link erscheinen erneut (AK1/AK5). */}
				<div className="login-page__card">
					<h2 className="login-page__card-title">Noch ohne Zugang?</h2>
					<form onSubmit={handleWaitlistJoin} className="login-page__form">
						<label className="login-page__label" htmlFor="waitlist-email">
							Auf die Warteliste per E-Mail
						</label>
						<input
							id="waitlist-email"
							type="email"
							autoComplete="email"
							required
							placeholder="name@beispiel.de"
							value={waitlistEmail}
							onChange={(event) => setWaitlistEmail(event.target.value)}
							className="login-page__input"
						/>
						<button
							type="submit"
							disabled={waitlistState === 'sending'}
							className="login-page__btn login-page__btn--secondary"
						>
							{waitlistState === 'sending' ? 'Wird eingetragen …' : 'Auf die Warteliste'}
						</button>
						{waitlistState === 'done' && waitlistResult !== null && (
							<>
								<p role="status" className="login-page__status login-page__status--waitlist">
									<span>
										Position {waitlistResult.position}
										{typeof waitlistResult.total === 'number' ? ` von ${waitlistResult.total}` : ''} — je mehr
										Freundinnen und Freunde du einlädst, desto weiter rückst du auf.
									</span>
									<a
										className="login-page__ref-link"
										href={waitlistResult.link}
										target="_blank"
										rel="noopener noreferrer"
									>
										{waitlistResult.link}
										<span className="visually-hidden"> (öffnet in neuem Tab)</span>
									</a>
								</p>
								<button
									type="button"
									onClick={() => void copyReferralLink()}
									aria-live="polite"
									className="login-page__btn login-page__btn--secondary"
								>
									{referralCopied ? 'Kopiert ✓' : 'Empfehlungs-Link kopieren'}
								</button>
							</>
						)}
						{waitlistState === 'failed' && (
							<p role="alert" className="login-page__alert">
								Der Eintrag auf die Warteliste hat gerade nicht geklappt. Bitte versuche es gleich noch einmal.
							</p>
						)}
					</form>
				</div>

				{/* Zurück zur öffentlichen Website — nur im Web, in der App gibt es dort nichts (#1769) */}
				{!isNativeChannel() && (
					<a className="login-page__back" href="/" aria-label="Balamentum: Zurück zur Website">
						Zurück zur Website
					</a>
				)}
			</div>
		</div>
	);
};
