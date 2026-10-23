/**
 * PKCE für Magic Links aus der Android-App (#2563): Der Link läuft über ein Custom Scheme, das jede
 * App registrieren kann. Nur die anfordernde App kennt den Verifier; der Server bekommt beim Anfordern
 * lediglich dessen SHA-256 (Challenge) und löst den Token nur mit dem passenden Verifier ein.
 */
const VERIFIER_KEY = 'pp-magic-verifier';

export const base64url = (bytes: Uint8Array): string =>
	btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');

/** Erzeugt und speichert einen neuen Verifier und liefert seine Challenge (base64url(SHA-256)). */
export const createMagicChallenge = async (): Promise<string> => {
	const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
	localStorage.setItem(VERIFIER_KEY, verifier);
	return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
};

/** Liefert den gespeicherten Verifier genau einmal und löscht ihn (auch wenn das Einlösen scheitert). */
export const takeMagicVerifier = (): string | null => {
	const verifier = localStorage.getItem(VERIFIER_KEY);
	localStorage.removeItem(VERIFIER_KEY);
	return verifier;
};
