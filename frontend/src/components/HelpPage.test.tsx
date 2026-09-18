import { act, cleanup, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpPage } from './HelpPage';

/**
 * Rote Spec-Tests für #1190 — „Changelog-Tab neben dem Handbuch" (Spec docs/spec/issue-1190.md).
 *
 * Vertrag: Die Hilfe-Seite bekommt KolTabs mit „Handbuch" (initial aktiv) und „Changelog".
 * Der Changelog-Tab lädt lazy beim ersten Aktivieren die GitHub-Releases vollständig (paginiert,
 * 100 je Seite); seit #1206 werden die Bodys nach Kategorien aggregiert (Struktur siehe
 * #1206-Describe unten); die Anzeige-Menge (30/100/alle) schneidet client-seitig; bei
 * Ladefehler erscheint eine verständliche Meldung mit Retry-Pfad.
 *
 * jsdom rendert `<kol-tabs>` als nicht upgegradetes Element (Muster SettingsPage.test.tsx:301):
 * Panels bleiben im DOM und sind über `[slot="tab-N"]` prüfbar. Der @public-ui-React-Wrapper
 * setzt Objekt-Props als Properties auf das Element — deshalb sind `_tabs` (Labels) und
 * `_on.onSelect` (Tab-Wechsel) auch ohne Custom-Element-Upgrade direkt ansprechbar.
 * `fetch` ist global gemockt: `/user-guide.md` liefert Markdown, die GitHub-Releases-API
 * liefert je Test eine Fixture — kein Live-Abruf in Unit-Tests.
 */

const RELEASES_URL = 'https://api.github.com/repos/deleonio/priority-pilot/releases?per_page=100';

const USER_GUIDE_MD = [
	'# Priority Pilot Handbuch',
	'',
	'## Erster Abschnitt',
	'',
	'- Bullet',
	'',
	'### Unterabschnitt',
	'',
	'Absatz.',
	'',
	'## Duplikat',
	'',
	'Noch ein Absatz.',
	'',
	'## Duplikat',
	'',
	'Schluss.',
].join('\n');

// #1320 (Test-Pflege): Die Handbuch-Überschrift wird als `h2` gerendert, nicht mehr als `h1` —
// die eine `<h1>` der Ansicht trägt seit dem Layout-Umbau das App-Layout („Hilfe", AK7), die
// Markdown-Ebenen rücken dafür um eins tiefer (siehe MARKDOWN_COMPONENTS in HelpPage.tsx).
const GUIDE_HEADING = 'h2';

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

