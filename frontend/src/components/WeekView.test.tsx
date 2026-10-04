import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Task, TaskPillarContribution } from 'client';
import { TaskStatus } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeekView } from './WeekView';

/**
 * `KolCard`/`KolButton` bleiben ohne lokalen Mock nicht hochgestufte Custom Elements (kein Shadow-DOM
 * in jsdom, `_label` unsichtbar für `textContent`/`getByRole` — Muster wie `TaskTree.test.tsx`).
 * Auf reale, klickbare/lesbare Elemente reduziert: `_label` als Überschrift bzw. Button-Text.
 */
vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, className, children }: { _label?: string; className?: string; children?: React.ReactNode }) => (
		<div className={className}>
			<h3>{_label}</h3>
			{children}
		</div>
	),
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: () => void } }) => (
		<button onClick={() => _on?.onClick?.()}>{_label}</button>
	),
}));

afterEach(cleanup);

const pillars: TaskPillarContribution[] = [];

const task = (id: number, title: string, deadline: Date | null, status: Task['status'] = TaskStatus.Open): Task => ({
	id,
	title,
	status,
	priority: 3,
	estimatedEffort: 1,
	actualEffort: null,
	description: null,
	deadline,
	seriesId: null,
	isException: false,
	pinned: false,
	pillars,
});

// Referenzdatum ist ein Mittwoch (2026-09-23, UTC) — feste Kalenderwoche für deterministische Tests.
const REFERENCE = new Date(Date.UTC(2026, 8, 23));
const MONDAY = new Date(Date.UTC(2026, 8, 21));
const TUESDAY = new Date(Date.UTC(2026, 8, 22));
const SUNDAY = new Date(Date.UTC(2026, 8, 27));

/**
 * #1617 AK1: Die Wochenansicht zeigt alle 7 Tage der Woche, in der das Referenzdatum liegt.
 */
describe('WeekView — 7-Tage-Übersicht (#1617 AK1)', () => {
	it('rendert genau 7 Tageskarten von Montag bis Sonntag', () => {
		const { container } = render(
			<WeekView tasks={[]} nextTask={null} suggestions={[]} referenceDate={REFERENCE} onSelectDay={() => {}} />,
		);

		const dayCards = container.querySelectorAll('.week-view-day');
		expect(dayCards).toHaveLength(7);
		expect(screen.getByRole('heading', { name: /Montag/i })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /Sonntag/i })).toBeInTheDocument();
	});
});

/**
 * #1617 AK3: Manuell geplante (per Deadline datierte) Aufgaben werden dem jeweiligen Wochentag korrekt
 * zugeordnet — eine Aufgabe mit Deadline Montag darf NICHT unter Dienstag erscheinen (Negativ-Kontrolle).
 */
describe('WeekView — Zuordnung manueller Aufgaben je Tag (#1617 AK3)', () => {
	it('zeigt eine Aufgabe nur unter ihrem Deadline-Tag', () => {
		const montagsAufgabe = task(1, 'Montags-Aufgabe', MONDAY);
		render(
			<WeekView
				tasks={[montagsAufgabe]}
				nextTask={null}
				suggestions={[]}
				referenceDate={REFERENCE}
				onSelectDay={() => {}}
			/>,
		);

		const montagCard = screen.getByRole('heading', { name: /Montag,/i }).closest('.week-view-day') as HTMLElement;
		const dienstagCard = screen.getByRole('heading', { name: /Dienstag,/i }).closest('.week-view-day') as HTMLElement;
		expect(within(montagCard).getByText('Montags-Aufgabe')).toBeInTheDocument();
		// Negativ-Kontrolle: nicht am Dienstag.
		expect(within(dienstagCard).queryByText('Montags-Aufgabe')).toBeNull();
	});

	it('ordnet eine Aufgabe mit Deadline Sonntag der letzten Karte zu', () => {
		const sonntagsAufgabe = task(2, 'Sonntags-Aufgabe', SUNDAY);
		render(
			<WeekView
				tasks={[sonntagsAufgabe]}
				nextTask={null}
				suggestions={[]}
				referenceDate={REFERENCE}
				onSelectDay={() => {}}
			/>,
		);

		const sonntagCard = screen.getByRole('heading', { name: /Sonntag,/i }).closest('.week-view-day') as HTMLElement;
		expect(within(sonntagCard).getByText('Sonntags-Aufgabe')).toBeInTheDocument();
	});

	// #2012 AK1 (Test-Pflege): flipped von „erledigte Aufgaben werden ausgeblendet" auf „erledigte
	// Aufgaben erscheinen unter ihrem Deadline-Tag" — der alte Soll-Text sperrte das neue Verhalten.
	it('zeigt erledigte Aufgaben (Status Done) unter ihrem Deadline-Tag', () => {
		const erledigt = task(3, 'Erledigte-Aufgabe', TUESDAY, TaskStatus.Done);
		render(
			<WeekView tasks={[erledigt]} nextTask={null} suggestions={[]} referenceDate={REFERENCE} onSelectDay={() => {}} />,
		);

		// Karte mit nur erledigten Aufgaben ist nicht leer — Titel in genau dieser Karte.
		const dienstagCard = screen.getByRole('heading', { name: /Dienstag,/i }).closest('.week-view-day') as HTMLElement;
		const mittwochCard = screen.getByRole('heading', { name: /Mittwoch,/i }).closest('.week-view-day') as HTMLElement;
		expect(within(dienstagCard).getByText('Erledigte-Aufgabe')).toBeInTheDocument();
		// Negativ-Kontrolle: nicht am Folgetag.
		expect(within(mittwochCard).queryByText('Erledigte-Aufgabe')).toBeNull();
	});
});

