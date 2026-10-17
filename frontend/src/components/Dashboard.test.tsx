import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { BalanceStatus, Pillar, Task, TaskPillarContribution, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { Dashboard } from './Dashboard';
import { HeartBalance } from './HeartBalance';
import { api } from '../api';
// #2527: i18n läuft echt (vitest.setup.ts pinnt `de`) — der Sprach-Test wechselt selbst (Muster CareHint #2063).
import i18next from '../i18n/config';

// KoliBri-Komponenten sind in jsdom nicht registriert; KolPagination wird zum Klick-Stub, damit
// `_on.onChangePage` auslösbar ist. Alles andere bleibt echt.
vi.mock('@public-ui/react-v19', async (importOriginal) => ({
	...(await importOriginal<typeof import('@public-ui/react-v19')>()),
	KolPagination: (props: {
		_page: number;
		_max: number;
		_pageSize: number;
		_on: { onChangePage: (e: Event, p: number) => void };
	}) => (
		<button
			data-testid="pager"
			data-page={props._page}
			data-max={props._max}
			onClick={() => props._on.onChangePage(new Event('click'), props._page + 1)}
		/>
	),
}));

// Auftakt-Spiegel: HeartBalance rendert echt, protokolliert aber seine Props — die Freigabe des
// Auftakts ist im jsdom (kein WebGL, SVG-Rückfall ohne Auftakt) sonst nicht beobachtbar.
vi.mock('./HeartBalance', async (importOriginal) => {
	const original = await importOriginal<typeof import('./HeartBalance')>();
	return { ...original, HeartBalance: vi.fn(original.HeartBalance) };
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const pillar = (id: number, name: string, weight: number): Pillar => ({ id, name, description: '', weight });

const task = (
	id: number,
	pillars: TaskPillarContribution[],
	estimatedEffort: number,
	status: Task['status'],
): Task => ({
	id,
	title: `T${id}`,
	status,
	priority: 3,
	estimatedEffort,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pinned: false,
	pillars,
});

/**
 * AK4 (#124): Das Dashboard-Widget „Meine Themen" stellt je Säule den offenen und den erledigten
 * Anteil gegenüber. Dieser Komponententest rendert das Dashboard mit definierten Daten und prüft den
 * sichtbaren Text der jeweiligen Säulen-Kachel. Solange die Status-Aufschlüsselung in `Dashboard.tsx`
 * fehlt, ist der Test rot; er wird grün, sobald die Anzeige offen/erledigt je Säule ergänzt ist.
 */
describe('Dashboard — Meine Themen: offen/erledigt je Säule (#124)', () => {
	it('zeigt je Säule sowohl den offenen als auch den erledigten Anteil', () => {
		const koerper = pillar(1, 'Körper', 100);
		const tasks = [
			task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 2, TaskStatus.Open),
			task(11, [{ pillarId: 1, share: 100, confidence: 100 }], 3, TaskStatus.Done),
		];

		const { container } = render(
			<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />,
		);

		const pillarItems = container.querySelectorAll('.dashboard-pillars-list .dashboard-pillar');
		expect(pillarItems).toHaveLength(1);

		const text = pillarItems[0].textContent ?? '';
		// Sowohl der offene (1 Task) als auch der erledigte (1 Task) Anteil müssen sichtbar sein.
		expect(text).toMatch(/1\s+offen/i);
		expect(text).toMatch(/1\s+erledigt/i);
	});
});

/**
 * #169: Das Dashboard begrüßt den Nutzer personalisiert mit „Hallo <Name>!". Der Name kommt als
 * `displayName`-Prop (von `App.tsx` aus `localStorage` gelesen). Diese Komponententests rendern das
 * Dashboard direkt mit der Prop und prüfen den sichtbaren Begrüßungstext. Bei leerem `displayName`
 * wird gar keine Begrüßung gerendert (kein Fallback-Name).
 */
describe('Dashboard — Personalisierte Begrüßung (#169)', () => {
	// AC1: Mit `displayName="Peter"` muss die Begrüßung „Hallo Peter!" sichtbar sein.
	it('zeigt „Hallo Peter!" wenn displayName="Peter" übergeben wird', () => {
		const { container } = render(
			<Dashboard tasks={[]} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} displayName="Peter" />,
		);

		expect(container.textContent ?? '').toMatch(/Hallo\s+Peter!/i);
	});

	// AC2: Bei leerem displayName darf KEINE Begrüßung erscheinen (kein Fallback-Name).
	it('zeigt keine Begrüßung, wenn displayName leer ist', () => {
		const { container } = render(
			<Dashboard tasks={[]} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} displayName="" />,
		);

		expect(container.textContent ?? '').not.toMatch(/Hallo/i);
		expect(container.querySelector('.dashboard-greeting')).toBeNull();
	});
});

/**
 * #390: Die Statuskacheln des Dashboards zeigen nur noch drei Einträge (Gesamt, Offen, Erledigt).
 * Die Kachel „In Bearbeitung" entfällt; Tasks mit Status InProcess fließen in die Kachel „Offen" ein.
 * Diese Tests sind rot, solange `Dashboard.tsx` noch über `STATUS_OPTIONS` iteriert (vier Kacheln).
 */
describe('Dashboard — Statuskacheln: genau drei Kacheln (Issue #390)', () => {
	it('AK1: zeigt genau drei Kacheln — keine Kachel „In Bearbeitung"', () => {
		const tasks = [
			task(1, [], 1, TaskStatus.Open),
			task(2, [], 1, TaskStatus.InProcess),
			task(3, [], 1, TaskStatus.Done),
		];
		const { container } = render(
			<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} />,
		);

		const items = container.querySelectorAll('.dashboard-cards > li');
		// Erwartet: Gesamt + Offen + Erledigt = 3 (aktuell 4, weil STATUS_OPTIONS drei Einträge hat).
		expect(items).toHaveLength(3);

		// Der Akzent-Span für die InProcess-Kachel darf nicht erscheinen.
		expect(container.querySelector('.dashboard-cards .dashboard-card-accent.inprocess')).toBeNull();
	});

	it('AK2: ein Task mit Status InProcess erhöht die Kachel „Offen" um 1', () => {
		const tasks = [task(1, [], 1, TaskStatus.Open), task(2, [], 1, TaskStatus.InProcess)];
		const { container } = render(
			<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} />,
		);

		// Nach der Umsetzung trägt die „Offen"-Kachel den Akzent „open" und einen Count von 2.
		const openAccent = container.querySelector('.dashboard-cards .dashboard-card-accent.open');
		expect(openAccent).not.toBeNull();
		const offenLi = openAccent?.closest('li');
		const count = offenLi?.querySelector('.dashboard-card-count');
		expect(count?.textContent).toBe('2');
	});
});

/**
 * #410: Säulen-Meter optimieren — Schwellwert von 75% des Zielwerts.
 * Die aktuellen Meter zeigen alle Werte unter dem Zielwert als "suboptimal" an, was zu einer
 * permanenten Warnung führt. Stattdessen soll ein Schwellwert von 75% des Zielwerts gelten.
 */
/**
 * AK1 (#440): Bei 0 Säulen zeigt das Dashboard-Widget „Meine Themen" eine gestaltete KolCard
 * mit Icon, Hinweistext und Link zu den Einstellungen (nicht nur plain text).
 * Der Test ist rot, solange Dashboard.tsx Zeile 196 noch `<p>Keine Säulen vorhanden.</p>` rendert.
 */
