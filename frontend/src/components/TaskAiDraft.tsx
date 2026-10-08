import { KolAlert, KolButton, KolHeading, KolSpin } from '@public-ui/react-v19';
import type { Task } from 'client';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readAiPreferences } from '../lib/aiPreferences';

const ACTION_LABEL_KEYS = {
	draft: 'aiDraft.actionDraft',
	summary: 'aiDraft.actionSummary',
	research: 'aiDraft.actionResearch',
} as const;

interface TaskAiDraftProps {
	task: Task;
	/** Nach Erstellen/Löschen: Aufgabenliste nachladen, ohne den Dialog zu schließen. */
	onChanged?: () => void;
}

/**
 * KI-Entwurf einer Aufgabe (#2350): erst der Klick ruft das LLM auf; der Entwurf steht getrennt von
 * der Beschreibung und lässt sich ohne Rückfrage verwerfen (abgeleitet, jederzeit neu erzeugbar).
 * Die Aktion folgt dem Schalter „KI aktivieren" (#1080) und der KI-Eignung (#2349) — die liefert der
 * Server nur mit `ai_assist`, die Paketgrenze ist damit schon abgebildet. Ein vorhandener Entwurf
 * bleibt auch ohne Aktion sichtbar und löschbar.
 */
export const TaskAiDraft = ({ task, onChanged }: TaskAiDraftProps) => {
	const { t } = useTranslation('taskForm');
	const [draft, setDraft] = useState<string | null>(task.aiDraft ?? null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const running = useRef(false);
	const actionRef = useRef<HTMLKolButtonElement>(null);
	const suitability = readAiPreferences().aiEnabled ? task.aiSuitability : null;

	/** @returns ob die Aktion gelungen ist. */
	const run = async (action: () => Promise<string | null>): Promise<boolean> => {
		if (running.current) return false;
		running.current = true;
		setBusy(true);
		setError(null);
		try {
			setDraft(await action());
			onChanged?.();
			return true;
		} catch (reason) {
			setError((await toApiError(reason)).message);
			return false;
		} finally {
			running.current = false;
			setBusy(false);
		}
	};

	const create = (): Promise<boolean> => run(() => api.createTaskAiDraft({ id: task.id }));

	// Der Löschen-Knopf fällt mit dem Entwurf weg — Fokus zurück auf die Erstellen-Aktion.
	const remove = async (): Promise<void> => {
		const deleted = await run(async () => {
			await api.deleteTaskAiDraft({ id: task.id });
			return null;
		});
		if (deleted) void actionRef.current?.focus();
	};

	if (suitability == null && draft === null) return null;

	return (
		<section className="form-section ai-draft">
			{suitability != null && (
				<>
					<KolButton
						ref={actionRef}
						data-testid="ai-draft-action"
						_label={draft === null ? t(ACTION_LABEL_KEYS[suitability]) : t('aiDraft.regenerate')}
						_variant="secondary"
						_disabled={busy}
						_on={{ onClick: () => void create() }}
					/>
					{draft === null && !busy && <p className="hint">{t('aiDraft.hint')}</p>}
				</>
			)}
			{busy && <KolSpin _show _variant="cycle" _label={t('aiDraft.busy')} />}
			{error !== null && (
				<KolAlert _type="error" _alert _label={t('aiDraft.failed')}>
					{error}
				</KolAlert>
			)}
			{draft !== null && (
				<div className="ai-draft__section" data-testid="ai-draft-section">
					<KolHeading _label={t('aiDraft.heading')} _level={4} />
					<p className="ai-draft__text">{draft}</p>
					<KolButton
						data-testid="ai-draft-delete"
						_label={t('aiDraft.delete')}
						_variant="secondary"
						_icons={{ left: { icon: 'fa-solid fa-trash' } }}
						_disabled={busy}
						_on={{ onClick: () => void remove() }}
					/>
				</div>
			)}
		</section>
	);
};
