import { KolButton, KolHeading } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { PillarDeleteDialog } from './PillarDeleteDialog';
import { PillarFormDialog } from './PillarFormDialog';

interface PillarListProps {
	/**
	 * Wird nach jeder Säulen-Mutation (anlegen/umbenennen/löschen) aufgerufen, damit
	 * übergeordnete Komponenten (z. B. App.tsx) ihre Pillar-Daten neu laden können.
	 * Verhindert stale PillarWeightsForm nach PillarList-Mutationen (#439 Review Finding 3).
	 */
	onPillarChanged?: () => void;
}

/**
 * Säulen-Verwaltungs-Komponente (Issue #439): Zeigt eine Liste aller Säulen an und erlaubt das
 * Anlegen neuer Säulen, das Bearbeiten und das Löschen — jeweils über eigene Modal-Dialoge
 * (KoliBri `KolDialog`), nicht mehr als Inline-Forms.
 *
 * Nutzt die API-Funktionen aus #438 (createPillar, updatePillar, deletePillar).
 */
export const PillarList = ({ onPillarChanged }: PillarListProps) => {
	const [pillars, setPillars] = useState<Pillar[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	// Dialog-Status: welcher Dialog ist gerade offen?
	type FormMode = { kind: 'create' } | { kind: 'edit'; pillar: Pillar };
	const [formMode, setFormMode] = useState<FormMode | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Pillar | null>(null);

	// Fallback-Fokusziel für den Lösch-Dialog: Nach erfolgreichem Löschen fällt der
	// „Löschen\"-Button mit der Karten-Zeile aus dem DOM (kein Trigger mehr im DOM).
	// Analog zu App.tsx `deleteFallbackRef`: stabiler Container mit tabIndex={-1}
	// erlaubt programmatischen Fokus ohne visuelle Tab-Stop-Wirkung.
	// Typ `HTMLDivElement` (das echte DOM-Element des Containers); beim Durchreichen
	// an `fallbackFocusRef` sicher zu `HTMLElement` gecastet (HTMLDivElement ⊂ HTMLElement).
	const deleteFallbackRef = useRef<HTMLDivElement>(null);

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

	// ── Render ───────────────────────────────────────────────────────────────

	const handleDialogClosed = (): void => {
		setFormMode(null);
		setDeleteTarget(null);
	};

	const handleDialogSaved = async (): Promise<void> => {
		setFormMode(null);
		await loadPillars();
		onPillarChanged?.();
	};

	const handleDeleted = async (): Promise<void> => {
		setDeleteTarget(null);
		await loadPillars();
		onPillarChanged?.();
	};

	return (
		<div className="pillar-list" ref={deleteFallbackRef} tabIndex={-1}>
			{error !== null && <p className="error-message">{error}</p>}

			{/* ── Anlegen-Button ───────────────────────────────────────────── */}
			<div className="pillar-list-toolbar">
				<KolButton
					_label="Neue Säule anlegen"
					_icons={{ left: { icon: 'fa-solid fa-plus' } }}
					_variant="primary"
					_on={{ onClick: () => setFormMode({ kind: 'create' }) }}
				/>
			</div>

			{/* ── Säulen-Liste ─────────────────────────────────────────────── */}
			{loading ? (
				<p aria-live="polite">Säulen werden geladen …</p>
			) : pillars.length === 0 ? (
				<p>Keine Säulen vorhanden.</p>
			) : (
				<ul className="pillar-items">
					{pillars.map((pillar) => (
						<li key={pillar.id} className="pillar-item" data-pillar-id={pillar.id}>
							<div className="pillar-info">
								<KolHeading _label={pillar.name} _level={3} />
								{pillar.description && <p className="hint pillar-list-description">{pillar.description}</p>}
							</div>
							<div className="pillar-actions">
								<KolButton
									_label="Bearbeiten"
									_variant="secondary"
									_on={{ onClick: () => setFormMode({ kind: 'edit', pillar }) }}
								/>
								<KolButton _label="Löschen" _variant="danger" _on={{ onClick: () => setDeleteTarget(pillar) }} />
							</div>
						</li>
					))}
				</ul>
			)}

			{/* ── Anlegen/Bearbeiten-Dialog ──────────────────────────────── */}
			{formMode !== null && (
				<PillarFormDialog
					pillar={formMode.kind === 'edit' ? formMode.pillar : undefined}
					onClose={handleDialogClosed}
					onSaved={() => void handleDialogSaved()}
				/>
			)}

			{/* ── Lösch-Bestätigungsdialog ───────────────────────────────── */}
			{deleteTarget !== null && (
				<PillarDeleteDialog
					pillar={deleteTarget}
					onClose={handleDialogClosed}
					onDeleted={() => void handleDeleted()}
					fallbackFocusRef={deleteFallbackRef as RefObject<HTMLElement | null>}
				/>
			)}
		</div>
	);
};
