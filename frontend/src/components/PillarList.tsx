import type { Pillar } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';

interface EditingState {
	id: number;
	name: string;
	description: string;
}

interface DeleteConfirmState {
	id: number;
	name: string;
}

interface PillarListProps {
	/** Wird aufgerufen, wenn die Inline-Bearbeitung beginnt/endet (true = editierend, false = nicht editierend). */
	onEditingChange?: (editing: boolean) => void;
	/**
	 * Wird nach jeder Säulen-Mutation (anlegen/umbenennen/löschen) aufgerufen, damit
	 * übergeordnete Komponenten (z. B. App.tsx) ihre Pillar-Daten neu laden können.
	 * Verhindert stale PillarWeightsForm nach PillarList-Mutationen (#439 Review Finding 3).
	 */
	onPillarChanged?: () => void;
}

/**
 * Säulen-Verwaltungs-Komponente (Issue #439): Zeigt eine Liste aller Säulen an und erlaubt das
 * Anlegen neuer Säulen, Inline-Umbenennen/-Beschreibungsänderung und Löschen mit Bestätigungsdialog.
 * Nutzt die API-Funktionen aus #438 (createPillar, updatePillar, deletePillar).
 */
export const PillarList = ({ onEditingChange, onPillarChanged }: PillarListProps) => {
	const [pillars, setPillars] = useState<Pillar[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	// Create-Formular-Status
	const [newName, setNewName] = useState('');
	const [newDescription, setNewDescription] = useState('');
	const [createError, setCreateError] = useState<string | null>(null);

	// Inline-Edit-Status
	const [editing, setEditing] = useState<EditingState | null>(null);
	const [editError, setEditError] = useState<string | null>(null);
	const [editSaving, setEditSaving] = useState(false);

	// Lösch-Bestätigungsdialog
	const [deleteTarget, setDeleteTarget] = useState<DeleteConfirmState | null>(null);
	const [deleteSaving, setDeleteSaving] = useState(false);

	const loadPillars = useCallback(async () => {
		try {
			const data = await api.listPillars();
			setPillars(data);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadPillars();
	}, [loadPillars]);

	// ── Anlegen ──────────────────────────────────────────────────────────────

	const handleCreate = async () => {
		setCreateError(null);
		if (!newName.trim()) {
			setCreateError('Name darf nicht leer sein.');
			return;
		}
		try {
			const pillarCreate: { name: string; description?: string } = { name: newName.trim() };
			if (newDescription.trim()) {
				pillarCreate.description = newDescription.trim();
			}
			await api.createPillar({ pillarCreate });
			setNewName('');
			setNewDescription('');
			await loadPillars();
			onPillarChanged?.();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setCreateError(apiError.message);
		}
	};

	// ── Umbenennen / Inline-Edit ────────────────────────────────────────────

	const startEditing = (pillar: Pillar) => {
		setEditing({ id: pillar.id, name: pillar.name, description: pillar.description });
		setEditError(null);
		onEditingChange?.(true);
	};

	const handleSaveEdit = async () => {
		if (!editing) return;
		setEditSaving(true);
		setEditError(null);
		try {
			const original = pillars.find((p) => p.id === editing.id);
			if (!original) return;

			const pillarUpdate: { name?: string; description?: string } = {};
			if (editing.name !== original.name) {
				pillarUpdate.name = editing.name;
			}
			if (editing.description !== original.description) {
				pillarUpdate.description = editing.description;
			}

			if (Object.keys(pillarUpdate).length > 0) {
				await api.updatePillar({ id: editing.id, pillarUpdate });
			}
			setEditing(null);
			onEditingChange?.(false);
			await loadPillars();
			onPillarChanged?.();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setEditError(apiError.message);
		} finally {
			setEditSaving(false);
		}
	};

	const handleCancelEdit = () => {
		setEditing(null);
		setEditError(null);
		onEditingChange?.(false);
	};

	// ── Löschen ──────────────────────────────────────────────────────────────

	const handleDeleteConfirm = async () => {
		if (!deleteTarget) return;
		setDeleteSaving(true);
		try {
			await api.deletePillar({ id: deleteTarget.id });
			setDeleteTarget(null);
			await loadPillars();
			onPillarChanged?.();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setDeleteSaving(false);
		}
	};

	const handleDeleteCancel = () => {
		setDeleteTarget(null);
	};

	// ── Render ───────────────────────────────────────────────────────────────

	return (
		<div className="pillar-list">
			{error !== null && <div className="error-message">{error}</div>}

			{/* ── Anlegen-Formular ─────────────────────────────────────────── */}
			{editing === null && (
				<div className="pillar-create-form">
					<h3>Neue Säule anlegen</h3>
					<label>
						Name
						<input
							type="text"
							aria-label="Name"
							required
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
					</label>
					<label>
						Beschreibung
						<input
							type="text"
							aria-label="Beschreibung"
							value={newDescription}
							onChange={(e) => setNewDescription(e.target.value)}
						/>
					</label>
					{createError !== null && <div className="error-message">{createError}</div>}
					<button type="button" aria-label="Anlegen" onClick={() => void handleCreate()}>
						Anlegen
					</button>
				</div>
			)}

			{/* ── Säulen-Liste ──────────────────────────────────────────────── */}
			{loading ? (
				<p aria-live="polite">Säulen werden geladen …</p>
			) : pillars.length === 0 && editing === null ? (
				<p>Keine Säulen vorhanden.</p>
			) : (
				<div className="pillar-items">
					{pillars.map((pillar) => (
						<div key={pillar.id} className="pillar-item" data-pillar-id={pillar.id}>
							{editing?.id === pillar.id ? (
								<div className="pillar-edit-row">
									<label>
										Name
										<input
											type="text"
											aria-label="Name"
											value={editing.name}
											onChange={(e) => setEditing({ ...editing, name: e.target.value })}
										/>
									</label>
									<label>
										Beschreibung
										<input
											type="text"
											aria-label="Beschreibung"
											value={editing.description}
											onChange={(e) => setEditing({ ...editing, description: e.target.value })}
										/>
									</label>
									{editError !== null && <div className="error-message">{editError}</div>}
									<button
										type="button"
										aria-label="Speichern"
										disabled={editSaving}
										onClick={() => void handleSaveEdit()}
									>
										Speichern
									</button>
									<button type="button" aria-label="Abbrechen" disabled={editSaving} onClick={() => handleCancelEdit()}>
										Abbrechen
									</button>
								</div>
							) : (
								<>
									<div className="pillar-info">
										<span className="pillar-name">{pillar.name}</span>
										{pillar.description && <span className="pillar-list-description">{pillar.description}</span>}
									</div>
									<div className="pillar-actions">
										<button type="button" aria-label="Bearbeiten" onClick={() => startEditing(pillar)}>
											Bearbeiten
										</button>
										<button
											type="button"
											aria-label="Löschen"
											onClick={() => setDeleteTarget({ id: pillar.id, name: pillar.name })}
										>
											Löschen
										</button>
									</div>
								</>
							)}
						</div>
					))}
				</div>
			)}

			{/* ── Lösch-Bestätigungsdialog ──────────────────────────────────── */}
			{deleteTarget !== null && (
				<div className="delete-confirm-dialog" role="dialog" aria-label="Löschen bestätigen">
					<h3>Säule „{deleteTarget.name}„ löschen?</h3>
					<p>
						Diese Säule wird endgültig gelöscht. Tasks und Serien, die dieser Säule zugeordnet sind, verlieren ihre
						Zuordnung.
					</p>
					<button
						type="button"
						aria-label="Endgültig löschen"
						disabled={deleteSaving}
						onClick={() => void handleDeleteConfirm()}
					>
						Endgültig löschen
					</button>
					<button type="button" aria-label="Abbrechen" disabled={deleteSaving} onClick={() => handleDeleteCancel()}>
						Abbrechen
					</button>
				</div>
			)}
		</div>
	);
};
