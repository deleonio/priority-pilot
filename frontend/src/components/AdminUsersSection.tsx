import { KolAlert, KolBadge, KolButton, KolInputRadio, KolProgress, KolSpin } from '@public-ui/react-v19';
import type { AdminUser, OwnReassignPillarsStatus, ReassignPillarsResult, ReassignStatusFilter } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { planLabel } from '../lib/planOffers';
import { Modal } from './Modal';

/** Statusauswahl des Neuberechnungs-Laufs (#1614) — „offen" schließt Aufgaben in Bearbeitung ein. */
const FILTER_OPTIONS: { label: string; value: ReassignStatusFilter }[] = [
	{ label: 'Alle Aufgaben', value: 'all' },
	{ label: 'Nur offene Aufgaben', value: 'open' },
	{ label: 'Nur erledigte Aufgaben', value: 'done' },
];

/**
 * Aufgaben je Server-Aufruf des Batches (#1614). Klein, damit der Fortschrittsbalken während des
 * Laufs weiterläuft — mit dem Server-Default von 200 stand er bis zum Ende eines einzigen langen
 * Requests auf „0 / 0“.
 */
const REASSIGN_BATCH_SIZE = 5;

const describeReason = (reason: string): string =>
	reason === 'HTTP 429' ? 'HTTP 429 (Rate-Limit des KI-Anbieters)' : reason;

