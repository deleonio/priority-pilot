import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpPage } from './HelpPage';

/**
 * Rote Spec-Tests für #1190 — „Changelog-Tab neben dem Handbuch" (Spec docs/spec/issue-1190.md).
 *
 * Vertrag: Die Hilfe-Seite bekommt KolTabs mit „Handbuch" (initial aktiv) und „Changelog".
 * Der Changelog-Tab lädt lazy beim ersten Aktivieren die letzten 30 GitHub-Releases und
 * rendert sie als flache Liste (Version als h2, de-DE-Datum in <time>, Body mit
 * ReactMarkdown); bei Ladefehler erscheint eine verständliche Meldung mit Retry-Pfad.
 *
 * jsdom rendert `<kol-tabs>` als nicht upgegradetes Element (Muster SettingsPage.test.tsx:301):
 * Panels bleiben im DOM und sind über `[slot="tab-N"]` prüfbar. Der @public-ui-React-Wrapper
 * setzt Objekt-Props als Properties auf das Element — deshalb sind `_tabs` (Labels) und
 * `_on.onSelect` (Tab-Wechsel) auch ohne Custom-Element-Upgrade direkt ansprechbar.
 * `fetch` ist global gemockt: `/user-guide.md` liefert Markdown, die GitHub-Releases-API
 * liefert je Test eine Fixture — kein Live-Abruf in Unit-Tests.
 */

const RELEASES_URL = 'https://api.github.com/repos/deleonio/priority-pilot/releases?per_page=30';

const USER_GUIDE_MD = '# Priority Pilot Handbuch\n\n- Erster Abschnitt';

const releasesFixture = [
	{
		tag_name: 'v0.1.695',
		published_at: '2026-09-02T10:00:00Z',
		body: '### 💥 Breaking Changes\n\n- Export entfernt',
	},
	{
		tag_name: 'v0.1.694',
		published_at: '2026-08-30T10:00:00Z',
		body: '### 🐛 Bug Fixes\n\n- Fehler behoben',
	},
];

let fetchMock: ReturnType<typeof vi.fn>;

const mdResponse = (text: string): Response =>
	({ ok: true, status: 200, statusText: 'OK', text: () => Promise.resolve(text) }) as unknown as Response;

const releasesResponse = (releases: unknown[]): Response =>
	({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(releases) }) as unknown as Response;

/** Ruft den Tab-Wechsel über den KolTabs-Callback auf (gleicher Pfad wie der echte Klick). */
const selectTab = (container: HTMLElement, selected: number): void => {
	const tabsEl = container.querySelector('kol-tabs');
	const on = (tabsEl as unknown as { _on?: { onSelect?: (event: Event, selected: number) => void } } | null)?._on;
	expect(on?.onSelect, 'KolTabs onSelect-Callback ist verdrahtet').toBeTypeOf('function');
	act(() => {
		on?.onSelect?.(new Event('click'), selected);
	});
};

