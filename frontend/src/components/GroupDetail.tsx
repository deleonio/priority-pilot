import { KolDetails, KolAlert, KolBadge, KolButton, KolHeading, KolInputText, KolSpin } from '@public-ui/react-v19';
import type {
	Group,
	GroupInviteLink,
	GroupInvitation,
	GroupMember,
	GroupSeries,
	GroupTask,
	Task,
	UserSearchHit,
} from 'client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';
import { CopyButton } from './CopyButton';
import { DuoCard } from './DuoCard';
import { getPublicOrigin } from '../lib/siteOrigin';
import { PlanBadge } from './PlanBadge';
import { GroupChallengeCard } from './GroupChallengeCard';

/** Ab dieser Länge sucht der Server nach Namensfragmenten (kürzer: nur volle E-Mail). */
const MIN_QUERY_LENGTH = 3;

/** Debounce der Nutzersuche — bündelt Tastenschläge, statt pro Zeichen einen Request zu feuern. */
const SEARCH_DEBOUNCE_MS = 300;

/** Vollständiger Beitrittslink zu einem Token (#1226). */
const inviteLinkUrl = (token: string): string =>
	`${getPublicOrigin()}/app/gruppen/beitreten?token=${encodeURIComponent(token)}`;

/** Maskiert einen Token auf Anfang und Ende — nach dem einmaligen Voll-Blick (KI-UX #1226). */
const maskToken = (token: string): string => `${token.slice(0, 4)} … ${token.slice(-4)}`;

/** Ablaufdatum eines Links kurz in der aktiven Sprache formatiert. */
const formatExpiry = (expiresAt: string, language: string): string =>
	new Date(expiresAt).toLocaleDateString(language, { day: '2-digit', month: '2-digit', year: 'numeric' });

type GroupDetailProps = {
	groupId: number;
	ownRole: GroupMember['role'];
	/** Art der Gruppe (#1991): `duo` zeigt die Duo-Karte statt Mitglieder- und Aufgabenbereichen. */
	kind?: Group['kind'];
	/** Wechsel stößt ein Neuladen der Daten an (Klick auf die bereits aufgeklappte Gruppenkarte). */
	refreshKey?: number;
	/** DOM-Id des Detail-Containers — Ziel von `aria-controls` am Karten-Toggle (#1257). */
	id?: string;
};

/**
 * Gruppendetail (#1212 AK11): Das Wesentliche — die Mitgliederliste (Anzeigename + Rollen-Badge)
 * — steht direkt unter dem Kartenkopf; alle weiteren Bereiche (offene Einladungen, füreinander
 * angelegte Aufgaben/Serien, Nutzersuche, Einladungslinks) sind KolDetails und standardmäßig
 * zugeklappt (#1257) — so bleibt die aufgeklappte Gruppe bei 375px übersichtlich. Nur Admins
 * sehen die Nutzersuche zum Einladen und die Entfernen-Aktion je Mitglied — die Server-Rolle
 * steuert (403/404 bleiben die eigentliche Absicherung, die UI blendet nur aus).
 *
 * Die Suche ist bewusst KolInputText + eigene Ergebnisliste statt KolCombobox: @public-ui 4.3.0
 * hat keinen Filter-Hook für serverseitige Treffer (#1083).
 */
