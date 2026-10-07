import { KolCard } from '@public-ui/react-v19';
import type { FreeSlot } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';

/**
 * Dashboard-Karte „Freie Zeit" (#1990): heutige Kalender-Lücken mit den Aufgaben, die hineinpassen
 * (`GET /tasks/free-slots`). Reine Information ohne Aktion. Ohne Lücke, ohne Kalender, beim Laden
 * oder bei Fehlern erscheint die Karte nicht — das Dashboard bleibt wie gewohnt (KI-UX, AK4).
 * Neu geladen bei geänderten Aufgaben und bei Rückkehr in den Tab, damit keine vergangene Lücke stehen bleibt.
 */

const formatTime = (iso: string): string =>
	new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export const FreeTimeCard = () => {
	const [slots, setSlots] = useState<FreeSlot[]>([]);
	const [refreshKey, setRefreshKey] = useState(0);

	useEffect(() => {
		const refresh = () => setRefreshKey((key) => key + 1);
		const onVisibility = () => {
			if (document.visibilityState === 'visible') refresh();
		};
		window.addEventListener(TASKS_CHANGED_EVENT, refresh);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener(TASKS_CHANGED_EVENT, refresh);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		api
			.listFreeSlots()
			.then((list) => {
				if (!cancelled) setSlots(list);
			})
			.catch(() => {
				if (!cancelled) setSlots([]);
			});
		return () => {
			cancelled = true;
		};
	}, [refreshKey]);

	if (slots.length === 0) return null;

	return (
		<KolCard
			className="dashboard-free-time"
			role="region"
			aria-label="Freie Zeit"
			_label="Freie Zeit"
			_level={0}
			data-testid="free-time-card"
		>
			<ol className="dashboard-free-time-list">
				{slots.map((slot) => {
					const from = formatTime(slot.start);
					const to = formatTime(slot.end);
					return (
						<li key={slot.start} className="dashboard-free-time-slot">
							<span className="dashboard-free-time-range">
								<span aria-hidden="true">{`${from}–${to}`}</span>
								<span className="visually-hidden">{`von ${from} bis ${to} Uhr`}</span>
							</span>
							<ul className="dashboard-free-time-tasks">
								{slot.tasks.map((task) => (
									<li key={task.id}>{task.title}</li>
								))}
							</ul>
						</li>
					);
				})}
			</ol>
		</KolCard>
	);
};