const releasesResponse = (releases: unknown[], link?: string): Response =>
	({
		ok: true,
		status: 200,
		statusText: 'OK',
		json: () => Promise.resolve(releases),
		headers: new Headers(link ? { Link: link } : {}),
	}) as unknown as Response;

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

	it('AK1: KolTabs mit Labels [Handbuch, Feedback, Impressum, Changelog]; Handbuch bleibt nach Tab-Wechsel erhalten', async () => {
		const { container } = render(<HelpPage />);

		const tabsEl = container.querySelector('kol-tabs') as unknown as { _tabs?: { _label: string }[] } | null;
		expect(
			tabsEl?._tabs?.map((t) => t._label),
			'vier Tabs (Feedback seit #1435), Handbuch zuerst (= initial aktiv)',
		).toEqual(['Handbuch', 'Feedback', 'Impressum', 'Changelog']);

		// Handbuch-Inhalt ist initial gerendert (Panel slot="tab-0" bleibt gemountet).
		await waitFor(() => {
			expect(
				panel(container, 'tab-0')?.querySelector(GUIDE_HEADING),
				'Handbuch-Überschrift im tab-0-Panel',
			).toBeTruthy();
		});

		selectTab(container, 3);
		await waitFor(() => {
			expect(panel(container, 'tab-3')).toBeTruthy();
		});

		const guideCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('user-guide.md'));
		expect(guideCalls, 'Handbuch wird beim Tab-Wechsel nicht neu geladen').toHaveLength(1);
		expect(panel(container, 'tab-0')?.querySelector(GUIDE_HEADING), 'Handbuch-Inhalt bleibt im DOM').toBeTruthy();
	});

	it('AK2: Changelog lädt lazy (kein API-Call bei Mount), paginiert (100 je Seite), neueste zuerst mit Version + de-DE-Datum', async () => {
		const { container } = render(<HelpPage />);

		// Lazy: vor dem ersten Aktivieren des Changelog-Tabs passiert kein GitHub-Call.
		await waitFor(() => {
			expect(panel(container, 'tab-0')?.querySelector(GUIDE_HEADING)).toBeTruthy();
		});
		expect(
			fetchMock.mock.calls.some(([input]) => String(input).includes('api.github.com')),
			'lazy: kein API-Call beim Betreten der Hilfe-Seite',
		).toBe(false);

		selectTab(container, 3);

		// #1206 hat die h2-je-Release-/`<time>`-Struktur durch Kategorien-Aggregation ersetzt:
		// Ready-Marker ist jetzt die erste Kategorie-Überschrift (Test-Pflege zu #1190).
		await waitFor(() => {
			expect(panel(container, 'tab-3')?.textContent).toContain('Breaking Changes');
		});

		expect(
			fetchMock.mock.calls.map(([input]) => String(input)).find((url) => url.includes('api.github.com')),
			'URL fragt die erste Seite mit 100 Releases ab',
		).toBe(RELEASES_URL);
	});

	it('AK3: Release-Body wird gerendert — Kategorie-Abschnitte als Überschrift, Items als li', async () => {
		const { container } = render(<HelpPage />);

		selectTab(container, 3);

		await waitFor(() => {
			expect(panel(container, 'tab-3')?.textContent).toContain('v0.1.695');
		});

		const changelog = panel(container, 'tab-3');
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

		const { container } = render(<HelpPage />);
		await waitFor(() => {
			expect(panel(container, 'tab-0')?.querySelector(GUIDE_HEADING)).toBeTruthy();
		});

		selectTab(container, 3);

		await waitFor(() => {
			expect(panel(container, 'tab-3')?.textContent ?? '').toMatch(/konnte nicht geladen werden/i);
		});
		expect(panel(container, 'tab-0')?.querySelector(GUIDE_HEADING), 'Handbuch-Tab bleibt funktionsfähig').toBeTruthy();

		// Recovery-Pfad (KI-UX): Weg- und Zurückschalten startet einen neuen Versuch.
		selectTab(container, 0);
		selectTab(container, 3);
		await waitFor(() => {
			const ghCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('api.github.com'));
			expect(ghCalls, 'Retry: API wird beim erneuten Aktivieren wieder aufgerufen').toHaveLength(2);
		});
	});
});

describe('HelpPage – Impressum-Tab (§ 5 DDG)', () => {
	// Impressum ist statisch (kein Fetch); jsdom lässt alle Panels im DOM, daher über den
	// Tab-Wechsel prüfbar wie die anderen Panels.
	it('dritter Reiter „Impressum" rendert die Pflichtangaben-Struktur', async () => {
		const { container } = render(<HelpPage />);

		selectTab(container, 2);

		const impress = panel(container, 'tab-2');
		expect(impress?.querySelector('h2')?.textContent, 'Überschrift Impressum').toBe('Impressum');
		expect(impress?.textContent, '§ 5 DDG als Rechtsgrundlage genannt').toContain('Angaben gemäß § 5 DDG');
		expect(impress?.textContent, 'Kontakt-Pflichtangabe E-Mail').toContain('E-Mail:');
		expect(impress?.querySelector('a[href^="mailto:"]'), 'E-Mail als mailto-Link').toBeTruthy();
	});
});

