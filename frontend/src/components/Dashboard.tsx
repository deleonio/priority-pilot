import { KolBadge, KolButton, KolCard, KolMeter } from '@public-ui/react-v19';
import { NearbyCard } from './NearbyCard';
import type { Pillar, Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { useMemo } from 'react';
import { useGeolocation } from '../lib/useGeolocation';
import { collectTaskValues } from '../lib/forest';
import { buildPillarSummaries, calculateMeterThreshold, calculateMeterHighThreshold } from '../lib/pillar';
import { buildPillarBalances } from '../lib/score';
import {
	type DeadlineUrgency,
	deadlineUrgency,
	formatDeadline,
	formatNumber,
	formatRelativeDeadline,
} from '../lib/task';

/** Badge-Hintergrundfarbe je hervorzuhebender Dringlichkeit (Textfarbe berechnet KolBadge automatisch). */
const URGENCY_COLOR: Record<Exclude<DeadlineUrgency, 'later'>, string> = {
	overdue: '#b42318',
	soon: '#b54708',
};

interface DashboardProps {
	tasks: Task[];
	/** Nach Wert absteigend sortierter Aufgabenwald (`GET /forest`); Basis für die wichtigsten Tasks. */
	forest: TaskTreeNode[];
	/** Nächste wichtige Aufgabe (`GET /next`) oder `null`, falls keine ansteht. */
	nextTask: Task | null;
	/**
	 * „Was ist jetzt dran?"-Vorschlagsliste (`GET /suggestions`): nach Score sortiert und durch den
	 * Überlastungsschutz begrenzt (Konzept §4.3). Default leer, falls noch nicht geladen.
	 */
	suggestions?: Task[];
	/** Die fünf Lebensbalance-Säulen samt Gewichtung (`GET /pillars`) für das Widget „Meine Themen". */
	pillars: Pillar[];
	/** Anzeigename des Nutzers für die personalisierte Begrüßung (aus `localStorage`). Leer → keine Begrüßung. */
	displayName?: string;
	/** Öffnet die nächste Aufgabe zum Bearbeiten („Jetzt starten" im Signal-Panel, P2-1). */
	onStartTask?: (task: Task) => void;
}

interface StatCard {
	label: string;
	count: number;
	/** CSS-Akzentklasse für den farbcodierten Statusbezug (`total` für die Gesamtzahl). */
	accent: string;
}

/** Anzahl der im Widget „Wichtigste Tasks" angezeigten Einträge. */
const TOP_TASKS_LIMIT = 5;

/** Eine Aufgabe mit gesetzter, gültiger Deadline (für die Deadline-Liste). */
type TaskWithDeadline = Task & { deadline: Date };

/** Prüft, ob eine Aufgabe eine gesetzte, gültige Deadline trägt (Type-Guard für die Liste). */
const hasDeadline = (task: Task): task is TaskWithDeadline =>
	task.deadline != null && !Number.isNaN(task.deadline.getTime());

/**
 * Dashboard-Startbereich mit Status-Kennzahlen als Karten (Gesamtzahl + Anzahl je Status), der
 * nächsten wichtigen Aufgabe (`GET /next`), dem Widget „Wichtigste Tasks" (Top-N nach Wert
 * absteigend) sowie den anstehenden Deadlines.
 *
 * Reine Ableitung aus den bereits geladenen Daten (keine eigene API-Anfrage). Die Status-Karten
 * zeigen genau drei Kacheln: Gesamt, Offen (Open+InProcess), Erledigt.
 * Der `forest` ist serverseitig bereits nach Wert absteigend sortiert, daher genügt das Abschneiden
 * der ersten `TOP_TASKS_LIMIT` Wurzeln. Die Deadline-Liste zeigt nur noch nicht erledigte Aufgaben
 * mit gesetzter Deadline, aufsteigend nach Datum. Das Widget „Meine Themen" zeigt je Säule die
 * aktuelle Gewichtung sowie Anzahl, Gesamtwert und Gesamtaufwand der zugeordneten Tasks (der Wert
 * stammt aus dem `forest`, umfasst also nur offene/in Arbeit befindliche Tasks). Anzahl und Aufwand
 * werden dabei je Säule nach Status aufgeschlüsselt (#124): offen (`Open`/`In process`) vs. erledigt
 * (`Done`), damit erkennbar ist, wie eine Säule bereits abgearbeitet ist.
 */
export const Dashboard = ({
	tasks,
	forest,
	nextTask,
	suggestions = [],
	pillars,
	displayName = '',
	onStartTask,
}: DashboardProps) => {
	const greeting = displayName.trim();
	// #1098 AK4: eigene Hook-Instanz (wie Footer/SettingsPage) — entscheidet, ob die
	// NearbyCard überhaupt gerendert wird.
	const { enabled: geoEnabled } = useGeolocation();
	const cards = useMemo<StatCard[]>(() => {
		let openCount = 0;
		let doneCount = 0;
		for (const task of tasks) {
			if (task.status === TaskStatus.Done) doneCount++;
			else if (task.status === TaskStatus.Open || task.status === TaskStatus.InProcess) openCount++;
		}
		return [
			{ label: 'Gesamt', count: tasks.length, accent: 'total' },
			{ label: 'Offen', count: openCount, accent: 'open' },
			{ label: 'Erledigt', count: doneCount, accent: 'done' },
		];
	}, [tasks]);

	// Einmal pro Mount bestimmter Bezugszeitpunkt für die Deadline-Dringlichkeit (stabil je Ansicht).
	const now = useMemo(() => new Date(), []);

	const topTasks = useMemo(() => forest.slice(0, TOP_TASKS_LIMIT), [forest]);

	// Wertbeiträge je Task aus dem Wald ableiten und je Säule zu Kennzahlen aggregieren.
	const pillarSummaries = useMemo(() => {
		const valueByTaskId = collectTaskValues(forest);
		return buildPillarSummaries(pillars, tasks, valueByTaskId);
	}, [pillars, tasks, forest]);

	// Gesamtguthaben (Gamification-Balance, §4.4): Punkte je Säule aus dem erledigten Aufwand,
	// daraus Anteile und Gesamtstand ableiten. Tasks ohne Säulen-Zuweisung fließen gleichmäßig
	// nach Säulen-Gewicht ein, damit erledigte Arbeit auch ohne explizite Säule sichtbar wird.
	const pillarBalances = useMemo(() => {
		const punkteProSaeule = new Map<number, number>(
			pillarSummaries.map(({ pillar, doneEstimatedEffort }) => [pillar.id, doneEstimatedEffort]),
		);
		const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);
		if (totalWeight > 0) {
			for (const task of tasks) {
				if (task.status === TaskStatus.Done && task.pillars.length === 0) {
					for (const pillar of pillars) {
						const prev = punkteProSaeule.get(pillar.id) ?? 0;
						punkteProSaeule.set(pillar.id, prev + task.estimatedEffort * (pillar.weight / totalWeight));
					}
				}
			}
		}
		return buildPillarBalances(pillars, punkteProSaeule);
	}, [pillars, pillarSummaries, tasks]);

	const gesamtPunkte = useMemo(() => pillarBalances.reduce((acc, { punkte }) => acc + punkte, 0), [pillarBalances]);

	const upcomingDeadlines = useMemo<TaskWithDeadline[]>(
		() =>
			// `filter` liefert ein neues Array, daher ist das anschließende `sort` ohne Mutation der Props.
			tasks
				.filter((task): task is TaskWithDeadline => task.status !== TaskStatus.Done && hasDeadline(task))
				.sort((a, b) => a.deadline.getTime() - b.deadline.getTime()),
		[tasks],
	);

	// P2-1: Vorschläge, die die bereits angezeigte Nächste-Aufgabe ausschließen — sonst wiederholt
	// "Was ist jetzt dran?" dieselbe Hauptaussage (#443).
	const suggestionsFiltered = useMemo(
		() => suggestions.filter((task) => nextTask === null || task.id !== nextTask.id),
		[suggestions, nextTask],
	);

	return (
		<section className="dashboard">
			<div className="dashboard-heading">
				<h2>Dashboard</h2>
			</div>
			{greeting !== '' && <p className="dashboard-greeting">Hallo {greeting}!</p>}
			<ul className="dashboard-cards">
				{cards.map((card) => (
					<li key={card.label}>
						<KolCard _label={card.label} _level={0}>
							<div className="dashboard-card">
								<span className={`dashboard-card-accent ${card.accent}`} aria-hidden="true" />
								<span className="dashboard-card-count">{card.count}</span>
							</div>
						</KolCard>
					</li>
				))}
			</ul>
			{/*
			 * P2-1: „Nächste Aufgabe" ist die EINE Hauptaussage einer Ansicht (ux-design.md §1).
			 * Sie trägt die Signalfarbe `--pp-signal` / `--pp-signal-wash` und eine klare
			 * Folgehandlung („Jetzt starten"). Die Säulen-Balance, Statistik-Karten und
			 * Deadline-Liste ordnen sich darunter.
			 */}
			<section className="dashboard-next-task" role="region" aria-labelledby="dashboard-next-task-heading">
				<h3 id="dashboard-next-task-heading">Nächste Aufgabe</h3>
				{nextTask === null ? (
					<p className="dashboard-next-task-empty">
						Aktuell steht keine Aufgabe an (alle erledigt oder durch offene Vorgänger blockiert).
					</p>
				) : (
					<div className="dashboard-next-task-content">
						<span className="dashboard-next-task-title">
							#{nextTask.id} – {nextTask.title}
						</span>
						<span className="dashboard-next-task-priority">Priorität {nextTask.priority}</span>
						{onStartTask !== undefined && (
							<KolButton
								_label="Jetzt starten"
								_variant="primary"
								_icons={{ left: { icon: 'fa-solid fa-play' } }}
								_on={{ onClick: () => onStartTask(nextTask) }}
							/>
						)}
					</div>
				)}
			</section>
			{/*
			 * P2-1: „Was ist jetzt dran?" — Vorschläge, die die nächste Aufgabe ausschließen,
			 * um keine doppelte Hauptaussage zu erzeugen. Visuell eine schlichtere Liste ohne
			 * Signal-Färbung; die Signalfläche gehört allein der „Nächste Aufgabe"-Zeile.
			 */}
			<section className="dashboard-suggestions" aria-label="Was ist jetzt dran?">
				<h3>Was ist jetzt dran?</h3>
				{suggestionsFiltered.length === 0 ? (
					<p className="dashboard-suggestions-empty">Aktuell stehen keine weiteren Vorschläge an.</p>
				) : (
					<ol className="dashboard-suggestions-list">
						{suggestionsFiltered.map((task) => (
							<li key={task.id} className="dashboard-suggestion">
								<span className="dashboard-suggestion-title">
									#{task.id} – {task.title}
								</span>
								<span className="dashboard-suggestion-meta">(Priorität {task.priority})</span>
							</li>
						))}
					</ol>
				)}
			</section>
			{/*
			 * #1066: „In der Nähe" — Distanzliste unter der Vorschlagsliste. Wie die anderen
			 * Sekundär-Widgets ohne Signal-Färbung; die Signalfläche gehört allein der
			 * „Nächste Aufgabe"-Zeile (KI-UX-Platzierungsempfehlung).
			 */}
			{/* #1098 AK4: „In der Nähe" nur rendern, wenn die Standorterfassung an ist —
			    ausgeschaltet verschwindet die Card komplett (keine Hinweis-Card mehr). */}
			{geoEnabled && <NearbyCard />}
			<section className="dashboard-top-tasks">
				<h3>Wichtigste Tasks</h3>
				{topTasks.length === 0 ? (
					<p>Keine offenen Aufgaben vorhanden.</p>
				) : (
					<ol className="dashboard-top-tasks-list">
						{topTasks.map((task) => (
							<li key={task.id} className="dashboard-top-task">
								<span className="dashboard-top-task-title">
									#{task.id} – {task.title}
								</span>
								<span className="dashboard-top-task-meta">
									(Priorität {task.priority}, Wert {formatNumber(task.value)})
								</span>
							</li>
						))}
					</ol>
				)}
			</section>
			<section className="dashboard-pillars">
				<h3>Meine Themen</h3>
				{pillars.length === 0 ? (
					<KolCard _label="Keine Säulen vorhanden" _level={0}>
						<p>
							Lege in den <a href="/settings">Einstellungen</a> deine ersten Säulen an, um hier den Überblick über deine
							Themen zu behalten.
						</p>
					</KolCard>
				) : (
					<ul className="dashboard-pillars-list">
						{pillarSummaries.map(
							({
								pillar,
								taskCount,
								openCount,
								doneCount,
								totalValue,
								totalEstimatedEffort,
								openEstimatedEffort,
								doneEstimatedEffort,
								actualShare,
							}) => (
								<li key={pillar.id} className="dashboard-pillar">
									<KolMeter
										_label={pillar.name}
										_value={actualShare}
										_max={1}
										_low={calculateMeterThreshold(pillar.weight)}
										_high={calculateMeterHighThreshold(pillar.weight)}
									/>
									<span className="dashboard-pillar-meta">
										{`${taskCount} ${taskCount === 1 ? 'Aufgabe' : 'Aufgaben'} (${openCount} offen · ${doneCount} erledigt) · Wert ${formatNumber(totalValue)} · Aufwand ${formatNumber(totalEstimatedEffort)} Tage (${formatNumber(openEstimatedEffort)} offen · ${formatNumber(doneEstimatedEffort)} erledigt)`}
									</span>
								</li>
							),
						)}
					</ul>
				)}
			</section>
			<section className="dashboard-balance">
				<h3>Gesamtguthaben</h3>
				{gesamtPunkte === 0 ? (
					<p>Noch keine Punkte vergeben — schließe Tasks ab, um dein Guthaben aufzubauen.</p>
				) : (
					<>
						<p className="dashboard-balance-total">
							<span data-testid="balance-total">{formatNumber(gesamtPunkte)}</span> Punkte
						</p>
						<ul className="dashboard-balance-list" data-testid="balance-pillar-list">
							{pillarBalances.map(({ pillar, punkte, anteil }) => (
								<li key={pillar.id} className="dashboard-balance-row" data-testid="balance-pillar-row">
									<span className="dashboard-balance-name">{pillar.name}</span>
									<span className="dashboard-balance-value">
										{formatNumber(punkte)} Punkte ({Math.round(anteil * 100)} %)
									</span>
								</li>
							))}
						</ul>
					</>
				)}
			</section>
			<section className="dashboard-deadlines">
				<h3>Anstehende Deadlines</h3>
				{upcomingDeadlines.length === 0 ? (
					<p>Keine anstehenden Deadlines.</p>
				) : (
					<ul className="dashboard-deadlines-list">
						{upcomingDeadlines.map((task) => {
							const urgency = deadlineUrgency(task.deadline, now);
							return (
								<li key={task.id} className="dashboard-deadline">
									<span className="dashboard-deadline-title">
										#{task.id} – {task.title}
									</span>
									<span className="dashboard-deadline-aside">
										{urgency !== 'later' && (
											<KolBadge _label={formatRelativeDeadline(task.deadline, now)} _color={URGENCY_COLOR[urgency]} />
										)}
										<span className="dashboard-deadline-date">{formatDeadline(task.deadline)}</span>
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</section>
		</section>
	);
};
