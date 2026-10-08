import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { tasksToCsv } from '../lib/taskCsv';

/** Export aller Aufgaben als CSV-Download — rein clientseitig aus `GET /tasks` (Gegenstück zum Import). */
export const TaskExportCard = () => {
	const { t } = useTranslation('capture');
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
			link.download = t('taskExport.fileName');
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
			<p>{t('taskExport.hint')}</p>
			<KolButton
				key={busy ? 'export-busy' : 'export-idle'}
				_label={t('taskExport.button')}
				class="settings-action-btn"
				_variant="secondary"
				_disabled={busy}
				_on={{ onClick: () => void exportTasks() }}
			/>
			{error && (
				<KolAlert _type="error" _label={t('taskExport.failed')}>
					{t('taskExport.failedText')}
				</KolAlert>
			)}
		</div>
	);
};
