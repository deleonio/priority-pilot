export type AuthUser = {
	id: number;
	name: string;
	email: string;
};

export async function checkAuth(): Promise<AuthUser | null> {
	const response = await fetch('/api/v1/auth/me');
	if (response.status === 401) {
		return null;
	}
	if (!response.ok) {
		throw new Error(`Auth-Check fehlgeschlagen (${response.status})`);
	}
	return (await response.json()) as AuthUser;
}
