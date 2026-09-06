import { KolAccordion, KolAlert, KolBadge, KolButton, KolHeading, KolInputText, KolSpin } from '@public-ui/react-v19';
import type { GroupInviteLink, GroupInvitation, GroupMember, GroupSeries, GroupTask, UserSearchHit } from 'client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';

/** Rollen-Text je serverseitiger Rolle — Rolle immer als Text, nie nur als Farbe (KI-UX #1211). */
const roleLabel = (role: GroupMember['role']): string => (role === 'admin' ? 'Admin' : 'Mitglied');

/** Ab dieser Länge sucht der Server nach Namensfragmenten (kürzer: nur volle E-Mail). */
const MIN_QUERY_LENGTH = 3;

/** Debounce der Nutzersuche — bündelt Tastenschläge, statt pro Zeichen einen Request zu feuern. */
const SEARCH_DEBOUNCE_MS = 300;

/** Vollständiger Beitrittslink zu einem Token (#1226). */
const inviteLinkUrl = (token: string): string =>
	`${window.location.origin}/gruppen/beitreten?token=${encodeURIComponent(token)}`;

/** Maskiert einen Token auf Anfang und Ende — nach dem einmaligen Voll-Blick (KI-UX #1226). */
const maskToken = (token: string): string => `${token.slice(0, 4)} … ${token.slice(-4)}`;

