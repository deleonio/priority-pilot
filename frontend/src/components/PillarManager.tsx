import type { Pillar } from 'client';
import { useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';

interface PillarManagerProps {
	pillars: Pillar[];
	onPillarsChanged: () => void;
	pillarUsage?: Record<number, { taskCount: number; seriesCount: number }>;
}

/**
 * Verwaltungskomponente für Säulen (CRUD im Einstellungen-Tab).
 * Ermöglicht Anlegen, Umbenennen/Beschreibung ändern und Löschen von Säulen
 * mit Bestätigungsdialog. Nutzt native HTML-Elemente (keine KoliBri-Komponenten),
 * damit Komponententests via accessibility roles funktionieren.
 */
export const PillarManager = ({ pillars, onPillarsChanged, pillarUsage }: PillarManagerProps) => {
	// — Neue Säule anlegen —
	const [newName, setNewName] = useState('');
	const [newDescription, setNewDescription] = useState('');
	const [createError, setCreateError] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	// — Bearbeiten (inline) —
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editName, setEditName] = useState('');
	const [editDescription, setEditDescription] = useState('');
	const [editError, setEditError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// — Löschen (Modal) —
	const [deletingPillar, setDeletingPillar] = useState<Pillar | null>(null);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	const handleCreate = async (): Promise<void> => {
		if (newName.trim().length === 0) {
			setCreateError('Der Name darf nicht leer sein.');
			return;
		}
		setCreateError(null);
		setCreating(true);
		try {
			await api.createPillar({ name: newName.trim(), description: newDescription.trim() || undefined });
			setNewName('');
			setNewDescription('');
			onPillarsChanged();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setCreateError(apiError.message);
		} finally {
			setCreating(false);
		}
	};

	const handleEdit = (pillar: Pillar): void => {
		setEditingId(pillar.id);
		setEditName(pillar.name);
		setEditDescription(pillar.description);
		setEditError(null);
	};

	const handleSaveEdit = async (): Promise<void> => {
		if (editingId === null) return;
		if (editName.trim().length === 0) {
			setEditError('Der Name darf nicht leer sein.');
			return;
		}
		setEditError(null);
		setSaving(true);
		try {
			const currentPillar = pillars.find((p) => p.id === editingId);
			await api.updatePillar({
				id: editingId,
				name: editName.trim() !== currentPillar?.name ? editName.trim() : undefined,
				description: editDescription.trim() !== currentPillar?.description ? editDescription.trim() : undefined,
			});
			setEditingId(null);
			onPillarsChanged();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setEditError(apiError.message);
		} finally {
			setSaving(false);
		}
	};

	const handleDeleteConfirm = async (): Promise<void> => {
		if (deletingPillar === null) return;
		setDeleteError(null);
		setDeleting(true);
		try {
			await api.deletePillar({ id: deletingPillar.id });
			setDeletingPillar(null);
			onPillarsChanged();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setDeleteError(apiError.message);
			setDeleting(false);
		}
	};

	const getUsageHint = (pillarId: number): string => {
		const usage = pillarUsage?.[pillarId];
		if (!usage) return '';
		const parts: string[] = [];
		if (usage.taskCount > 0) parts.push(`${usage.taskCount} Tasks`);
		if (usage.seriesCount > 0) parts.push(`${usage.seriesCount} Serien`);
		if (parts.length === 0) return '';
		return `Beiträge von ${parts.join(' und ')} werden entfernt.`;
	};

	return (
		<div className="pillar-manager">
			{/* Anlege-Formular */}
			<div className="pillar-create-form">
				<label>
					Name
					<input type="text" aria-label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
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
				{createError !== null && <div role="alert">{createError}</div>}
				<button type="button" disabled={creating} onClick={() => void handleCreate()} aria-label="Anlegen">
					{creating ? 'Wird angelegt…' : 'Anlegen'}
				</button>
			</div>

			{/* Säulen-Liste */}
			{pillars.length === 0 ? (
				<p className="hint">Keine Säulen vorhanden. Lege die erste Säule an.</p>
			) : (
				<div className="pillar-list">
					{pillars.map((pillar) => (
						<div key={pillar.id} className="pillar-list-item">
							{editingId === pillar.id ? (
								<div className="pillar-edit-form">
									<label>
										Name
										<input
											type="text"
											aria-label="Name"
											value={editName}
											onChange={(e) => setEditName(e.target.value)}
										/>
									</label>
									<label>
										Beschreibung
										<input
											type="text"
											aria-label="Beschreibung"
											value={editDescription}
											onChange={(e) => setEditDescription(e.target.value)}
										/>
									</label>
									{editError !== null && <div role="alert">{editError}</div>}
									<div className="pillar-edit-actions">
										<button
											type="button"
											disabled={saving}
											onClick={() => void handleSaveEdit()}
											aria-label="Speichern"
										>
											{saving ? 'Wird gespeichert…' : 'Speichern'}
										</button>
										<button type="button" disabled={saving} onClick={() => setEditingId(null)} aria-label="Abbrechen">
											Abbrechen
										</button>
									</div>
								</div>
							) : (
								<>
									<div className="pillar-info">
										<strong>{pillar.name}</strong>
										{pillar.description && <p className="hint">{pillar.description}</p>}
									</div>
									<div className="pillar-actions">
										<button type="button" onClick={() => handleEdit(pillar)} aria-label="Bearbeiten">
											Bearbeiten
										</button>
										<button type="button" onClick={() => setDeletingPillar(pillar)} aria-label="Löschen">
											Löschen
										</button>
									</div>
								</>
							)}
						</div>
					))}
				</div>
			)}

			{/* Lösch-Bestätigungsdialog */}
			{deletingPillar !== null && (
				<Modal title="Säule löschen" onClose={() => !deleting && setDeletingPillar(null)}>
					{deleteError !== null && <div role="alert">{deleteError}</div>}
					<p>
						Soll die Säule <strong>„{deletingPillar.name}"</strong> wirklich gelöscht werden? Diese Aktion kann nicht
						rückgängig gemacht werden.
					</p>
					<p className="hint">{getUsageHint(deletingPillar.id)}</p>
					<div className="modal-actions">
						<button
							type="button"
							disabled={deleting}
							onClick={() => void handleDeleteConfirm()}
							aria-label="Endgültig löschen"
						>
							{deleting ? 'Löschen…' : 'Endgültig löschen'}
						</button>
						<button type="button" disabled={deleting} onClick={() => setDeletingPillar(null)} aria-label="Abbrechen">
							Abbrechen
						</button>
					</div>
				</Modal>
			)}
		</div>
	);
};