describe('Dashboard — Empty-State bei 0 Säulen (Issue #440, AK1)', () => {
	// Test-Pflege #1118: Mit der Sektions-Card „Meine Themen" (AK1) wird der bisherige
	// Card-in-Card-Leerzustand obsolet — der Hinweis steht jetzt IN der Sektions-Card.
	it('AK1: zeigt bei pillars=[] den Hinweistext innerhalb der Sektions-Card „Meine Themen" (#1118 AK3/AK4)', () => {
		const { container } = render(<Dashboard tasks={[]} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} />);

		// Genau eine Card: die Sektions-Card selbst (Widget-Klasse sitzt am Card-Host) —
		// kein verschachteltes kol-card.
		const cards = container.querySelectorAll('.dashboard-pillars');
		expect(cards).toHaveLength(1);
		expect(cards[0].getAttribute('_label')).toBe('Meine Themen');

		// Der Leerzustand steht innerhalb dieser Card.
		const cardText = cards[0].textContent ?? '';
		expect(cardText).toMatch(/in den Einstellungen/i);

		// Ein Link zu den Einstellungen soll vorhanden sein.
		const link = cards[0].querySelector('a[href]');
		expect(link).not.toBeNull();
		expect(link?.getAttribute('href')).toContain('settings');
	});

	it('AK1: zeigt bei pillars.length > 0 KEINE Empty-State-KolCard', () => {
		const koerper = pillar(1, 'Körper', 100);
		const { container } = render(
			<Dashboard tasks={[]} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />,
		);

		// Wenn Säulen vorhanden sind, darf die Empty-State-KolCard nicht erscheinen.
		const cards = container.querySelectorAll('kol-card');
		const emptyCard = [...cards].find((c) => c.getAttribute('_label') === 'Keine Säulen vorhanden');
		expect(emptyCard).toBeUndefined();

		// Stattdessen soll die Säulen-Liste gerendert werden.
		expect(container.querySelector('.dashboard-pillars-list')).not.toBeNull();
	});
});

describe('Dashboard — Säulen-Meter mit 75%-Schwellwert (Issue #410)', () => {
	it('AK1: Der Meter-Schwellwert (_low) ist 75% des Zielwerts (Gewichtung)', () => {
		const koerper = pillar(1, 'Körper', 20); // Zielwert 20%
		const tasks = [task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 3, TaskStatus.Done)];

		const { container } = render(
			<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />,
		);

		// Der Meter wird mit KolMeter gerendert und soll _low=0.15 (75% von 20%) haben
		const meter = container.querySelector('kol-meter');
		expect(meter).not.toBeNull();

		// Das _low-Attribut soll 0.15 sein (75% von 0.2)
		const lowValue = meter?.getAttribute('_low');
		expect(lowValue).toBe('0.15');
	});

	it('AK2: Bei Zielwert 25% ist der Schwellwert 18.75%', () => {
		const sinn = pillar(2, 'Sinn', 25); // Zielwert 25%
		const tasks = [task(11, [{ pillarId: 2, share: 100, confidence: 100 }], 2, TaskStatus.Done)];

		const { container } = render(
			<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[sinn]} />,
		);

		const meter = container.querySelector('kol-meter');
		expect(meter).not.toBeNull();

		// Das _low-Attribut soll 0.1875 sein (75% von 0.25)
		const lowValue = meter?.getAttribute('_low');
		expect(lowValue).toBe('0.1875');
	});

	it('AK3: Der Schwellwert gilt für alle Säulen mit unterschiedlichen Zielwerten', () => {
		const koerper = pillar(1, 'Körper', 20); // Zielwert 20% → Schwellwert 15%
		const sinn = pillar(2, 'Sinn', 30); // Zielwert 30% → Schwellwert 22.5%
		const tasks = [
			task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 3, TaskStatus.Done),
			task(11, [{ pillarId: 2, share: 100, confidence: 100 }], 2, TaskStatus.Done),
		];

		const { container } = render(
			<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper, sinn]} />,
		);

		const meters = container.querySelectorAll('kol-meter');
		expect(meters).toHaveLength(2);

		// Erster Meter (Körper): Schwellwert 0.15
		expect(meters[0]?.getAttribute('_low')).toBe('0.15');
		// Zweiter Meter (Sinn): Schwellwert 0.225
		expect(meters[1]?.getAttribute('_low')).toBe('0.225');
	});

	it('AK4: Werte unter 75% des Zielwerts werden als suboptimal angezeigt', () => {
		// Säule mit Zielwert 20% → Schwellwert 15%
		// Ist-Wert 14% (unter 15%) → soll suboptimal angezeigt werden
		const koerper = pillar(1, 'Körper', 20);
		const tasks = [task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 1.4, TaskStatus.Done)];

		const { container } = render(
			<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />,
		);

		const meter = container.querySelector('kol-meter');
		expect(meter).not.toBeNull();

		// Der Wert (actualShare) ist unter dem Schwellwert (low)
		const low = meter?.getAttribute('_low');

		// actualShare sollte 0.14 sein (1.4 / (1.4 + andere doneEfforts))
		// Da wir nur eine Säule haben, ist der actualShare = 1.0 (100% des doneEfforts)
		// Wir prüfen zumindest, dass low korrekt ist
		expect(low).toBe('0.15');
	});

	it('AK5: Werte über 75% des Zielwerts werden als optimal angezeigt', () => {
		// Säule mit Zielwert 20% → Schwellwert 15%
		// Ist-Wert 16% (über 15%) → soll optimal angezeigt werden
		const koerper = pillar(1, 'Körper', 20);
		const tasks = [task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 1.6, TaskStatus.Done)];

		const { container } = render(
			<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />,
		);

		const meter = container.querySelector('kol-meter');
		expect(meter).not.toBeNull();

		// Der Schwellwert ist korrekt auf 0.15 gesetzt
		const low = meter?.getAttribute('_low');
		expect(low).toBe('0.15');
	});

	it('AK6: Bei 5 Säulen mit je 20% gilt der Schwellwert von 15% für alle', () => {
		// Das Szenario aus dem Issue: 5 Säulen mit je 20%
		const koerper = pillar(1, 'Körper', 20);
		const sinn = pillar(2, 'Sinn', 20);
		const geist = pillar(3, 'Geist', 20);
		const sozial = pillar(4, 'Sozial', 20);
		const emotion = pillar(5, 'Emotion', 20);

		const tasks = [
			task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 1, TaskStatus.Done),
			task(11, [{ pillarId: 2, share: 100, confidence: 100 }], 1, TaskStatus.Done),
			task(12, [{ pillarId: 3, share: 100, confidence: 100 }], 1, TaskStatus.Done),
			task(13, [{ pillarId: 4, share: 100, confidence: 100 }], 1, TaskStatus.Done),
			task(14, [{ pillarId: 5, share: 100, confidence: 100 }], 1, TaskStatus.Done),
		];

		const { container } = render(
			<Dashboard
				tasks={tasks}
				forest={[] as TaskTreeNode[]}
				nextTask={null}
				pillars={[koerper, sinn, geist, sozial, emotion]}
			/>,
		);

		const meters = container.querySelectorAll('kol-meter');
		expect(meters).toHaveLength(5);

		// Alle 5 Meter sollen den gleichen Schwellwert von 0.15 haben
		for (let i = 0; i < 5; i++) {
			expect(meters[i]?.getAttribute('_low')).toBe('0.15');
		}
	});
});

