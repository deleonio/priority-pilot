import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpPage } from './HelpPage';

/**
 * Rote Spec-Tests für #1190 — „Changelog-Tab neben dem Handbuch" (Spec docs/spec/issue-1190.md).
 *
 * Vertrag: Die Hilfe-Seite bekommt KolTabs mit „Handbuch" (initial aktiv) und „Changelog".
 * Der Changelog-Tab lädt lazy beim ersten Aktivieren die letzten 30 GitHub-Releases; seit
 * #1206 werden die Bodys nach Kategorien aggregiert (Struktur siehe #1206-Describe unten);
 * bei Ladefehler erscheint eine verständliche Meldung mit Retry-Pfad.
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

		// #1206 hat die h2-je-Release-/`<time>`-Struktur durch Kategorien-Aggregation ersetzt:
		// Ready-Marker ist jetzt die erste Kategorie-Überschrift (Test-Pflege zu #1190).
		await waitFor(() => {
			expect(panel(container, 'tab-1')?.textContent).toContain('Breaking Changes');
		});

		expect(
			fetchMock.mock.calls.map(([input]) => String(input)).find((url) => url.includes('api.github.com')),
			'URL fragt genau die letzten 30 Releases ab',
		).toBe(RELEASES_URL);
	});

	it('AK3: Release-Body wird gerendert — Kategorie-Abschnitte als Überschrift, Items als li', async () => {
		const { container } = render(<HelpPage onBack={() => undefined} />);

		selectTab(container, 1);

		await waitFor(() => {
			expect(panel(container, 'tab-1')?.textContent).toContain('v0.1.695');
		});

		const changelog = panel(container, 'tab-1');
		expect(changelog?.textContent, 'Kategorie-Überschrift aus dem Body').toContain('Breaking Changes');
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

describe('HelpPage – #1206: Kategorien-Aggregation und klickbare Links', () => {
	// Fixture mit Kategorie-Struktur wie sie .github/release.yml erzeugt: v0.1.695 mit
	// Breaking Changes + Bug Fixes (inkl. nackter URL und Markdown-Link, AK1), v0.1.694
	// mit Bug Fixes + Other Changes. New Features/Improvements/Engineering fehlen bewusst —
	// leere Kategorien dürfen nicht erscheinen (AK2). Führender HTML-Kommentar wie bei
	// echten Release-Bodys.
	const releases695and694 = [
		{
			tag_name: 'v0.1.695',
			published_at: '2026-09-02T10:00:00Z',
			body: [
				'<!-- Release notes generated by GitHub -->',
				'### 💥 Breaking Changes\n\n- Export entfernt',
				'### 🐞 Bug Fixes\n\n- Absturz beim Speichern behoben, siehe https://github.com/deleonio/priority-pilot/pull/1203',
			].join('\n\n'),
		},
		{
			tag_name: 'v0.1.694',
			published_at: '2026-08-30T10:00:00Z',
			body: '### 🐞 Bug Fixes\n\n- Fehler behoben ([Handbuch](https://example.com/hilfe) aktualisiert)\n\n### Other Changes\n\n- Aufräumarbeiten',
		},
	];

	beforeEach(() => {
		fetchMock = vi.fn((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes('api.github.com')) {
				return Promise.resolve(releasesResponse(releases695and694));
			}
			return Promise.resolve(mdResponse(USER_GUIDE_MD));
		});
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		cleanup();
	});

	/** Textinhalte aller Kategorie-Überschriften (h2/h3) im Changelog-Panel, in DOM-Reihenfolge. */
	const categoryHeadings = (container: HTMLElement): string[] =>
		Array.from(panel(container, 'tab-1')?.querySelectorAll('h2, h3') ?? []).map((h) => h.textContent ?? '');

	it('AK1: Nackte URLs und Markdown-Links werden zu echten <a href> gerendert', async () => {
		const { container } = render(<HelpPage onBack={() => undefined} />);

		selectTab(container, 1);

		await waitFor(() => {
			expect(panel(container, 'tab-1')?.querySelectorAll('li').length).toBeGreaterThan(0);
		});

		const changelog = panel(container, 'tab-1');
		// Autolink: nackte URL im Body (react-markdown ohne GFM linkifiziert sie nicht → rot).
		expect(changelog?.querySelector('a[href*="pull/1203"]'), 'nackte URL wird als Link gerendert').toBeTruthy();
		// Markdown-Link [Text](url) bleibt erhalten.
		expect(
			changelog?.querySelector('a[href="https://example.com/hilfe"]'),
			'Markdown-Link wird als Link gerendert',
		).toBeTruthy();
	});

	it('AK2: Je Kategorie genau eine Überschrift, feste Reihenfolge, leere Kategorien entfallen; Bullets aller Versionen unter derselben Kategorie', async () => {
		const { container } = render(<HelpPage onBack={() => undefined} />);

		selectTab(container, 1);

		await waitFor(() => {
			expect(categoryHeadings(container).length).toBeGreaterThan(0);
		});

		const headings = categoryHeadings(container);
		// Genau eine Überschrift je Kategorie: „Bug Fixes" kommt in beiden Releases vor.
		const bugFixHeadings = headings.filter((h) => h.includes('Bug Fixes'));
		expect(bugFixHeadings, 'Bug Fixes erscheint genau einmal (aggregiert)').toHaveLength(1);

		// Reihenfolge wie .github/release.yml; fehlende Kategorien (New Features,
		// Improvements, Engineering) erscheinen nicht.
		const order = ['Breaking Changes', 'Bug Fixes', 'Other Changes'];
		const positions = order.map((cat) => headings.findIndex((h) => h.includes(cat)));
		expect(positions, 'alle erwarteten Kategorien vorhanden').not.toContain(-1);
		expect(
			[...positions].sort((a, b) => a - b),
			'Kategorie-Reihenfolge entspricht release.yml',
		).toEqual(positions);
		expect(
			headings.some((h) => h.includes('New Features') || h.includes('Improvements') || h.includes('Engineering')),
			'leere Kategorien erscheinen nicht',
		).toBe(false);

		// Bug-Fix-Bullets beider Versionen unter demselben (einzigen) Bug-Fix-Abschnitt:
		// Bullets, die im DOM NACH der Bug-Fix-Überschrift und VOR der nächsten Kategorie-
		// Überschrift liegen.
		const headingEls = Array.from(panel(container, 'tab-1')?.querySelectorAll('h2, h3') ?? []);
		const bugFixHeading = headingEls.find((h) => (h.textContent ?? '').includes('Bug Fixes'));
		expect(bugFixHeading, 'Bug-Fix-Überschrift existiert').toBeTruthy();
		const nextHeading = headingEls[headingEls.indexOf(bugFixHeading!) + 1];
		const isBetween = (li: Element): boolean => {
			if (!bugFixHeading) return false;
			const afterBugFix = bugFixHeading.compareDocumentPosition(li) & Node.DOCUMENT_POSITION_FOLLOWING;
			const beforeNext = nextHeading
				? nextHeading.compareDocumentPosition(li) & Node.DOCUMENT_POSITION_PRECEDING
				: true;
			return Boolean(afterBugFix && beforeNext);
		};
		const liTexts = Array.from(panel(container, 'tab-1')?.querySelectorAll('li') ?? [])
			.filter(isBetween)
			.map((li) => li.textContent ?? '');
		expect(
			liTexts.some((t) => t.includes('Absturz beim Speichern')),
			'Bullet v0.1.695 im Bug-Fix-Block',
		).toBe(true);
		expect(
			liTexts.some((t) => t.includes('Fehler behoben')),
			'Bullet v0.1.694 im selben Bug-Fix-Block',
		).toBe(true);
	});

	it('AK3: Kein Eintrag geht verloren — li-Gesamtzahl = Bullet-Summe; Ursprungs-Version je Bullet sichtbar', async () => {
		const { container } = render(<HelpPage onBack={() => undefined} />);

		selectTab(container, 1);

		await waitFor(() => {
			expect(categoryHeadings(container).length).toBeGreaterThan(0);
		});

		const lis = Array.from(panel(container, 'tab-1')?.querySelectorAll('li') ?? []);
		const liTexts = lis.map((li) => li.textContent ?? '');
		// Bullet-Summe der Fixture-Bodys: 695 = 2 (Export, Absturz), 694 = 2 (Fehler, Aufräumarbeiten).
		expect(lis, 'Anzahl Einträge = Summe aller Bullets').toHaveLength(4);
		// Jeder Bullet zeigt seine Ursprungs-Version im Text (Klammer-Suffix o. Ä.).
		for (const text of liTexts) {
			expect(text, `Bullet nennt Ursprungs-Version: "${text.slice(0, 40)}…"`).toMatch(/v0\.1\.69[45]/);
		}
		// Der HTML-Kommentar aus dem Body wird nicht als Eintrag gerendert.
		expect(liTexts.join(' '), 'Release-notes-Kommentar fließt nicht ein').not.toContain('Release notes generated');
	});
});

/** Slot-Container eines Tabs (KolTabs-Panel-Host; jsdom lässt alle Panels im DOM). */
function panel(container: HTMLElement, slot: string): HTMLElement | null {
	return container.querySelector(`[slot="${slot}"]`);
}
