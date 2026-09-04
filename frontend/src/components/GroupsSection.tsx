import { KolAlert, KolBadge, KolButton, KolCard, KolHeading, KolSpin } from '@public-ui/react-v19';
import type { Group, ReceivedInvitation } from 'client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { GroupDeleteDialog } from './GroupDeleteDialog';
import { GroupDetail } from './GroupDetail';
import { GroupFormDialog } from './GroupFormDialog';

type DialogState =
	{ kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; group: Group } | { kind: 'delete'; group: Group };

/** Rollen-Text je serverseitiger Rolle — Rolle immer als Text, nie nur als Farbe (KI-UX #1211). */
const roleLabel = (role: Group['role']): string => (role === 'admin' ? 'Admin' : 'Mitglied');

/** Mitgliederzahl mit deutscher Einzahl („1 Mitglied“, „3 Mitglieder“). */
const memberCountLabel = (count: number): string => `${count} ${count === 1 ? 'Mitglied' : 'Mitglieder'}`;

/**
 * Gruppen-Verwaltung im Settings-Tab „Gruppen“ (#1211 AK6–AK8): Liste der eigenen Gruppen als
 * vertikale Karten (Name, gekappte Beschreibung, Rolle + Mitgliederzahl), Anlegen/Bearbeiten per
 * Modal (`GroupFormDialog`) und Löschen mit sequenzieller Bestätigung (`GroupDeleteDialog`).
 * Nur Admins sehen Bearbeiten/Löschen — die Server-Rolle steuert (AK7), Nicht-Admin-Mitgliedschaften
 * sind rein informativ. Zustände: Laden (KolSpin), Fehler (KolAlert), Leer (Karte mit Anlegen-CTA).
 */
