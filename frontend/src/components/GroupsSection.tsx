import {
	KolAccordion,
	KolAlert,
	KolAvatar,
	KolBadge,
	KolButton,
	KolCard,
	KolHeading,
	KolSpin,
} from '@public-ui/react-v19';
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
	// Aufgeklappte Gruppe (#1212): Jede Gruppe ist ein `KolAccordion` — der Klapp-Mechanismus kommt
	// aus KoliBri (Rolle, Tastaturpfad und `aria-expanded` inklusive) statt aus einem selbstgebauten
	// `onClick` am Listenelement. Genau eine Gruppe ist offen, damit die Sektion mobil eine Spalte
	// bleibt. Das Detail hält Mitgliederzahl und Mitgliederliste sofort sichtbar; weitere Bereiche
	// sind dort ebenfalls KolAccordion und zugeklappt (#1257).
	const [openGroupId, setOpenGroupId] = useState<number | null>(null);
	// Ticker für „Daten auffrischen“ am offenen Detail (#1223): Hochzählen löst ein Neuladen aus.
	const [detailRefreshTick, setDetailRefreshTick] = useState(0);
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
			{/* Keine H2 „Gruppen" mehr: Der Tab-Reiter trägt den Namen bereits — die Überschrift stand
			    doppelt im Accessibility-Baum (Design-Lauf 2026-09). */}
			{error !== null && (
				<KolAlert _type="error" _label="Gruppen konnten nicht geladen werden">
					{error}
				</KolAlert>
			)}
			{invitations.length > 0 && (
				<KolCard className="settings-card" _label="Einladungen" _level={2}>
					<ul className="groups-items">
						{invitations.map((invitation) => (
							<li key={invitation.id} className="groups-item">
								<div className="groups-info">
									<KolHeading _label={invitation.groupName} _level={3} />
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
				</KolCard>
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
								<li key={group.id} className="groups-item groups-item--accordion" data-group-id={group.id}>
									{/*
									 * Eine Gruppe = ein `KolAccordion` (Design-Lauf 2026-09). Vorher war das ein
									 * selbstgebauter Aufklapper: ein `onClick` am `<li>` mit einer
									 * `event.target.closest(...)`-Heuristik, die entscheiden musste, welcher Klick
									 * auf-/zuklappt und welcher nicht — Rolle, Tastaturpfad und `aria-expanded`
									 * hingen an einem separaten Namens-Button daneben. KoliBri bringt all das
									 * nativ mit, und die Seite hat damit genau eine Klapp-Primitive.
									 */}
									<KolAccordion
										className="groups-accordion"
										_label={group.name}
										_level={3}
										_open={openGroupId === group.id}
										_on={{
											onToggle: () => setOpenGroupId(openGroupId === group.id ? null : group.id),
										}}
									>
										<div className="groups-body">
											<div className="groups-summary">
												{/* Gruppenbild (#1225, AK4): Avatar neben den Metadaten — mit imageUrl das Bild,
												    ohne Bild die Initialen aus dem Namen (Muster App.tsx:665). `_color` bewusst
												    ungesetzt (KI-UX), rein dekorativ und kein eigenes Klick-Ziel; `aria-hidden`
												    hält den Namen einmalig im SR-Baum — der Accordion-Kopf trägt ihn. */}
												<KolAvatar
													aria-hidden="true"
													className="groups-avatar"
													_label={group.name}
													_src={group.imageUrl ?? undefined}
												/>
												<div className="groups-info">
													{group.description !== null && group.description !== '' && (
														<p className="hint groups-description">{group.description}</p>
													)}
													{/* Metazeile: Rolle als Text-Badge (nie nur Farbe) + Mitgliederzahl (AK6). */}
													<div className="groups-meta">
														<KolBadge _label={roleLabel(group.role)} />
														<span>{memberCountLabel(group.memberCount)}</span>
													</div>
												</div>
											</div>
											<div className="groups-actions">
												{/* #1223: Explizites Bedienelement statt „Klick irgendwo ins offene Detail" —
												    der alte Auffrisch-Pfad war weder sichtbar noch per Tastatur erreichbar. */}
												<KolButton
													_label="Daten auffrischen"
													_variant="secondary"
													_on={{ onClick: () => setDetailRefreshTick((tick) => tick + 1) }}
												/>
												{group.role === 'admin' && (
													<>
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
													</>
												)}
											</div>
											{openGroupId === group.id && (
												<GroupDetail
													id={`group-detail-${group.id}`}
													groupId={group.id}
													ownRole={group.role}
													refreshKey={detailRefreshTick}
												/>
											)}
										</div>
									</KolAccordion>
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
