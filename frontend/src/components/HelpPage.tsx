import { KolSelect, KolSpin, KolTabs } from '@public-ui/react-v19';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aggregateChangelog, entriesToMarkdown } from '../lib/changelog';

// Tab-Leiste der Hilfe-Seite (#1190). Modulkonstante, damit `KolTabs` nicht bei jedem Render
// eine neue Tab-Liste erhält (Muster SettingsPage.tsx). Reihenfolge: Handbuch (Index 0,
// initial aktiv), Changelog (Index 1).
const HELP_TABS = [{ _label: 'Handbuch' }, { _label: 'Changelog' }];

// Öffentliche GitHub-Releases-API (Repo ist public, kein Token nötig). Die API wird vollständig
// paginiert abgerufen (100 je Seite, Folgeseiten über den `Link`-Header); wie viel davon
// angezeigt wird, regelt der Auswahl-Regler im Changelog-Tab (30/100/alle). Renovate-/Dependabot-
// Einträge werden bereits upstream beim Release-Erzeugen ausgeschlossen (.github/release.yml),
// das Frontend filtert nichts.
const RELEASES_URL = 'https://api.github.com/repos/deleonio/priority-pilot/releases?per_page=100';

// Auswahl-Regler des Changelog-Tabs: Anzeige-Menge der Releases. Werte als String (KoliBri-
// Select-Option), Default „30" = bisheriges Verhalten. Der Wechsel schneidet nur client-seitig —
// kein erneuter Fetch.
const CHANGELOG_LIMIT_OPTIONS = [
	{ label: 'Letzte 30', value: '30' },
	{ label: 'Letzte 100', value: '100' },
	{ label: 'Alle', value: 'alle' },
];

type ChangelogLimit = (typeof CHANGELOG_LIMIT_OPTIONS)[number]['value'];

interface GithubRelease {
	tag_name: string;
	published_at: string;
	body: string | null;
}

/** Eintrag eines Hilfe-Inhaltsverzeichnisses: Anker-Id, Linktext, Ebene (2 = Haupt-, 3 = Unterabschnitt). */
interface HelpTocItem {
	id: string;
	text: string;
	level: 2 | 3;
}

// Externe Links (GitHub-PRs) verlassen die PWA — zentral für beide Tabs gesetzt, gilt für
// Markdown-Links und (seit #1206, via remark-gfm) Autolinks nackter URLs gleich (KI-UX).
//
// #1320: Die Markdown-Überschriften rücken zugleich eine Ebene tiefer. Das Handbuch ist ein für
// sich stehendes Dokument und beginnt mit `# Priority Pilot – Nutzerhandbuch`; seit die Hilfe im
// App-Layout steckt, trägt die Seite bereits die eine `<h1>` „Hilfe" (AK7). Ohne Verschiebung
// stünden zwei `<h1>` im Dokument und die Gliederung hätte zwei konkurrierende Wurzeln. `h6`
// bleibt `h6` — tiefer geht die HTML-Gliederung nicht (das Handbuch nutzt maximal `###`).
const MARKDOWN_COMPONENTS: Components = {
	a: ({ href, children }) => (
		<a href={href} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	),
	h1: ({ children }) => <h2>{children}</h2>,
	h2: ({ children }) => <h3>{children}</h3>,
	h3: ({ children }) => <h4>{children}</h4>,
	h4: ({ children }) => <h5>{children}</h5>,
	h5: ({ children }) => <h6>{children}</h6>,
};

/** URL der Folgeseite aus dem GitHub-`Link`-Header (`<…>; rel="next"`) — null, wenn erschöpft. */
const nextPageUrl = (linkHeader: string | null): string | null =>
	linkHeader?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;

// Die API liefert neueste zuerst — das Frontend rendert in API-Reihenfolge ohne eigene Sortierung.
const fetchReleases = async (): Promise<GithubRelease[]> => {
	const releases: GithubRelease[] = [];
	let url: string | null = RELEASES_URL;
	while (url) {
		const response = await fetch(url);
		if (!response.ok) throw new Error(response.statusText);
		releases.push(...((await response.json()) as GithubRelease[]));
		url = nextPageUrl(response.headers.get('Link'));
	}
	return releases;
};

