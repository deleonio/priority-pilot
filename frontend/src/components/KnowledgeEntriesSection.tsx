import { KolAlert, KolButton, KolInputText } from '@public-ui/react-v19';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { KnowledgeEntry } from 'client';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useEntitlement } from '../lib/usePlan';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { PlanBadge } from './PlanBadge';

const MAX_TEXT_LENGTH = 500;

/** Klick am umgebenden Element statt über `_on` (Muster `PlaceFavoritesSection.tsx`). */
const ButtonAction = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
	<span className="api-tokens__action" onClick={onClick}>
		{children}
	</span>
);

/**
 * Einstellungen → Tab „KI": Wissens-Einträge (#1936 AK7). Pro-Nutzer legen persönliche Hinweise an,
 * bearbeiten sie inline und löschen sie über `ConfirmDeleteDialog`; passende Einträge fließen
 * serverseitig in die Säulenzuordnung ein. Ohne Entitlement `knowledge_entries` nur der `PlanHint`
 * (über `PlanBadge`) — kein Laden, kein Anlegefeld, weil der Server ohnehin 403 liefert.
 *
 * Bewusst ohne `KolAccordion`: der Abschnitt ist direkt bedienbar (AK7/AK8-e2e ohne Aufklappen).
 */
export const KnowledgeEntriesSection = () => {
	const { t } = useTranslation(['settings', 'common']);
	const locked = useEntitlement('knowledge_entries')?.allowed === false;
	const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
	const [text, setText] = useState('');
	const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null);

	useEffect(() => {
		if (locked) return;
		let active = true;
		api
			.listKnowledgeEntries()
			.then((list) => {
				if (active) setEntries(list ?? []);
			})
			.catch(() => {
				if (active) setError(t('knowledgeEntries.loadError'));
			});
		return () => {
			active = false;
		};
	}, [locked, t]);

	const run = async (action: () => Promise<void>): Promise<void> => {
		setError(null);
		setBusy(true);
		try {
			await action();
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setBusy(false);
		}
	};

	const handleCreate = (): Promise<void> => {
		const trimmed = text.trim();
		if (trimmed === '') {
			setError(t('knowledgeEntries.textRequired'));
			return Promise.resolve();
		}
		return run(async () => {
			const created = await api.createKnowledgeEntry({ text: trimmed });
			setEntries((previous) => [...previous, created]);
			setText('');
		});
	};

	const handleSave = (): Promise<void> => {
		if (editing === null) return Promise.resolve();
		const { id } = editing;
		return run(async () => {
			const updated = await api.updateKnowledgeEntry(id, { text: editing.text.trim() });
			setEntries((previous) => previous.map((entry) => (entry.id === id ? updated : entry)));
			setEditing(null);
		});
	};

	return (
		<div className="api-tokens settings-card knowledge-entries" data-testid="knowledge-entries-panel">
			<h2>{t('knowledgeEntries.title')}</h2>
			<PlanBadge feature="knowledge_entries" />
			{!locked && (
				<>
					<div className="api-tokens__create">
						<p>{t('knowledgeEntries.intro')}</p>
						<KolInputText
							_label={t('knowledgeEntries.newLabel')}
							_maxLength={MAX_TEXT_LENGTH}
							_hasCounter
							_value={text}
							_on={{ onInput: (_event, value) => setText(String(value ?? '')) }}
						/>
						<ButtonAction onClick={() => void handleCreate()}>
							<KolButton
								_label={t('common:actions.add')}
								class="settings-action-btn"
								_variant="primary"
								_disabled={busy}
							/>
						</ButtonAction>
						{error !== null && (
							<KolAlert _type="error" _label={t('knowledgeEntries.errorLabel')}>
								{error}
							</KolAlert>
						)}
					</div>
					{entries.length === 0 ? (
						<p>{t('knowledgeEntries.empty')}</p>
					) : (
						<ul className="api-tokens__list">
							{entries.map((entry) => (
								<li key={entry.id} className="api-tokens__item" data-testid="knowledge-entry-row">
									{editing?.id === entry.id ? (
										<>
											<KolInputText
												_label={t('knowledgeEntries.editLabel')}
												_maxLength={MAX_TEXT_LENGTH}
												_hasCounter
												_value={editing.text}
												_on={{ onInput: (_event, value) => setEditing({ id: entry.id, text: String(value ?? '') }) }}
											/>
											<ButtonAction onClick={() => void handleSave()}>
												<KolButton
													_label={t('common:actions.save')}
													class="settings-action-btn"
													_variant="secondary"
													_disabled={busy}
												/>
											</ButtonAction>
											<ButtonAction onClick={() => setEditing(null)}>
												<KolButton
													_label={t('common:actions.cancel')}
													class="settings-action-btn"
													_variant="tertiary"
												/>
											</ButtonAction>
										</>
									) : (
										<>
											<span className="api-tokens__name">{entry.text}</span>
											<ButtonAction onClick={() => setEditing({ id: entry.id, text: entry.text })}>
												<KolButton _label={t('common:actions.edit')} class="settings-action-btn" _variant="secondary" />
											</ButtonAction>
										</>
									)}
									{/* Name über den Expert-Slot (`_label=""`), Eintragstext versteckt dazu — Muster
									    `PlaceFavoritesSection.tsx` (#2013). */}
									<ButtonAction onClick={() => setDeleteTarget(entry)}>
										<KolButton
											_label=""
											_icons={{ left: { icon: 'fa-solid fa-trash' } }}
											class="settings-action-btn"
											_variant="danger"
										>
											<span slot="expert">
												{t('common:actions.delete')}
												<span className="visually-hidden">{` ${entry.text}`}</span>
											</span>
										</KolButton>
									</ButtonAction>
								</li>
							))}
						</ul>
					)}
				</>
			)}

			{deleteTarget !== null && (
				<ConfirmDeleteDialog
					title={t('knowledgeEntries.deleteTitle')}
					body={<p>{t('knowledgeEntries.deleteBody')}</p>}
					confirmLabel={t('categoryDeleteDialog.confirm')}
					onConfirm={() => api.deleteKnowledgeEntry(deleteTarget.id)}
					onClose={() => setDeleteTarget(null)}
					onDeleted={() => {
						setEntries((previous) => previous.filter((entry) => entry.id !== deleteTarget.id));
						setDeleteTarget(null);
					}}
				/>
			)}
		</div>
	);
};
