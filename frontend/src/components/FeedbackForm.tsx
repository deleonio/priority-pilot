import { KolAlert, KolButton, KolInputText, KolSelect, KolTextarea } from '@public-ui/react-v19';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';

// Kategorien des Feedback-Formulars (#1435, in #1475 auf drei konsolidiert). Die Werte sind
// der Vertrag mit dem Server (`server/src/express/routes/feedback.ts`), die Labels sind die
// deutsche Anzeige. Modulkonstante, damit `KolSelect` nicht bei jedem Render eine neue
// Optionsliste erhält.
const FEEDBACK_CATEGORIES = [
	{ labelKey: 'feedbackForm.categoryQuestion', value: 'frage' },
	{ labelKey: 'feedbackForm.categoryWish', value: 'wunsch' },
	{ labelKey: 'feedbackForm.categoryBug', value: 'bug' },
] as const;

/** Liest den Wert eines KoliBri-Events als String (die Events liefern `unknown`). */
const readString = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));

/**
 * Feedback-Formular im Hilfe-Bereich (Issue #1435, AK8–AK10): Kategorie, Titel und
 * Beschreibung landen über `POST /feedback` als Markdown im Obsidian-Vault.
 *
 * Erfolg leert die Felder und zeigt eine Bestätigung (AK8). Ein Fehler lässt die Eingaben
 * stehen, damit der zweite Versuch ohne Neutippen möglich ist (AK9).
 */
export const FeedbackForm = () => {
	const { t } = useTranslation(['settings', 'forms']);
	// Stabile Options-Identität: eine neue Liste je Render baut die KoliBri-Auswahl neu auf.
	const categoryOptions = useMemo(
		() => FEEDBACK_CATEGORIES.map(({ labelKey, value }) => ({ label: t(labelKey), value })),
		[t],
	);
	const [category, setCategory] = useState('wunsch');
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [sending, setSending] = useState(false);
	const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

	const submit = async (): Promise<void> => {
		if (title.trim() === '' || description.trim() === '') {
			setStatus({ type: 'error', message: t('feedbackForm.required') });
			return;
		}
		setSending(true);
		try {
			await api.sendFeedback({ category, title: title.trim(), description: description.trim() });
			setTitle('');
			setDescription('');
			setStatus({ type: 'success', message: t('feedbackForm.sent') });
		} catch (reason) {
			// #1465: Der Server unterscheidet „nicht konfiguriert" (503) von „gerade nicht gespeichert"
			// (502) — die frühere Pauschalzeile verschluckte den Unterschied, und niemand konnte sehen,
			// ob ein zweiter Versuch etwas bringt. `llmMapping: false`, weil das kein KI-Endpunkt ist
			// und die 502/503-Übersetzung aus #620 hier vom Thema ablenkt.
			// Eingaben bewusst NICHT zurücksetzen (AK9) — erneutes Senden ohne Neutippen.
			const { message } = await toApiError(reason, { llmMapping: false });
			setStatus({ type: 'error', message });
		} finally {
			setSending(false);
		}
	};

	return (
		<div className="feedback-form">
			<p>{t('feedbackForm.intro')}</p>
			{status !== null && (
				<KolAlert
					_type={status.type}
					_label={status.type === 'success' ? t('feedbackForm.sentLabel') : t('feedbackForm.errorLabel')}
				>
					{status.message}
				</KolAlert>
			)}
			<div className="form-grid">
				<KolSelect
					_label={t('forms:labels.category')}
					_required
					_options={categoryOptions}
					_value={category}
					_on={{ onChange: (_event, value) => setCategory(readString(value)) }}
				/>
				{/* Kein `_type="search"`: das Titel-Feld ist eine Freitext-Eingabe, kein Suchfeld.
				    `type="search"` würde die ARIA-Rolle auf `searchbox` setzen und Screenreadern ein
				    Suchfeld ansagen — dieselbe Auszeichnung wie beim Task-Titel (`TaskForm.tsx:1017`),
				    der ebenfalls ohne `_type` auskommt und in den e2e als `textbox` adressiert wird. */}
				<KolInputText
					_label={t('feedbackForm.title')}
					_required
					_value={title}
					_on={{
						onInput: (_event, value) => setTitle(readString(value)),
						onChange: (_event, value) => setTitle(readString(value)),
					}}
				/>
				<KolTextarea
					_label={t('forms:labels.description')}
					_required
					_rows={6}
					_value={description}
					_on={{
						onInput: (_event, value) => setDescription(readString(value)),
						onChange: (_event, value) => setDescription(readString(value)),
					}}
				/>
				<KolButton
					_label={sending ? t('feedbackForm.sending') : t('feedbackForm.send')}
					_variant="primary"
					_disabled={sending}
					_on={{ onClick: () => void submit() }}
				/>
			</div>
		</div>
	);
};
