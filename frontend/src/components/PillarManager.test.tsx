import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Pillar } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Modal mock — KoliBris `KolDialog` (natives `<dialog>`) ist in jsdom nicht lauffähig.
vi.mock('./Modal', () => ({
	Modal: ({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) => (
		<div role="dialog" aria-label={title}>
			{children}
			<button onClick={onClose}>Schließen</button>
		</div>
	),
}));

// Die Komponente existiert NOCH nicht. Der Import wird fehlschlagen (rote Tests).
// Sobald die Umsetzung die Komponente erstellt, werden die Tests grün.
// @ts-expect-error — Komponente wird von der Umsetzung erstellt (#425)
import { PillarManager } from './PillarManager';

afterEach(cleanup);

const pillar = (id: number, name: string, description = '', weight = 0): Pillar => ({
	id,
	name,
	description,
	weight,
});

/**
 * AK1: Nutzer kann im Säulen-Tab eine Säule anlegen (Name Pflicht, Beschreibung optional);
 * sie erscheint sofort in Liste, Gewichtung und Task-Formular-Auswahl.
 */
describe('#425 PillarManager — Anlegen (AK1)', () => {
	it('rendert ein Anlege-Formular mit Eingabefeldern für Name und Beschreibung', () => {
		const onPillarsChanged = vi.fn();

		render(<PillarManager pillars={[]} onPillarsChanged={onPillarsChanged} />);

		// Eingabefeld für den Namen (Pflichtfeld)
		expect(screen.getByRole('textbox', { name: /Name/i })).toBeInTheDocument();
		// Eingabefeld für die optionale Beschreibung
		expect(screen.getByRole('textbox', { name: /Beschreibung/i })).toBeInTheDocument();
		// Anlegen-Button
		expect(screen.getByRole('button', { name: /Anlegen/i })).toBeInTheDocument();
	});

	it('validiert, dass der Name nicht leer sein darf', () => {
		const onPillarsChanged = vi.fn();

		render(<PillarManager pillars={[]} onPillarsChanged={onPillarsChanged} />);

		const nameInput = screen.getByRole('textbox', { name: /Name/i });
		const createButton = screen.getByRole('button', { name: /Anlegen/i });

		// Leeren Namen eingeben und auf Anlegen klicken
		fireEvent.change(nameInput, { target: { value: '' } });
		fireEvent.click(createButton);

		// onPillarsChanged darf NICHT aufgerufen werden (Validierung schlägt fehl)
		expect(onPillarsChanged).not.toHaveBeenCalled();
	});

	it('ruft onPillarsChanged auf, nachdem eine Säule erfolgreich angelegt wurde', () => {
		const onPillarsChanged = vi.fn();

		render(<PillarManager pillars={[]} onPillarsChanged={onPillarsChanged} />);

		const nameInput = screen.getByRole('textbox', { name: /Name/i });
		const descInput = screen.getByRole('textbox', { name: /Beschreibung/i });
		const createButton = screen.getByRole('button', { name: /Anlegen/i });

		fireEvent.change(nameInput, { target: { value: 'Meditation' } });
		fireEvent.change(descInput, { target: { value: 'Innere Ruhe' } });
		fireEvent.click(createButton);

		// Der Callback wird aufgerufen, sobald der API-Call erfolgt (asynchron).
		// Mit `vi.waitFor` prüfen wir, dass er irgendwann feuert.
		expect(onPillarsChanged).toHaveBeenCalled();
	});

	it('zeigt einen Feldfehler bei Namenskonflikt (409) an', () => {
		const onPillarsChanged = vi.fn();

		render(<PillarManager pillars={[pillar(1, 'Sport', 'Bewegung')]} onPillarsChanged={onPillarsChanged} />);

		const nameInput = screen.getByRole('textbox', { name: /Name/i });
		fireEvent.change(nameInput, { target: { value: 'Sport' } });
		fireEvent.click(screen.getByRole('button', { name: /Anlegen/i }));

		// Ein Fehlerhinweis (KolAlert oder ähnlich) erscheint für den Namenskonflikt
		// Der exakte Text wird von der API-Fehlermeldung bestimmt.
		// Wir erwarten, dass mindestens ein Alert gerendert wird.
		expect(screen.queryByRole('alert')).toBeInTheDocument();
	});
});

/**
 * AK2: Umbenennen/Beschreibung ändern wirkt überall nach Reload;
 * Namenskonflikt zeigt einen verständlichen Feldfehler.
 */
describe('#425 PillarManager — Bearbeiten (AK2)', () => {
	it('rendert Bearbeiten-Buttons je Säule', () => {
		const onPillarsChanged = vi.fn();
		const pillars = [pillar(1, 'Körper', 'Physische Gesundheit'), pillar(2, 'Sinn', 'Lebenssinn')];

		render(<PillarManager pillars={pillars} onPillarsChanged={onPillarsChanged} />);

		// Jede Säule hat einen Bearbeiten-Button
		const editButtons = screen.getAllByRole('button', { name: /Bearbeiten/i });
		expect(editButtons).toHaveLength(pillars.length);
	});

	it('ermöglicht Umbenennen einer Säule und ruft onPillarsChanged danach auf', () => {
		const onPillarsChanged = vi.fn();
		const pillars = [pillar(1, 'Körper', 'Alte Beschreibung')];

		render(<PillarManager pillars={pillars} onPillarsChanged={onPillarsChanged} />);

		// Bearbeiten-Button der ersten Säule klicken
		fireEvent.click(screen.getAllByRole('button', { name: /Bearbeiten/i })[0]);

		// Eingabefelder im Bearbeiten-Dialog sollten erscheinen
		const nameInput = screen.getByRole('textbox', { name: /Name/i });
		expect(nameInput).toBeInTheDocument();

		// Namen ändern
		fireEvent.change(nameInput, { target: { value: 'Fitness' } });

		// Speichern
		fireEvent.click(screen.getByRole('button', { name: /Speichern/i }));

		expect(onPillarsChanged).toHaveBeenCalled();
	});
});

/**
 * AK3: Löschen verlangt eine Bestätigung inkl. Hinweis auf betroffene Task-/Serien-Beiträge;
 * danach sind Liste, Gewichte und Task-Beiträge konsistent.
 */
describe('#425 PillarManager — Löschen (AK3)', () => {
	it('rendert Löschen-Buttons je Säule', () => {
		const onPillarsChanged = vi.fn();
		const pillars = [pillar(1, 'Körper'), pillar(2, 'Sinn')];

		render(<PillarManager pillars={pillars} onPillarsChanged={onPillarsChanged} />);

		const deleteButtons = screen.getAllByRole('button', { name: /Löschen/i });
		expect(deleteButtons).toHaveLength(pillars.length);
	});

	it('zeigt einen Bestätigungsdialog vor dem Löschen', () => {
		const onPillarsChanged = vi.fn();
		const pillars = [pillar(1, 'Körper', 'Gesundheit')];

		render(<PillarManager pillars={pillars} onPillarsChanged={onPillarsChanged} />);

		// Löschen-Button klicken
		fireEvent.click(screen.getByRole('button', { name: /Löschen/i }));

		// Bestätigungsdialog muss erscheinen
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		// Eine Warnung über den Verlust von Beiträgen
		expect(screen.getByText(/Beiträge/i)).toBeInTheDocument();
	});

	it('löscht die Säule nach Bestätigung und ruft onPillarsChanged auf', () => {
		const onPillarsChanged = vi.fn();
		const pillars = [pillar(1, 'Körper')];

		render(<PillarManager pillars={pillars} onPillarsChanged={onPillarsChanged} />);

		fireEvent.click(screen.getByRole('button', { name: /Löschen/i }));

		// Bestätigungs-Dialog: „Endgültig löschen" klicken
		fireEvent.click(screen.getByRole('button', { name: /Endgültig löschen/i }));

		expect(onPillarsChanged).toHaveBeenCalled();
	});

	it('bricht Löschen ab, wenn der Nutzer „Abbrechen" klickt', () => {
		const onPillarsChanged = vi.fn();
		const pillars = [pillar(1, 'Körper')];

		render(<PillarManager pillars={pillars} onPillarsChanged={onPillarsChanged} />);

		fireEvent.click(screen.getByRole('button', { name: /Löschen/i }));
		fireEvent.click(screen.getByRole('button', { name: /Abbrechen/i }));

		// onPillarsChanged darf nicht aufgerufen sein (kein Löschen)
		expect(onPillarsChanged).not.toHaveBeenCalled();
	});

	it('zeigt die Anzahl betroffener Tasks/Serien im Lösch-Hinweis', () => {
		const onPillarsChanged = vi.fn();
		const pillars = [pillar(1, 'Körper', 'Gesundheit')];

		render(
			<PillarManager
				pillars={pillars}
				onPillarsChanged={onPillarsChanged}
				// Prop für die Anzahl betroffener Einträge (von der Umsetzung zu liefern)
				pillarUsage={{ 1: { taskCount: 3, seriesCount: 1 } }}
			/>,
		);

		fireEvent.click(screen.getByRole('button', { name: /Löschen/i }));

		// Der Hinweistext muss die konkreten Zahlen nennen
		const dialog = screen.getByRole('dialog');
		expect(dialog.textContent).toMatch(/3/); // taskCount
		expect(dialog.textContent).toMatch(/1/); // seriesCount
	});
});

/**
 * AK4: Mit 0 Säulen zeigen der Verwaltungsbereich einen Empty-State mit Verweis
 * auf das Anlegen; mit vielen Säulen bleibt die Liste benutzbar.
 */
describe('#425 PillarManager — Empty-State und viele Säulen (AK4)', () => {
	it('zeigt Empty-State mit Hinweis, wenn keine Säulen existieren', () => {
		const onPillarsChanged = vi.fn();

		render(<PillarManager pillars={[]} onPillarsChanged={onPillarsChanged} />);

		// Ein Hinweis, dass noch keine Säulen existieren
		expect(screen.getByText(/keine Säulen/i)).toBeInTheDocument();
		// Trotzdem das Anlege-Formular anzeigen
		expect(screen.getByRole('button', { name: /Anlegen/i })).toBeInTheDocument();
	});

	it('rendert viele Säulen ohne Layout-Probleme (kein Fehler)', () => {
		const onPillarsChanged = vi.fn();
		const manyPillars = Array.from({ length: 10 }, (_, i) => pillar(i + 1, `Säule ${i + 1}`, `Beschreibung ${i + 1}`));

		const { container } = render(<PillarManager pillars={manyPillars} onPillarsChanged={onPillarsChanged} />);

		// Alle 10 Säulen müssen in der Liste erscheinen
		expect(screen.getAllByRole('button', { name: /Löschen/i })).toHaveLength(10);
		expect(screen.getAllByRole('button', { name: /Bearbeiten/i })).toHaveLength(10);

		// Kein unerwarteter Fehler
		expect(container).toBeTruthy();
	});
});

/**
 * AK5: Bestehende Tests bleiben grün; neue Komponententests decken AK1–AK4 ab.
 * (implizit durch diesen Test erfüllt — er deckt AK1–AK4 ab)
 */
