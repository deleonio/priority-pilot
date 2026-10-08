import { KolAlert, KolButton, KolSpin } from '@public-ui/react-v19';
import type { Category } from 'client';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
	const { t } = useTranslation(['settings', 'common']);
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
				<Trans t={t} i18nKey="categoryList.intro" components={{ strong: <strong /> }} />
			</p>

			{error !== null && (
				<KolAlert _type="error" _label={t('categoryList.loadError')}>
					<p>{error}</p>
					<KolButton
						_label={t('categoryList.retry')}
						_variant="secondary"
						_on={{ onClick: () => void loadCategories() }}
					/>
				</KolAlert>
			)}

			{loading ? (
				<KolSpin _show _variant="cycle" _label={t('categoryList.loading')} />
			) : categories.length === 0 && error === null ? (
				/* Leerzustand als Einladung — die Toolbar bleibt aus, damit es genau eine Primäraktion gibt.
				   #2015: keine Kartenfläche (Regel 1 — die Liste liegt selbst in der Karte „Kategorien verwalten“). */
				<section className="empty-state">
					<h3>{t('categoryList.emptyTitle')}</h3>
					<p>{t('categoryList.emptyText')}</p>
					<KolButton
						_label={t('categoryList.create')}
						_icons={{ left: { icon: 'fa-solid fa-plus' } }}
						_variant="primary"
						_on={{ onClick: () => setFormMode({ kind: 'create' }) }}
					/>
				</section>
			) : (
				<>
					<div className="pillar-list-toolbar">
						<KolButton
							_label={t('categoryList.create')}
							_icons={{ left: { icon: 'fa-solid fa-plus' } }}
							_variant="primary"
							_on={{ onClick: () => setFormMode({ kind: 'create' }) }}
						/>
					</div>

					<ul className="pillar-items category-items">
						{categories.map((category) => (
							<li key={category.id} className="category-chip" data-category-id={category.id}>
								<CategoryBadge category={category} />
								<span className="category-chip-actions">
									{/* Icon-only wie die Zeilen-Aktionen der TaskTable (#2014): Die KolIcons-Font kennt
									    keinen Stift/Papierkorb → Zahnrad/Kreuz; `_hideLabel` hält das Label im A11y-Baum. */}
									<KolButton
										_label={t('common:actions.edit')}
										_icons={{ left: { icon: 'kolicon-cogwheel' } }}
										_hideLabel
										_variant="secondary"
										_on={{ onClick: () => setFormMode({ kind: 'edit', category }) }}
									/>
									<KolButton
										_label={t('common:actions.delete')}
										_icons={{ left: { icon: 'fa-solid fa-trash' } }}
										_hideLabel
										_variant="danger"
										_on={{ onClick: () => setDeleteTarget(category) }}
									/>
								</span>
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
