import { KolAlert, KolBadge, KolButton, KolDetails, KolInputRadio, KolSpin } from '@public-ui/react-v19';
import { ResponseError, type AdminUser, type AllowedEmail, type ReassignStatusFilter, type components } from 'client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../api';
import i18next from '../i18n/config';
import { toApiError } from '../lib/apiError';
import { formatEuro, paymentStatusLabel } from '../lib/format';
import { planLabel } from '../lib/planOffers';
import { useReassignRun, type ReassignPortionArgs } from '../lib/useReassignRun';
import { getApiBase } from '../lib/siteOrigin';
import { Modal } from './Modal';
import { ReassignFailureList, ReassignProgressView, ReassignStatusText } from './ReassignRunViews';

/** Statusauswahl des Neuberechnungs-Laufs (#1614) — „offen" schließt Aufgaben in Bearbeitung ein. */
const FILTER_VALUES: ReassignStatusFilter[] = ['all', 'open', 'done'];

/** Rollen-Text je serverseitiger Rolle — Rolle immer als Text, nie nur als Farbe (analog GroupDetail). */
const roleLabel = (role: AdminUser['role']): string =>
	i18next.t(`admin:adminUsers.roles.${role === 'admin' || role === 'tester' ? role : 'member'}`);

/** Herkunfts-Text je Zulassung (#1982/#1983) — Herkunft immer als Text-Badge, nie nur Farbe (KI-UX). */
const originLabel = (origin: AllowedEmail['origin']): string => i18next.t(`admin:adminUsers.origins.${origin}`);

/** Rechnung im Vertragsformat der Eigentümer-Route (#1958) — dieselben Felder wie /billing/invoices. */
type AdminInvoice = components['schemas']['Invoice'];