const formatStartedAt = (iso: string): string =>
	new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

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
	// Statusauswahl des Laufs (#1614) — „offen" umfasst auch Aufgaben in Bearbeitung.
	const [filter, setFilter] = useState<ReassignStatusFilter>('all');
	// Fortschritt der Portionierungs-Serie: verarbeitete Aufgaben und Gesamtzahl der Auswahl.
	const [progress, setProgress] = useState({ processed: 0, total: 0 });
	// Neustart über alle Konten oder Fortsetzen der seit dem letzten Start noch offenen Aufgaben.
	const [mode, setMode] = useState<'restart' | 'resume'>('restart');
	// Stand des Batches (#1614) — Grundlage für „Fortsetzen“.
	const [batchStatus, setBatchStatus] = useState<OwnReassignPillarsStatus | null>(null);

	const loadBatchStatus = useCallback(async (): Promise<void> => {
		try {
			setBatchStatus(await api.getReassignPillarsStatus({ status: filter }));
		} catch {
			setBatchStatus(null);
		}
	}, [filter]);

	useEffect(() => {
		void loadBatchStatus();
	}, [loadBatchStatus]);

	const canResume =
		batchStatus !== null &&
		batchStatus.startedAt !== null &&
		batchStatus.pending > 0 &&
		batchStatus.pending < batchStatus.total;

	/**
	 * Der Server verarbeitet je Aufruf höchstens eine Portion und meldet über `remaining`, wie
	 * viele Aufgaben noch offen sind. Statt den Admin „Fortsetzen" klicken zu lassen (Finding #5:
	 * ohne mitgezählten Offset traf jeder Folgeaufruf wieder dieselbe erste Portion), ruft dieser
	 * Lauf selbst nach, bis nichts mehr offen ist — daraus speist sich der Fortschrittsbalken.
	 */
	const startReassign = useCallback(async (): Promise<void> => {
		setRunning(true);
		setConfirmStep('closed');
		setSummary(null);
		setProgress({ processed: 0, total: 0 });

		// `offset` zählt nur die Fehlschläge dieser Serie: Erfolgreich verarbeitete fallen serverseitig
		// aus der Auswahl, die fehlgeschlagenen bleiben vorn in ihr stehen.
		let offset = 0;
		let processed = 0;
		let first = true;
		const totals = { updated: 0, failed: 0, skipped: 0, users: 0 };
		const failureReasons: Record<string, number> = {};
		try {
			for (;;) {
				const result = await api.reassignTaskPillars({
					offset,
					status: filter,
					limit: REASSIGN_BATCH_SIZE,
					restart: first && mode === 'restart',
				});
				first = false;
				const consumed = result.updated + result.failed + result.skipped;
				totals.updated += result.updated;
				totals.failed += result.failed;
				totals.skipped += result.skipped;
				totals.users = Math.max(totals.users, result.users);
				for (const [reason, count] of Object.entries(result.failureReasons ?? {})) {
					failureReasons[reason] = (failureReasons[reason] ?? 0) + count;
				}
				offset += result.failed;
				processed += consumed;

				setProgress({ processed, total: processed + result.remaining });
				setSummary({ ...totals, failureReasons: { ...failureReasons }, remaining: result.remaining });
				setError(null);

				// `consumed === 0` bricht ab, auch wenn der Server noch Aufgaben meldet — sonst liefe
				// die Schleife endlos, falls eine Portion nichts mehr verarbeiten kann.
				if (result.remaining === 0 || consumed === 0) {
					return;
				}
			}
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setRunning(false);
			void loadBatchStatus();
		}
	}, [filter, mode, loadBatchStatus]);
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
				{!running && batchStatus?.startedAt != null && batchStatus.total > 0 && (
					<p data-testid="reassign-batch-status">
						Stand seit {formatStartedAt(batchStatus.startedAt)}:{' '}
						<strong>
							{batchStatus.total - batchStatus.pending} von {batchStatus.total}
						</strong>{' '}
						Aufgaben neu berechnet
						{batchStatus.pending > 0 ? `, ${batchStatus.pending} noch offen.` : '.'}
					</p>
				)}
				<div className="modal-actions">
					<KolButton
						_label="Säulenverteilung aller Aufgaben neu berechnen"
						_variant="secondary"
						_disabled={running}
						_on={{
							onClick: () => {
								setMode('restart');
								setConfirmStep('intent');
							},
						}}
					/>
					{canResume && (
						<KolButton
							_label={`Fortsetzen (${batchStatus.pending} offen)`}
							_variant="primary"
							_disabled={running}
							_on={{
								onClick: () => {
									// Direkt zur Kostenbestätigung: Die Absicht ist mit dem Fortsetzen klar.
									setMode('resume');
									setConfirmStep('costs');
								},
							}}
						/>
					)}
				</div>
				{running &&
					(progress.total === 0 ? (
						// Vor der ersten Antwort ist die Gesamtzahl unbekannt — kein „0 / 0“.
						<p>Ermittle Aufgaben und verarbeite die erste Portion…</p>
					) : (
						<>
							<p>
								Verarbeite Aufgaben…{' '}
								<strong>
									{progress.processed} / {progress.total}
								</strong>
							</p>
							<KolProgress
								_variant="bar"
								_max={progress.total}
								_value={progress.processed}
								_label="Fortschritt der Neuberechnung"
							/>
						</>
					))}
				{!running && summary !== null && (
					<KolAlert _type={summary.failed === 0 ? 'info' : 'warning'} _label="Neuberechnung abgeschlossen">
						<p>
							{summary.updated} Aufgaben neu zugeordnet, {summary.skipped} unverändert gelassen, {summary.failed}{' '}
							fehlgeschlagen ({summary.users} Konten).
						</p>
						{summary.failed > 0 && (
							<ul>
								{Object.entries(summary.failureReasons ?? {}).map(([reason, count]) => (
									<li key={reason}>
										{describeReason(reason)}: {count}
									</li>
								))}
							</ul>
						)}
					</KolAlert>
				)}
			</div>
			{confirmStep === 'intent' && (
				<Modal title="Säulenverteilung neu berechnen" onClose={() => setConfirmStep('closed')}>
					<p>
						Sollen die Säulen-Beiträge der Aufgaben ALLER Konten anhand von Titel und Beschreibung neu berechnet werden?
						Status, Punkte und Streak bleiben unverändert.
					</p>
					<div className="form-grid">
						<KolInputRadio
							_label="Filter"
							_options={FILTER_OPTIONS}
							_value={filter}
							_on={{
								onChange: (_event, value) => {
									const next = FILTER_OPTIONS.find((option) => option.value === value);
									if (next !== undefined) {
										setFilter(next.value);
									}
								},
							}}
						/>
					</div>
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
							_label={running ? 'Berechne …' : mode === 'resume' ? 'Jetzt fortsetzen' : 'Jetzt neu berechnen'}
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
