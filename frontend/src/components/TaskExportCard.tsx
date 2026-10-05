import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useState } from 'react';
import { api } from '../api';
import { tasksToCsv } from '../lib/taskCsv';

/** Export aller Aufgaben als CSV-Download — rein clientseitig aus `GET /tasks` (Gegenstück zum Import). */
export const TaskExportCard = () => {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);

	const exportTasks = async (): Promise<void> => {
		setBusy(true);
		setError(false);
		try {
			const tasks = await api.listTasks();
			const url = URL.createObjectURL(new Blob([`\uFEFF${tasksToCsv(tasks)}`], { type: 'text/csv;charset=utf-8' }));
			const link = document.createElement('a');
			link.href = url;
			link.download = 'balamentum-aufgaben.csv';
			link.click();
			URL.revokeObjectURL(url);
		} catch {
			setError(true);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="settings-card-stack">
			<p>Lädt alle deine Aufgaben als CSV-Datei herunter (Titel, Frist, Priorität, Status, Beschreibung).</p>
			<KolButton
				key={busy ? 'export-busy' : 'export-idle'}
				_label="Aufgaben als CSV exportieren"
				class="settings-action-btn"
				_variant="secondary"
				_disabled={busy}
				_on={{ onClick: () => void exportTasks() }}
			/>
			{error && (
				<KolAlert _type="error" _label="Export fehlgeschlagen">
					Die Aufgaben konnten nicht geladen werden. Versuche es erneut.
				</KolAlert>
			)}
		</div>
	);
};
