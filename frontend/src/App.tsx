import { KolAlert, KolHeading } from '@public-ui/react-v19';
import type { Task } from 'client';
import { useEffect, useState } from 'react';
import { api } from './api';

export const App = () => {
	const [tasks, setTasks] = useState<Task[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		api
			.listTasks({ signal: controller.signal })
			.then(setTasks)
			.catch((reason: unknown) => {
				// Abbruch beim Unmount ist erwartet und kein Fehler.
				if (controller.signal.aborted) {
					return;
				}
				setError(reason instanceof Error ? reason.message : 'Unbekannter Fehler beim Laden der Tasks.');
			});
		return () => controller.abort();
	}, []);

	return (
		<main style={{ margin: '2rem', fontFamily: 'sans-serif' }}>
			<KolHeading _label="Priority Pilot" _level={1} />
			<p>Smoke-Test: Aufgaben über GET /tasks laden und roh anzeigen.</p>
			{error !== null && (
				<KolAlert _type="error" _label="Fehler beim Laden der Tasks">
					{error}
				</KolAlert>
			)}
			{error === null && tasks === null && <p>Lade Tasks…</p>}
			{tasks !== null && <pre>{JSON.stringify(tasks, null, 2)}</pre>}
		</main>
	);
};