/** Anker-tauglicher Slug: Umlaute transliteriert, Rest zu Bindestrichen gefaltet. */
const slugify = (text: string): string =>
	text
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

/** Flacht die Inline-Kinder einer Markdown-Überschrift zu reinem Text (Grundlage der Slug-Bildung). */
const headingText = (children: ReactNode): string => {
	if (typeof children === 'string' || typeof children === 'number') return String(children);
	if (Array.isArray(children)) return children.map((child) => headingText(child)).join('');
	if (typeof children === 'object' && children !== null && 'props' in children) {
		return headingText((children as { props: { children?: ReactNode } }).props.children);
	}
	return '';
};

/** Inhaltsverzeichnis als Linkliste; Ebene 3 (Unterabschnitte) eingerückt, ohne Einträge nicht gerendert. */
const HelpToc = ({ items, label }: { items: HelpTocItem[]; label: string }) =>
	items.length === 0 ? null : (
		<nav className="help-toc" aria-label={label}>
			<ul>
				{items.map((item) => (
					<li key={item.id} className={item.level === 3 ? 'help-toc-sub' : undefined}>
						<a href={`#${item.id}`}>{item.text}</a>
					</li>
				))}
			</ul>
		</nav>
	);

/** Lazy-Zustand des Changelog-Tabs: `idle`/`error` lösen beim Aktivieren einen (neuen) Versuch aus. */
type ChangelogState =
	{ status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'loaded'; releases: GithubRelease[] };