export const GroupDetail = ({ groupId, ownRole, kind = 'group', refreshKey = 0, id }: GroupDetailProps) => {
	const { t, i18n } = useTranslation(['groups', 'common']);
	const isDuo = kind === 'duo';
	const [members, setMembers] = useState<GroupMember[] | null>(null);
	// Einladen nur für Admins; ein volles Duo (2 Mitglieder) lässt keine weitere Person zu (#1991, AK3).
	const canInvite = ownRole === 'admin' && (!isDuo || (members?.length ?? 0) < 2);
	const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
	// Füreinander angelegte Aufgaben (#1223): reine Lese-Ansicht, keine Aktionen je Eintrag.
	// `null` = erster Ladevorgang — sonst blitzt der Leerzustand-Hinweis vor den ersten Daten auf.
	const [tasks, setTasks] = useState<GroupTask[] | null>(null);
	// Füreinander angelegte Serien (#1254): analoge Lese-Ansicht, wird im selben Ladevorgang
	// mitgezogen (KI-UX Regel 7: kein zweiter Spinner-Lauf, kein Springen von leer auf voll).
	const [seriesList, setSeriesList] = useState<GroupSeries[] | null>(null);
	// Offene Aufgaben der Gruppe (#1521, AK6): an die Gruppe gerichtete Aufgaben, die noch niemand
	// erledigt hat. Quelle ist die normale Aufgabenliste — der Lese-Scope liefert Mitgliedern die
	// unclaimten Gruppen-Aufgaben bereits mit; erledigte fallen durch den Claim heraus.
	const [openGroupTasks, setOpenGroupTasks] = useState<Task[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [hits, setHits] = useState<UserSearchHit[] | null>(null);
	// Nutzersuche (Audit #1257): Debounce-Timer plus laufende Anfrage — beim nächsten Tastenschlag
	// bzw. Unmount abgebrochen, damit eine späte alte Antwort keine neueren Treffer überschreibt
	// (Muster useAddressSearch).
	const searchTimerRef = useRef<number | undefined>(undefined);
	const searchAbortRef = useRef<AbortController | null>(null);
	// Mitglied, dessen Entfernung noch bestätigt werden muss (null = kein Dialog offen).
	const [pendingRemoval, setPendingRemoval] = useState<GroupMember | null>(null);
	// Initialfokus im Bestätigungsdialog: „Abbrechen" (#472 — destruktive Aktion nicht per Enter).
	const cancelRemoveRef = useRef<HTMLKolButtonElement>(null);
	// Einladungslinks (#1226), in DIESER Sitzung erzeugt — der Token wird nur bei der Erzeugung
	// übermittelt, eine serverseitige Liste existiert bewusst nicht. `copiedLinkId` markiert den
	// Link, dessen einmaliger Voll-Blick vorbei ist (fortan maskiert).
	const [inviteLinks, setInviteLinks] = useState<GroupInviteLink[]>([]);
	const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);
	// Link, dessen Ungültigmachung noch bestätigt werden muss (null = kein Dialog offen).
	const [pendingRevoke, setPendingRevoke] = useState<GroupInviteLink | null>(null);
	// Initialfokus im Bestätigungsdialog: „Abbrechen" (#472).
	const cancelRevokeRef = useRef<HTMLKolButtonElement>(null);

	const load = useCallback(async (): Promise<void> => {
		try {
			// Duo (#1991, AK2): keine Aufgaben- und Serienabfragen — nur Mitglieder und Einladungen.
			const [loadedMembers, loadedInvitations, loadedTasks, loadedSeries] = await Promise.all([
				api.getGroupMembers({ id: groupId }),
				ownRole === 'admin' ? api.getGroupInvitations({ id: groupId }) : Promise.resolve([]),
				isDuo ? Promise.resolve([]) : api.getGroupTasks({ id: groupId }),
				isDuo ? Promise.resolve([]) : api.getGroupSeries({ id: groupId }),
			]);
			setMembers(Array.isArray(loadedMembers) ? loadedMembers : []);
			setInvitations(Array.isArray(loadedInvitations) ? loadedInvitations : []);
			setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
			setSeriesList(Array.isArray(loadedSeries) ? loadedSeries : []);
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
		if (isDuo) {
			return;
		}
		// #1521 (AK6): Offene Gruppen-Aufgaben aus der normalen Aufgabenliste filtern — bewusst
		// außerhalb des Haupt-Ladevorgangs: dieser Abschnitt ist Zusatzinformation und darf die
		// Mitglieder-/Einladungsansicht bei einem Fehler nicht mit einer Fehlermeldung ersetzen.
		try {
			const allTasks = await api.listTasks();
			setOpenGroupTasks(
				(Array.isArray(allTasks) ? allTasks : []).filter(
					(task) => task.groupId === groupId && task.userId == null && task.status !== 'Done',
				),
			);
		} catch {
			setOpenGroupTasks([]);
		}
	}, [groupId, ownRole, isDuo]);

	useEffect(() => {
		void load();
	}, [load, refreshKey]);

	// Laufende Suche beim Unmount stoppen (Timer + Anfrage) — sonst setzt eine späte Antwort
	// State in einer längst geschlossenen Komponente (Muster useAddressSearch).
	useEffect(
		() => () => {
			window.clearTimeout(searchTimerRef.current);
			searchAbortRef.current?.abort();
		},
		[],
	);

	/** Hängende Suche stoppen — Timer und laufende Anfrage (etwa nach dem Einladen). */
	const cancelSearch = (): void => {
		window.clearTimeout(searchTimerRef.current);
		searchAbortRef.current?.abort();
	};

	/** Eigentliche Suche: startet erst nach dem Debounce, Ergebnis nur wenn nicht überholt. */
	const runSearch = async (trimmed: string): Promise<void> => {
		searchAbortRef.current?.abort();
		const current = new AbortController();
		searchAbortRef.current = current;
		try {
			const found = await api.searchUsers({ query: trimmed, signal: current.signal });
			if (!current.signal.aborted) {
				setHits(Array.isArray(found) ? found : []);
				setError(null);
			}
		} catch (reason) {
			if (!current.signal.aborted) {
				const apiError = await toApiError(reason);
				setError(apiError.message);
			}
		}
	};

	const handleSearch = (value: string): void => {
		setQuery(value);
		window.clearTimeout(searchTimerRef.current);
		// Laufende Anfrage sofort stoppen (nicht erst beim nächsten runSearch) — sonst könnte
		// eine alte Antwort noch während des Debounce-Fensters Treffer zur neuen Eingabe zeigen.
		searchAbortRef.current?.abort();
		const trimmed = value.trim();
		if (trimmed.length < MIN_QUERY_LENGTH && !trimmed.includes('@')) {
			cancelSearch();
			setHits(null);
			return;
		}
		searchTimerRef.current = window.setTimeout(() => void runSearch(trimmed), SEARCH_DEBOUNCE_MS);
	};

	const handleInvite = async (userId: number): Promise<void> => {
		try {
			await api.inviteGroupMember({ id: groupId, userId });
			cancelSearch();
			setQuery('');
			setHits(null);
			await load();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	};

	const handleRemove = async (userId: number): Promise<void> => {
		setPendingRemoval(null);
		try {
			await api.removeGroupMember({ id: groupId, userId });
			await load();
		} catch (reason) {
			// 409 „letzter Administrator" kommt als Server-Meldung und bleibt als KolAlert stehen.
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	};

	const handleRoleChange = async (userId: number, role: GroupMember['role']): Promise<void> => {
		try {
			await api.updateGroupMemberRole({ id: groupId, userId, role });
			await load();
		} catch (reason) {
			// 409 „letzter Administrator" kommt als Server-Meldung und bleibt als KolAlert stehen.
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	};

	// ── Einladungslinks (#1226) ───────────────────────────────────────────────────────
	// Der Server übermittelt den Token ausschließlich in der Erzeugungs-Antwort — deshalb bleibt
	// der frische Link genau einmal voll sichtbar (mit Kopieren-Aktion) und erscheint danach in
	// der Liste der offenen Links nur noch maskiert. Die Liste lebt bewusst im Komponenten-State:
	// es gibt keinen serverseitigen Listen-Endpunkt, und nach einem Neuladen sind alte Token
	// ohnehin nie wieder einsehbar.

	const handleCreateInviteLink = async (): Promise<void> => {
		try {
			const created = await api.createGroupInviteLink({ id: groupId });
			setInviteLinks((current) => [created, ...current]);
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	};

	const handleRevokeInviteLink = async (link: GroupInviteLink): Promise<void> => {
		setPendingRevoke(null);
		try {
			await api.revokeInviteLink({ id: link.id });
			setInviteLinks((current) => current.filter((entry) => entry.id !== link.id));
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	};

	return (
		<div className="group-detail" id={id}>
			{error !== null && (
				<KolAlert _type="error" _label={t('groups:detail.actionError')}>
					{error}
				</KolAlert>
			)}
			{members === null ? (
				<KolSpin _show _variant="cycle" _label={t('groups:detail.membersLoading')} />
			) : (
				<>
					{/* Kein eigener Detailkopf mehr (#1257): Avatar und Name stehen bereits im
					    Kartenkopf direkt darüber — die Duplizierung verdrängte die Mitglieder
					    unnötig nach unten. */}
					{/* #1484 (T3b AK3): Grenzstelle `groups` — das Badge beschriftet nur, gesperrt wird nichts. */}
					<PlanBadge feature="groups" />
					{/* #1992: Challenge oberhalb der Mitglieder — die häufige Aktion bleibt im Daumenbereich. */}
					<GroupChallengeCard groupId={groupId} />
					{/* Duo (#1991): die Karte ersetzt Mitgliederliste und Aufgabenbereiche; `key` lädt sie beim
					    „Daten auffrischen" neu. */}
					{isDuo && <DuoCard key={refreshKey} groupId={groupId} />}
					{!isDuo && <KolHeading _label={t('groups:detail.members')} _level={4} />}
					<ul className="group-members">
						{(isDuo ? [] : members).map((member) => (
							<li key={member.userId} className="group-member">
								<span className="group-member-name">{member.displayName}</span>
								<KolBadge _label={t(`groups:roles.${member.role}`)} />
								{ownRole === 'admin' && (
									<KolButton
										_label={
											member.role === 'admin'
												? t('groups:detail.demote', { name: member.displayName })
												: t('groups:detail.promote', { name: member.displayName })
										}
										_variant="secondary"
										_on={{
											onClick: () => void handleRoleChange(member.userId, member.role === 'admin' ? 'member' : 'admin'),
										}}
									/>
								)}
								{ownRole === 'admin' && (
									<KolButton
										_label={t('common:actions.remove')}
										_variant="danger"
										_on={{ onClick: () => setPendingRemoval(member) }}
									/>
								)}
							</li>
						))}
					</ul>
					<KolDetails _label={t('groups:detail.openInvitations')} _level={4}>
						<ul className="group-invitations">
							{invitations.map((invitation) => (
								<li key={invitation.id} className="group-invitation">
									<span className="group-member-name">{invitation.displayName}</span>
									<KolBadge _label={t('groups:detail.pending')} />
								</li>
							))}
						</ul>
					</KolDetails>
					{!isDuo && (
						<>
							{/* #1521 (AK6): Offene Aufgaben, die an die ganze Gruppe gerichtet sind — jedes Mitglied
					    kann sie erledigen. Abgegrenzt von „Füreinander angelegt" (#1223, Einzel-Empfänger). */}
							<KolDetails _label={t('groups:detail.openGroupTasks')} _level={4}>
								<div data-testid="group-open-tasks">
									{openGroupTasks === null ? (
										<KolSpin _show _variant="cycle" _label={t('groups:detail.openGroupTasksLoading')} />
									) : openGroupTasks.length === 0 ? (
										<p className="hint">{t('groups:detail.openGroupTasksEmpty')}</p>
									) : (
										<ul className="group-tasks">
											{openGroupTasks.map((task) => (
												<li key={task.id} className="group-task">
													<div className="group-task-title">{task.title}</div>
												</li>
											))}
										</ul>
									)}
								</div>
							</KolDetails>
							<KolDetails _label={t('groups:detail.tasks')} _level={4}>
								{tasks === null ? (
									<KolSpin _show _variant="cycle" _label={t('groups:detail.tasksLoading')} />
								) : tasks.length === 0 ? (
									<p className="hint">{t('groups:detail.tasksEmpty')}</p>
								) : (
									<ul className="group-tasks">
										{tasks.map((task) => (
											<li key={task.id} className="group-task">
												{/* Je eigene Zeile (KI-UX #1223): Empfänger als Haupteintrag, Titel und Ersteller
										    als Sekundärzeilen — Block-Elemente, damit lange Namen umbrechen (AK8). */}
												<div className="group-task-recipient">{task.recipientName}</div>
												<div className="group-task-title">{task.title}</div>
												<div className="group-task-creator">
													{t('groups:detail.createdBy', { name: task.creatorName })}
												</div>
											</li>
										))}
									</ul>
								)}
							</KolDetails>
							<KolDetails _label={t('groups:detail.series')} _level={4}>
								{seriesList === null ? (
									<KolSpin _show _variant="cycle" _label={t('groups:detail.seriesLoading')} />
								) : seriesList.length === 0 ? (
									<p className="hint">{t('groups:detail.seriesEmpty')}</p>
								) : (
									<ul className="group-series">
										{seriesList.map((series) => (
											<li key={series.id} className="group-series-entry">
												{/* Je eigene Zeile (KI-UX #1254): Eigentümer als Haupteintrag, Titel darunter,
										    Rhythmus und Ersteller als Sekundärzeile — Block-Elemente, damit lange
										    Namen bei 375 px umbrechen statt überlaufen (AK7). */}
												<div className="group-series-owner">{series.ownerName}</div>
												<div className="group-series-title">{series.title}</div>
												<div className="group-series-meta">
													{t('groups:detail.seriesMeta', { rhythm: series.rhythm, name: series.creatorName })}
													{!series.active && <KolBadge _label={t('groups:detail.dormant')} />}
												</div>
											</li>
										))}
									</ul>
								)}
							</KolDetails>
						</>
					)}
					{canInvite && (
						/* Eigenes aufklappbares Element statt unbeschrifteter Sektion (#1257):
						   standardmäßig zugeklappt, die Überschrift trägt den Zweck. */
						<KolDetails _label={t('groups:detail.inviteMembers')} _level={4}>
							<KolInputText
								_label={t('groups:detail.searchLabel')}
								_type="search"
								_placeholder={t('groups:detail.searchPlaceholder')}
								_value={query}
								_on={{ onInput: (_event, value) => handleSearch(String(value ?? '')) }}
							/>
							{/* Treffer als Live-Region (Audit #1257): der Wechsel zwischen leer und Trefferliste
							    wird angesagt, ohne den Fokus zu bewegen — die Region bleibt dafür bestehen. */}
							<div role="status">
								{hits !== null &&
									(hits.length === 0 ? (
										<p className="hint">{t('groups:detail.noHits')}</p>
									) : (
										<ul className="group-search-hits">
											{hits.map((hit) => (
												<li key={hit.id} className="group-search-hit">
													<span className="group-member-name">{hit.displayName}</span>
													<KolButton
														_label={t('groups:detail.invite')}
														_variant="primary"
														_on={{ onClick: () => void handleInvite(hit.id) }}
													/>
												</li>
											))}
										</ul>
									))}
							</div>
						</KolDetails>
					)}
					{canInvite && (
						/* Eigenes aufklappbares Element mit eindeutigem Namen (#1257) — „Einladungslinks“
						   statt „Einladungen“, um es von den offenen Einladungen zu unterscheiden. */
						<KolDetails _label={t('groups:detail.inviteLinks')} _level={4}>
							<section className="group-invite-links">
								<p className="hint">{t('groups:detail.inviteLinksHint')}</p>
								<KolButton
									_label={t('groups:detail.createLink')}
									_variant="secondary"
									_on={{ onClick: () => void handleCreateInviteLink() }}
								/>
								{inviteLinks.length > 0 && (
									<ul className="group-invite-links-list">
										{inviteLinks.map((link) => (
											<li key={link.id} className="group-invite-link">
												{copiedLinkId === link.id ? (
													<>
														<span className="group-invite-link-token">{maskToken(link.token)}</span>
														<span className="group-invite-link-meta">
															{t('groups:detail.validUntilCopied', {
																date: formatExpiry(link.expiresAt, i18n.language),
															})}
														</span>
													</>
												) : (
													<>
														{/* Der frische Link ist einmal voll sichtbar — direkt hier kopierbar. */}
														<div className="copy-row">
															<code className="group-invite-link-token">{inviteLinkUrl(link.token)}</code>
															<CopyButton
																text={inviteLinkUrl(link.token)}
																ariaLabel={t('groups:detail.copyLink')}
																onSuccess={() => setCopiedLinkId(link.id)}
																onError={(message) => setError(message)}
															/>
														</div>
														<span className="group-invite-link-meta">
															{t('groups:detail.validUntil', { date: formatExpiry(link.expiresAt, i18n.language) })}
														</span>
													</>
												)}
												<KolButton
													_label={t('groups:detail.revoke')}
													_variant="danger"
													_on={{ onClick: () => setPendingRevoke(link) }}
												/>
											</li>
										))}
									</ul>
								)}
							</section>
						</KolDetails>
					)}
				</>
			)}
			{pendingRemoval !== null && (
				<Modal
					title={t('groups:detail.removeTitle')}
					onClose={() => setPendingRemoval(null)}
					initialFocusRef={cancelRemoveRef as RefObject<HTMLElement | null>}
				>
					<p>
						<Trans
							t={t}
							i18nKey="groups:detail.removeText"
							components={{ name: <strong>{pendingRemoval.displayName}</strong> }}
						/>
					</p>
					<div className="modal-actions">
						<KolButton
							ref={cancelRemoveRef}
							_label={t('common:actions.cancel')}
							_variant="secondary"
							_on={{ onClick: () => setPendingRemoval(null) }}
						/>
						<KolButton
							_label={t('common:actions.remove')}
							_variant="danger"
							_on={{ onClick: () => void handleRemove(pendingRemoval.userId) }}
						/>
					</div>
				</Modal>
			)}
			{pendingRevoke !== null && (
				<Modal
					title={t('groups:detail.revokeTitle')}
					onClose={() => setPendingRevoke(null)}
					initialFocusRef={cancelRevokeRef as RefObject<HTMLElement | null>}
				>
					<p>{t('groups:detail.revokeText')}</p>
					<div className="modal-actions">
						<KolButton
							ref={cancelRevokeRef}
							_label={t('common:actions.cancel')}
							_variant="secondary"
							_on={{ onClick: () => setPendingRevoke(null) }}
						/>
						<KolButton
							_label={t('groups:detail.revoke')}
							_variant="danger"
							_on={{ onClick: () => void handleRevokeInviteLink(pendingRevoke) }}
						/>
					</div>
				</Modal>
			)}
		</div>
	);
};