describe('HelpPage – #1190: Changelog-Tab neben dem Handbuch', () => {
	beforeEach(() => {
		fetchMock = vi.fn((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('api.github.com')) {
				return Promise.resolve(releasesResponse(releasesFixture));
			}
			return Promise.resolve(mdResponse(USER_GUIDE_MD));
		});
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		cleanup();
	});

	it('AK1: KolTabs mit Labels [Handbuch, Changelog]; Handbuch bleibt nach Tab-Wechsel erhalten', async () => {
		const { container } = render(<HelpPage onBack={() => undefined} />);

		const tabsEl = container.querySelector('kol-tabs') as unknown as { _tabs?: { _label: string }[] } | null;
		expect(
			tabsEl?._tabs?.map((t) => t._label),
			'zwei Tabs, Handbuch zuerst (= initial aktiv)',
		).toEqual(['Handbuch', 'Changelog']);

		// Handbuch-Inhalt ist initial gerendert (Panel slot="tab-0" bleibt gemountet).
		await waitFor(() => {
			expect(panel(container, 'tab-0')?.querySelector('h1'), 'Handbuch-Überschrift im tab-0-Panel').toBeTruthy();
		});

		selectTab(container, 1);
		await waitFor(() => {
			expect(panel(container, 'tab-1')).toBeTruthy();
		});

		const guideCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('user-guide.md'));
		expect(guideCalls, 'Handbuch wird beim Tab-Wechsel nicht neu geladen').toHaveLength(1);
		expect(panel(container, 'tab-0')?.querySelector('h1'), 'Handbuch-Inhalt bleibt im DOM').toBeTruthy();
	});

	it('AK2: Changelog lädt lazy (kein API-Call bei Mount), per_page=30, neueste zuerst mit Version + de-DE-Datum', async () => {
		const { container } = render(<HelpPage onBack={() => undefined} />);

		// Lazy: vor dem ersten Aktivieren des Changelog-Tabs passiert kein GitHub-Call.
		await waitFor(() => {
			expect(panel(container, 'tab-0')?.querySelector('h1')).toBeTruthy();
		});
		expect(
			fetchMock.mock.calls.some(([input]) => String(input).includes('api.github.com')),
			'lazy: kein API-Call beim Betreten der Hilfe-Seite',
		).toBe(false);

		selectTab(container, 1);

		await waitFor(() => {
			expect(panel(container, 'tab-1')?.querySelectorAll('h2').length).toBeGreaterThan(0);
		});

		expect(
			fetchMock.mock.calls.map(([input]) => String(input)).find((url) => url.includes('api.github.com')),
			'URL fragt genau die letzten 30 Releases ab',
		).toBe(RELEASES_URL);

		const versions = Array.from(panel(container, 'tab-1')?.querySelectorAll('h2') ?? []).map((h2) => h2.textContent);
		expect(versions, 'flache Liste in API-Reihenfolge (neueste zuerst)').toEqual(['v0.1.695', 'v0.1.694']);

		const times = Array.from(panel(container, 'tab-1')?.querySelectorAll('time') ?? []);
		expect(times[0]?.getAttribute('datetime'), 'Datum maschinenlesbar (published_at)').toBe('2026-09-02T10:00:00Z');
		expect(times[0]?.textContent, 'sichtbares Datum de-DE formatiert').toBe('2.9.2026');
	});

	it('AK3: Release-Body wird gerendert — Kategorie-Abschnitte als h3, Items als li', async () => {
		const { container } = render(<HelpPage onBack={() => undefined} />);

		selectTab(container, 1);

		await waitFor(() => {
			expect(panel(container, 'tab-1')?.textContent).toContain('v0.1.695');
		});

		const changelog = panel(container, 'tab-1');
		expect(changelog?.querySelector('h3')?.textContent, 'Kategorie-Überschrift aus dem Body').toContain(
			'Breaking Changes',
		);
		expect(changelog?.querySelector('li')?.textContent, 'Body-Listen werden gerendert').toContain('Export entfernt');
	});

	it('AK5: bei Ladefehler verständliche Meldung, Handbuch unberührt, erneutes Aktivieren lädt erneut', async () => {
		fetchMock = vi.fn((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('api.github.com')) {
				return Promise.reject(new Error('rate limit'));
			}
			return Promise.resolve(mdResponse(USER_GUIDE_MD));
		});
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(<HelpPage onBack={() => undefined} />);
		await waitFor(() => {
			expect(panel(container, 'tab-0')?.querySelector('h1')).toBeTruthy();
		});

		selectTab(container, 1);

		await waitFor(() => {
			expect(panel(container, 'tab-1')?.textContent ?? '').toMatch(/konnte nicht geladen werden/i);
		});
		expect(panel(container, 'tab-0')?.querySelector('h1'), 'Handbuch-Tab bleibt funktionsfähig').toBeTruthy();

		// Recovery-Pfad (KI-UX): Weg- und Zurückschalten startet einen neuen Versuch.
		selectTab(container, 0);
		selectTab(container, 1);
		await waitFor(() => {
			const ghCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('api.github.com'));
			expect(ghCalls, 'Retry: API wird beim erneuten Aktivieren wieder aufgerufen').toHaveLength(2);
		});
	});
});

/** Slot-Container eines Tabs (KolTabs-Panel-Host; jsdom lässt alle Panels im DOM). */
function panel(container: HTMLElement, slot: string): HTMLElement | null {
	return container.querySelector(`[slot="${slot}"]`);
}
