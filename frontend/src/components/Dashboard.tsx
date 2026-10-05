import { KolBadge, KolButton, KolCard, KolMeter } from '@public-ui/react-v19';
import { NearbyCard } from './NearbyCard';
import { CareHint } from './CareHint';
import { DayDoneHint } from './DayDoneHint';
import { StreakCard } from './StreakCard';
import { WeeklyBalanceCard } from './WeeklyBalanceCard';
import { MonthlyBalanceCard } from './MonthlyBalanceCard';
import { YearlyRecapCard } from './YearlyRecapCard';
import { MilestoneBadges } from './MilestoneBadges';
import { MissedTasksCard } from './MissedTasksCard';
import { HeartBalance } from './HeartBalance';
import type { components, Pillar, Task, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
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

/**
 * #1985: „Warum jetzt?“ — `GET /next` liefert die Begründungswerte additiv im Payload
 * (reviveTask-Spread, api.ts); hier über den TaskRecommendation-Vertrag typisiert. Bewusst nur
 * die zwei Zusatzfelder gepickt — der Vertrags-`deadline` (String) kollidiert mit dem
 * revivierten `Date` des Frontend-`Task`.
 */
type BegrTask = Task & Partial<Pick<components['schemas']['TaskRecommendation'], 'scoreBreakdown' | 'reasons'>>;

/**
 * Begründungssätze der Karte (#1985): bis zu vier kurze Sätze, absteigend nach dem
 * scoreBreakdown-Anteil des jeweiligen Faktors (stärkster Grund zuerst = DOM-Reihenfolge, A11y).
 * Rein informativ, ohne Technik-Werte (KI-UX): keine Anteile/Prozente/Scores. Ohne Anteile
 * genau ein Fallback-Satz aus der Frist (ohne Frist keiner). Die Priorität steht schon in der
 * Meta-Zeile der Karte und wird nicht wiederholt.
 */
const begruendungsSaetze = (task: BegrTask): string[] => {
	const { reasons, scoreBreakdown } = task;
	if (reasons === undefined || Object.keys(reasons).length === 0) {
		return task.deadline ? [`Fällig am ${formatDeadline(task.deadline)}.`] : [];
	}
	const anteil = (key: keyof NonNullable<typeof reasons>): number =>
		scoreBreakdown?.[key as keyof NonNullable<typeof scoreBreakdown>] ?? 0;
	const saetze: Array<{ key: keyof NonNullable<typeof reasons>; satz: string }> = [];
	const balance = reasons.balance;
	if (balance !== undefined && balance.pillars.length > 0) {
		const namen =
			balance.pillars.length === 1
				? `Säule ${balance.pillars[0]!}`
				: `Säulen ${balance.pillars.slice(0, -1).join(', ')} und ${balance.pillars.at(-1)!}`;
		saetze.push({
			key: 'balance',
			satz: `${namen} kam${balance.pillars.length === 1 ? '' : 'en'} diese Woche zu kurz.`,
		});
	}
	if (reasons.unlock !== undefined) {
		const offen = reasons.unlock.openCount;
		saetze.push({
			key: 'unlock',
			satz: offen === 1 ? 'Schaltet 1 offene Aufgabe frei.' : `Schaltet ${offen} offene Aufgaben frei.`,
		});
	}
	const frist = reasons.deadline;
	if (frist !== undefined) {
		const tage = frist.daysUntil;
		saetze.push({
			key: 'deadline',
			satz:
				tage < 0
					? `Überfällig seit ${-tage} ${-tage === 1 ? 'Tag' : 'Tagen'}.`
					: tage === 0
						? 'Fällig heute.'
						: `Fällig am ${formatDeadline(new Date(`${frist.date}T00:00:00Z`))} (in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}).`,
		});
	}
	return saetze.sort((a, b) => anteil(b.key) - anteil(a.key)).map(({ satz }) => satz);
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
	/** Markiert die nächste Aufgabe als erledigt („Erledigt" im Signal-Panel, #1168). */
	onCompleteTask?: (task: Task) => void;
	/** Öffnet den Bearbeiten-Dialog für die nächste Aufgabe („Bearbeiten" im Signal-Panel, #1447). */
	onEditTask?: (task: Task) => void;
	/**
	 * #1361: KolTabs hält inaktive Panels per `hidden` im DOM statt sie zu entfernen — ohne diesen
	 * Schalter würde der Abschluss-Hinweis hier UND im Aufgaben-Tab gleichzeitig mounten und
	 * `data-testid="day-done"` doppeln. Default `true` (eigenständige Nutzung ohne Tab-Kontext).
	 */
	showDayDoneHint?: boolean;
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
	onCompleteTask,
	onEditTask,
	showDayDoneHint = true,
}: DashboardProps) => {
	const greeting = displayName.trim();
	// #1098 AK4: eigene Hook-Instanz (wie Footer/SettingsPage) — entscheidet, ob die
	// NearbyCard überhaupt gerendert wird. Bei Verweigerung durch den Browser bleibt sie
	// gerendert: Die Card zeigt ihren eigenen Ablehn-Hinweis (#1066 AK4), statt spurlos zu
	// verschwinden — der Nutzer wollte den Standort ja einschalten.
	const { enabled: geoEnabled, permissionDenied: geoDenied } = useGeolocation();
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

	// Punkte je Säule aus dem erledigten Aufwand (Gamification-Balance, §4.4). Tasks ohne
	// Säulen-Zuweisung fließen gleichmäßig nach Säulen-Gewicht ein, damit erledigte Arbeit auch ohne
	// explizite Säule sichtbar wird. Eigenes `useMemo`, weil zwei Widgets an derselben Punktequelle
	// hängen — „Gesamtguthaben" (Anteile) und das Herz (Füllstand); eine je Render neu gebaute Map
	// würde deren Memoisierung bei jedem Render wegwerfen.
	const punkteProSaeule = useMemo(() => {
		const punkte = new Map<number, number>(
			pillarSummaries.map(({ pillar, doneEstimatedEffort }) => [pillar.id, doneEstimatedEffort]),
		);
		const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);
		if (totalWeight > 0) {
			for (const task of tasks) {
				if (task.status === TaskStatus.Done && task.pillars.length === 0) {
					for (const pillar of pillars) {
						const prev = punkte.get(pillar.id) ?? 0;
						punkte.set(pillar.id, prev + task.estimatedEffort * (pillar.weight / totalWeight));
					}
				}
			}
		}
		return punkte;
	}, [pillars, pillarSummaries, tasks]);

	// #1638 AK5: Den Füllstand des Herzens rechnet der Server im Kadenz-Modell (Soll-Rhythmus je Säule
	// im 28-Tage-Fenster) — dieselbe Zahl wie Verlauf und MCP `balance_status`. Neu geladen, sobald
	// sich die Aufgaben ändern; bis zur Antwort oder bei Fehler bleibt der lokal gerechnete Wert.
	const [serverFill, setServerFill] = useState<number | undefined>(undefined);
	useEffect(() => {
		let cancelled = false;
		api
			.getBalanceStatus({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
			.then((status) => {
				if (!cancelled) {
					setServerFill(status.fuellstandProzent / 100);
				}
			})
			.catch(() => {
				// Nicht erreichbar: das Herz zeigt weiter den lokalen Wert statt eines Fehlerzustands.
			});
		return () => {
			cancelled = true;
		};
	}, [tasks]);

	const pillarBalances = useMemo(() => buildPillarBalances(pillars, punkteProSaeule), [pillars, punkteProSaeule]);

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
				{greeting !== '' && <p className="dashboard-greeting">Hallo {greeting}!</p>}
			</div>

			{/*
			 * Desktop-Hero (ab 48rem): „Meine Lebensbalance" links zwei Drittel, rechts ein Drittel
			 * die Kennzahlen-Kacheln gestapelt und darunter — bündig mit der Herz-Unterkante — die
			 * „Nächste Aufgabe". Mobil bleibt die gewohnte Einspaltigkeit; das Herz steht weiter ganz
			 * oben und mittig: Es beantwortet „wie steht es um mich?", bevor die Zahlen kommen. Es
			 * bleibt bewusst in der Säulen-Rampe eingefärbt und greift NICHT die Signalfarbe ab — die
			 * gehört weiterhin allein der „Nächsten Aufgabe" als der einen Hauptaussage (ux-design.md
			 * §1). Ohne Säulen gibt es nichts zu segmentieren, dann entfällt die Karte ganz und der
			 * Solo-Modifier (.dashboard-hero--solo) stellt das Raster auf eine Spalte um (die Karte
			 * „Meine Themen" führt dort zu den Einstellungen). Die DOM-Reihenfolge ist zugleich die
			 * Lesereihenfolge: Herz → Kacheln → Nächste Aufgabe.
			 */}
			<div className={pillars.length > 0 ? 'dashboard-hero' : 'dashboard-hero dashboard-hero--solo'}>
				{pillars.length > 0 && (
					<KolCard className="dashboard-heart" _label="Meine Lebensbalance" _level={3}>
						<HeartBalance pillars={pillars} punkteProSaeule={punkteProSaeule} fill={serverFill} />
					</KolCard>
				)}
				<div className="dashboard-hero-side">
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
					 * Folgehandlung („Erledigt"). Die Säulen-Balance, Statistik-Karten und
					 * Deadline-Liste ordnen sich darunter.
					 */}
					{/* #1118: Die Card selbst ist das Widget — die alte Außen-<section> ist entfernt,
					    die Sektionsklasse sitzt am Card-Host. Card-Label = Sektionsüberschrift;
					    die Region-Semantik der Hauptaussage zieht mit auf den Host um. */}
					<CareHint />
					<KolCard
						className="dashboard-next-task"
						role="region"
						aria-label="Nächste Aufgabe"
						_label="Nächste Aufgabe"
						_level={3}
					>
						{nextTask === null ? (
							<p className="dashboard-next-task-empty">
								Aktuell steht keine Aufgabe an (alle erledigt oder durch offene Vorgänger blockiert).
							</p>
						) : (
							<div className="dashboard-next-task-content">
								<span className="dashboard-next-task-title">{nextTask.title}</span>
								<span className="dashboard-next-task-priority">Priorität {nextTask.priority}</span>
								{/* #1985: „Warum jetzt?“ — Begründungssätze, stärkster Grund zuerst (DOM-Reihenfolge,
								    A11y); ohne Anteile der Fallback-Satz. Reine Information im Signal-Panel: keine
								    Interaktion, kein Farb-/Gewichts-Akzent (KI-UX). */}
								{begruendungsSaetze(nextTask).length > 0 && (
									<ul className="dashboard-next-task-reasons">
										{begruendungsSaetze(nextTask).map((satz) => (
											<li key={satz}>{satz}</li>
										))}
									</ul>
								)}
								{/* #1465: Beide Aktionen liegen in EINER Zeile (`.dashboard-next-task-actions`) —
								    „Erledigen" nimmt die Restbreite, der Stift bleibt inhaltsbreit daneben.
								    #1447: Bearbeiten steht NACH „Erledigen" im DOM, die Signalfarbe bleibt der
								    Hauptaussage vorbehalten (ux-design.md §1), Icon-only wie der Präzedenzfall
								    in `TaskTree.tsx:212-223`. Der Breiten-Vertrag aus #1042 gilt jetzt für die
								    Zeile: sie füllt mobil die Innenbreite, ab Tablet ist sie inhaltsbreit. */}
								{(onCompleteTask !== undefined || onEditTask !== undefined) && (
									<div className="dashboard-next-task-actions">
										{onCompleteTask !== undefined && (
											<KolButton
												_label="Erledigen"
												_variant="primary"
												_icons={{ left: { icon: 'fa-solid fa-check' } }}
												_on={{ onClick: () => onCompleteTask(nextTask) }}
											/>
										)}
										{onEditTask !== undefined && (
											<KolButton
												_label="Bearbeiten"
												_hideLabel
												_variant="secondary"
												_icons={{ left: { icon: 'fa-solid fa-pen' } }}
												_on={{ onClick: () => onEditTask(nextTask) }}
											/>
										)}
									</div>
								)}
							</div>
						)}
					</KolCard>
				</div>
			</div>
			{/*
			 * P2-1: „Was ist jetzt dran?" — Vorschläge, die die nächste Aufgabe ausschließen,
			 * um keine doppelte Hauptaussage zu erzeugen. Visuell eine schlichtere Liste ohne
			 * Signal-Färbung; die Signalfläche gehört allein der „Nächste Aufgabe"-Zeile.
			 */}
			<KolCard
				className="dashboard-suggestions"
				role="region"
				aria-label="Was ist jetzt dran?"
				_label="Was ist jetzt dran?"
				_level={3}
			>
				{suggestionsFiltered.length === 0 ? (
					<p className="dashboard-suggestions-empty">Aktuell stehen keine weiteren Vorschläge an.</p>
				) : (
					<ol className="dashboard-suggestions-list">
						{suggestionsFiltered.map((task) => (
							<li key={task.id} className="dashboard-suggestion">
								<span className="dashboard-suggestion-title">{task.title}</span>
								<span className="dashboard-suggestion-meta">(Priorität {task.priority})</span>
							</li>
						))}
					</ol>
				)}
			</KolCard>
			{/*
			 * #1066: „In der Nähe" — Distanzliste unter der Vorschlagsliste. Wie die anderen
			 * Sekundär-Widgets ohne Signal-Färbung; die Signalfläche gehört allein der
			 * „Nächste Aufgabe"-Zeile (KI-UX-Platzierungsempfehlung).
			 */}
			{/* #1098 AK4: „In der Nähe" nur rendern, wenn die Standorterfassung an ist —
			    ausgeschaltet verschwindet die Card komplett (keine Hinweis-Card mehr).
			    Bei Browser-Verweigerung (#1066 AK4) bleibt sie für den Ablehn-Hinweis stehen. */}
			{(geoEnabled || geoDenied) && <NearbyCard />}
			<KolCard className="dashboard-top-tasks" _label="Wichtigste Tasks" _level={3}>
				{topTasks.length === 0 ? (
					<p className="dashboard-empty">Keine offenen Aufgaben vorhanden.</p>
				) : (
					<ol className="dashboard-top-tasks-list">
						{topTasks.map((task) => (
							<li key={task.id} className="dashboard-top-task">
								<span className="dashboard-top-task-title">{task.title}</span>
								<span className="dashboard-top-task-meta">
									(Priorität {task.priority}, Wert {formatNumber(task.value)})
								</span>
							</li>
						))}
					</ol>
				)}
			</KolCard>
			<KolCard className="dashboard-pillars" _label="Meine Themen" _level={3}>
				{pillars.length === 0 ? (
					<p className="dashboard-empty">
						Lege in den <a href={`${import.meta.env.BASE_URL}settings`}>Einstellungen</a> deine ersten Säulen an, um
						hier den Überblick über deine Themen zu behalten.
					</p>
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
									{/*
									 * Die Kennzahlen stehen als beschriftete Wertepaare statt als ein Fließtext-Satz:
									 * Screenreader lesen vier benannte Werte, das Auge findet sie ohne Satz-Parsing.
									 * Der Anteil führt, weil er die Frage der Karte beantwortet („wo stehe ich?");
									 * die Aufschlüsselung offen/erledigt hängt gedämpft an ihrem jeweiligen Wert.
									 */}
									<dl className="dashboard-pillar-facts">
										<div className="dashboard-pillar-fact dashboard-pillar-fact--lead">
											<dt>Anteil</dt>
											<dd>{Math.round(actualShare * 100)} %</dd>
										</div>
										<div className="dashboard-pillar-fact">
											<dt>Aufgaben</dt>
											<dd>
												{taskCount}
												<span className="dashboard-pillar-split">
													{openCount} offen · {doneCount} erledigt
												</span>
											</dd>
										</div>
										<div className="dashboard-pillar-fact">
											<dt>Wert</dt>
											<dd>{formatNumber(totalValue)}</dd>
										</div>
										<div className="dashboard-pillar-fact">
											<dt>Aufwand</dt>
											<dd>
												{formatNumber(totalEstimatedEffort)} Tage
												<span className="dashboard-pillar-split">
													{formatNumber(openEstimatedEffort)} offen · {formatNumber(doneEstimatedEffort)} erledigt
												</span>
											</dd>
										</div>
									</dl>
								</li>
							),
						)}
					</ul>
				)}
			</KolCard>
			{/*
			 * #1360: „Streak" direkt vor dem Gesamtguthaben — beide beantworten dieselbe Frage nach
			 * dem eigenen Durchhalten, das Guthaben als Summe, der Streak als Tagesrhythmus. Die Card
			 * lädt selbst (Muster NearbyCard), daher ohne Prop-Kette und ohne Bedingung.
			 */}
			<StreakCard />
			{/* #1968: „Meine Woche in fünf Säulen“ direkt nach dem Streak — beide Karten erzählen
			 * vom Durchhalten, die Wochenkarte als teilbares Standbild. Lädt selbst (Muster
			 * StreakCard), daher ohne Prop-Kette; sie erscheint von selbst erst am Sonntag (AK4). */}
			<WeeklyBalanceCard />
			{/* #1995: Rückblick auf den Vormonat — dieselbe Karten-Idee wie die Wochenkarte, deshalb
			 * direkt daneben. Lädt selbst (Muster WeeklyBalanceCard), daher ohne Prop-Kette; sie
			 * erscheint von selbst nur im Monatsanfangs-Fenster (Tag 1–7, AK4). */}
			{/* #1997: Jahresrückblick aufs Vorjahr (Balamentum Wrapped) — das größere Ereignis steht in
			 * den ersten Januartagen vor der Monatskarte. Lädt selbst (Muster MonthlyBalanceCard) und
			 * erscheint von selbst nur im Januar (AK5). */}
			<YearlyRecapCard />
			<MonthlyBalanceCard />
			{/* #1362: eigener Knoten direkt nach der Streak-Card — beide Stufenlisten (Streak/Punkte)
			 * bauen auf denselben Kennzahlen auf, die Badges fassen sie zu einer Übersicht zusammen. */}
			<MilestoneBadges />
			{/*
			 * Verpasste Aufgaben: eigener Knoten nach den Meilensteinen — macht sichtbar, wie viele
			 * Aufgaben der Auto-Delete-Cron gelöscht hat, ohne Punkte/Streak zu beeinflussen. Lädt
			 * selbst (Muster StreakCard), daher ohne Prop-Kette und ohne Bedingung.
			 */}
			<MissedTasksCard />
			{/* #1361: eigener Knoten neben der Streak-Card, damit deren E2E-Locators (#1360) unberührt
			 * bleiben. Bedingung wertet die volle `tasks`-Liste aus. */}
			{showDayDoneHint && <DayDoneHint tasks={tasks} />}
			<KolCard className="dashboard-balance" _label="Gesamtguthaben" _level={3}>
				{gesamtPunkte === 0 ? (
					<p className="dashboard-empty">
						Noch keine Punkte vergeben — schließe Tasks ab, um dein Guthaben aufzubauen.
					</p>
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
			</KolCard>
			<KolCard className="dashboard-deadlines" _label="Anstehende Deadlines" _level={3}>
				{upcomingDeadlines.length === 0 ? (
					<p className="dashboard-empty">Keine anstehenden Deadlines.</p>
				) : (
					<ul className="dashboard-deadlines-list">
						{upcomingDeadlines.map((task) => {
							const urgency = deadlineUrgency(task.deadline, now);
							return (
								<li key={task.id} className="dashboard-deadline">
									<span className="dashboard-deadline-title">{task.title}</span>
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
			</KolCard>
		</section>
	);
};