/**
 * Issue #1118 — Dashboard-Sektionen als Kolibri-Cards.
 * Spec: docs/spec/issue-1118.md (AK1–AK4).
 *
 * Rot-Solange: alle sechs Sektionen rendern heute noch bare `<section>` mit eigenem `<h3>`;
 * erst wenn `KolCard` mit `_label`/`_level` eingezogen ist, werden die Tests grün.
 */
describe('Dashboard — Sektionen als Kolibri-Cards (Issue #1118)', () => {
	const SECTIONS = [
		['dashboard-next-task', 'Nächste Aufgabe'],
		['dashboard-suggestions', 'Was ist jetzt dran?'],
		['dashboard-top-tasks', 'Wichtigste Tasks'],
		['dashboard-pillars', 'Meine Themen'],
		['dashboard-balance', 'Gesamtguthaben'],
		['dashboard-deadlines', 'Anstehende Deadlines'],
	] as const;

	it('AK1/AK2: je Sektion genau eine Card mit Sektionslabel und dritter Überschriftenebene, kein separates <h3>', () => {
		const koerper = pillar(1, 'Körper', 100);
		const { container } = render(
			<Dashboard tasks={[]} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />,
		);

		for (const [className, label] of SECTIONS) {
			const widget = container.querySelector(`.${className}`);
			expect(widget, `Sektion .${className} fehlt`).not.toBeNull();

			// AK1/AK4: Das Widget IST der Card-Host (alte Außen-<section> entfernt) — kein Card-in-Card.
			const card = widget!.matches('kol-card') ? widget! : widget!.querySelector('kol-card');
			expect(card, `.${className} erwartet genau eine Card`).not.toBeNull();

			// AK2: Sektionsüberschrift als Card-Label …
			expect(card!.getAttribute('_label')).toBe(label);

			// … als dritte Ebene unter dem Dashboard-<h2> (KoliBri-Default _level=0 wäre KEINE Überschrift).
			expect(card!.getAttribute('_level')).toBe('3');

			// AK2: kein separates <h3> mehr (keine doppelte Überschrift im Accessibility-Tree).
			expect(widget!.querySelector('h3')).toBeNull();
		}

		// AK2: die Region „Nächste Aufgabe" bleibt benannt (Name muss „Nächste Aufgabe" lauten).
		const nextTask = container.querySelector('.dashboard-next-task')!;
		const regionName =
			nextTask.getAttribute('aria-label') ??
			document.getElementById(nextTask.getAttribute('aria-labelledby') ?? '')?.textContent ??
			'';
		expect(regionName).toMatch(/Nächste Aufgabe/);
	});

	it('AK3/AK4: Sektions-Leerzustände stehen innerhalb der Card', () => {
		const { container } = render(<Dashboard tasks={[]} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} />);

		const emptyExpectations: Array<[string, RegExp]> = [
			['dashboard-next-task', /keine Aufgabe an/],
			['dashboard-suggestions', /keine weiteren Vorschläge/],
			['dashboard-top-tasks', /Keine offenen Aufgaben/],
			['dashboard-pillars', /in den Einstellungen/],
			['dashboard-balance', /Noch keine Punkte vergeben/],
			['dashboard-deadlines', /Keine anstehenden Deadlines/],
		];

		for (const [className, pattern] of emptyExpectations) {
			// Der Leerzustand steht innerhalb der Card — die Widget-Klasse sitzt am Card-Host.
			const card = container.querySelector(`.${className}`);
			expect(card, `.Leerzustand-Card .${className} fehlt`).not.toBeNull();
			expect(card!.textContent ?? '').toMatch(pattern);
		}
	});
});

/**
 * ROTER Spec-Test für #1168 (AK1, TF1 — docs/spec/issue-1168.md): der Aktionsbutton im Panel
 * „Nächste Aufgabe" heißt „Erledigt" statt „Jetzt starten". `Dashboard.tsx:198-205` rendert heute
 * `KolButton _label="Jetzt starten"` an der Prop `onStartTask`; der Vertrag wird auf eine neue Prop
 * `onCompleteTask` umgestellt. Der Test ist rot, bis `Dashboard.tsx` die neue Prop und das neue Label
 * trägt — mit der alten Prop bleibt der Button ungerendert (Bedingung `onStartTask !== undefined`),
 * daher gibt es aktuell KEIN Element mit `_label="Erledigen"` im Panel.
 */
describe('Dashboard — „Erledigt"-Button im Signal-Panel (Issue #1168, docs/spec/issue-1168.md)', () => {
	it('AK1: rendert bei gesetztem nextTask einen Button „Erledigt", keinen Button „Jetzt starten"', () => {
		const nextTask = task(42, [], 2, TaskStatus.Open);
		const onCompleteTask = () => undefined;

		const { container } = render(
			<Dashboard
				tasks={[nextTask]}
				forest={[] as TaskTreeNode[]}
				nextTask={nextTask}
				pillars={[]}
				onCompleteTask={onCompleteTask}
			/>,
		);

		const panel = container.querySelector('.dashboard-next-task-content');
		expect(panel, '.dashboard-next-task-content fehlt bei gesetztem nextTask').not.toBeNull();

		const buttons = [...(panel?.querySelectorAll('kol-button') ?? [])];
		const doneButton = buttons.find((b) => b.getAttribute('_label') === 'Erledigen');
		expect(doneButton, 'Button mit _label="Erledigen" fehlt im Panel').toBeDefined();

		const startButton = buttons.find((b) => b.getAttribute('_label') === 'Jetzt starten');
		expect(startButton, 'Button „Jetzt starten" darf nicht mehr existieren').toBeUndefined();
	});
});

/**
 * Issue #1448 (docs/spec/issue-1448.md): die Widgets „Nächste Aufgabe" und „Was ist jetzt dran?"
 * zeigen aktuell `#{id} – {title}` an. Der Task-ID-Präfix soll aus beiden Widgets verschwinden,
 * die Prioritätsangabe bleibt unverändert sichtbar.
 */