export const GroupsSection = () => {
	const [groups, setGroups] = useState<Group[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
	// Aufgeklappte Gruppe (#1212): Klick auf die Karte zeigt Mitglieder, Einladungen und die
	// Nutzersuche direkt darunter — kein eigener Screen, damit die Sektion mobil eine Spalte bleibt.
	const [openGroupId, setOpenGroupId] = useState<number | null>(null);
	const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);

	// Fokus-Rückgabe nach dem Löschen: Der „Löschen“-Trigger fällt mit der Karte aus dem DOM —
	// stabiler Container mit tabIndex={-1} als Fallback (PillarList-Muster).
	const deleteFallbackRef = useRef<HTMLDivElement>(null);

	const loadGroups = useCallback(async (): Promise<void> => {
		try {
			const loaded = await api.listGroups();
			// Defensive gegen Unit-Test-Mocks, die listGroups pauschal mit undefined auflösen.
			setGroups(Array.isArray(loaded) ? loaded : []);
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	}, []);

	const loadInvitations = useCallback(async (): Promise<void> => {
		try {
			const loaded = await api.listReceivedInvitations();
			setInvitations(Array.isArray(loaded) ? loaded : []);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	}, []);

	useEffect(() => {
		void loadGroups();
		void loadInvitations();
	}, [loadGroups, loadInvitations]);

	/** Annehmen/Ablehnen einer empfangenen Einladung (#1212 AK6/AK7). */
	const respondToInvitation = async (id: number, accept: boolean): Promise<void> => {
		try {
			await (accept ? api.acceptInvitation({ id }) : api.declineInvitation({ id }));
			await Promise.all([loadInvitations(), loadGroups()]);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	};

	const handleDialogClosed = (): void => {
		setDialog({ kind: 'closed' });
	};

	const handleSaved = async (): Promise<void> => {
		setDialog({ kind: 'closed' });
		await loadGroups();
	};

	const handleDeleted = async (): Promise<void> => {
		setDialog({ kind: 'closed' });
		await loadGroups();
	};

	return (
		<div className="groups-section" ref={deleteFallbackRef} tabIndex={-1}>
			<KolHeading _label="Gruppen" _level={2} />
			{error !== null && (
				<KolAlert _type="error" _label="Gruppen konnten nicht geladen werden">
					{error}
				</KolAlert>
			)}
			{invitations.length > 0 && (
				<section className="group-received-invitations">
					<KolHeading _label="Einladungen" _level={3} />
					<ul className="groups-items">
						{invitations.map((invitation) => (
							<li key={invitation.id} className="groups-item">
								<div className="groups-info">
									<KolHeading _label={invitation.groupName} _level={4} />
									<p className="hint">{`Eingeladen von ${invitation.invitedByName}`}</p>
								</div>
								<div className="groups-actions">
									<KolButton
										_label="Annehmen"
										_variant="primary"
										_on={{ onClick: () => void respondToInvitation(invitation.id, true) }}
									/>
									<KolButton
										_label="Ablehnen"
										_variant="secondary"
										_on={{ onClick: () => void respondToInvitation(invitation.id, false) }}
									/>
								</div>
							</li>
						))}
					</ul>
				</section>
			)}
			{groups === null ? (
				<KolSpin _show _variant="cycle" _label="Gruppen werden geladen …" />
			) : (
				<>
					{groups.length > 0 && (
						<div className="groups-toolbar">
							<KolButton
								_label="Gruppe anlegen"
								_icons={{ left: { icon: 'fa-solid fa-plus' } }}
								_variant="primary"
								_on={{ onClick: () => setDialog({ kind: 'create' }) }}
							/>
						</div>
					)}
					{groups.length === 0 ? (
						<section className="empty-state">
							<KolCard _label="Noch keine Gruppen" _level={3}>
								<p>Lege eine Gruppe an, um gemeinsam mit anderen zu priorisieren — du bist automatisch Admin.</p>
								<KolButton
									_label="Gruppe anlegen"
									_icons={{ left: { icon: 'fa-solid fa-plus' } }}
									_variant="primary"
									_on={{ onClick: () => setDialog({ kind: 'create' }) }}
								/>
							</KolCard>
						</section>
					) : (
						<ul className="groups-items">
							{groups.map((group) => (
								<li
									key={group.id}
									className="groups-item groups-item--expandable"
									data-group-id={group.id}
									// Ganze Karte klickbar (#1212): der Namens-Button allein deckt nur einen schmalen
									// Streifen ab, ein Klick daneben (die Karte ist `space-between`, dazwischen liegt
									// eine Lücke) blieb wirkungslos. Der Guard nimmt Bedienelemente und das bereits
									// aufgeklappte Detail aus — sonst klappte jeder Klick auf „Einladen"/„Entfernen"
									// oder ins Suchfeld die Ansicht wieder zu. Tastaturpfad bleibt der Namens-Button.
									onClick={(event) => {
										if (
											(event.target as HTMLElement).closest(
												'.group-detail, kol-button, kol-input-text, kol-dialog, button, a, input',
											) !== null
										) {
											return;
										}
										setOpenGroupId(openGroupId === group.id ? null : group.id);
									}}
								>
									<div className="groups-info">
										<KolButton
											_label={group.name}
											_variant="tertiary"
											_on={{ onClick: () => setOpenGroupId(openGroupId === group.id ? null : group.id) }}
										/>
										{group.description !== null && group.description !== '' && (
											<p className="hint groups-description">{group.description}</p>
										)}
										{/* Metazeile: Rolle als Text-Badge (nie nur Farbe) + Mitgliederzahl (AK6). */}
										<div className="groups-meta">
											<KolBadge _label={roleLabel(group.role)} />
											<span>{memberCountLabel(group.memberCount)}</span>
										</div>
									</div>
									{group.role === 'admin' && (
										<div className="groups-actions">
											<KolButton
												_label="Bearbeiten"
												_variant="secondary"
												_on={{ onClick: () => setDialog({ kind: 'edit', group }) }}
											/>
											<KolButton
												_label="Löschen"
												_variant="danger"
												_on={{ onClick: () => setDialog({ kind: 'delete', group }) }}
											/>
										</div>
									)}
									{openGroupId === group.id && <GroupDetail groupId={group.id} ownRole={group.role} />}
								</li>
							))}
						</ul>
					)}
				</>
			)}

			{dialog.kind === 'create' && <GroupFormDialog onClose={handleDialogClosed} onSaved={() => void handleSaved()} />}
			{dialog.kind === 'edit' && (
				<GroupFormDialog group={dialog.group} onClose={handleDialogClosed} onSaved={() => void handleSaved()} />
			)}
			{dialog.kind === 'delete' && (
				<GroupDeleteDialog
					group={dialog.group}
					onClose={handleDialogClosed}
					onDeleted={() => void handleDeleted()}
					fallbackFocusRef={deleteFallbackRef as RefObject<HTMLElement | null>}
				/>
			)}
		</div>
	);
};
