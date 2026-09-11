import { KolAlert } from '@public-ui/react-v19';
import type { Task } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { istTagGeschafft } from '../lib/dayDone';

interface DayDoneHintProps {
	tasks: Task[];
}

/**
 * Kalendertag (`YYYY-MM-DD`) von `jetzt` in `zeitZone` — dieselbe `formatToParts`-Bildung wie
 * `tagIn` in `server/src/logics/streak.ts`, damit der Vergleich mit dem server-gelieferten
 * `letzterTag` (ebenfalls über `tagIn` gebildet) dieselbe Kalendertagsgrenze verwendet. Ein
 * UTC-`toISOString().slice(0, 10)` würde in jeder Zeitzone ≠ UTC täglich ein Zeitfenster
 * erzeugen, in dem UTC- und lokales Datum auseinanderfallen (Finding #1, PR #1375).
 */
const kalendertagIn = (jetzt: Date, zeitZone: string): string => {
	const teile = new Intl.DateTimeFormat('en-US', {
		timeZone: zeitZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(jetzt);
	const teil = (type: Intl.DateTimeFormatPartTypes): string => teile.find((p) => p.type === type)?.value ?? '';
	return `${teil('year')}-${teil('month')}-${teil('day')}`;
};

/**
 * Abschluss-Hinweis „Tag geschafft" (#1361, docs/spec/issue-1361.md): erscheint nur, wenn keine
 * Aufgabe offen oder in Bearbeitung ist UND die letzte Erledigung heute war. Lädt `letzterTag`
 * selbst über `api.getStreak` (Muster `StreakCard`), die Aufgabenliste kommt als Prop, weil der
 * Aufrufer sie ohnehin im State hält.
 *
 * Kein Hinweis-Zustand rendert bewusst KEINEN Knoten (nicht nur versteckt) — der Hinweis ist ein
 * Moment, kein dauerhaftes UI-Element.
 */
export const DayDoneHint = ({ tasks }: DayDoneHintProps) => {
	const [letzterTag, setLetzterTag] = useState<string | null | undefined>(undefined);
	const zeitZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	useEffect(() => {
		let cancelled = false;
		api
			.getStreak({ tz: zeitZone })
			.then((result) => {
				if (!cancelled) {
					setLetzterTag(result.letzterTag);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setLetzterTag(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [zeitZone]);

	if (letzterTag === undefined) {
		return null;
	}

	const heuteTag = kalendertagIn(new Date(), zeitZone);
	if (!istTagGeschafft(tasks, letzterTag, heuteTag)) {
		return null;
	}

	return (
		<div className="day-done-hint" data-testid="day-done">
			<KolAlert _type="success" _alert _label="Tag geschafft">
				<p>Alle Aufgaben erledigt — heute geschafft.</p>
			</KolAlert>
		</div>
	);
};
