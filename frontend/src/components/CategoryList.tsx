import { KolAlert, KolButton, KolCard, KolSpin } from '@public-ui/react-v19';
import type { Category } from 'client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { CategoryBadge } from './CategoryBadge';
import { CategoryDeleteDialog } from './CategoryDeleteDialog';
import { CategoryFormDialog } from './CategoryFormDialog';

interface CategoryListProps {
	/**
	 * Wird nach jeder Kategorie-Mutation aufgerufen, damit übergeordnete Komponenten (App.tsx)
	 * ihre Kategorie-Daten neu laden — sonst zeigen Formulare und Filter einen alten Stand
	 * (Muster `PillarList.onPillarChanged`, #439).
	 */
	onCategoryChanged?: () => void;
}

/**
 * Kategorie-Verwaltung in den Einstellungen — Aufbau wie `PillarList` (#439): Liste plus eigene
 * Modal-Dialoge zum Anlegen, Bearbeiten und Löschen, mit den vier gestalteten Zuständen
 * (Laden, Fehler, Leer, Erfolg — docs/mobile-ui-rules.md Regel 7).
 *
 * Der einleitende Text grenzt Kategorie und Lebenssäule voneinander ab: Ohne ihn legen Nutzer
 * beides doppelt an, und eine als Ordner missbrauchte Säule verzerrt die Balance-Rechnung.
 */
export const CategoryList = ({ onCategoryChanged }: CategoryListProps) => {
	const [categories, setCategories] = useState<Category[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	type FormMode = { kind: 'create' } | { kind: 'edit'; category: Category };
	const [formMode, setFormMode] = useState<FormMode | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

	// Fallback-Fokusziel für den Lösch-Dialog: Nach dem Löschen fällt der auslösende Button mit der
	// Zeile aus dem DOM (Muster PillarList).
	const deleteFallbackRef = useRef<HTMLDivElement>(null);

	const loadCategories = useCallback(async () => {
		try {
			setCategories(await api.listCategories());
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadCategories();
	}, [loadCategories]);

	const handleDialogClosed = (): void => {
		setFormMode(null);
		setDeleteTarget(null);
	};

	const handleDialogSaved = async (): Promise<void> => {
		setFormMode(null);
		await loadCategories();
		onCategoryChanged?.();
	};

	const handleDeleted = async (): Promise<void> => {
		setDeleteTarget(null);
		await loadCategories();
		onCategoryChanged?.();
	};

	return (
		<div className="pillar-list category-list" ref={deleteFallbackRef} tabIndex={-1}>
			<p className="hint category-list-intro">
				Kategorien ordnen deine Aufgaben nach Thema — „Hausbau", „Steuer", „Verein". Jede Aufgabe hat höchstens eine,
				sie erscheint als farbiges Kennzeichen in den Listen und lässt sich in der Suche filtern. Anders als eine{' '}
				<strong>Lebenssäule</strong> wirkt sie nicht auf die Priorisierung: Säulen sagen, worauf eine Aufgabe in deinem
				Leben einzahlt (anteilig, mehrere gleichzeitig) und steuern damit Wert und Balance. Kategorien sagen nur, wo
				etwas thematisch hingehört.
			</p>

			{error !== null && (
				<KolAlert _type="error" _label="Kategorien konnten nicht geladen werden">
					<p>{error}</p>
					<KolButton _label="Erneut versuchen" _variant="secondary" _on={{ onClick: () => void loadCategories() }} />
				</KolAlert>
			)}

			{loading ? (
				<KolSpin _show _variant="cycle" _label="Kategorien werden geladen …" />
			) : categories.length === 0 && error === null ? (
				/* Leerzustand als Einladung — die Toolbar bleibt aus, damit es genau eine Primäraktion gibt. */
				<section className="empty-state">
					<KolCard _label="Noch keine Kategorien" _level={3}>
						<p>
							Lege deine erste Kategorie an, um Aufgaben nach Thema zu bündeln. Ohne Kategorie bleiben Aufgaben einfach
							ungeordnet — nichts geht verloren.
						</p>
						<KolButton
							_label="Neue Kategorie anlegen"
							_icons={{ left: { icon: 'fa-solid fa-plus' } }}
							_variant="primary"
							_on={{ onClick: () => setFormMode({ kind: 'create' }) }}
						/>
					</KolCard>
				</section>
			) : (
				<>
					<div className="pillar-list-toolbar">
						<KolButton
							_label="Neue Kategorie anlegen"
							_icons={{ left: { icon: 'fa-solid fa-plus' } }}
							_variant="primary"
							_on={{ onClick: () => setFormMode({ kind: 'create' }) }}
						/>
					</div>

					<ul className="pillar-items category-items">
						{categories.map((category) => (
							<li key={category.id} className="pillar-item category-item" data-category-id={category.id}>
								<div className="pillar-info">
									<CategoryBadge category={category} />
								</div>
								<div className="pillar-actions">
									<KolButton
										_label="Bearbeiten"
										_variant="secondary"
										_on={{ onClick: () => setFormMode({ kind: 'edit', category }) }}
									/>
									<KolButton _label="Löschen" _variant="danger" _on={{ onClick: () => setDeleteTarget(category) }} />
								</div>
							</li>
						))}
					</ul>
				</>
			)}

			{formMode !== null && (
				<CategoryFormDialog
					category={formMode.kind === 'edit' ? formMode.category : undefined}
					onClose={handleDialogClosed}
					onSaved={() => void handleDialogSaved()}
				/>
			)}

			{deleteTarget !== null && (
				<CategoryDeleteDialog
					category={deleteTarget}
					onClose={handleDialogClosed}
					onDeleted={() => void handleDeleted()}
					fallbackFocusRef={deleteFallbackRef as RefObject<HTMLElement | null>}
				/>
			)}
		</div>
	);
};
