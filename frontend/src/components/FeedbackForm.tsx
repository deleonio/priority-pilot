import { KolAlert, KolButton, KolInputText, KolSelect, KolTextarea } from '@public-ui/react-v19';
import { useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';

// Kategorien des Feedback-Formulars (#1435). Die Werte sind der Vertrag mit dem Server
// (`server/src/express/routes/feedback.ts`), die Labels sind die deutsche Anzeige.
// Modulkonstante, damit `KolSelect` nicht bei jedem Render eine neue Optionsliste erhält.
const FEEDBACK_CATEGORIES = [
	{ label: 'Fehler', value: 'bug' },
	{ label: 'Funktionswunsch', value: 'feature' },
	{ label: 'Idee', value: 'idee' },
	{ label: 'Frage', value: 'frage' },
];

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
	const [category, setCategory] = useState('bug');
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [sending, setSending] = useState(false);
	const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

	const submit = async (): Promise<void> => {
		if (title.trim() === '' || description.trim() === '') {
			setStatus({ type: 'error', message: 'Bitte Titel und Beschreibung ausfüllen.' });
			return;
		}
		setSending(true);
		try {
			await api.sendFeedback({ category, title: title.trim(), description: description.trim() });
			setTitle('');
			setDescription('');
			setStatus({ type: 'success', message: 'Danke! Dein Feedback wurde gesendet.' });
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
			<p>Fehler, Wünsche, Ideen oder Fragen landen direkt im Notizbuch der Entwicklung — kein GitHub-Konto nötig.</p>
			{status !== null && (
				<KolAlert _type={status.type} _label={status.type === 'success' ? 'Gesendet' : 'Fehler'}>
					{status.message}
				</KolAlert>
			)}
			<div className="form-grid">
				<KolSelect
					_label="Kategorie"
					_required
					_options={FEEDBACK_CATEGORIES}
					_value={category}
					_on={{ onChange: (_event, value) => setCategory(readString(value)) }}
				/>
				{/* Kein `_type="search"`: das Titel-Feld ist eine Freitext-Eingabe, kein Suchfeld.
				    `type="search"` würde die ARIA-Rolle auf `searchbox` setzen und Screenreadern ein
				    Suchfeld ansagen — dieselbe Auszeichnung wie beim Task-Titel (`TaskForm.tsx:1017`),
				    der ebenfalls ohne `_type` auskommt und in den e2e als `textbox` adressiert wird. */}
				<KolInputText
					_label="Titel"
					_required
					_value={title}
					_on={{
						onInput: (_event, value) => setTitle(readString(value)),
						onChange: (_event, value) => setTitle(readString(value)),
					}}
				/>
				<KolTextarea
					_label="Beschreibung"
					_required
					_rows={6}
					_value={description}
					_on={{
						onInput: (_event, value) => setDescription(readString(value)),
						onChange: (_event, value) => setDescription(readString(value)),
					}}
				/>
				<KolButton
					_label={sending ? 'Wird gesendet …' : 'Senden'}
					_variant="primary"
					_disabled={sending}
					_on={{ onClick: () => void submit() }}
				/>
			</div>
		</div>
	);
};
