import { User } from '../models/index.js';

/**
 * OAuth-Profil-Sync (Issue #1238). Ein Google-Profil (E-Mail, Name, Avatar) wird mit der
 * `users`-Zeile abgeglichen: Bestandsnutzer bekommen geänderte Profilfelder nachgezogen
 * (bisher nur `avatarUrl` — `displayName` blieb in der DB stehen und die Gruppenmitglieder-
 * liste zeigte endlos den alten Namen), neue E-Mails werden mit dem Google-Profil angelegt.
 *
 * Der Rückgabewert ist bewusst die DB-Zeile (nicht die Profil-Variablen): Er ist die Basis
 * für den Session-Nutzer in `done()` — damit tragen `/auth/me` und `GET /groups/:id/members`
 * (Live-Lese aus `users`) denselben Namen. OAuth-Nutzer haben kein Passwort — der Sentinel
 * verhindert bcrypt-Login über die /auth/login-Route.
 *
 * E-Mail-Allowlist (`isEmailAllowed`) bleibt im Aufrufort (GoogleStrategy-Verify in
 * `express/index.ts`) — sie ist Teil der Route-Registrierung, nicht des Upserts.
 */
export async function upsertOAuthUser({
	email,
	displayName,
	avatarUrl,
}: {
	email: string;
	displayName: string | null;
	avatarUrl: string | null;
}): Promise<{ id: number; email: string; displayName: string; avatarUrl: string | null }> {
	// Fallback wie bisher: ohne Profilname gilt die E-Mail (identisch in Zeile und Rückgabe).
	const resolvedDisplayName = displayName ?? email;

	const [user, created] = await User.findOrCreate({
		where: { email },
		defaults: { email, passwordHash: '__oauth__', displayName: resolvedDisplayName, avatarUrl },
	});

	// Bestandsnutzer: abweichende Profilfelder nachziehen (Muster des bisherigen avatarUrl-Syncs).
	// #1256: Ein selbst über PUT /profile gesetzter Name (`displayNameCustom`) wird vom
	// Google-Profil NICHT mehr überschrieben — nur der Avatar folgt weiterhin jedem Login.
	if (!created && (user.displayName !== resolvedDisplayName || user.avatarUrl !== avatarUrl)) {
		await user.update({
			displayName: user.displayNameCustom ? user.displayName : resolvedDisplayName,
			avatarUrl,
		});
	}

	return { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl };
}