/** Ablaufdatum eines Links kurz und deutsch formatiert. */
const formatExpiry = (expiresAt: string): string =>
	new Date(expiresAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

type GroupDetailProps = {
	groupId: number;
	ownRole: GroupMember['role'];
	/** Wechsel stößt ein Neuladen der Daten an (Klick auf die bereits aufgeklappte Gruppenkarte). */
	refreshKey?: number;
	/** DOM-Id des Detail-Containers — Ziel von `aria-controls` am Karten-Toggle (#1257). */
	id?: string;
};

/**
 * Gruppendetail (#1212 AK11): Das Wesentliche — die Mitgliederliste (Anzeigename + Rollen-Badge)
 * — steht direkt unter dem Kartenkopf; alle weiteren Bereiche (offene Einladungen, füreinander
 * angelegte Aufgaben/Serien, Nutzersuche, Einladungslinks) sind KolAccordion und standardmäßig
 * zugeklappt (#1257) — so bleibt die aufgeklappte Gruppe bei 375px übersichtlich. Nur Admins
 * sehen die Nutzersuche zum Einladen und die Entfernen-Aktion je Mitglied — die Server-Rolle
 * steuert (403/404 bleiben die eigentliche Absicherung, die UI blendet nur aus).
 *
 * Die Suche ist bewusst KolInputText + eigene Ergebnisliste statt KolCombobox: @public-ui 4.3.0
 * hat keinen Filter-Hook für serverseitige Treffer (#1083).
 */
export const GroupDetail = ({ groupId, ownRole, refreshKey = 0, id }: GroupDetailProps) => {
	const [members, setMembers] = useState<GroupMember[] | null>(null);
	const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
	// Füreinander angelegte Aufgaben (#1223): reine Lese-Ansicht, keine Aktionen je Eintrag.
	// `null` = erster Ladevorgang — sonst blitzt der Leerzustand-Hinweis vor den ersten Daten auf.
	const [tasks, setTasks] = useState<GroupTask[] | null>(null);
	// Füreinander angelegte Serien (#1254): analoge Lese-Ansicht, wird im selben Ladevorgang
	// mitgezogen (KI-UX Regel 7: kein zweiter Spinner-Lauf, kein Springen von leer auf voll).
	const [seriesList, setSeriesList] = useState<GroupSeries[] | null>(null);
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
			const [loadedMembers, loadedInvitations, loadedTasks, loadedSeries] = await Promise.all([
				api.getGroupMembers({ id: groupId }),
				ownRole === 'admin' ? api.getGroupInvitations({ id: groupId }) : Promise.resolve([]),
				api.getGroupTasks({ id: groupId }),
				api.getGroupSeries({ id: groupId }),
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
	}, [groupId, ownRole]);

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

	const handleCopyInviteLink = async (link: GroupInviteLink): Promise<void> => {
		try {
			await navigator.clipboard.writeText(inviteLinkUrl(link.token));
			// Einmal voll sichtbar, danach maskiert (KI-UX-Block): Nach dem Kopieren ist der
			// eine Blick gewesen — der Eintrag erscheint fortan nur noch als Ausschnitt.
			setCopiedLinkId(link.id);
		} catch {
			setError('Der Link konnte nicht in die Zwischenablage kopiert werden. Bitte manuell markieren und kopieren.');
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
				<KolAlert _type="error" _label="Aktion nicht möglich">
					{error}
				</KolAlert>
			)}
			{members === null ? (
				<KolSpin _show _variant="cycle" _label="Mitglieder werden geladen …" />
			) : (
				<>
					{/* Kein eigener Detailkopf mehr (#1257): Avatar und Name stehen bereits im
					    Kartenkopf direkt darüber — die Duplizierung verdrängte die Mitglieder
					    unnötig nach unten. */}
					<KolHeading _label="Mitglieder" _level={4} />
					<ul className="group-members">
						{members.map((member) => (
							<li key={member.userId} className="group-member">
								<span className="group-member-name">{member.displayName}</span>
								<KolBadge _label={roleLabel(member.role)} />
								{ownRole === 'admin' && (
									<KolButton
										_label={
											member.role === 'admin'
												? `${member.displayName} zur Mitgliedschaft zurückstufen`
												: `${member.displayName} zum Administrator machen`
										}
										_variant="secondary"
										_on={{
											onClick: () => void handleRoleChange(member.userId, member.role === 'admin' ? 'member' : 'admin'),
										}}
									/>
								)}
								{ownRole === 'admin' && (
									<KolButton _label="Entfernen" _variant="danger" _on={{ onClick: () => setPendingRemoval(member) }} />
								)}
							</li>
						))}
					</ul>
					{invitations.length > 0 && (
						<KolAccordion _label="Offene Einladungen" _level={4}>
							<ul className="group-invitations">
								{invitations.map((invitation) => (
									<li key={invitation.id} className="group-invitation">
										<span className="group-member-name">{invitation.displayName}</span>
										<KolBadge _label="Ausstehend" />
									</li>
								))}
							</ul>
						</KolAccordion>
					)}
					<KolAccordion _label="Füreinander angelegt" _level={4}>
						{tasks === null ? (
							<KolSpin _show _variant="cycle" _label="Gruppen-Aufgaben werden geladen …" />
						) : tasks.length === 0 ? (
							<p className="hint">Noch hat niemand eine Aufgabe für ein anderes Mitglied angelegt.</p>
						) : (
							<ul className="group-tasks">
								{tasks.map((task) => (
									<li key={task.id} className="group-task">
										{/* Je eigene Zeile (KI-UX #1223): Empfänger als Haupteintrag, Titel und Ersteller
										    als Sekundärzeilen — Block-Elemente, damit lange Namen umbrechen (AK8). */}
										<div className="group-task-recipient">{task.recipientName}</div>
										<div className="group-task-title">{task.title}</div>
										<div className="group-task-creator">{`von ${task.creatorName}`}</div>
									</li>
								))}
							</ul>
						)}
					</KolAccordion>
					<KolAccordion _label="Füreinander angelegte Serien" _level={4}>
						{seriesList === null ? (
							<KolSpin _show _variant="cycle" _label="Gruppen-Serien werden geladen …" />
						) : seriesList.length === 0 ? (
							<p className="hint">Noch hat niemand eine Serie für ein anderes Mitglied angelegt.</p>
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
											{`${series.rhythm} · von ${series.creatorName}`}
											{!series.active && <KolBadge _label="Ruhend" />}
										</div>
									</li>
								))}
							</ul>
						)}
					</KolAccordion>
					{ownRole === 'admin' && (
						/* Eigenes aufklappbares Element statt unbeschrifteter Sektion (#1257):
						   standardmäßig zugeklappt, die Überschrift trägt den Zweck. */
						<KolAccordion _label="Mitglieder einladen" _level={4}>
							<KolInputText
								_label="Konto suchen"
								_type="search"
								_placeholder="Name ab 3 Zeichen oder volle E-Mail"
								_value={query}
								_on={{ onInput: (_event, value) => handleSearch(String(value ?? '')) }}
							/>
							{/* Treffer als Live-Region (Audit #1257): der Wechsel zwischen leer und Trefferliste
							    wird angesagt, ohne den Fokus zu bewegen — die Region bleibt dafür bestehen. */}
							<div role="status">
								{hits !== null &&
									(hits.length === 0 ? (
										<p className="hint">Keine Konten gefunden.</p>
									) : (
										<ul className="group-search-hits">
											{hits.map((hit) => (
												<li key={hit.id} className="group-search-hit">
													<span className="group-member-name">{hit.displayName}</span>
													<KolButton
														_label="Einladen"
														_variant="primary"
														_on={{ onClick: () => void handleInvite(hit.id) }}
													/>
												</li>
											))}
										</ul>
									))}
							</div>
						</KolAccordion>
					)}
					{ownRole === 'admin' && (
						/* Eigenes aufklappbares Element mit eindeutigem Namen (#1257) — „Einladungslinks“
						   statt „Einladungen“, um es von den offenen Einladungen zu unterscheiden. */
						<KolAccordion _label="Einladungslinks" _level={4}>
							<section className="group-invite-links">
								<p className="hint">
									Über einen Link kann jeder deiner Gruppe ohne persönliche Einladung beitreten. Ein Link ist 7 Tage
									gültig und lässt sich jederzeit ungültig machen.
								</p>
								<KolButton
									_label="Link erzeugen"
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
															gültig bis {formatExpiry(link.expiresAt)} · Link kopiert
														</span>
													</>
												) : (
													<>
														{/* Der frische Link ist einmal voll sichtbar — direkt hier kopierbar. */}
														<code className="group-invite-link-token">{inviteLinkUrl(link.token)}</code>
														<span className="group-invite-link-meta">gültig bis {formatExpiry(link.expiresAt)}</span>
														<KolButton
															_label="Link kopieren"
															_variant="secondary"
															_on={{ onClick: () => void handleCopyInviteLink(link) }}
														/>
													</>
												)}
												<KolButton
													_label="Ungültig machen"
													_variant="danger"
													_on={{ onClick: () => setPendingRevoke(link) }}
												/>
											</li>
										))}
									</ul>
								)}
							</section>
						</KolAccordion>
					)}
				</>
			)}
			{pendingRemoval !== null && (
				<Modal
					title="Mitglied entfernen"
					onClose={() => setPendingRemoval(null)}
					initialFocusRef={cancelRemoveRef as RefObject<HTMLElement | null>}
				>
					<p>
						Willst du <strong>„{pendingRemoval.displayName}“</strong> wirklich aus der Gruppe entfernen? Die Person
						verliert damit den Zugriff auf die Gruppe und ihre Inhalte.
					</p>
					<div className="modal-actions">
						<KolButton
							ref={cancelRemoveRef}
							_label="Abbrechen"
							_variant="secondary"
							_on={{ onClick: () => setPendingRemoval(null) }}
						/>
						<KolButton
							_label="Entfernen"
							_variant="danger"
							_on={{ onClick: () => void handleRemove(pendingRemoval.userId) }}
						/>
					</div>
				</Modal>
			)}
			{pendingRevoke !== null && (
				<Modal
					title="Einladungslink ungültig machen"
					onClose={() => setPendingRevoke(null)}
					initialFocusRef={cancelRevokeRef as RefObject<HTMLElement | null>}
				>
					<p>
						Willst du diesen Einladungslink wirklich ungültig machen? Niemand kann damit mehr beitreten — das lässt sich
						nicht rückgängig machen. Bereits Beigetretene bleiben Mitglied.
					</p>
					<div className="modal-actions">
						<KolButton
							ref={cancelRevokeRef}
							_label="Abbrechen"
							_variant="secondary"
							_on={{ onClick: () => setPendingRevoke(null) }}
						/>
						<KolButton
							_label="Ungültig machen"
							_variant="danger"
							_on={{ onClick: () => void handleRevokeInviteLink(pendingRevoke) }}
						/>
					</div>
				</Modal>
			)}
		</div>
	);
};