describe('HelpPage – #1206: Kategorien-Aggregation und klickbare Links', () => {
	// Fixture mit Kategorie-Struktur wie sie .github/release.yml erzeugt: v0.1.695 mit
	// Breaking Changes + Bug Fixes (inkl. nackter Repo-URL, Markdown-Repo-Link und
	// Markdown-Fremdlink, AK1), v0.1.694 mit Bug Fixes + Other Changes. Der „Other Changes“-
	// Bullet von v0.1.695 ist im REALEN GitHub-Format (`<Subject> by @<user> in <URL>`,
	// wie CHANGELOG.md) — Regression dafür, dass die Attribution mit der URL verschwindet
	// und kein Satzfragment übrig bleibt. New Features/Improvements/Engineering fehlen
	// bewusst — leere Kategorien dürfen nicht erscheinen (AK2). Führender HTML-Kommentar
	// wie bei echten Release-Bodys.
	const releases695and694 = [
		{
			tag_name: 'v0.1.695',
			published_at: '2026-09-02T10:00:00Z',
			body: [
				'<!-- Release notes generated by GitHub -->',
				'### 💥 Breaking Changes\n\n- Export entfernt',
				'### 🐞 Bug Fixes\n\n- Absturz beim Speichern behoben, siehe https://github.com/deleonio/priority-pilot/pull/1203',
				'### Other Changes\n\n- Speichern beschleunigt ([#1204](https://github.com/deleonio/priority-pilot/pull/1204))\n- docs(guide): sync user guide by @deleonio in https://github.com/deleonio/priority-pilot/pull/1403',
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
		Array.from(panel(container, 'tab-3')?.querySelectorAll('h2, h3') ?? []).map((h) => h.textContent ?? '');

	it('AK1: Markdown-Links zu Fremdseiten werden zu <a href>, Repo-Verlinkungen im Changelog werden entfernt', async () => {
		const { container } = render(<HelpPage />);

		selectTab(container, 3);

		await waitFor(() => {
			expect(panel(container, 'tab-3')?.querySelectorAll('li').length).toBeGreaterThan(0);
		});

		const changelog = panel(container, 'tab-3');
		// Repo-URLs (nackte Autolinks wie Markdown-Links) fließen nicht als Verlinkung ein —
		// der Changelog-Tab soll nicht auf die eigene GitHub-Historie verlinken.
		expect(
			changelog?.querySelector('a[href*="github.com/deleonio/priority-pilot"]'),
			'keine Repo-Links im Changelog',
		).toBeNull();
		expect(changelog?.textContent, 'nackte Repo-URL fällt als Text weg').not.toContain(
			'https://github.com/deleonio/priority-pilot',
		);
		expect(changelog?.textContent, 'Markdown-Repo-Link behält seinen Linktext').toContain('#1204');
		expect(changelog?.textContent, 'Bullet-Text selbst bleibt erhalten').toContain('Absturz beim Speichern');
		// Reales GitHub-Format (`Subject by @user in <URL>`): weder die URL noch ein
		// Attributions-Fragment darf übrig bleiben, der Subject-Text schon.
		expect(changelog?.textContent, 'Attribution fällt mit der URL weg').not.toContain('by @deleonio in');
		expect(changelog?.textContent, 'Subject des reale-Format-Bullets bleibt').toContain('sync user guide');
		// Markdown-Link zu einer Fremdseite bleibt erhalten.
		expect(
			changelog?.querySelector('a[href="https://example.com/hilfe"]'),
			'Markdown-Link wird als Link gerendert',
		).toBeTruthy();
	});

	it('AK2: Je Kategorie genau eine Überschrift, feste Reihenfolge, leere Kategorien entfallen; Bullets aller Versionen unter derselben Kategorie', async () => {
		const { container } = render(<HelpPage />);

		selectTab(container, 3);

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
		const headingEls = Array.from(panel(container, 'tab-3')?.querySelectorAll('h2, h3') ?? []);
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
		const liTexts = Array.from(panel(container, 'tab-3')?.querySelectorAll('li') ?? [])
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
		const { container } = render(<HelpPage />);

		selectTab(container, 3);

		await waitFor(() => {
			expect(categoryHeadings(container).length).toBeGreaterThan(0);
		});

		const lis = Array.from(panel(container, 'tab-3')?.querySelectorAll('.help-sidebar-main li') ?? []);
		const liTexts = lis.map((li) => li.textContent ?? '');
		// Bullet-Summe der Fixture-Bodys: 695 = 4 (Export, Absturz, #1204, sync user guide),
		// 694 = 2 (Fehler, Aufräumarbeiten).
		expect(lis, 'Anzahl Einträge = Summe aller Bullets').toHaveLength(6);
		// Jeder Bullet zeigt seine Ursprungs-Version im Text (Klammer-Suffix o. Ä.).
		for (const text of liTexts) {
			expect(text, `Bullet nennt Ursprungs-Version: "${text.slice(0, 40)}…"`).toMatch(/v0\.1\.69[45]/);
		}
		// Der HTML-Kommentar aus dem Body wird nicht als Eintrag gerendert.
		expect(liTexts.join(' '), 'Release-notes-Kommentar fließt nicht ein').not.toContain('Release notes generated');
	});
});

describe('HelpPage – Pagination und Auswahl der Anzeige-Menge (30/100/alle)', () => {
	// 35 Releases über zwei Seiten: Seite 1 (30 Stück) mit `Link`-Header auf Seite 2 (5 Stück,
	// ohne weiteren Link) — Deckung für den Folgeseiten-Nachlauf über den Link-Header.
	const pageOne = Array.from({ length: 30 }, (_, i) => ({
		tag_name: `v0.1.${600 - i}`,
		published_at: '2026-09-02T10:00:00Z',
		body: `### 🐞 Bug Fixes\n\n- Fix ${i}`,
	}));
	const pageTwo = Array.from({ length: 5 }, (_, i) => ({
		tag_name: `v0.1.${570 - i}`,
		published_at: '2026-08-30T10:00:00Z',
		body: `### 🐞 Bug Fixes\n\n- Fix ${30 + i}`,
	}));
	const PAGE_TWO_URL = `${RELEASES_URL}&page=2`;

	beforeEach(() => {
		fetchMock = vi.fn((input: RequestInfo | URL) => {
			const url = String(input);
			if (url === RELEASES_URL) return Promise.resolve(releasesResponse(pageOne, `<${PAGE_TWO_URL}>; rel="next"`));
			if (url === PAGE_TWO_URL) return Promise.resolve(releasesResponse(pageTwo));
			return Promise.resolve(mdResponse(USER_GUIDE_MD));
		});
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		cleanup();
	});

	/** Löst den onChange-Callback des KolSelect über den Wrapper-Pfad aus (jsdom hydratiert nicht). */
	const changeLimit = (container: HTMLElement, value: string): void => {
		const selectEl = panel(container, 'tab-3')?.querySelector('kol-select');
		const on = (selectEl as unknown as { _on?: { onChange?: (event: Event, value: string) => void } } | null)?._on;
		expect(on?.onChange, 'KolSelect onChange-Callback ist verdrahtet').toBeTypeOf('function');
		act(() => {
			on?.onChange?.(new Event('change'), value);
		});
	};

	const changelogEntries = (container: HTMLElement): string[] =>
		Array.from(panel(container, 'tab-3')?.querySelectorAll('.help-sidebar-main li') ?? []).map(
			(li) => li.textContent ?? '',
		);

	// Test-Pflege zu PR #1432 Finding #1: Der Default „Letzte 30" lädt nur noch Seite 1 (deckt
	// die Fixture mit exakt 30 Einträgen bereits ab) statt eagerly die volle Historie; erst „Alle"
	// löst das Nachladen der Folgeseite über den Link-Header aus.
	it('lädt initial nur Seite 1; „Alle" lädt die Folgeseite nach, „Letzte 100" braucht danach keinen weiteren Fetch', async () => {
		const { container } = render(<HelpPage />);

		selectTab(container, 3);
		await waitFor(() => {
			expect(changelogEntries(container)).toHaveLength(30);
		});

		expect(
			fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.includes('api.github.com')),
			'Default „30" genügt Seite 1',
		).toEqual([RELEASES_URL]);

		// „Alle" verlangt mehr als geladen ist → Folgeseite wird nachgeladen.
		changeLimit(container, 'alle');
		await waitFor(() => {
			expect(changelogEntries(container), '„Alle" zeigt alle 35 Einträge').toHaveLength(35);
		});
		expect(
			fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.includes('api.github.com')),
			'Folgeseite wird erst bei Bedarf nachgeladen',
		).toEqual([RELEASES_URL, PAGE_TWO_URL]);

		// „Letzte 100" bei bereits vollständig geladenen 35 Releases: kein erneuter Fetch.
		changeLimit(container, '100');
		expect(changelogEntries(container), '„Letzte 100" zeigt alle vorhandenen 35').toHaveLength(35);
		expect(
			fetchMock.mock.calls.filter(([input]) => String(input).includes('api.github.com')),
			'kein weiterer Fetch, da bereits vollständig geladen',
		).toHaveLength(2);
	});
});

describe('HelpPage – Inhaltsverzeichnis in der Sidebar (Handbuch + Changelog)', () => {
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

	it('Handbuch: TOC listet ##/###-Abschnitte, jeder Link trifft eine vorhandene Anker-Id (Duplikate suffigen)', async () => {
		const { container } = render(<HelpPage />);

		await waitFor(() => {
			expect(panel(container, 'tab-0')?.querySelector(GUIDE_HEADING)).toBeTruthy();
		});

		const toc = Array.from(panel(container, 'tab-0')?.querySelectorAll('.help-toc a') ?? []);
		expect(toc.map((a) => a.textContent)).toEqual(['Erster Abschnitt', 'Unterabschnitt', 'Duplikat', 'Duplikat']);
		for (const link of toc) {
			const id = (link.getAttribute('href') ?? '').slice(1);
			expect(id, 'jeder Link trägt einen Anker').not.toBe('');
			expect(panel(container, 'tab-0')?.querySelector(`[id="${id}"]`), `Anker-Ziel #${id} existiert`).toBeTruthy();
		}
		expect(
			panel(container, 'tab-0')?.querySelector('[id="duplikat-2"]'),
			'Duplikat erhält deterministisches Suffix',
		).toBeTruthy();
		expect(
			panel(container, 'tab-0')?.querySelector('.help-toc .help-toc-sub')?.textContent,
			'Unterabschnitte sind als Ebene 3 markiert',
		).toContain('Unterabschnitt');
	});

	// Regressionstest zu PR #1432 Finding #2: Anker-Vergabe zählte bislang während des Renderns
	// (Map-Mutation in den Heading-Komponenten) — unter `StrictMode` (doppelter Render-Aufruf je
	// Komponente) liefen TOC-Links dadurch ins Leere. Der Fix vergibt Ids in einem einzigen reinen
	// `useMemo`-Durchlauf und schlägt sie beim Rendern nur noch per Zeilen-Lookup nach.
	it('Handbuch: TOC-Links treffen auch unter <StrictMode> ein vorhandenes Anker-Ziel', async () => {
		const { container } = render(
			<StrictMode>
				<HelpPage />
			</StrictMode>,
		);

		await waitFor(() => {
			expect(panel(container, 'tab-0')?.querySelector(GUIDE_HEADING)).toBeTruthy();
		});

		const toc = Array.from(panel(container, 'tab-0')?.querySelectorAll('.help-toc a') ?? []);
		expect(toc.length, 'Handbuch-TOC hat Einträge').toBeGreaterThan(0);
		for (const link of toc) {
			const id = (link.getAttribute('href') ?? '').slice(1);
			expect(id, 'jeder Link trägt einen Anker').not.toBe('');
			expect(
				panel(container, 'tab-0')?.querySelector(`[id="${id}"]`),
				`Anker-Ziel #${id} existiert auch unter StrictMode`,
			).toBeTruthy();
		}
	});

	it('Changelog: TOC listet die Kategorien, Links treffen die Kategorie-Sektionen; Select bleibt in der Sidebar', async () => {
		const { container } = render(<HelpPage />);

		selectTab(container, 3);
		await waitFor(() => {
			expect(panel(container, 'tab-3')?.querySelector('.help-toc a')).toBeTruthy();
		});

		const toc = Array.from(panel(container, 'tab-3')?.querySelectorAll('.help-toc a') ?? []);
		expect(toc.map((a) => a.textContent)).toEqual(['💥 Breaking Changes', '🐞 Bug Fixes']);
		for (const link of toc) {
			const id = (link.getAttribute('href') ?? '').slice(1);
			expect(
				panel(container, 'tab-3')?.querySelector(`section[id="${id}"]`),
				`Kategorie-Sektion #${id} existiert`,
			).toBeTruthy();
		}
		expect(
			panel(container, 'tab-3')?.querySelector('.help-sidebar-aside kol-select'),
			'Auswahl-Regler sitzt in der Sidebar',
		).toBeTruthy();
	});
});

/** Slot-Container eines Tabs (KolTabs-Panel-Host; jsdom lässt alle Panels im DOM). */
function panel(container: HTMLElement, slot: string): HTMLElement | null {
	return container.querySelector(`[slot="${slot}"]`);
}
