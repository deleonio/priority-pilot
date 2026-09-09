import { KolAlert, KolButton, KolCard, KolHeading, KolSpin } from '@public-ui/react-v19';
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
 *
 * Vier gestaltete Zustände (docs/mobile-ui-rules.md Regel 7): Laden (`KolSpin`), Fehler
 * (`KolAlert`), Leer (Karte mit Anlegen-CTA) und Erfolg (Kartenliste mit Toolbar) — Muster
 * wie `GroupsSection`. Im Leerzustand bleibt die Toolbar aus, damit genau ein
 * „Neue Säule anlegen"-Knopf existiert.
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
			setPillars(await api.listPillars());
			// Fehler nach erfolgreichem Nachladen zurücknehmen — sonst bleibt die Meldung eines
			// gescheiterten Versuchs über der bereits wieder gefüllten Liste stehen (Muster GroupsSection).
			setError(null);
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
			{/* Fehler als `KolAlert` statt als `<p className="error-message">`: die Klasse hatte app-weit
			    keine einzige CSS-Regel, der Fehler stand als normaler Fließtext ohne Fehler-Affordanz
			    über der Liste. Muster wie `GroupsSection` (Meldungen sind KoliBri, DESIGN.md). */}
			{error !== null && (
				<KolAlert _type="error" _label="Säulen konnten nicht geladen werden">
					{error}
				</KolAlert>
			)}

			{/* ── Vier gestaltete Zustände (mobile-ui-rules Regel 7): Laden, Leer, Fehler, Erfolg ── */}
			{loading ? (
				<KolSpin _show _variant="cycle" _label="Säulen werden geladen …" />
			) : pillars.length === 0 ? (
				/* Leerzustand als Einladung zum Handeln — der einzige „Neue Säule anlegen"-Knopf in
				   diesem Zustand (die Toolbar bleibt aus, genau eine Primäraktion pro Zustand). */
				<section className="empty-state">
					<KolCard _label="Noch keine Säulen" _level={3}>
						<p>
							Säulen sind die Lebensbereiche, auf die deine Aufgaben einzahlen — lege deine erste an, um die
							Priorisierung nach Lebensbalance zu steuern.
						</p>
						<KolButton
							_label="Neue Säule anlegen"
							_icons={{ left: { icon: 'fa-solid fa-plus' } }}
							_variant="primary"
							_on={{ onClick: () => setFormMode({ kind: 'create' }) }}
						/>
					</KolCard>
				</section>
			) : (
				<>
					{/* ── Anlegen-Button ───────────────────────────────────────── */}
					<div className="pillar-list-toolbar">
						<KolButton
							_label="Neue Säule anlegen"
							_icons={{ left: { icon: 'fa-solid fa-plus' } }}
							_variant="primary"
							_on={{ onClick: () => setFormMode({ kind: 'create' }) }}
						/>
					</div>

					{/* ── Säulen-Liste ─────────────────────────────────────────── */}
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
				</>
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
