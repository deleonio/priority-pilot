import { KolAlert, KolBadge, KolButton, KolDetails, KolInputRadio, KolSpin } from '@public-ui/react-v19';
import { ResponseError, type AdminUser, type AllowedEmail, type ReassignStatusFilter, type components } from 'client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { formatEuro, paymentStatusLabel } from '../lib/format';
import { planLabel } from '../lib/planOffers';
import { useReassignRun, type ReassignPortionArgs } from '../lib/useReassignRun';
import { getApiBase } from '../lib/siteOrigin';
import { Modal } from './Modal';
import { ReassignFailureList, ReassignProgressView, ReassignStatusText } from './ReassignRunViews';

/** Statusauswahl des Neuberechnungs-Laufs (#1614) — „offen" schließt Aufgaben in Bearbeitung ein. */
const FILTER_OPTIONS: { label: string; value: ReassignStatusFilter }[] = [
	{ label: 'Alle Aufgaben', value: 'all' },
	{ label: 'Nur offene Aufgaben', value: 'open' },
	{ label: 'Nur erledigte Aufgaben', value: 'done' },
];

/** Rollen-Text je serverseitiger Rolle — Rolle immer als Text, nie nur als Farbe (analog GroupDetail). */
const roleLabel = (role: AdminUser['role']): string =>
	role === 'admin' ? 'Admin' : role === 'tester' ? 'Tester' : 'Mitglied';

/** Herkunfts-Text je Zulassung (#1982/#1983) — Herkunft immer als Text-Badge, nie nur Farbe (KI-UX). */
const ORIGIN_LABELS: Record<AllowedEmail['origin'], string> = {
	einladung: 'Einladung',
	delegation: 'Delegation',
	admin: 'Admin',
	warteliste: 'Warteliste',
};

/** Rechnung im Vertragsformat der Eigentümer-Route (#1958) — dieselben Felder wie /billing/invoices. */
type AdminInvoice = components['schemas']['Invoice'];

/** Zeitpunkte in der Rechnungsliste als „TT.MM.JJJJ" (Muster `SubscriptionSection.tsx`). */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('de-DE');

/** PDF-Download über die Admin-Route (#1958 AK2) — Anker-Muster `SubscriptionSection.tsx` (`downloadInvoicePdf`). */
const downloadAdminInvoicePdf = (userId: number, invoice: AdminInvoice): void => {
	const link = document.createElement('a');
	link.href = `${getApiBase()}/admin/users/${userId}/invoices/${invoice.id}/pdf`;
	link.download = `${invoice.number}.pdf`;
	document.body.appendChild(link);
	link.click();
	link.remove();
};

/**
 * Rechnungsansicht je Nutzer (#1958 AK3): aufklappbares `KolDetails` mit eindeutigem Label, das
 * erst beim ersten Aufklappen lädt (die Nutzerliste umfasst alle Nutzer — Eager-Fetch wäre
 * N Requests), danach gecacht. Vier Zustände nach KI-UX: Laden (KolSpin), leer, Fehler
 * (KolAlert), Liste mit Nummer, Zeitraum, Betrag, Status „Ausgestellt" und Download je Rechnung.
 */
