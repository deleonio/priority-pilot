import { KolProgress } from '@public-ui/react-v19';
import type { OwnReassignPillarsStatus } from 'client';
import type { ReassignRunState } from '../lib/useReassignRun';

/**
 * Gemeinsame Anzeigen der Säulen-Neuberechnung (#1614) für Nutzer-Modal und Admin-Batch — dieselbe
 * Darstellung an beiden Einstiegen, damit sie nicht wieder auseinanderlaufen (siehe `useReassignRun`).
 */

/** Fortschritt eines laufenden Laufs. */
export const ReassignProgressView = ({ run }: { run: ReassignRunState }) =>
	run.total === 0 ? (
		// Vor der ersten Antwort ist die Gesamtzahl unbekannt — kein „0 / 0“, das wie ein hängender
		// Lauf aussieht.
		<p>Ermittle Aufgaben und verarbeite die erste Portion…</p>
	) : (
		<>
			<p>
				Verarbeite Aufgaben…{' '}
				<strong>
					{run.processed} / {run.total}
				</strong>
			</p>
			<KolProgress _variant="bar" _max={run.total} _value={run.processed} _label="Fortschritt der Neuberechnung" />
		</>
	);

/** Fehlergründe eines abgeschlossenen Laufs, z. B. „HTTP 429 (Rate-Limit des KI-Anbieters): 12“. */
export const ReassignFailureList = ({ reasons }: { reasons: Record<string, number> }) => (
	<ul>
		{Object.entries(reasons).map(([reason, count]) => (
			<li key={reason}>
				{reason === 'HTTP 429' ? 'HTTP 429 (Rate-Limit des KI-Anbieters)' : reason}: {count}
			</li>
		))}
	</ul>
);

/** Stand des letzten Laufs: wie viele Aufgaben seit seinem Start neu berechnet und noch offen sind. */
export const ReassignStatusText = ({ status, testId }: { status: OwnReassignPillarsStatus; testId: string }) =>
	status.startedAt === null ? null : (
		<p data-testid={testId}>
			Stand seit {new Date(status.startedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}:{' '}
			<strong>
				{status.total - status.pending} von {status.total}
			</strong>{' '}
			Aufgaben neu berechnet
			{status.pending > 0 ? `, ${status.pending} noch offen.` : '.'}
		</p>
	);
