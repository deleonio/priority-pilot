import { KolAlert, KolButton, KolInputText, KolSelect, KolTextarea } from '@public-ui/react-v19';
import { useState } from 'react';
import { api } from '../api';

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
		} catch {
			// Eingaben bewusst NICHT zurücksetzen (AK9) — erneutes Senden ohne Neutippen.
			setStatus({ type: 'error', message: 'Senden fehlgeschlagen. Bitte später erneut versuchen.' });
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
				<KolInputText
					_label="Titel"
					_required
					_type="search"
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