/** Zeitpunkte in der Rechnungsliste als „TT.MM.JJJJ" (Muster `SubscriptionSection.tsx`). */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString(i18next.language);

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
	const { t } = useTranslation(['admin', 'billing']);
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
			_label={t('adminUsers.invoicesOf', { name: displayName })}
			_on={{
				onClick: () => {
					if (openedRef.current) return;
					openedRef.current = true;
					void load();
				},
			}}
		>
			{error !== null ? (
				<KolAlert _type="error" _label={t('billing:invoices.label')}>
					{error}
				</KolAlert>
			) : invoices === null ? (
				<KolSpin _show _variant="cycle" _label={t('billing:invoices.loading')} />
			) : invoices.length === 0 ? (
				<p>{t('billing:invoices.empty')}</p>
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
								_label={t('billing:invoices.download', { number: invoice.number })}
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
const subscriptionStatusLabel = (status: string): string =>
	i18next.t(`admin:adminUsers.subscriptionStatus.${status}`, { defaultValue: status });

/**
 * Abos je Nutzer mit Lösch-Aktionen (#2295) — Lazy-Load wie {@link UserInvoices}. Löschen kündigt
 * bei PayPal und entfernt Abo samt Rechnungen restlos, daher erst nach einem Ja/Nein-Dialog (Muster
 * „Sequenzielle Bestätigung“); `onDeleted` lässt die Nutzerzeile (Paket) und Rechnungen neu laden.
 */
const UserSubscriptions = ({ user, onDeleted }: { user: AdminUser; onDeleted: () => void }) => {
	const { t } = useTranslation(['admin', 'common']);
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
			_label={t('adminUsers.subscriptionsOf', { name: user.displayName })}
			_on={{
				onClick: () => {
					if (openedRef.current) return;
					openedRef.current = true;
					void load();
				},
			}}
		>
			{error !== null && (
				<KolAlert _type="error" _label={t('adminUsers.subscriptionsLabel')}>
					{error}
				</KolAlert>
			)}
			{subscriptions === null ? (
				error === null && <KolSpin _show _variant="cycle" _label={t('adminUsers.subscriptionsLoading')} />
			) : subscriptions.length === 0 ? (
				<p>{t('adminUsers.subscriptionsEmpty')}</p>
			) : (
				<>
					<ul className="admin-subscriptions__list">
						{subscriptions.map((sub) => (
							<li key={sub.id} className="admin-subscriptions__item">
								<span>{`#${sub.id} ${planLabel(sub.plan)}`}</span>
								<span>{t('adminUsers.since', { date: formatDate(sub.createdAt) })}</span>
								<KolBadge _label={subscriptionStatusLabel(sub.status)} />
								<KolButton
									_label={t('adminUsers.deleteSubscription', { id: sub.id })}
									_variant="secondary"
									_disabled={running}
									_on={{ onClick: () => setConfirm(sub) }}
								/>
							</li>
						))}
					</ul>
					<KolButton
						_label={t('adminUsers.deleteAllSubscriptions')}
						_variant="secondary"
						_disabled={running}
						_on={{ onClick: () => setConfirm('all') }}
					/>
				</>
			)}
			{confirm !== null && (
				<Modal
					title={confirm === 'all' ? t('adminUsers.deleteAllTitle') : t('adminUsers.deleteOneTitle')}
					onClose={() => setConfirm(null)}
				>
					<p>
						{confirm === 'all'
							? t('adminUsers.deleteAllText', { name: user.displayName })
							: t('adminUsers.deleteOneText', {
									id: confirm.id,
									plan: planLabel(confirm.plan),
									name: user.displayName,
								})}
					</p>
					<div className="modal-actions">
						<KolButton
							_label={t('common:actions.cancel')}
							_variant="secondary"
							_disabled={running}
							_on={{ onClick: () => setConfirm(null) }}
						/>
						<KolButton
							_label={running ? t('adminUsers.deleting') : t('adminUsers.deleteNow')}
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
const DELETE_REFUSALS = new Set(['subscription_active', 'last_group_admin', 'paypal_unavailable']);

/** Optionen der Rollen-Radiogruppe je Zeile — stabile Objektidentität wie in `AppearanceSetting.tsx`. */
const ROLE_VALUES: AdminUser['role'][] = ['admin', 'member', 'tester'];

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
	const { t } = useTranslation(['admin', 'common']);
	// Stabile Objektidentität je Sprache (Radiogruppen, Muster `AppearanceSetting.tsx`).
	const roleOptions = useMemo(
		() => ROLE_VALUES.map((value) => ({ label: t(`adminUsers.roles.${value}`), value })),
		[t],
	);
	const filterOptions = useMemo(
		() => FILTER_VALUES.map((value) => ({ label: t(`adminUsers.filter.${value}`), value })),
		[t],
	);
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
	// Ablehnungsgrund als Schlüssel unter `adminUsers.deleteRefusals`.
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
			setDeleteError(typeof code === 'string' && DELETE_REFUSALS.has(code) ? code : 'fallback');
		} finally {
			deletingRef.current = false;
			setDeleting(false);
		}
	};

	return (
		<div className="admin-users">
			{error !== null && (
				<KolAlert _type="error" _label={t('adminUsers.actionFailed')}>
					{error}
				</KolAlert>
			)}
			{users === null ? (
				<KolSpin _show _variant="cycle" _label={t('adminUsers.usersLoading')} />
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
								<span className="admin-user-ai">
									{t('adminUsers.aiRequests', { count: user.aiRequestsThisMonth ?? 0 })}
								</span>
								<KolBadge _label={roleLabel(user.role)} />
								{/* #1556 AK1: Paket immer als Text-Badge (nie nur Farbe), in jeder Zeile. */}
								<KolBadge _label={planLabel(user.plan)} />
								{/* #1959 AK1: Sperr-Status dauerhaft in der Zeile sichtbar (Text-Badge). */}
								{user.subscriptionStatus === 'locked' && <KolBadge _label={t('adminUsers.locked')} />}
								<KolInputRadio
									_label={t('adminUsers.roleOf', { name: user.displayName })}
									_orientation="horizontal"
									_options={roleOptions}
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
													_label={t('adminUsers.lockSubscription')}
													_variant="secondary"
													_disabled={subRunning}
													_on={{ onClick: () => setSubConfirm({ user, kind: 'lock' }) }}
												/>
												<KolButton
													_label={t('adminUsers.cancelSubscription')}
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
												_label={t('adminUsers.deleteAccount')}
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
							<h4 className="admin-allowed-heading">{t('adminUsers.allowedHeading')}</h4>
							<ul className="admin-allowed-list">
								{allowedEmails.map((entry) => (
									<li key={entry.email} className="admin-allowed-email">
										<span className="admin-user-email">{entry.email}</span>
										<KolBadge _label={originLabel(entry.origin)} />
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
						_label={t('adminUsers.reassign')}
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
							_label={t('adminUsers.resume', { count: status.pending })}
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
					<KolAlert _type="error" _label={t('adminUsers.reassignFailed')}>
						{run.error}
					</KolAlert>
				)}
				{run.phase === 'completed' && run.error === null && (
					<KolAlert _type={run.failed === 0 ? 'info' : 'warning'} _label={t('adminUsers.reassignCompleted')}>
						<p>{t('adminUsers.reassignSummary', { updated: run.updated, skipped: run.skipped, failed: run.failed })}</p>
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
					title={confirmStep === 'intent' ? t('adminUsers.reassignTitle') : t('adminUsers.costsTitle')}
					onClose={() => setConfirmStep('closed')}
				>
					{confirmStep === 'intent' ? (
						<>
							<p>{t('adminUsers.reassignIntent')}</p>
							<div className="form-grid">
								<KolInputRadio
									_label={t('adminUsers.filter.label')}
									_options={filterOptions}
									_value={filter}
									_on={{
										onChange: (_event, value) => {
											const next = FILTER_VALUES.find((option) => option === value);
											if (next !== undefined) {
												setFilter(next);
											}
										},
									}}
								/>
							</div>
							<div className="modal-actions">
								<KolButton
									_label={t('common:actions.cancel')}
									_variant="secondary"
									_disabled={running}
									_on={{ onClick: () => setConfirmStep('closed') }}
								/>
								<KolButton
									_label={t('adminUsers.next')}
									_variant="primary"
									_disabled={running}
									_on={{ onClick: () => setConfirmStep('costs') }}
								/>
							</div>
						</>
					) : (
						<>
							<p>{t('adminUsers.costsText')}</p>
							<div className="modal-actions">
								<KolButton
									_label={t('common:actions.cancel')}
									_variant="secondary"
									_disabled={running}
									_on={{ onClick: () => setConfirmStep('closed') }}
								/>
								<KolButton
									_label={
										running
											? t('adminUsers.calculating')
											: mode === 'resume'
												? t('adminUsers.resumeNow')
												: t('adminUsers.reassignNow')
									}
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
					title={subConfirm.kind === 'lock' ? t('adminUsers.lockSubscription') : t('adminUsers.cancelSubscription')}
					onClose={() => setSubConfirm(null)}
				>
					<p>
						{subConfirm.kind === 'lock'
							? t('adminUsers.lockText', { name: subConfirm.user.displayName, plan: planLabel(subConfirm.user.plan) })
							: t('adminUsers.cancelText', {
									name: subConfirm.user.displayName,
									plan: planLabel(subConfirm.user.plan),
								})}
					</p>
					<div className="modal-actions">
						<KolButton
							_label={t('common:actions.cancel')}
							_variant="secondary"
							_disabled={subRunning}
							_on={{ onClick: () => setSubConfirm(null) }}
						/>
						<KolButton
							_label={
								subRunning
									? subConfirm.kind === 'lock'
										? t('adminUsers.locking')
										: t('adminUsers.cancelling')
									: subConfirm.kind === 'lock'
										? t('adminUsers.lockNow')
										: t('adminUsers.cancelNow')
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
				<Modal title={t('adminUsers.deleteAccount')} onClose={closeDelete}>
					{deleteError !== null && (
						<KolAlert _type="error" _label={t('adminUsers.deleteFailed')}>
							{t(`adminUsers.deleteRefusals.${deleteError}`)}
						</KolAlert>
					)}
					{deleteTarget.step === 'intent' ? (
						<>
							<p className="admin-delete-text">
								<Trans
									t={t}
									i18nKey="adminUsers.deleteIntent"
									components={{
										name: <strong>{deleteTarget.user.displayName}</strong>,
										email: <strong>{deleteTarget.user.email}</strong>,
									}}
								/>
							</p>
							<div className="modal-actions">
								<KolButton _label={t('common:actions.cancel')} _variant="secondary" _on={{ onClick: closeDelete }} />
								<KolButton
									_label={t('adminUsers.next')}
									_variant="primary"
									_on={{ onClick: () => setDeleteTarget({ user: deleteTarget.user, step: 'scope' }) }}
								/>
							</div>
						</>
					) : (
						<>
							<p>{t('adminUsers.deleteScope')}</p>
							<div className="modal-actions">
								<KolButton
									_label={t('common:actions.cancel')}
									_variant="secondary"
									_disabled={deleting}
									_on={{ onClick: closeDelete }}
								/>
								<KolButton
									_label={deleting ? t('adminUsers.deletingAccount') : t('adminUsers.deleteAccountFinal')}
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
