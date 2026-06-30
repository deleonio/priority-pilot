export type AuthUser = {
	id: number;
	name: string;
	email: string;
};

export async function checkAuth(): Promise<AuthUser | null> {
	const response = await fetch('/auth/me');
	if (!response.ok) {
		return null;
	}
	return (await response.json()) as AuthUser;
}
