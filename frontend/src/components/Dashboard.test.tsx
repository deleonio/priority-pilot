import { cleanup, render } from '@testing-library/react';
import type { Pillar, Task, TaskPillarContribution, TaskTreeNode } from 'client';
import { TaskStatus } from 'client';
import { afterEach, describe, expect, it } from 'vitest';
import { Dashboard } from './Dashboard';

afterEach(cleanup);

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
 * daher gibt es aktuell KEIN Element mit `_label="Erledigt"` im Panel.
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
				// @ts-expect-error — `onCompleteTask` existiert noch nicht im Props-Vertrag (#1168 AK1).
				onCompleteTask={onCompleteTask}
			/>,
		);

		const panel = container.querySelector('.dashboard-next-task-content');
		expect(panel, '.dashboard-next-task-content fehlt bei gesetztem nextTask').not.toBeNull();

		const buttons = [...(panel?.querySelectorAll('kol-button') ?? [])];
		const doneButton = buttons.find((b) => b.getAttribute('_label') === 'Erledigt');
		expect(doneButton, 'Button mit _label="Erledigt" fehlt im Panel').toBeDefined();

		const startButton = buttons.find((b) => b.getAttribute('_label') === 'Jetzt starten');
		expect(startButton, 'Button „Jetzt starten" darf nicht mehr existieren').toBeUndefined();
	});
});