/**
 * #2012 AK2/AK3: erledigte Einträge sind klar von offenen unterscheidbar (eigene Klasse, unter den
 * offenen einsortiert); Tage ohne zugeordnete Aufgaben bleiben ohne Listeneinträge.
 */
describe('WeekView — erledigte Aufgaben in der Tageskarte (#2012 AK2/AK3)', () => {
	it('kennzeichnet erledigte Einträge mit week-view-done und ordnet sie unter die offenen ein', () => {
		const offen = task(4, 'Offene-Aufgabe', TUESDAY);
		const erledigt = task(5, 'Erledigte-Aufgabe', TUESDAY, TaskStatus.Done);
		render(
			<WeekView
				tasks={[offen, erledigt]}
				nextTask={null}
				suggestions={[]}
				referenceDate={REFERENCE}
				onSelectDay={() => {}}
			/>,
		);

		const dienstagCard = screen.getByRole('heading', { name: /Dienstag,/i }).closest('.week-view-day') as HTMLElement;
		const lis = Array.from(dienstagCard.querySelectorAll('li'));
		const openLi = lis.find((li) => li.textContent === 'Offene-Aufgabe');
		const doneLi = lis.find((li) => li.textContent === 'Erledigte-Aufgabe');
		expect(doneLi).toHaveClass('week-view-done');
		expect(openLi).not.toHaveClass('week-view-done');
		// Done erscheint unter den offenen Einträgen derselben Karte.
		expect(lis.indexOf(openLi!)).toBeLessThan(lis.indexOf(doneLi!));
	});

	it('lässt Tage ohne zugeordnete Aufgaben ohne Listeneinträge', () => {
		const erledigt = task(6, 'Erledigte-Aufgabe', TUESDAY, TaskStatus.Done);
		render(
			<WeekView tasks={[erledigt]} nextTask={null} suggestions={[]} referenceDate={REFERENCE} onSelectDay={() => {}} />,
		);

		const mittwochCard = screen.getByRole('heading', { name: /Mittwoch,/i }).closest('.week-view-day') as HTMLElement;
		expect(mittwochCard.querySelectorAll('li')).toHaveLength(0);
	});
});

/**
 * #1617 AK3 (Fortsetzung): systemisch empfohlene Aufgaben (`GET /suggestions`) gehören zum heutigen
 * Tag (Referenzdatum) — die Empfehlungs-Engine bewertet ausschließlich den aktuellen Zeitpunkt
 * (`server/src/logics/find.ts`), eine Simulation für andere Wochentage ist bewusst nicht Teil dieses
 * Tickets (dokumentiert im PR). Negativ-Kontrolle: die Empfehlung erscheint NICHT unter einem
 * Nachbartag.
 */