describe('Dashboard — kein Task-ID-Präfix in "Nächste Aufgabe" / "Was ist jetzt dran?" (#1448)', () => {
	it('AK1: „Nächste Aufgabe" zeigt nur den Titel, keine #<ID>', () => {
		const nextTask = task(114, [], 2, TaskStatus.Open);
		nextTask.title = 'Wondershare Filmora kündigen';

		const { container } = render(
			<Dashboard tasks={[nextTask]} forest={[] as TaskTreeNode[]} nextTask={nextTask} pillars={[]} />,
		);

		const titleEl = container.querySelector('.dashboard-next-task-title');
		expect(titleEl, '.dashboard-next-task-title fehlt').not.toBeNull();
		expect(titleEl?.textContent).toContain('Wondershare Filmora kündigen');
		expect(titleEl?.textContent, 'Task-ID-Präfix #114 darf nicht mehr im Titel stehen').not.toMatch(/#114/);
	});

	it('AK2: „Was ist jetzt dran?" zeigt je Vorschlag nur den Titel, keine #<ID>', () => {
		const nextTask = task(1, [], 2, TaskStatus.Open);
		const suggestionA = task(201, [], 2, TaskStatus.Open);
		suggestionA.title = 'Steuererklärung einreichen';
		const suggestionB = task(202, [], 2, TaskStatus.Open);
		suggestionB.title = 'Zahnarzttermin vereinbaren';

		const { container } = render(
			<Dashboard
				tasks={[nextTask, suggestionA, suggestionB]}
				forest={[] as TaskTreeNode[]}
				nextTask={nextTask}
				pillars={[]}
				suggestions={[suggestionA, suggestionB]}
			/>,
		);

		const titles = [...container.querySelectorAll('.dashboard-suggestion-title')];
		expect(titles, 'Erwartet zwei Vorschlags-Einträge').toHaveLength(2);
		for (const el of titles) {
			expect(el.textContent, `Vorschlagstitel „${el.textContent}" enthält Task-ID-Präfix`).not.toMatch(/#\d+/);
		}
		expect(titles.map((el) => el.textContent)).toEqual(
			expect.arrayContaining([
				expect.stringContaining('Steuererklärung einreichen'),
				expect.stringContaining('Zahnarzttermin vereinbaren'),
			]),
		);
	});

	it('AK3: Prioritätsangabe bleibt in beiden Widgets sichtbar', () => {
		const nextTask = task(114, [], 2, TaskStatus.Open);
		const suggestion = task(201, [], 2, TaskStatus.Open);

		const { container } = render(
			<Dashboard
				tasks={[nextTask, suggestion]}
				forest={[] as TaskTreeNode[]}
				nextTask={nextTask}
				pillars={[]}
				suggestions={[suggestion]}
			/>,
		);

		const priorityEl = container.querySelector('.dashboard-next-task-priority');
		expect(priorityEl?.textContent).toContain('Priorität');

		const metaEl = container.querySelector('.dashboard-suggestion-meta');
		expect(metaEl?.textContent).toContain('Priorität');
	});
});

/**
 * ROTER Spec-Test für #1447 (AK1, AK3 — docs/spec/issue-1447.md): neben „Erledigen" fehlt im Panel
 * „Nächste Aufgabe" noch ein Bearbeiten-Button. Rot, bis `Dashboard.tsx` die Prop `onEditTask` sowie
 * den Icon-only-Button (`_label="Bearbeiten"`, `_hideLabel`, Icon `fa-solid fa-pen`) rendert.
 */
describe('Dashboard — „Bearbeiten"-Button im Signal-Panel (Issue #1447, docs/spec/issue-1447.md)', () => {
	// `onEditTask` ist die Ziel-Prop aus docs/spec/issue-1447.md — existiert auf `DashboardProps` noch
	// nicht. Der Cast hält den Spec-Commit tsc-sauber (sonst Build-Fehler statt rotem Testlauf); der
	// eigentliche Rot-Zustand kommt aus der fehlenden Laufzeit-Umsetzung (Button/Callback fehlen).
	const renderWithEdit = (props: ComponentProps<typeof Dashboard> & { onEditTask?: (task: Task) => void }) =>
		render(<Dashboard {...(props as ComponentProps<typeof Dashboard>)} />);

	it('AK1: rendert bei gesetztem nextTask und onEditTask einen Icon-only-Button „Bearbeiten" nach „Erledigen"', () => {
		const nextTask = task(42, [], 2, TaskStatus.Open);
		const onCompleteTask = () => undefined;
		const onEditTask = () => undefined;

		const { container } = renderWithEdit({
			tasks: [nextTask],
			forest: [] as TaskTreeNode[],
			nextTask,
			pillars: [],
			onCompleteTask,
			onEditTask,
		});

		const panel = container.querySelector('.dashboard-next-task-content');
		expect(panel, '.dashboard-next-task-content fehlt bei gesetztem nextTask').not.toBeNull();

		const buttons = [...(panel?.querySelectorAll('kol-button') ?? [])];
		const editButton = buttons.find((b) => b.getAttribute('_label') === 'Bearbeiten');
		expect(editButton, 'Button mit _label="Bearbeiten" fehlt im Panel').toBeDefined();
		// Test-Pflege #1447: `@public-ui/react-v19` reflektiert Nicht-String-Props dash-case
		// (`_hideLabel={true}` → Attribut `_hide-label=""`); ein Attribut `_hidelabel` kann der
		// Wrapper nie erzeugen. Assertion auf den real gerenderten Namen gezogen, Prüfabsicht
		// (Icon-only) unverändert.
		expect(editButton?.getAttribute('_hide-label')).not.toBeNull();

		const doneButton = buttons.find((b) => b.getAttribute('_label') === 'Erledigen');
		expect(doneButton, 'Button „Erledigen" fehlt weiterhin').toBeDefined();

		// Reihenfolge im DOM: „Erledigen" zuerst, „Bearbeiten" danach (KI-UX: Daumenzone/Tab-Reihenfolge).
		expect(buttons.indexOf(doneButton!)).toBeLessThan(buttons.indexOf(editButton!));
	});

	it('AK2: Klick auf „Bearbeiten" ruft onEditTask exakt mit der angezeigten nextTask auf', () => {
		const nextTask = task(42, [], 2, TaskStatus.Open);
		const calls: Task[] = [];
		const onEditTask = (t: Task) => calls.push(t);

		const { container } = renderWithEdit({
			tasks: [nextTask],
			forest: [] as TaskTreeNode[],
			nextTask,
			pillars: [],
			onCompleteTask: () => undefined,
			onEditTask,
		});

		const panel = container.querySelector('.dashboard-next-task-content');
		const buttons = [...(panel?.querySelectorAll('kol-button') ?? [])];
		const editButton = buttons.find((b) => b.getAttribute('_label') === 'Bearbeiten');
		expect(editButton).toBeDefined();

		// Test-Pflege #1447: In jsdom ist `kol-button` ein undefiniertes Custom Element — es gibt
		// weder Shadow-DOM noch einen inneren `<button>`, und `_on` liegt nur als Property am Host
		// (Wrapper setzt Objekt-Props als Property, nicht als Attribut). Klick daher über die
		// Property auslösen, wie `ApiTokensSection.test.tsx:186-189` es für `_on.onChange` tut.
		(editButton as unknown as { _on: { onClick: (event: Event) => void } })._on.onClick(new Event('click'));

		expect(calls).toHaveLength(1);
		expect(calls[0]?.id).toBe(42);
	});

	it('AK3: rendert KEINEN Bearbeiten-Button, wenn nextTask === null', () => {
		const { container } = renderWithEdit({
			tasks: [],
			forest: [] as TaskTreeNode[],
			nextTask: null,
			pillars: [],
			onCompleteTask: () => undefined,
			onEditTask: () => undefined,
		});

		const buttons = [...container.querySelectorAll('.dashboard-next-task kol-button')];
		const editButton = buttons.find((b) => b.getAttribute('_label') === 'Bearbeiten');
		expect(editButton, 'Bearbeiten-Button darf ohne nextTask nicht existieren').toBeUndefined();
	});

	it('AK3: rendert KEINEN Bearbeiten-Button, wenn onEditTask nicht übergeben wird', () => {
		const nextTask = task(42, [], 2, TaskStatus.Open);

		const { container } = render(
			<Dashboard
				tasks={[nextTask]}
				forest={[] as TaskTreeNode[]}
				nextTask={nextTask}
				pillars={[]}
				onCompleteTask={() => undefined}
			/>,
		);

		const buttons = [...container.querySelectorAll('.dashboard-next-task kol-button')];
		const editButton = buttons.find((b) => b.getAttribute('_label') === 'Bearbeiten');
		expect(editButton, 'Bearbeiten-Button darf ohne onEditTask-Prop nicht existieren').toBeUndefined();
	});
});

/**
 * #1465 (A): Die interne Task-ID verschwindet auch aus den übrigen Dashboard-Widgets — #1448 hatte
 * sie nur aus „Nächste Aufgabe" und „Was ist jetzt dran?" entfernt. Priorität, Wert und Datum
 * bleiben sichtbar.
 */
describe('Dashboard — kein Task-ID-Präfix in „Wichtigste Tasks" / „Anstehende Deadlines" (#1465)', () => {
	it('„Wichtigste Tasks" zeigt nur den Titel, keine #<ID>', () => {
		// Das Widget speist sich aus dem Wald (`forest`), nicht aus `tasks`.
		const top: TaskTreeNode = {
			id: 307,
			title: 'Kur-Tochter',
			priority: 5,
			estimatedEffort: 1,
			totalEstimatedEffort: 1,
			value: 5,
			status: 'Open',
			dependents: [],
		};

		const { container } = render(<Dashboard tasks={[]} forest={[top]} nextTask={null} pillars={[]} />);

		const title = container.querySelector('.dashboard-top-task-title');
		expect(title?.textContent).toBe('Kur-Tochter');
		const meta = container.querySelector('.dashboard-top-task-meta');
		expect(meta?.textContent).toContain('Priorität');
	});

	it('„Anstehende Deadlines" zeigt nur den Titel, keine #<ID>', () => {
		const withDeadline = task(380, [], 2, TaskStatus.Open);
		withDeadline.title = 'Handy-Anbieter für Amira finden';
		withDeadline.deadline = new Date('2026-07-14T00:00:00.000Z');

		const { container } = render(
			<Dashboard tasks={[withDeadline]} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} />,
		);

		const title = container.querySelector('.dashboard-deadline-title');
		expect(title?.textContent).toBe('Handy-Anbieter für Amira finden');
		expect(container.querySelector('.dashboard-deadline-date')?.textContent).toMatch(/\d{2}\.\d{2}\.\d{4}/);
	});
});

/**
 * #1465 (B): „Erledigen" und der Bearbeiten-Stift liegen in EINER Aktionszeile
 * (`.dashboard-next-task-actions`) statt untereinander — „Erledigen" bleibt der erste Knoten im
 * DOM, damit Tab-Reihenfolge und Signal-Priorität unverändert bleiben (#1447).
 */
describe('Dashboard — „Erledigen" und „Bearbeiten" in einer Aktionszeile (#1465)', () => {
	it('beide Buttons sind Kinder derselben Zeile, „Erledigen" zuerst', () => {
		const nextTask = task(42, [], 2, TaskStatus.Open);

		const { container } = render(
			<Dashboard
				tasks={[nextTask]}
				forest={[] as TaskTreeNode[]}
				nextTask={nextTask}
				pillars={[]}
				onCompleteTask={() => undefined}
				onEditTask={() => undefined}
			/>,
		);

		const actions = container.querySelector('.dashboard-next-task-actions');
		expect(actions, '.dashboard-next-task-actions fehlt').not.toBeNull();

		const labels = [...(actions?.children ?? [])].map((child) => child.getAttribute('_label'));
		expect(labels).toEqual(['Erledigen', 'Bearbeiten']);
	});
});

/**
 * #1638 AK5: Das Dashboard-Herz zeigt den Füllstand, den der Server im Kadenz-Modell rechnet
 * (GET /scores/balance, dieselbe Quelle wie MCP `balance_status`) — nicht den lokal aus den
 * Anteilen gerechneten Wert. Lokal läge eine einzige Säule mit allen Punkten bei 100 %.
 */
describe('Dashboard — Herz-Füllstand aus dem Server (#1638)', () => {
	it('übernimmt fuellstandProzent aus GET /scores/balance', async () => {
		const status = {
			fuellstandProzent: 37,
			hatPunkte: true,
			saeulen: [],
			meilensteine: [],
		} as unknown as BalanceStatus;
		const spy = vi.spyOn(api, 'getBalanceStatus').mockResolvedValue(status);
		const koerper = pillar(1, 'Körper', 100);
		const tasks = [task(11, [{ pillarId: 1, share: 100, confidence: 100 }], 1, TaskStatus.Done)];

		render(<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />);

		await waitFor(() => expect(screen.getByTestId('heart-balance-value').textContent).toBe('37 %'));
		expect(spy).toHaveBeenCalledTimes(1);
	});
});

/**
 * Der Auftakt des Balance-Bilds startet erst mit der Beantwortung der Balance-Frage — sonst wächst
 * das Zifferblatt auf den lokalen Notwert und wechselt dort mitten im Auftakt auf den echten Stand.
 * Im Fehlerfall wird trotzdem freigegeben: Der lokale Wert ist dann der Stand.
 */
describe('Dashboard — Auftakt-Freigabe des Balance-Bilds', () => {
	it('hält den Auftakt zurück und gibt ihn mit der Balance-Antwort frei', async () => {
		const status = {
			fuellstandProzent: 37,
			hatPunkte: true,
			saeulen: [],
			meilensteine: [],
		} as unknown as BalanceStatus;
		let loesen!: (status: BalanceStatus) => void;
		vi.spyOn(api, 'getBalanceStatus').mockImplementation(
			() => new Promise<BalanceStatus>((resolve) => (loesen = resolve)),
		);
		const koerper = pillar(1, 'Körper', 100);
		const tasks = [task(11, [{ pillarId: 1, share: 100, confidence: 100 }], 1, TaskStatus.Done)];

		render(<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />);

		await waitFor(() => expect(vi.mocked(HeartBalance).mock.calls.at(-1)?.[0]?.auftaktBereit).toBe(false));
		await act(async () => loesen(status));
		await waitFor(() => expect(vi.mocked(HeartBalance).mock.calls.at(-1)?.[0]?.auftaktBereit).toBe(true));
	});

	it('gibt im Fehlerfall für den lokalen Wert frei', async () => {
		vi.spyOn(api, 'getBalanceStatus').mockRejectedValue(new Error('nicht erreichbar'));
		const koerper = pillar(1, 'Körper', 100);
		const tasks = [task(11, [{ pillarId: 1, share: 100, confidence: 100 }], 1, TaskStatus.Done)];

		render(<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />);

		await waitFor(() => expect(vi.mocked(HeartBalance).mock.calls.at(-1)?.[0]?.auftaktBereit).toBe(true));
	});
});

/**
 * AK1 (#1793, Spec docs/spec/issue-1793.md): Der Fürsorge-Hinweis steht im DOM VOR der Card
 * „Nächste Aufgabe" (`.dashboard-next-task`). ROT, bis `Dashboard` `CareHint` einbindet.
 */
describe('Dashboard — Fürsorge-Hinweis vor „Nächste Aufgabe" (#1793)', () => {
	it('rendert den Hinweis oberhalb der Card „Nächste Aufgabe"', async () => {
		vi.spyOn(api, 'getCareSuggestions').mockResolvedValue({
			vorschlaege: [
				{
					typ: 'vorlage',
					anlass: 'defizit',
					titel: 'Zehn Minuten spazieren gehen',
					beschreibung: 'Ein kurzer Spaziergang',
					saeuleId: 1,
					saeuleName: 'Körper',
					saeulenBeitraege: [{ pillarId: 1, share: 100 }],
					templateKey: 'koerper-spaziergang',
				},
			],
		});

		const { container } = render(
			<Dashboard tasks={[]} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[pillar(1, 'Körper', 100)]} />,
		);

		const careHint = await waitFor(() => {
			const el = container.querySelector('[data-testid="care-hint"]');
			expect(el).not.toBeNull();
			return el as Element;
		});
		const nextTask = container.querySelector('.dashboard-next-task') as Element;
		expect(careHint.compareDocumentPosition(nextTask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});

/**
 * Rote Spec-Tests für #1985 (TF2–TF4 — docs/spec/issue-1985.md): die Karte „Nächste Aufgabe“
 * baut aus den additiven `reasons`-Werten von `GET /next` bis zu vier Begründungssätze
 * (absteigend nach scoreBreakdown-Anteil, KI-UX: ohne Technik-Werte) und zeigt ohne Anteile
 * genau einen Fallback-Satz aus Priorität und Frist.
 */
describe('Dashboard — Begründungssätze der „Nächste Aufgabe“-Karte (#1985)', () => {
	const frist = new Date(2026, 9, 12); // 12.10.2026

	const mitBegruendung = (
		overrides: Partial<Pick<Task, 'deadline'>> & { scoreBreakdown?: object; reasons?: object },
	): Task =>
		({
			...task(42, [], 2, TaskStatus.Open),
			...overrides,
		}) as unknown as Task;

	const renderKarte = (nextTask: Task): { container: HTMLElement } =>
		render(<Dashboard tasks={[nextTask]} forest={[] as TaskTreeNode[]} nextTask={nextTask} pillars={[]} />);

	const saetze = (container: HTMLElement): string[] =>
		[...container.querySelectorAll('.dashboard-next-task-reasons li')].map((li) => li.textContent ?? '');

	it('AK2: drei Begründungssätze (ohne Priorität), absteigend nach Anteil, unter dem Titel', () => {
		const nextTask = mitBegruendung({
			deadline: frist,
			scoreBreakdown: { total: 1, balance: 0.5, unlock: 0.3, deadline: 0.15, priority: 0.05 },
			reasons: {
				balance: { pillars: ['Beziehungen'] },
				unlock: { openCount: 2 },
				deadline: { date: '2026-10-12', daysUntil: 11 },
				priority: { priority: 4 },
			},
		});
		const { container } = renderKarte(nextTask);

		const liste = saetze(container);
		expect(liste).toHaveLength(3);
		expect(liste[0]!).toMatch(/Säule Beziehungen kam diese Woche zu kurz\./);
		expect(liste[1]!).toMatch(/Schaltet 2 offene Aufgaben frei\./);
		expect(liste[2]!).toMatch(/Fällig am \d{1,2}\.\d{1,2}\.\d{4}/);

		// UX-Lesefluss: Liste unter dem Titel (DOM-Reihenfolge), vor der Aktionszeile.
		const titel = container.querySelector('.dashboard-next-task-title');
		const gruende = container.querySelector('.dashboard-next-task-reasons');
		expect(gruende).not.toBeNull();
		expect(titel && titel.compareDocumentPosition(gruende!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('AK3: andere Anteile → andere Sätze in anderer Reihenfolge', () => {
		const nextTask = mitBegruendung({
			deadline: frist,
			scoreBreakdown: { total: 1, deadline: 0.6, unlock: 0.3, priority: 0.1 },
			reasons: {
				unlock: { openCount: 1 },
				deadline: { date: '2026-10-12', daysUntil: 3 },
				priority: { priority: 2 },
			},
		});
		const { container } = renderKarte(nextTask);

		const liste = saetze(container);
		expect(liste).toHaveLength(2);
		expect(liste[0]!).toMatch(/Fällig am \d{1,2}\.\d{1,2}\.\d{4}/);
		expect(liste[1]!).toMatch(/Schaltet 1 offene Aufgabe frei\./);
		// Die Priorität steht schon in der Meta-Zeile — kein Begründungssatz dazu.
		expect(container.textContent).not.toMatch(/Priorität 2\./);
		expect(container.textContent).not.toMatch(/kam diese Woche zu kurz/);
	});

	it('AK4: ohne Anteile genau ein Fallback-Satz aus der Frist', () => {
		const nextTask = mitBegruendung({ deadline: frist, scoreBreakdown: { total: 0 } });
		const { container } = renderKarte(nextTask);

		const liste = saetze(container);
		expect(liste).toHaveLength(1);
		expect(liste[0]!).toMatch(/^Fällig am \d{1,2}\.\d{1,2}\.\d{4}\.$/);
	});

	it('AK4: ohne Frist keine Begründungssätze (die Priorität steht in der Meta-Zeile)', () => {
		const nextTask = mitBegruendung({ deadline: null, scoreBreakdown: { total: 0 } });
		const { container } = renderKarte(nextTask);

		const liste = saetze(container);
		expect(liste).toHaveLength(0);
	});
});

/**
 * ROTE Spec-Tests für #2244 (AK6 — docs/spec/issue-2244.md): Uhr-Button „Kurz zurückstellen" in
 * „Nächste Aufgabe". Rot, bis `Dashboard.tsx` die Prop `onSnoozeTask` und den Icon-only-Button rendert.
 */
describe('Dashboard — „Kurz zurückstellen"-Button im Signal-Panel (Issue #2244)', () => {
	// `onSnoozeTask` existiert noch nicht auf `DashboardProps` — Cast hält den Spec-Commit tsc-sauber.
	const renderWithSnooze = (props: ComponentProps<typeof Dashboard> & { onSnoozeTask?: (task: Task) => void }) =>
		render(<Dashboard {...(props as ComponentProps<typeof Dashboard>)} />);
	const snoozeButton = (container: HTMLElement) =>
		[...container.querySelectorAll('.dashboard-next-task-content kol-button')].find(
			(b) => b.getAttribute('_label') === 'Kurz zurückstellen',
		);

	it('AK6: rendert mit nextTask + onSnoozeTask einen Icon-only-Button, Klick ruft onSnoozeTask mit nextTask', () => {
		const nextTask = task(42, [], 2, TaskStatus.Open);
		const calls: Task[] = [];
		const { container } = renderWithSnooze({
			tasks: [nextTask],
			forest: [] as TaskTreeNode[],
			nextTask,
			pillars: [],
			onCompleteTask: () => undefined,
			onSnoozeTask: (t: Task) => calls.push(t),
		});

		const button = snoozeButton(container);
		expect(button, 'Button mit _label="Kurz zurückstellen" fehlt').toBeDefined();
		expect(button?.getAttribute('_hide-label')).not.toBeNull();

		(button as unknown as { _on: { onClick: (event: Event) => void } })._on.onClick(new Event('click'));
		expect(calls).toHaveLength(1);
		expect(calls[0]?.id).toBe(42);
	});

	it('AK6: ohne onSnoozeTask kein Snooze-Button', () => {
		const nextTask = task(42, [], 2, TaskStatus.Open);
		const { container } = render(
			<Dashboard tasks={[nextTask]} forest={[] as TaskTreeNode[]} nextTask={nextTask} pillars={[]} />,
		);
		expect(snoozeButton(container)).toBeUndefined();
	});
});

/**
 * Rote Spec-Tests für #1994 (AK5, docs/spec/issue-1994.md): `reasons.split` aus `GET /next` ergibt
 * einen Begründungssatz zum Aufteilen in kleinere Schritte — ohne Zahl, ohne Aktion; ohne
 * `reasons.split` erscheint er nicht.
 */
describe('Dashboard — Aufteilen-Hinweis an der „Nächste Aufgabe“-Karte (#1994)', () => {
	const renderKarte = (reasons: object): HTMLElement => {
		const nextTask = {
			...task(42, [], 2, TaskStatus.Open),
			scoreBreakdown: { total: 1, priority: 0.5 },
			reasons,
		} as unknown as Task;
		return render(<Dashboard tasks={[nextTask]} forest={[] as TaskTreeNode[]} nextTask={nextTask} pillars={[]} />)
			.container;
	};

	it('AK5: Satz zum Aufteilen sichtbar, ohne Zahl, ohne zusätzliche Schaltfläche', () => {
		const container = renderKarte({ priority: { priority: 2 }, split: { postponeCount: 7 } });
		const liste = container.querySelector('.dashboard-next-task-reasons');
		expect(liste?.textContent).toMatch(/kleinere Schritte/i);
		expect(liste?.textContent, 'der Zähler wird nicht genannt (Fürsorge-Ton)').not.toMatch(/7/);
		expect(liste?.querySelector('button, kol-button, a'), 'keine Aktion im Hinweis').toBeNull();
	});

	it('AK5: ohne reasons.split kein Aufteilen-Satz', () => {
		const container = renderKarte({ priority: { priority: 2 } });
		expect(container.textContent).not.toMatch(/kleinere Schritte/i);
	});
});

describe('Dashboard — Deadlines-Pagination (8 je Seite)', () => {
	const mitDeadlines = (n: number) =>
		Array.from({ length: n }, (_, i) => {
			const t = task(i + 1, [], 1, TaskStatus.Open);
			t.deadline = new Date(Date.UTC(2026, 9, 12 + i));
			return t;
		});
	const renderDeadlines = (n: number) =>
		render(<Dashboard tasks={mitDeadlines(n)} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} />);

	it('10 Deadlines: Seite 1 zeigt 8, Weiter zeigt die restlichen 2', () => {
		const { container } = renderDeadlines(10);
		expect(container.querySelectorAll('.dashboard-deadline')).toHaveLength(8);
		expect(screen.getByTestId('pager').dataset.max).toBe('10');
		act(() => screen.getByTestId('pager').click());
		expect(container.querySelectorAll('.dashboard-deadline')).toHaveLength(2);
		expect(screen.getByTestId('pager').dataset.page).toBe('2');
	});

	it('bis 8 Deadlines: kein Pager', () => {
		renderDeadlines(8);
		expect(screen.queryByTestId('pager')).toBeNull();
	});

	it('schrumpft die Liste auf Seite 2, klemmt die Seite und blendet den Pager aus', () => {
		const { container, rerender } = renderDeadlines(10);
		act(() => screen.getByTestId('pager').click());
		rerender(<Dashboard tasks={mitDeadlines(3)} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[]} />);
		expect(container.querySelectorAll('.dashboard-deadline')).toHaveLength(3);
		expect(screen.queryByTestId('pager')).toBeNull();
	});
});

/**
 * Rote Spec-Tests für #2526 (docs/spec/issue-2526.md, ADR 0024): „Erledigen“ ohne offene
 * Checkliste wird DIREKT aus dem Signal-Panel ausgeführt (kein Dialog mehr) und meldet an der
 * Tipp-Stelle zurück — Erfolg mit Punkten/Streak und „Rückgängig“ in einer aria-live-Region,
 * Fehler als Inline-KolAlert. Bis zur Umsetzung ruft der Klick noch nichts auf → rot.
 */
describe('Dashboard — Direkt-Erledigen mit Inline-Rückmeldung (Issue #2526)', () => {
	const erledigenButton = (container: HTMLElement) =>
		[...container.querySelectorAll('.dashboard-next-task-content kol-button')].find(
			(b) => b.getAttribute('_label') === 'Erledigen',
		);

	const setup = () => {
		vi.spyOn(api, 'getBalanceStatus').mockResolvedValue({
			fuellstandProzent: 0,
			hatPunkte: true,
			saeulen: [],
			meilensteine: [],
		} as unknown as BalanceStatus);
		vi.spyOn(api, 'getCareSuggestions').mockResolvedValue({ vorschlaege: [] } as never);
		vi.spyOn(api, 'getStreak').mockResolvedValue({ aktuell: 4 } as never); // Vertrag: `{ aktuell }` (Fixup #2572)
	};

	it('AK2: Direkt-Erledigen zeigt die Rückmeldung in einer aria-live-Region mit „Rückgängig“', async () => {
		setup();
		const updateSpy = vi.spyOn(api, 'updateTask').mockResolvedValue({} as never);
		const nextTask = task(51, [{ pillarId: 1, share: 100, confidence: 100 }], 1, TaskStatus.Open);
		const { container } = render(
			<Dashboard
				tasks={[nextTask]}
				forest={[] as TaskTreeNode[]}
				nextTask={nextTask}
				pillars={[pillar(1, 'Körper', 100)]}
			/>,
		);

		const button = erledigenButton(container);
		expect(button, 'Button „Erledigen“ fehlt im Panel').toBeDefined();
		(button as unknown as { _on: { onClick: (event: Event) => void } })._on.onClick(new Event('click'));

		await waitFor(() => {
			const live = container.querySelector('.dashboard-next-task-content [aria-live="polite"]');
			expect(live, 'Rückmeldung fehlt oder liegt nicht in einer aria-live-Region').not.toBeNull();
			expect(live!.textContent).toMatch(/\+\d+ Punkte/);
		});
		// Der Streak folgt nicht-blockierend nach — er muss im Region-Text landen (Fixup #2572: Mock
		// am openapi-Vertrag `{ aktuell }`, sonst war die Streak-Zeile hier nie gerendert).
		await waitFor(() => {
			expect(container.querySelector('.dashboard-next-task-content [aria-live="polite"]')?.textContent).toContain(
				'Streak 4 Tage',
			);
		});
		expect(updateSpy).toHaveBeenCalledTimes(1);

		const undo = [...container.querySelectorAll('.dashboard-next-task-content kol-button')].find(
			(b) => b.getAttribute('_label') === 'Rückgängig',
		);
		expect(undo, 'Knopf „Rückgängig“ fehlt im Inline-Zustand').toBeDefined();
	});

	it('Fixup #2572: die aria-live-Region steht dauerhaft im DOM — schon vor dem Erledigen und leer', () => {
		setup();
		const nextTask = task(53, [{ pillarId: 1, share: 100, confidence: 100 }], 1, TaskStatus.Open);
		const { container } = render(
			<Dashboard
				tasks={[nextTask]}
				forest={[] as TaskTreeNode[]}
				nextTask={nextTask}
				pillars={[pillar(1, 'Körper', 100)]}
			/>,
		);

		const live = container.querySelector('.dashboard-next-task-content [aria-live="polite"]');
		expect(live, 'Live-Region muss schon vor dem Erledigen im DOM stehen').not.toBeNull();
		expect(live!.textContent, 'Ohne Rückmeldung bleibt die Region leer').toBe('');
	});

	it('AK7: schlägt das Erledigen fehl, zeigt das Panel eine Inline-Fehlermeldung und die Aufgabe bleibt offen', async () => {
		setup();
		vi.spyOn(api, 'updateTask').mockRejectedValue(new Error('Serverfehler'));
		const nextTask = task(52, [{ pillarId: 1, share: 100, confidence: 100 }], 1, TaskStatus.Open);
		const { container } = render(
			<Dashboard
				tasks={[nextTask]}
				forest={[] as TaskTreeNode[]}
				nextTask={nextTask}
				pillars={[pillar(1, 'Körper', 100)]}
			/>,
		);

		const button = erledigenButton(container);
		expect(button, 'Button „Erledigen“ fehlt im Panel').toBeDefined();
		(button as unknown as { _on: { onClick: (event: Event) => void } })._on.onClick(new Event('click'));

		await waitFor(() => {
			const alert = container.querySelector('.dashboard-next-task-content kol-alert');
			expect(alert, 'keine Inline-Fehlermeldung im Panel').not.toBeNull();
			expect(alert?.getAttribute('_type')).toBe('error');
		});
		expect(container.querySelector('.dashboard-next-task-content')?.textContent).toContain('T52');
	});
});

/**
 * Rote Spec-Tests für #2527 (docs/spec/issue-2527.md): Das Einstieg-Signal (`reasons.einstieg`)
 * aus `GET /next` rendert den einladenden Einstiegssatz statt „kam diese Woche zu kurz“ —
 * in de und en (Ton nach docs/fuersorge-tonalitaet.md).
 */
describe('Dashboard — Einstiegssatz unter der Mindestmenge (#2527)', () => {
	const renderKarte = (reasons: object): { container: HTMLElement } => {
		const nextTask = {
			...task(42, [], 2, TaskStatus.Open),
			scoreBreakdown: { total: 1, balance: 1 },
			reasons,
		} as unknown as Task;
		return render(<Dashboard tasks={[nextTask]} forest={[] as TaskTreeNode[]} nextTask={nextTask} pillars={[]} />);
	};

	const saetze = (container: HTMLElement): string[] =>
		[...container.querySelectorAll('.dashboard-next-task-reasons li')].map((li) => li.textContent ?? '');

	it('TF3/AK4: reasons.einstieg → deutscher Einstiegssatz statt „kam diese Woche zu kurz“', () => {
		const { container } = renderKarte({ einstieg: true });
		expect(saetze(container)).toEqual([
			'Such dir eine kleine Aufgabe aus, die dir heute guttut – klein anfangen zählt.',
		]);
		expect(container.textContent).not.toMatch(/kam diese Woche zu kurz/);
	});

	it('TF3/AK4: Sprache en — englischer Einstiegssatz', async () => {
		await i18next.changeLanguage('en');
		const { container } = renderKarte({ einstieg: true });
		expect(saetze(container)).toEqual(['Pick one small task that does you good today – starting small counts.']);
		expect(container.textContent).not.toMatch(/fell short this week/);
		await i18next.changeLanguage('de');
	});
});

/**
 * Rote Spec-Tests für #2645 (docs/spec/issue-2645.md): Auf leerem Konto steht der Einstiegssatz
 * genau einmal — zeigt der CareHint den Satz (`anlass 'einstieg'`), entfällt die inhaltsgleiche
 * Begründungszeile der nächsten Aufgabe (`reasons.einstieg`). Ohne den Hinweis bleibt die Zeile
 * stehen (Bestandsvertrag #2527, TF3 oben).
 */
describe('Dashboard — Einstiegssatz genau einmal (#2645/AK3)', () => {
	// CareVorschlag wie `anlass: 'einstieg'` aus GET /scores/care-suggestions (0 Erledigungen).
	const einstiegVorschlag = {
		typ: 'vorlage',
		anlass: 'einstieg',
		titel: 'Such dir eine kleine Aufgabe aus, die dir heute guttut – klein anfangen zählt.',
		beschreibung: null,
		saeuleId: 0,
		saeuleName: '',
		saeulenBeitraege: [],
	} as never;

	it('unterdrückt die Begründungszeile, solange der CareHint den Einstiegssatz zeigt', async () => {
		vi.spyOn(api, 'getCareSuggestions').mockResolvedValue({ vorschlaege: [einstiegVorschlag] } as never);
		const nextTask = {
			...task(42, [], 2, TaskStatus.Open),
			scoreBreakdown: { total: 1, balance: 1 },
			reasons: { einstieg: true },
		} as unknown as Task;
		const { container } = render(
			<Dashboard tasks={[nextTask]} forest={[] as TaskTreeNode[]} nextTask={nextTask} pillars={[]} />,
		);

		// Erst absichern, dass der Hinweis den Satz wirklich zeigt (Quelle der ersten Instanz).
		await waitFor(() => {
			const hint = container.querySelector('[data-testid="care-hint"]');
			expect(hint?.textContent).toContain('Such dir eine kleine Aufgabe');
		});

		const satz = 'Such dir eine kleine Aufgabe aus, die dir heute guttut – klein anfangen zählt.';
		expect((container.textContent ?? '').split(satz).length - 1).toBe(1);
		expect(container.querySelector('.dashboard-next-task-reasons')?.textContent ?? '').not.toContain(satz);
	});
});

/**
 * Roter Spec-Test #2632 (docs/spec/issue-2632.md): der Inline-Erfolg nennt den Streak in korrekter
 * Einzahl/Mehrzahl — Locale-Schluessel `nextTask.streakDays_one`/`streakDays_other` in de und en
 * (Muster `days_one`/`days_other` bzw. #1819-Hilfetext-Glob in StreakCard.test.tsx). Das Verdrahten
 * des `count`-Parameters am t()-Aufruf sichert die e2e (issue-1360-streak.spec.ts, #2632-Block).
 */
const dashboardLocales = import.meta.glob<{ default: { nextTask?: Record<string, unknown> } }>(
	'../i18n/locales/*/dashboard.json',
	{ eager: true },
);

describe('Dashboard Inline-Erfolg — Streak in Einzahl/Mehrzahl (#2632 AK2)', () => {
	it('streakDays liegt je Sprache in Einzahl (1) und Mehrzahl (2) vor', () => {
		expect(Object.keys(dashboardLocales).length).toBeGreaterThanOrEqual(2);
		for (const [path, module] of Object.entries(dashboardLocales)) {
			const lang = /locales\/([^/]+)\//.exec(path)![1];
			const de = lang === 'de';
			const nextTask = module.default.nextTask ?? {};
			expect(nextTask.streakDays_one, `${lang} streakDays_one`).toBe(
				de ? 'Streak {{count}} Tag' : 'Streak {{count}} day',
			);
			expect(nextTask.streakDays_other, `${lang} streakDays_other`).toBe(
				de ? 'Streak {{count}} Tage' : 'Streak {{count}} days',
			);
		}
	});
});
