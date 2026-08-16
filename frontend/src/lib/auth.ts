export type AuthUser = {
	id: number;
	displayName: string;
	email: string;
	avatarUrl: string | null;
};

export async function checkAuth(): Promise<AuthUser | null> {
	const response = await fetch('/api/v1/auth/me');
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