describe('WeekView — Zuordnung systemisch empfohlener Aufgaben (#1617 AK3)', () => {
	it('zeigt eine Empfehlung nur unter dem heutigen Tag (Referenzdatum = Mittwoch)', () => {
		const empfehlung = task(4, 'Empfohlene-Aufgabe', null);
		render(
			<WeekView
				tasks={[empfehlung]}
				nextTask={null}
				suggestions={[empfehlung]}
				referenceDate={REFERENCE}
				onSelectDay={() => {}}
			/>,
		);

		const mittwochCard = screen.getByRole('heading', { name: /Mittwoch,/i }).closest('.week-view-day') as HTMLElement;
		const donnerstagCard = screen
			.getByRole('heading', { name: /Donnerstag,/i })
			.closest('.week-view-day') as HTMLElement;
		expect(within(mittwochCard).getByText(/Empfohlene-Aufgabe/)).toBeInTheDocument();
		expect(within(donnerstagCard).queryByText(/Empfohlene-Aufgabe/)).toBeNull();
	});

	/**
	 * Kreuzverhör-Fund (PR #1620, Runde 1): `nextTask`/`suggestions` mit einer eigenen Deadline an
	 * einem ANDEREN Tag als heute erschienen zusätzlich unter "heute" — dieselbe Aufgabe stand damit
	 * auf zwei Kartentagen. Diese Aufgabe hat eine Deadline am Sonntag; sie darf NUR dort auftauchen,
	 * nicht zusätzlich als "(nächste Aufgabe)" am heutigen Mittwoch.
	 */
	it('zeigt eine nächste Aufgabe mit Deadline an einem anderen Tag NUR unter ihrem Deadline-Tag, nicht zusätzlich heute', () => {
		const naechsteMitFremderDeadline = task(5, 'Naechste-Mit-Sonntags-Deadline', SUNDAY);
		render(
			<WeekView
				tasks={[naechsteMitFremderDeadline]}
				nextTask={naechsteMitFremderDeadline}
				suggestions={[]}
				referenceDate={REFERENCE}
				onSelectDay={() => {}}
			/>,
		);

		const mittwochCard = screen.getByRole('heading', { name: /Mittwoch,/i }).closest('.week-view-day') as HTMLElement;
		const sonntagCard = screen.getByRole('heading', { name: /Sonntag,/i }).closest('.week-view-day') as HTMLElement;
		expect(within(sonntagCard).getByText('Naechste-Mit-Sonntags-Deadline')).toBeInTheDocument();
		expect(within(mittwochCard).queryByText(/Naechste-Mit-Sonntags-Deadline/)).toBeNull();
	});

	/**
	 * Kreuzverhör-Fund (PR #1620, Runde 2, Finding #3): der Runde-1-Fix (`deadline == null`) blendete
	 * Empfehlungen mit einer Deadline AUSSERHALB der angezeigten Woche (überfällig oder weit in der
	 * Zukunft) komplett aus — weder unter ihrem (nicht angezeigten) Deadline-Tag noch unter „heute".
	 * Eine Empfehlung mit Deadline 2026-10-15 (außerhalb der Referenzwoche 21.–27.09.2026) muss unter
	 * dem heutigen Tag (Mittwoch) erscheinen.
	 */
	it('zeigt eine Empfehlung mit Deadline außerhalb der angezeigten Woche unter dem heutigen Tag', () => {
		const ausserhalbDerWoche = task(6, 'Empfehlung-Ausserhalb-Woche', new Date(Date.UTC(2026, 9, 15)));
		render(
			<WeekView
				tasks={[ausserhalbDerWoche]}
				nextTask={null}
				suggestions={[ausserhalbDerWoche]}
				referenceDate={REFERENCE}
				onSelectDay={() => {}}
			/>,
		);

		const mittwochCard = screen.getByRole('heading', { name: /Mittwoch,/i }).closest('.week-view-day') as HTMLElement;
		expect(within(mittwochCard).getByText(/Empfehlung-Ausserhalb-Woche/)).toBeInTheDocument();
	});
});

/**
 * #1617 AK2: Aus der Wochenansicht kann man einen Tag anwählen und landet in der bestehenden
 * Tagesansicht — der Callback `onSelectDay` wird beim Klick auf „Tag öffnen" ausgelöst.
 */
describe('WeekView — Tag anwählen führt zur Tagesansicht (#1617 AK2)', () => {
	it('ruft onSelectDay auf, wenn eine Tageskarte geöffnet wird', () => {
		const onSelectDay = vi.fn();
		render(
			<WeekView tasks={[]} nextTask={null} suggestions={[]} referenceDate={REFERENCE} onSelectDay={onSelectDay} />,
		);

		fireEvent.click(screen.getAllByRole('button', { name: 'Tag öffnen' })[0]);

		expect(onSelectDay).toHaveBeenCalledTimes(1);
		expect(onSelectDay).toHaveBeenCalledWith(MONDAY);
	});
});
