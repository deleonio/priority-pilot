import { KolButton, KolSpin, KolTabs } from '@public-ui/react-v19';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { aggregateChangelog, entriesToMarkdown } from '../lib/changelog';

interface HelpPageProps {
	onBack: () => void;
}

// Tab-Leiste der Hilfe-Seite (#1190). Modulkonstante, damit `KolTabs` nicht bei jedem Render
// eine neue Tab-Liste erhält (Muster SettingsPage.tsx). Reihenfolge: Handbuch (Index 0,
// initial aktiv), Changelog (Index 1).
const HELP_TABS = [{ _label: 'Handbuch' }, { _label: 'Changelog' }];

// Öffentliche GitHub-Releases-API (Repo ist public, kein Token nötig). Die letzten 30 Releases
// fix im Code — kein UI-Regler (KI-ANALYSE Annahme). Renovate-/Dependabot-Einträge werden
// bereits upstream beim Release-Erzeugen ausgeschlossen (.github/release.yml), das Frontend
// filtert nichts.
const RELEASES_URL = 'https://api.github.com/repos/deleonio/priority-pilot/releases?per_page=30';

interface GithubRelease {
	tag_name: string;
	published_at: string;
	body: string | null;
}

// Externe Links (GitHub-PRs) verlassen die PWA — zentral für beide Tabs gesetzt, gilt für
// Markdown-Links und (seit #1206, via remark-gfm) Autolinks nackter URLs gleich (KI-UX).
const MARKDOWN_COMPONENTS: Components = {
	a: ({ href, children }) => (
		<a href={href} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	),
};

// Die API liefert neueste zuerst — das Frontend rendert in API-Reihenfolge ohne eigene Sortierung.
const fetchReleases = (): Promise<GithubRelease[]> =>
	fetch(RELEASES_URL).then((r) => {
		if (!r.ok) throw new Error(r.statusText);
		return r.json() as Promise<GithubRelease[]>;
	});

/** Lazy-Zustand des Changelog-Tabs: `idle`/`error` lösen beim Aktivieren einen (neuen) Versuch aus. */
type ChangelogState =
	{ status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'loaded'; releases: GithubRelease[] };

export const HelpPage = ({ onBack }: HelpPageProps) => {
	const [content, setContent] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState(0);
	const [changelog, setChangelog] = useState<ChangelogState>({ status: 'idle' });

	useEffect(() => {
		fetch('/user-guide.md')
			.then((r) => {
				if (!r.ok) throw new Error(r.statusText);
				return r.text();
			})
			.then(setContent)
			.catch(() => setContent('# Hilfe\n\n- Handbuch konnte nicht geladen werden.'));
	}, []);

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

	return (
		<main className="help-page">
			<header className="help-page-header">
				<KolButton
					_label="Zurück"
					_icons={{ left: { icon: 'fa-solid fa-arrow-left' } }}
					_variant="secondary"
					_on={{ onClick: onBack }}
				/>
			</header>
			<KolTabs _label="Hilfe" _tabs={HELP_TABS} _selected={activeTab} _on={tabsCallbacks}>
				<div slot="tab-0" className="help-page-content">
					{content === null ? (
						<div className="help-page-loading">
							<KolSpin _show _variant="cycle" _label="Lädt Handbuch …" />
						</div>
					) : (
						<ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
							{content}
						</ReactMarkdown>
					)}
				</div>
				<div slot="tab-1" className="help-page-content">
					{changelog.status === 'loading' && (
						<div className="help-page-loading">
							<KolSpin _show _variant="cycle" _label="Lädt Changelog …" />
						</div>
					)}
					{changelog.status === 'error' && <p>Changelog konnte nicht geladen werden.</p>}
					{changelog.status === 'loaded' &&
						aggregateChangelog(changelog.releases).map((category) => (
							<section key={category.title} className="help-changelog-category">
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
			</KolTabs>
		</main>
	);
};
