import { KolAlert, KolBadge, KolButton, KolSpin } from '@public-ui/react-v19';
import type { AdminUser } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';

/** Rollen-Text je serverseitiger Rolle — Rolle immer als Text, nie nur als Farbe (analog GroupDetail). */
const roleLabel = (role: AdminUser['role']): string => (role === 'admin' ? 'Admin' : 'Mitglied');

/**
 * Nutzerverwaltung für Admins (Rollensystem admin/member): listet alle Nutzer der App und
 * erlaubt das Umschalten der Rolle. Nur clientseitig ausgeblendet für Member (Tab-Sichtbarkeit
 * in `SettingsPage`) — die eigentliche Absicherung ist `requireRole('admin')` im Backend; ein
 * 403 (z. B. abgelaufene Admin-Rechte) landet als Fehlermeldung hier.
 */
export const AdminUsersSection = () => {
	const [users, setUsers] = useState<AdminUser[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async (): Promise<void> => {
		try {
			const loaded = await api.getAdminUsers();
			setUsers(Array.isArray(loaded) ? loaded : []);
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const handleRoleChange = async (id: number, role: AdminUser['role']): Promise<void> => {
		try {
			await api.updateUserRole({ id, role });
			await load();
		} catch (reason) {
			// 409 „letzter Administrator" kommt als Server-Meldung und bleibt als KolAlert stehen.
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	};

	return (
		<div className="admin-users">
			{error !== null && (
				<KolAlert _type="error" _label="Aktion nicht möglich">
					{error}
				</KolAlert>
			)}
			{users === null ? (
				<KolSpin _show _variant="cycle" _label="Nutzer werden geladen …" />
			) : (
				<>
					{/* Keine eigene Überschrift mehr: Tab-Reiter („Nutzerverwaltung") und Karten-Label
					    („Nutzer und Rollen", SettingsPage) benennen den Abschnitt bereits — die H4 war die
					    dritte Wiederholung desselben Namens (Design-Lauf 2026-09). */}
					<ul className="admin-user-list">
						{users.map((user) => (
							<li key={user.id} className="admin-user">
								<span className="admin-user-name">{user.displayName}</span>
								<span className="admin-user-email">{user.email}</span>
								<KolBadge _label={roleLabel(user.role)} />
								<KolButton
									_label={
										user.role === 'admin'
											? `${user.displayName} zur Mitgliedschaft zurückstufen`
											: `${user.displayName} zum Administrator machen`
									}
									_variant="secondary"
									_on={{ onClick: () => void handleRoleChange(user.id, user.role === 'admin' ? 'member' : 'admin') }}
								/>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	);
};