const UserInvoices = ({ userId, displayName }: { userId: number; displayName: string }) => {
	const [invoices, setInvoices] = useState<AdminInvoice[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	// „Schon geöffnet"-Merker: weitere Klicks holen nicht neu (Lazy-Load, gecacht).
	const openedRef = useRef(false);
	const load = useCallback(async (): Promise<void> => {
		try {
			const loaded = await api.getAdminUserInvoices({ id: userId });
			setInvoices(Array.isArray(loaded) ? loaded : []);
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			// Fehlschlag gilt als „noch nicht geöffnet“ — nächster Klick versucht es erneut (Fixup #1958).
			openedRef.current = false;
		}
	}, [userId]);
	return (
		<KolDetails
			_label={`Rechnungen von ${displayName}`}
			_on={{
				onClick: () => {
					if (openedRef.current) return;
					openedRef.current = true;
					void load();
				},
			}}
		>
			{error !== null ? (
				<KolAlert _type="error" _label="Rechnungen">
					{error}
				</KolAlert>
			) : invoices === null ? (
				<KolSpin _show _variant="cycle" _label="Rechnungen werden geladen …" />
			) : invoices.length === 0 ? (
				<p>Noch keine Rechnungen vorhanden.</p>
			) : (
				<ul className="admin-invoices__list">
					{invoices.map((invoice) => (
						<li key={invoice.id} className="admin-invoices__item">
							<span>{invoice.number}</span>
							<span>
								{formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
							</span>
							<span>{formatEuro(invoice.amountCents)}</span>
							{/* Status als Text-Badge — Information nie allein über Farbe (WCAG 1.4.1, KI-UX). */}
							<KolBadge _label={paymentStatusLabel(invoice.paymentStatus)} />
							<KolButton
								_label={`PDF ${invoice.number} herunterladen`}
								_variant="secondary"
								_icons={{ left: { icon: 'fa-solid fa-download' } }}
								_on={{ onClick: () => downloadAdminInvoicePdf(userId, invoice) }}
							/>
						</li>
					))}
				</ul>
			)}
		</KolDetails>
	);
};

/** Abo-Eintrag der Nutzerverwaltung (#2295). */
type AdminSubscription = components['schemas']['AdminSubscription'];

/** Abo-Status als Text — unbekannte Status bleiben roh sichtbar statt zu verschwinden. */
const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
	active: 'Aktiv',
	approval_pending: 'Zahlung ausstehend',
	past_due: 'Zahlung überfällig',
	suspended: 'Pausiert',
	cancelled: 'Gekündigt',
	expired: 'Abgelaufen',
	locked: 'Gesperrt',
};

/**
 * Abos je Nutzer mit Lösch-Aktionen (#2295) — Lazy-Load wie {@link UserInvoices}. Löschen kündigt
 * bei PayPal und entfernt Abo samt Rechnungen restlos, daher erst nach einem Ja/Nein-Dialog (Muster
 * „Sequenzielle Bestätigung“); `onDeleted` lässt die Nutzerzeile (Paket) und Rechnungen neu laden.
 */
const UserSubscriptions = ({ user, onDeleted }: { user: AdminUser; onDeleted: () => void }) => {
	const [subscriptions, setSubscriptions] = useState<AdminSubscription[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const openedRef = useRef(false);
	// `null` = kein Dialog offen, `'all'` = alle Abos des Nutzers, sonst das eine Abo.
	const [confirm, setConfirm] = useState<AdminSubscription | 'all' | null>(null);
	const [running, setRunning] = useState(false);
	const load = useCallback(async (): Promise<void> => {
		try {
			const loaded = await api.getAdminUserSubscriptions({ id: user.id });
			setSubscriptions(Array.isArray(loaded) ? loaded : []);
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			openedRef.current = false;
		}
	}, [user.id]);
	const handleDelete = async (): Promise<void> => {
		if (confirm === null) return;
		setRunning(true);
		try {
			await api.deleteAdminUserSubscriptions({
				id: user.id,
				subscriptionId: confirm === 'all' ? undefined : confirm.id,
			});
			setConfirm(null);
			await load();
			onDeleted();
		} catch (reason) {
			// PayPal-Fehler (502): nichts gelöscht — Meldung bleibt im Abo-Bereich stehen.
			const apiError = await toApiError(reason);
			setConfirm(null);
			setError(apiError.message);
		} finally {
			setRunning(false);
		}
	};
	return (
		<KolDetails
			_label={`Abos von ${user.displayName}`}
			_on={{
				onClick: () => {
					if (openedRef.current) return;
					openedRef.current = true;
					void load();
				},
			}}
		>
			{error !== null && (
				<KolAlert _type="error" _label="Abos">
					{error}
				</KolAlert>
			)}
			{subscriptions === null ? (
				error === null && <KolSpin _show _variant="cycle" _label="Abos werden geladen …" />
			) : subscriptions.length === 0 ? (
				<p>Keine Abos vorhanden.</p>
			) : (
				<>
					<ul className="admin-subscriptions__list">
						{subscriptions.map((sub) => (
							<li key={sub.id} className="admin-subscriptions__item">
								<span>{`#${sub.id} ${planLabel(sub.plan)}`}</span>
								<span>seit {formatDate(sub.createdAt)}</span>
								<KolBadge _label={SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status} />
								<KolButton
									_label={`Abo #${sub.id} löschen`}
									_variant="secondary"
									_disabled={running}
									_on={{ onClick: () => setConfirm(sub) }}
								/>
							</li>
						))}
					</ul>
					<KolButton
						_label="Alle Abos dieses Nutzers löschen"
						_variant="secondary"
						_disabled={running}
						_on={{ onClick: () => setConfirm('all') }}
					/>
				</>
			)}
			{confirm !== null && (
				<Modal title={confirm === 'all' ? 'Alle Abos löschen' : 'Abo löschen'} onClose={() => setConfirm(null)}>
					<p>
						{confirm === 'all'
							? `Alle Abos von ${user.displayName} beim Zahlungsdienstleister kündigen und samt Rechnungen restlos löschen? Danach steht ${user.displayName} auf Free.`
							: `Abo #${confirm.id} (${planLabel(confirm.plan)}) von ${user.displayName} beim Zahlungsdienstleister kündigen und samt Rechnungen restlos löschen?`}{' '}
						Zahlungen werden nicht erstattet.
					</p>
					<div className="modal-actions">
						<KolButton
							_label="Abbrechen"
							_variant="secondary"
							_disabled={running}
							_on={{ onClick: () => setConfirm(null) }}
						/>
						<KolButton
							_label={running ? 'Lösche …' : 'Jetzt löschen'}
							_variant="danger"
							_disabled={running}
							_on={{ onClick: () => void handleDelete() }}
						/>
					</div>
				</Modal>
			)}
		</KolDetails>
	);
};

/** Meldung je Ablehnungsgrund der Konto-Löschung (#2327) — feste Texte statt Server-Meldung, mit nächstem Schritt. */
const DELETE_REFUSALS: Record<string, string> = {
	subscription_active:
		'Das Konto hat ein laufendes Abo. Erst „Alle Abos dieses Nutzers löschen“ ausführen, dann erneut versuchen.',
	last_group_admin:
		'Das Konto ist letzter Admin einer Gruppe mit weiteren Mitgliedern. Erst einen anderen Admin bestimmen.',
	paypal_unavailable: 'PayPal ist gerade nicht erreichbar. Später erneut versuchen.',
};
const DELETE_FALLBACK = 'Das Konto konnte nicht gelöscht werden. Bitte erneut versuchen.';

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
export const AdminUsersSection = ({ currentUserId }: { currentUserId?: number }) => {
	const [users, setUsers] = useState<AdminUser[] | null>(null);
	const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[] | null>(null);
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

	// #1983 (AK6): Zugelassene Adressen mit Herkunft — eigener Loader, damit ein Fehler der
	// Nutzerliste die Zulassungsliste nicht mitleert (und umgekehrt).
	const loadAllowedEmails = useCallback(async (): Promise<void> => {
		try {
			const loaded = await api.getAllowedEmails();
			setAllowedEmails(Array.isArray(loaded) ? loaded : []);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		void loadAllowedEmails();
	}, [loadAllowedEmails]);

	// Batch: Säulenverteilung aller Aufgaben neu berechnen (Admin-Trigger). Zweistufige
	// Bestätigung nach dem UX-Pattern „Sequenzielle Bestätigung“: erst die Absicht, dann
	// der Hinweis auf die KI-Kosten — pro Schritt nur eine Ja/Nein-Entscheidung.
	const [confirmStep, setConfirmStep] = useState<'closed' | 'intent' | 'costs'>('closed');
	// Statusauswahl des Laufs (#1614) — „offen" umfasst auch Aufgaben in Bearbeitung.
	const [filter, setFilter] = useState<ReassignStatusFilter>('all');
	// Neustart über alle Konten oder Fortsetzen der seit dem letzten Start noch offenen Aufgaben.
	const [mode, setMode] = useState<'restart' | 'resume'>('restart');

	// #1959: Abo-Aktion je Nutzerzeile — `null` = kein Bestätigungsdialog offen.
	const [subConfirm, setSubConfirm] = useState<{ user: AdminUser; kind: 'lock' | 'cancel' } | null>(null);
	// Läuft gerade eine Abo-Aktion — Dialog-Buttons sind dann disabled (Doppel-Submit-Schutz).
	const [subRunning, setSubRunning] = useState(false);
	// #2295: Zähler zum Neuaufbau der Rechnungsansichten nach dem Löschen von Abos (Lazy-Cache leeren).
	const [invoicesVersion, setInvoicesVersion] = useState(0);

	// #2327: Konto-Löschung je Nutzerzeile — zwei Ja/Nein-Schritte (Muster #1729), `null` = kein Dialog.
	const [deleteTarget, setDeleteTarget] = useState<{ user: AdminUser; step: 'intent' | 'scope' } | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);
	// Ref-Guard: reale Klicks feuern `_on.onClick` UND Host-`onClick` (Doppel-Submit trotz `_disabled`).
	const deletingRef = useRef(false);

	// Portionierter Lauf, Fortschritt und Fortsetzen: gemeinsam mit dem Nutzer-Modal in
	// `useReassignRun`, damit beide Einstiege nicht wieder auseinanderlaufen.
	const runPortion = useCallback(
		(args: ReassignPortionArgs) => api.reassignTaskPillars({ status: filter, ...args }),
		[filter],
	);
	const loadStatus = useCallback(() => api.getReassignPillarsStatus({ status: filter }), [filter]);
	const { run, status, canResume, start } = useReassignRun({ runPortion, loadStatus });
	const running = run.phase === 'processing';

	const startReassign = (): void => {
		setConfirmStep('closed');
		void start(mode === 'restart');
	};

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

	// #1959 AK1/AK2: bestätigte Abo-Aktion ausführen — Erfolg lädt die Liste neu (Zeilen-Status
	// sofort sichtbar), Fehler (409 bereits gekündigt / Google-Play) bleiben als KolAlert stehen
	// (Muster Rollenwechsel).
	const handleSubAction = async (): Promise<void> => {
		if (subConfirm === null) {
			return;
		}
		setSubRunning(true);
		try {
			if (subConfirm.kind === 'lock') {
				await api.lockUserSubscription({ id: subConfirm.user.id });
			} else {
				await api.cancelUserSubscription({ id: subConfirm.user.id });
			}
			setSubConfirm(null);
			await load();
		} catch (reason) {
			const apiError = await toApiError(reason);
			await load();
			setError(apiError.message);
		} finally {
			setSubRunning(false);
		}
	};

	const closeDelete = (): void => {
		setDeleteTarget(null);
		setDeleteError(null);
	};

	// #2327: bestätigte Löschung — Erfolg schließt den Dialog und lädt die Liste neu, 409/502 bleiben
	// als KolAlert im offenen Dialog stehen (Konto bleibt).
	const handleDeleteUser = async (): Promise<void> => {
		if (deleteTarget === null || deletingRef.current) {
			return;
		}
		deletingRef.current = true;
		setDeleting(true);
		setDeleteError(null);
		try {
			await api.deleteAdminUser({ id: deleteTarget.user.id });
			closeDelete();
			await load();
		} catch (reason) {
			const code = reason instanceof ResponseError ? (reason.body as { code?: unknown } | undefined)?.code : undefined;
			setDeleteError((typeof code === 'string' && DELETE_REFUSALS[code]) || DELETE_FALLBACK);
		} finally {
			deletingRef.current = false;
			setDeleting(false);
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
								{/* #1783 AK7: Verbrauch des laufenden Monats — Zusatzzeile, keine eigene Spalte (375px). */}
								<span className="admin-user-ai">{`KI-Anfragen diesen Monat: ${user.aiRequestsThisMonth ?? 0}`}</span>
								<KolBadge _label={roleLabel(user.role)} />
								{/* #1556 AK1: Paket immer als Text-Badge (nie nur Farbe), in jeder Zeile. */}
								<KolBadge _label={planLabel(user.plan)} />
								{/* #1959 AK1: Sperr-Status dauerhaft in der Zeile sichtbar (Text-Badge). */}
								{user.subscriptionStatus === 'locked' && <KolBadge _label="Gesperrt" />}
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
								{(user.subscriptionStatus !== null || user.id !== currentUserId) && (
									<div className="admin-user-actions">
										{/* #1959 AK4: Einstieg je Aktion — die Bestätigung folgt im Dialog
										    (Muster „Sequenzielle Bestätigung“); _variant="secondary", die
										    Primary-Fläche bleibt dem bestätigenden Button vorbehalten. */}
										{user.subscriptionStatus !== null && (
											<>
												<KolButton
													_label="Abo sperren"
													_variant="secondary"
													_disabled={subRunning}
													_on={{ onClick: () => setSubConfirm({ user, kind: 'lock' }) }}
												/>
												<KolButton
													_label="Abo stornieren"
													_variant="secondary"
													_disabled={subRunning}
													_on={{ onClick: () => setSubConfirm({ user, kind: 'cancel' }) }}
												/>
											</>
										)}
										{/* #2327: Konto löschen — nicht beim eigenen Eintrag, am Ende der Gruppe (Slip-Schutz);
										    Bestätigung zweistufig im Dialog unten. */}
										{user.id !== currentUserId && (
											<KolButton
												_label="Konto löschen"
												_variant="secondary"
												_on={{ onClick: () => setDeleteTarget({ user, step: 'intent' }) }}
											/>
										)}
									</div>
								)}
								{/* #1958 AK3: Rechnungsansicht je Nutzer — aufklappbar, Lazy-Load beim ersten Aufklappen. */}
								{/* #2295: Abos je Nutzer mit Lösch-Aktionen — nur bei vorhandenem Abo. */}
								{user.subscriptionStatus !== null && (
									<UserSubscriptions
										user={user}
										onDeleted={() => {
											setInvoicesVersion((version) => version + 1);
											void load();
										}}
									/>
								)}
								<UserInvoices key={`${user.id}-${invoicesVersion}`} userId={user.id} displayName={user.displayName} />
							</li>
						))}
					</ul>
					{/* #1983 (AK6): Zugelassene Adressen als eigene Liste im Karten-Listenmuster —
					    eigene Klassen, damit Bestands-Lokatoren (.admin-user) unberührt bleiben.
					    Herkunft als Text-Badge (KI-UX), Abschnitt nur bei Einträgen sichtbar. */}
					{allowedEmails !== null && allowedEmails.length > 0 && (
						<>
							<h4 className="admin-allowed-heading">Freigeschaltete Adressen</h4>
							<ul className="admin-allowed-list">
								{allowedEmails.map((entry) => (
									<li key={entry.email} className="admin-allowed-email">
										<span className="admin-user-email">{entry.email}</span>
										<KolBadge _label={ORIGIN_LABELS[entry.origin]} />
									</li>
								))}
							</ul>
						</>
					)}
				</>
			)}
			<div className="admin-reassign">
				{!running && status !== null && status.total > 0 && (
					<ReassignStatusText status={status} testId="reassign-batch-status" />
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
					{canResume && status !== null && (
						<KolButton
							_label={`Fortsetzen (${status.pending} offen)`}
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
				{running && <ReassignProgressView run={run} />}
				{run.phase === 'completed' && run.error !== null && (
					<KolAlert _type="error" _label="Neuberechnung fehlgeschlagen">
						{run.error}
					</KolAlert>
				)}
				{run.phase === 'completed' && run.error === null && (
					<KolAlert _type={run.failed === 0 ? 'info' : 'warning'} _label="Neuberechnung abgeschlossen">
						<p>
							{run.updated} Aufgaben neu zugeordnet, {run.skipped} unverändert gelassen, {run.failed} fehlgeschlagen.
						</p>
						{run.failed > 0 && <ReassignFailureList reasons={run.failureReasons} />}
					</KolAlert>
				)}
			</div>
			{/* #1729: EINE persistente Modal-Instanz über beide Schritte (Muster GroupDeleteDialog) —
			    der Schrittwechsel tauscht nur Titel und Kinder statt die Dialog-Instanz neu zu
			    mounten, deren Öffnen-Effekt (showModal nach Promise-Auflösung) vor dem
			    Document-Einhängen laufen kann (InvalidStateError). */}
			{confirmStep !== 'closed' && (
				<Modal
					title={confirmStep === 'intent' ? 'Säulenverteilung neu berechnen' : 'KI-Kosten bestätigen'}
					onClose={() => setConfirmStep('closed')}
				>
					{confirmStep === 'intent' ? (
						<>
							<p>
								Sollen die Säulen-Beiträge der Aufgaben ALLER Konten anhand von Titel und Beschreibung neu berechnet
								werden? Status, Punkte und Streak bleiben unverändert.
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
						</>
					) : (
						<>
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
									_on={{ onClick: startReassign }}
								/>
							</div>
						</>
					)}
				</Modal>
			)}
			{/* #1959 AK4: Bestätigung je Abo-Aktion — ein reiner Ja/Nein-Schritt mit den konkreten
				    Konsequenzen (Sperre wirkt sofort, Storno läuft bis zum Periodenende weiter). Der
				    bestätigende Button benennt die Aktion („Jetzt sperren“/„Jetzt stornieren“) und während
				    des Requests den Fortschritt („Sperre …“/„Storniere …“, Muster „Berechne …“, #2105),
				    Abbrechen setzt keinen Request ab; beim Schließen kehrt der Fokus auf den auslösenden
				    Button zurück (Modal, verbindliches Pattern). */}
			{subConfirm !== null && (
				<Modal
					title={subConfirm.kind === 'lock' ? 'Abo sperren' : 'Abo stornieren'}
					onClose={() => setSubConfirm(null)}
				>
					<p>
						{subConfirm.kind === 'lock'
							? `Den Zugriff von ${subConfirm.user.displayName} auf das bezahlte Paket (${planLabel(subConfirm.user.plan)}) sofort sperren? Die Sperre wirkt sofort.`
							: `Das Abo von ${subConfirm.user.displayName} (${planLabel(subConfirm.user.plan)}) beim Zahlungsdienstleister kündigen? Das Paket läuft bis zum Ende des bezahlten Zeitraums weiter.`}
					</p>
					<div className="modal-actions">
						<KolButton
							_label="Abbrechen"
							_variant="secondary"
							_disabled={subRunning}
							_on={{ onClick: () => setSubConfirm(null) }}
						/>
						<KolButton
							_label={
								subRunning
									? subConfirm.kind === 'lock'
										? 'Sperre …'
										: 'Storniere …'
									: subConfirm.kind === 'lock'
										? 'Jetzt sperren'
										: 'Jetzt stornieren'
							}
							_variant="primary"
							_disabled={subRunning}
							_on={{ onClick: () => void handleSubAction() }}
						/>
					</div>
				</Modal>
			)}
			{/* #2327: EINE persistente Modal-Instanz über beide Schritte (Muster #1729). */}
			{deleteTarget !== null && (
				<Modal title="Konto löschen" onClose={closeDelete}>
					{deleteError !== null && (
						<KolAlert _type="error" _label="Löschen nicht möglich">
							{deleteError}
						</KolAlert>
					)}
					{deleteTarget.step === 'intent' ? (
						<>
							<p className="admin-delete-text">
								Konto von <strong>{deleteTarget.user.displayName}</strong> (<strong>{deleteTarget.user.email}</strong>)
								wirklich löschen?
							</p>
							<div className="modal-actions">
								<KolButton _label="Abbrechen" _variant="secondary" _on={{ onClick: closeDelete }} />
								<KolButton
									_label="Weiter"
									_variant="primary"
									_on={{ onClick: () => setDeleteTarget({ user: deleteTarget.user, step: 'scope' }) }}
								/>
							</div>
						</>
					) : (
						<>
							<p>
								Persönliche Daten und Feedback werden entfernt. Rechnungen und Abo-Datensätze bleiben wegen der
								Aufbewahrungspflicht. Das lässt sich nicht rückgängig machen.
							</p>
							<div className="modal-actions">
								<KolButton
									_label="Abbrechen"
									_variant="secondary"
									_disabled={deleting}
									_on={{ onClick: closeDelete }}
								/>
								<KolButton
									_label={deleting ? 'Wird gelöscht …' : 'Konto endgültig löschen'}
									_variant="danger"
									_disabled={deleting}
									_on={{ onClick: () => void handleDeleteUser() }}
								/>
							</div>
						</>
					)}
				</Modal>
			)}
		</div>
	);
};
