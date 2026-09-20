import { KolAlert, KolBadge, KolButton, KolSpin } from '@public-ui/react-v19';
import type { AdminUser, ReassignPillarsResult } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { planLabel } from '../lib/planOffers';
import { Modal } from './Modal';

/** Rollen-Text je serverseitiger Rolle — Rolle immer als Text, nie nur als Farbe (analog GroupDetail). */
const roleLabel = (role: AdminUser['role']): string =>
	role === 'admin' ? 'Admin' : role === 'tester' ? 'Tester' : 'Mitglied';

/**
 * Nutzerverwaltung für Admins (Rollensystem admin/member): listet alle Nutzer der App und
 * erlaubt das Umschalten der Rolle. Nur clientseitig ausgeblendet für Member (Tab-Sichtbarkeit
 * in `SettingsPage`) — die eigentliche Absicherung ist `requireRole('admin')` im Backend; ein
 * 403 (z. B. abgelaufene Admin-Rechte) landet als Fehlermeldung hier.
 *
 * #1556: Jede Zeile zeigt ihr Paket als Badge. Die Auswahl zum kostenfreien Selbst-Wechsel ist
 * seit #1565 in die eigene Karte im Tab Pakete gezogen (`OwnPlanCard`) — die Server-Route bleibt
 * universell (manuelle Vergabe bis T7, #1456 AK6), das UI hier ist rein lesend.
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

	// Batch: Säulenverteilung aller Aufgaben neu berechnen (Admin-Trigger). Zweistufige
	// Bestätigung nach dem UX-Pattern „Sequenzielle Bestätigung“: erst die Absicht, dann
	// der Hinweis auf die KI-Kosten — pro Schritt nur eine Ja/Nein-Entscheidung.
	const [confirmStep, setConfirmStep] = useState<'closed' | 'intent' | 'costs'>('closed');
	const [running, setRunning] = useState(false);
	const [summary, setSummary] = useState<ReassignPillarsResult | null>(null);
	const startReassign = useCallback(async (): Promise<void> => {
		setRunning(true);
		try {
			const result = await api.reassignTaskPillars();
			setSummary(result);
			setConfirmStep('closed');
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setConfirmStep('closed');
		} finally {
			setRunning(false);
		}
	}, []);
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
								{/* #1556 AK1: Paket immer als Text-Badge (nie nur Farbe), in jeder Zeile. */}
								<KolBadge _label={planLabel(user.plan)} />
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
			<div className="admin-reassign">
				<KolButton
					_label="Säulenverteilung aller Aufgaben neu berechnen"
					_variant="secondary"
					_disabled={running}
					_on={{ onClick: () => setConfirmStep('intent') }}
				/>
				{summary !== null && (
					<KolAlert _type="info" _label="Neuberechnung abgeschlossen">
						{summary.updated} Aufgaben neu zugeordnet, {summary.skipped} unverändert gelassen, {summary.failed}{' '}
						fehlgeschlagen ({summary.users} Konten).
					</KolAlert>
				)}
			</div>
			{confirmStep === 'intent' && (
				<Modal title="Säulenverteilung neu berechnen" onClose={() => setConfirmStep('closed')}>
					<p>
						Sollen die Säulen-Beiträge ALLER Aufgaben — auch der erledigten — anhand von Titel und Beschreibung neu
						berechnet werden? Status, Punkte und Streak bleiben unverändert.
					</p>
					<div className="modal-actions">
						<KolButton
							_label="Abbrechen"
							_variant="secondary"
							_disabled={running}
							_on={{ onClick: () => setConfirmStep('closed') }}
						/>
						<KolButton
							_label="Weiter"
							_variant="primary"
							_disabled={running}
							_on={{ onClick: () => setConfirmStep('costs') }}
						/>
					</div>
				</Modal>
			)}
			{confirmStep === 'costs' && (
				<Modal title="KI-Kosten bestätigen" onClose={() => setConfirmStep('closed')}>
					<p>
						Jede Aufgabe wird einzeln per KI klassifiziert — das verbraucht Kontingent und kann bei vielen Aufgaben
						dauern. Aufgaben ohne brauchbaren Vorschlag behalten ihre bisherige Zuordnung.
					</p>
					<div className="modal-actions">
						<KolButton
							_label="Abbrechen"
							_variant="secondary"
							_disabled={running}
							_on={{ onClick: () => setConfirmStep('closed') }}
						/>
						<KolButton
							_label={running ? 'Berechne …' : 'Jetzt neu berechnen'}
							_variant="primary"
							_disabled={running}
							_on={{ onClick: () => void startReassign() }}
						/>
					</div>
				</Modal>
			)}
		</div>
	);
};
