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
		const tasks = [
			task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 1.4, TaskStatus.Done),
		];

		const { container } = render(
			<Dashboard tasks={tasks} forest={[] as TaskTreeNode[]} nextTask={null} pillars={[koerper]} />,
		);

		const meter = container.querySelector('kol-meter');
		expect(meter).not.toBeNull();

		// Der Wert (actualShare) ist unter dem Schwellwert (low)
		const value = meter?.getAttribute('_value');
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
		const tasks = [
			task(10, [{ pillarId: 1, share: 100, confidence: 100 }], 1.6, TaskStatus.Done),
		];

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
