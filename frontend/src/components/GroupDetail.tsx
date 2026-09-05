import { KolAlert, KolBadge, KolButton, KolHeading, KolInputText, KolSpin } from '@public-ui/react-v19';
import type { GroupInvitation, GroupMember, UserSearchHit } from 'client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';

/** Rollen-Text je serverseitiger Rolle — Rolle immer als Text, nie nur als Farbe (KI-UX #1211). */
const roleLabel = (role: GroupMember['role']): string => (role === 'admin' ? 'Admin' : 'Mitglied');

/** Ab dieser Länge sucht der Server nach Namensfragmenten (kürzer: nur volle E-Mail). */
const MIN_QUERY_LENGTH = 3;

type GroupDetailProps = {
	groupId: number;
	ownRole: GroupMember['role'];
};

/**
 * Gruppendetail (#1212 AK11): Mitgliederliste (Anzeigename + Rollen-Badge) und darunter die
 * offenen Einladungen mit dem Hinweis „Ausstehend". Nur Admins sehen die Nutzersuche zum
 * Einladen und die Entfernen-Aktion je Mitglied — die Server-Rolle steuert (403/404 bleiben
 * die eigentliche Absicherung, die UI blendet nur aus).
 *
 * Die Suche ist bewusst KolInputText + eigene Ergebnisliste statt KolCombobox: @public-ui 4.3.0
 * hat keinen Filter-Hook für serverseitige Treffer (#1083).
 */
export const GroupDetail = ({ groupId, ownRole }: GroupDetailProps) => {
	const [members, setMembers] = useState<GroupMember[] | null>(null);
	const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [hits, setHits] = useState<UserSearchHit[] | null>(null);
	// Mitglied, dessen Entfernung noch bestätigt werden muss (null = kein Dialog offen).
	const [pendingRemoval, setPendingRemoval] = useState<GroupMember | null>(null);
	// Initialfokus im Bestätigungsdialog: „Abbrechen" (#472 — destruktive Aktion nicht per Enter).
	const cancelRemoveRef = useRef<HTMLKolButtonElement>(null);

	const load = useCallback(async (): Promise<void> => {
		try {
			const [loadedMembers, loadedInvitations] = await Promise.all([
				api.getGroupMembers({ id: groupId }),
				ownRole === 'admin' ? api.getGroupInvitations({ id: groupId }) : Promise.resolve([]),
			]);
			setMembers(Array.isArray(loadedMembers) ? loadedMembers : []);
			setInvitations(Array.isArray(loadedInvitations) ? loadedInvitations : []);
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	}, [groupId, ownRole]);

	useEffect(() => {
		void load();
	}, [load]);

	const handleSearch = async (value: string): Promise<void> => {
		setQuery(value);
		if (value.trim().length < MIN_QUERY_LENGTH && !value.includes('@')) {
			setHits(null);
			return;
		}
		try {
			setHits(await api.searchUsers({ query: value.trim() }));
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	};

	const handleInvite = async (userId: number): Promise<void> => {
		try {
			await api.inviteGroupMember({ id: groupId, userId });
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

	return (
		<div className="group-detail">
			{error !== null && (
				<KolAlert _type="error" _label="Aktion nicht möglich">
					{error}
				</KolAlert>
			)}
			{members === null ? (
				<KolSpin _show _variant="cycle" _label="Mitglieder werden geladen …" />
			) : (
				<>
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
						<>
							<KolHeading _label="Offene Einladungen" _level={4} />
							<ul className="group-invitations">
								{invitations.map((invitation) => (
									<li key={invitation.id} className="group-invitation">
										<span className="group-member-name">{invitation.displayName}</span>
										<KolBadge _label="Ausstehend" />
									</li>
								))}
							</ul>
						</>
					)}
					{ownRole === 'admin' && (
						<section className="group-invite">
							<KolInputText
								_label="Konto suchen"
								_type="search"
								_placeholder="Name ab 3 Zeichen oder volle E-Mail"
								_value={query}
								_on={{ onInput: (_event, value) => void handleSearch(String(value ?? '')) }}
							/>
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
						</section>
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
		</div>
	);
};
