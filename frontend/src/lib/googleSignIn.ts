import { registerPlugin } from '@capacitor/core';

/**
 * Natives Plugin der Android-App (`GoogleSignInPlugin.java`, ADR 0023): holt über den Credential
 * Manager ein ID-Token von Google, ohne Browser. Nur dynamisch laden, sonst landet `@capacitor/core`
 * im Web-Bundle.
 */
type GoogleSignInPlugin = {
	/** `auto`: bekanntes Konto ohne Rückfrage, sonst Konto-Sheet. Fehler-`code`: `canceled`, `no_credential`, `failed`. */
	signIn(options: { serverClientId: string; auto: boolean }): Promise<{ idToken: string }>;
	/** Hebt die automatische Kontowahl nach dem Abmelden auf. */
	signOut(): Promise<void>;
};

export const GoogleSignIn = registerPlugin<GoogleSignInPlugin>('GoogleSignIn');
