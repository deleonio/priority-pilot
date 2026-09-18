import { KolAlert, KolBadge, KolButton, KolSelect, KolSpin } from '@public-ui/react-v19';
import type { AdminUser } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { planLabel, type Plan } from '../lib/planOffers';

/** Rollen-Text je serverseitiger Rolle — Rolle immer als Text, nie nur als Farbe (analog GroupDetail). */
const roleLabel = (role: AdminUser['role']): string => (role === 'admin' ? 'Admin' : 'Mitglied');

/**
 * Paket-Auswahl in der Reihenfolge des Serververtrags (`PLAN_VALUES`, server/src/logics/plans.ts).
 * Labels über `planLabel` — dieselbe Quelle wie das Zeilen-Badge, damit Auswahl und Anzeige
 * niemals auseinanderlaufen (#1556 AK2).
 */
const PLAN_OPTIONS: Array<{ label: string; value: Plan }> = (['free', 'pro', 'max', 'ultimate'] as Plan[]).map(
	(plan) => ({ label: planLabel(plan), value: plan }),
);

/**
 * Nutzerverwaltung für Admins (Rollensystem admin/member): listet alle Nutzer der App und
 * erlaubt das Umschalten der Rolle. Nur clientseitig ausgeblendet für Member (Tab-Sichtbarkeit
 * in `SettingsPage`) — die eigentliche Absicherung ist `requireRole('admin')` im Backend; ein
 * 403 (z. B. abgelaufene Admin-Rechte) landet als Fehlermeldung hier.
 *
 * #1556: Jede Zeile zeigt ihr Paket als Badge; die Auswahl zum kostenfreien Selbst-Wechsel
 * steht bewusst NUR in der Zeile des eigenen Kontos (`currentUserId`) — die Server-Route
 * bleibt universell (manuelle Vergabe bis T7, #1456 AK6), das UI reduziert auf Selbstbedienung.
 */
export const AdminUsersSection = ({ currentUserId }: { currentUserId?: number }) => {
	const [users, setUsers] = useState<AdminUser[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	/** Sperrt die Paket-Auswahl während des laufenden PATCH (Race-Schutz bei schnellen Wechseln). */
	const [planPending, setPlanPending] = useState(false);

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

	/** #1556 AK3: PATCH + Liste neu laden — das neue Badge erscheint ohne Seitenreload. */
	const handlePlanChange = async (id: number, plan: Plan): Promise<void> => {
		try {
			setPlanPending(true);
			await api.updateUserPlan({ id, plan });
			await load();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setPlanPending(false);
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
								{/* #1556 AK1: Paket immer als Text-Badge (nie nur Farbe), in jeder Zeile. */}
								<KolBadge _label={planLabel(user.plan)} />
								{user.id === currentUserId && (
									/* #1556 AK2: Auswahl nur in der eigenen Zeile, mit Zeilenkontext im
									    Label (Badge und Auswahl sind sonst nicht unterscheidbar, KI-UX). */
									<span className="admin-user-plan">
										<KolSelect
											_label={`Eigenes Paket von ${user.displayName}`}
											_options={PLAN_OPTIONS}
											_value={user.plan}
											_disabled={planPending}
											_on={{
												onChange: (_event, value) => void handlePlanChange(user.id, String(value) as Plan),
											}}
										/>
									</span>
								)}
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
