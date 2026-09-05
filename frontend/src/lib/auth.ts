export type AuthUser = {
	id: number;
	displayName: string;
	email: string;
	avatarUrl: string | null;
};

/**
 * Session-Marker (#1231): Der `SessionExpiredDialog` setzt ihn, wenn der Nutzer das Neuladen
 * bestätigt. `Root.tsx` erlaubt genau dafür EINEN weiteren stillen Google-Login, obwohl in dieser
 * Browser-Session bereits einer lief (`pp_silent_attempted`) — und räumt den Marker nach der
 * Entscheidung wieder weg, damit der Bonus nicht auf spätere Abläufe übertragen wird.
 */
export const SESSION_RELOAD_KEY = 'pp_session_reload';

export async function checkAuth(): Promise<AuthUser | null> {
	// Issue #1136: Der Auth-Check braucht eine Zeitgrenze — ohne Abort bliebe Root beim hängenden
	// /auth/me-Request dauerhaft im Lade-Spinner. Nur dieser Request wird abgebrochen; die
	// Google-Top-Level-Navigation selbst ist clientseitig nicht abbrechbar.
	const response = await fetch('/api/v1/auth/me', { signal: AbortSignal.timeout(30_000) });
	if (response.status === 401) {
		return null;
	}
	if (!response.ok) {
		throw new Error(`Auth-Check fehlgeschlagen (${response.status})`);
	}
	const json = (await response.json()) as AuthUser;
	// Issue #217: avatarUrl explizit auf null normalisieren (undefined -> null),
	// falls die API kein avatarUrl-Feld liefert (z. B. Passwort-User).
	return { ...json, avatarUrl: (json as { avatarUrl?: string | null }).avatarUrl ?? null };
}
