import { KolAlert, KolBadge, KolButton, KolInputRadio, KolSpin } from '@public-ui/react-v19';
import type { AdminUser, ReassignPillarsResult } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { planLabel } from '../lib/planOffers';
import { Modal } from './Modal';

/** Rollen-Text je serverseitiger Rolle — Rolle immer als Text, nie nur als Farbe (analog GroupDetail). */
const roleLabel = (role: AdminUser['role']): string =>
	role === 'admin' ? 'Admin' : role === 'tester' ? 'Tester' : 'Mitglied';

/** Optionen der Rollen-Radiogruppe je Zeile — stabile Objektidentität wie in `AppearanceSetting.tsx`. */
const ROLE_OPTIONS: { label: string; value: AdminUser['role'] }[] = [
	{ label: 'Admin', value: 'admin' },
	{ label: 'Mitglied', value: 'member' },
	{ label: 'Tester', value: 'tester' },
];

/**
 * Nutzerverwaltung für Admins (Rollensystem admin/member/tester): listet alle Nutzer der App und
 * erlaubt das Setzen der Rolle über eine Radiogruppe je Zeile (admin/member/tester, #1566). Nur
 * clientseitig ausgeblendet für Member (Tab-Sichtbarkeit in `SettingsPage`) — die eigentliche
 * Absicherung ist `requireRole('admin')` im Backend; ein 403 (z. B. abgelaufene Admin-Rechte)
 * landet als Fehlermeldung hier.
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
	// Offset der Portionierungs-Serie (Finding #5): ohne ihn träfe „Fortsetzen" wieder dieselbe
	// erste Portion. Summe aus updated+failed+skipped aller Läufe dieser Serie; ein neuer Start
	// (Button „Säulenverteilung … neu berechnen") beginnt wieder bei 0.
	const [offset, setOffset] = useState(0);
	const startReassign = useCallback(
		async (resume: boolean): Promise<void> => {
			setRunning(true);
			try {
				const result = await api.reassignTaskPillars(resume ? offset : 0);
				setSummary(result);
				setOffset((resume ? offset : 0) + result.updated + result.failed + result.skipped);
				setConfirmStep('closed');
				setError(null);
			} catch (reason) {
				const apiError = await toApiError(reason);
				setError(apiError.message);
				setConfirmStep('closed');
			} finally {
				setRunning(false);
			}
		},
		[offset],
	);
	const handleRoleChange = async (id: number, role: AdminUser['role']): Promise<void> => {
		try {
			await api.updateUserRole({ id, role });
			await load();
		} catch (reason) {
			// 409 „letzter Administrator" kommt als Server-Meldung und bleibt als KolAlert stehen.
			const apiError = await toApiError(reason);
			// Neu laden, damit die Radiogruppe (eigener Zustand im Custom Element, #1616 Finding #1)
			// nicht auf der abgelehnten Rolle stehen bleibt, während Badge/Server die alte zeigen.
			// Nach `setError`, da `load()` bei Erfolg `setError(null)` setzt — sonst verschwände
			// die Fehlermeldung sofort wieder.
			await load();
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
								<KolInputRadio
									_label={`Rolle von ${user.displayName}`}
									_orientation="horizontal"
									_options={ROLE_OPTIONS}
									_value={user.role}
									_on={{
										onChange: (_event, value) => {
											if (typeof value === 'string') {
												void handleRoleChange(user.id, value as AdminUser['role']);
											}
										},
									}}
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
					_on={{
						onClick: () => {
							setOffset(0);
							setConfirmStep('intent');
						},
					}}
				/>
				{summary !== null && (
					<KolAlert _type="info" _label="Neuberechnung abgeschlossen">
						{summary.updated} Aufgaben neu zugeordnet, {summary.skipped} unverändert gelassen, {summary.failed}{' '}
						fehlgeschlagen ({summary.users} Konten). {summary.remaining} Aufgaben noch offen.
					</KolAlert>
				)}
				{summary !== null && summary.remaining > 0 && (
					<KolButton
						_label="Weitere Aufgaben neu berechnen (Fortsetzen)"
						_variant="secondary"
						_disabled={running}
						_on={{ onClick: () => void startReassign(true) }}
					/>
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
							_on={{ onClick: () => void startReassign(false) }}
						/>
					</div>
				</Modal>
			)}
		</div>
	);
};