export const HelpPage = () => {
	const [content, setContent] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState(0);
	const [changelog, setChangelog] = useState<ChangelogState>({ status: 'idle' });
	const [limit, setLimit] = useState<ChangelogLimit>('30');

	useEffect(() => {
		fetch('/user-guide.md')
			.then((r) => {
				if (!r.ok) throw new Error(r.statusText);
				return r.text();
			})
			.then(setContent)
			.catch(() => setContent('# Hilfe\n\n- Handbuch konnte nicht geladen werden.'));
	}, []);

	// Inhaltsverzeichnis des Handbuchs: aus den Markdown-Quellzeilen (`##`/`###`) mit demselben
	// Slug-Zähler wie die Anker-Vergabe in `markdownComponents` — beide Durchläufe gehen die
	// Überschriften in Dokumentreihenfolge durch, Ids matchen also (Duplikate suffigen gleich).
	const guideToc = useMemo<HelpTocItem[]>(() => {
		if (content === null) return [];
		const items: HelpTocItem[] = [];
		const seen = new Map<string, number>();
		for (const line of content.split('\n')) {
			const match = /^(#{2,3}) (.+)$/.exec(line.trim());
			if (!match) continue;
			const base = slugify(match[2]) || 'abschnitt';
			const count = seen.get(base) ?? 0;
			seen.set(base, count + 1);
			items.push({
				id: count === 0 ? base : `${base}-${count + 1}`,
				text: match[2],
				level: match[1].length as 2 | 3,
			});
		}
		return items;
	}, [content]);

	// Anker-Ids der gerenderten Handbuch-Überschriften: frischer Slug-Zähler je Render-Durchlauf,
	// damit Ids deterministisch sind und bei Duplikaten deterministische Suffixe erhalten.
	const seenSlugs = new Map<string, number>();
	const slugForHeading = (children: ReactNode): string => {
		const base = slugify(headingText(children)) || 'abschnitt';
		const count = seenSlugs.get(base) ?? 0;
		seenSlugs.set(base, count + 1);
		return count === 0 ? base : `${base}-${count + 1}`;
	};
	const markdownComponents: Components = {
		...MARKDOWN_COMPONENTS,
		h1: ({ children }) => <h2 id={slugForHeading(children)}>{children}</h2>,
		h2: ({ children }) => <h3 id={slugForHeading(children)}>{children}</h3>,
		h3: ({ children }) => <h4 id={slugForHeading(children)}>{children}</h4>,
		h4: ({ children }) => <h5 id={slugForHeading(children)}>{children}</h5>,
	};

	// Stabile Callback-Identität, damit KolTabs nicht bei jedem Render neu verdrahtet (#323).
	// Abhängigkeit ist nur der Lazy-Zustand: Beim ersten Aktivieren des Changelog-Tabs wird
	// geladen; nach einem Ladefehler startet ein erneutes Anwählen einen neuen Versuch
	// (KI-UX Recovery-Pfad), nach erfolgreichem Laden wird nicht neu geladen.
	const tabsCallbacks = useMemo(
		() => ({
			onSelect: (_event: Event, selected: number): void => {
				setActiveTab(selected);
				if (selected === 1 && (changelog.status === 'idle' || changelog.status === 'error')) {
					setChangelog({ status: 'loading' });
					void fetchReleases()
						.then((releases) => setChangelog({ status: 'loaded', releases }))
						.catch(() => setChangelog({ status: 'error' }));
				}
			},
		}),
		[changelog.status],
	);

	// Angezeigte Kategorien (der Auswahl-Regler schneidet client-seitig) — Grundlage für die
	// Kategorien-Sektionen und das Changelog-Inhaltsverzeichnis.
	const changelogCategories =
		changelog.status === 'loaded'
			? aggregateChangelog(limit === 'alle' ? changelog.releases : changelog.releases.slice(0, Number(limit)))
			: [];
	const changelogToc: HelpTocItem[] = changelogCategories.map((category) => ({
		id: slugify(category.title),
		text: category.title,
		level: 2,
	}));

	return (
		// #1320: Seiteninhalt INNERHALB der App-Shell — kein eigenes `<main>` und keine eigene `<h1>`
		// mehr (beides trägt seit #1320 das App-Layout, AK7), und kein „Zurück"-Button (AK3): Header
		// und Kopf-Aktionen bleiben sichtbar, der Rückweg läuft über den aktiven Toolbar-Button.
		<div className="help-page">
			<KolTabs _label="Hilfe" _tabs={HELP_TABS} _selected={activeTab} _on={tabsCallbacks}>
				<div slot="tab-0" className="help-page-content">
					{content === null ? (
						<div className="help-page-loading">
							<KolSpin _show _variant="cycle" _label="Lädt Handbuch …" />
						</div>
					) : (
						// Layout: mobil TOC unter dem Text, ab Desktop 2/3 Text + 1/3 Sidebar (TOC).
						<div className="help-sidebar-layout help-sidebar-layout--sidebar-last">
							<div className="help-sidebar-main">
								<ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
									{content}
								</ReactMarkdown>
							</div>
							<aside className="help-sidebar-aside">
								<HelpToc items={guideToc} label="Inhaltsverzeichnis" />
							</aside>
						</div>
					)}
				</div>
				<div slot="tab-1" className="help-page-content">
					{changelog.status === 'loading' && (
						<div className="help-page-loading">
							<KolSpin _show _variant="cycle" _label="Lädt Changelog …" />
						</div>
					)}
					{changelog.status === 'error' && <p>Changelog konnte nicht geladen werden.</p>}
					{changelog.status === 'loaded' && (
						// Layout: mobil Auswahl-Regler + TOC über dem Text, ab Desktop 2/3 Text +
						// 1/3 Sidebar (Auswahl-Regler, TOC der Kategorien).
						<div className="help-sidebar-layout help-sidebar-layout--sidebar-first">
							<div className="help-sidebar-main">
								{changelogCategories.map((category) => (
									<section key={category.title} id={slugify(category.title)} className="help-changelog-category">
										{/* Aggregation nach Kategorien (#1206): Die Bodys gliedern sich in
												`###`-Abschnitte je Kategorie — zusammengefasst erscheint jede
												Kategorie genau einmal, die Entries tragen ihre Ursprungs-Version. */}
										<h2>{category.title}</h2>
										<ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
											{entriesToMarkdown(category.entries)}
										</ReactMarkdown>
									</section>
								))}
							</div>
							<aside className="help-sidebar-aside">
								<KolSelect
									_label="Anzeige"
									_options={CHANGELOG_LIMIT_OPTIONS}
									_value={limit}
									_on={{ onChange: (_event, value) => setLimit(value as ChangelogLimit) }}
								/>
								<HelpToc items={changelogToc} label="Changelog-Inhaltsverzeichnis" />
							</aside>
						</div>
					)}
				</div>
			</KolTabs>
		</div>
	);
};
