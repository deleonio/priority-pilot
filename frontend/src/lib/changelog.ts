/**
 * Aggregiert GitHub-Release-Bodys nach Kategorien (#1206).
 *
 * Die Bodys werden serverseitig von GitHub aus `.github/release.yml` erzeugt: je Kategorie ein
 * `### <Emoji> <Name>`-Abschnitt mit `- `-Bullets. Diese Logik sammelt die Abschnitte aller
 * Releases (API-Reihenfolge: neueste zuerst), ordnet sie der festen Kategorie-Reihenfolge aus
 * der release.yml zu und hängt jeden Bullet mit seiner Ursprungs-Version zusammen — der
 * Changelog-Tab zeigt damit je Kategorie EINEN Block statt einer Sektion je Release.
 *
 * Ignoriert wird alles, was keinem Kategorie-Abschnitt angehört: der führende
 * `<!-- Release notes generated … -->`-HTML-Kommentar und die `**Full Changelog**:`-Zeile
 * (steht ohne `###`-Header am Body-Ende). Abschnitte, deren Name keiner bekannten Kategorie
 * entspricht, werden verworfen — unbekannte Überschriften erzeugt die release.yml nicht.
 */

/** Anzeige-Titel der Kategorien in der Reihenfolge von `.github/release.yml`. */
const CATEGORY_TITLES = [
	'💥 Breaking Changes',
	'🎉 New Features',
	'🐞 Bug Fixes',
	'🚀 Improvements',
	'🔧 Engineering',
	'Other Changes',
] as const;

/** Match-Schlüssel: Kategoriename ohne Emoji, kleingeschrieben. */
const categoryKey = (title: string): string =>
	title
		.replace(/[^\p{L}\p{N} ]/gu, '')
		.trim()
		.toLowerCase();

const KEYS: readonly string[] = CATEGORY_TITLES.map(categoryKey);

/** Ein Changelog-Eintrag: Bullet-Text (ohne `- `) mit Ursprungs-Version als Suffix (KI-UX). */
export interface ChangelogEntry {
	version: string;
	text: string;
}

/** Eine aggregierte Kategorie — nur nicht-leere Kategorien kommen in das Ergebnis. */
export interface ChangelogCategory {
	title: string;
	entries: ChangelogEntry[];
}

interface MinimalRelease {
	tag_name: string;
	body: string | null;
}

/** Entfernt führende HTML-Kommentar-Zeilen (`<!-- … -->`) aus dem Body. */
const stripLeadingHtmlComments = (body: string): string => {
	const lines = body.split('\n');
	let first = 0;
	while (first < lines.length && /^\s*<!--.*-->\s*$/.test(lines[first])) first++;
	return lines.slice(first).join('\n');
};

/**
 * Sammelt die Bullet-Zeilen (`- Text`) eines Abschnitts. Eingerückte Fortsetzungszeilen
 * (Mehrzeilen-Bullets) werden an den vorherigen Bullet angehängt, damit kein Eintrag
 * verloren geht (AK3).
 */
const collectBullets = (sectionBody: string): string[] => {
	const bullets: string[] = [];
	for (const line of sectionBody.split('\n')) {
		const bullet = /^[-*] (.+)$/.exec(line.trim());
		if (bullet) {
			bullets.push(bullet[1].trim());
			continue;
		}
		if (line.trim() !== '' && bullets.length > 0 && /^\s/.test(line)) {
			bullets[bullets.length - 1] += ` ${line.trim()}`;
		}
	}
	return bullets;
};

/**
 * Aggregiert die Release-Bodys: je Kategorie (release.yml-Reihenfolge) alle Bullets aller
 * Releases, jeweils mit `(vX.Y.Z)`-Ursprungs-Suffix. Leere Kategorien entfallen.
 */
export function aggregateChangelog(releases: MinimalRelease[]): ChangelogCategory[] {
	const buckets: ChangelogEntry[][] = CATEGORY_TITLES.map(() => []);

	for (const release of releases) {
		if (release.body === null) continue;
		const body = stripLeadingHtmlComments(release.body);

		// Body in `###`-Abschnitte zerlegen; der erste Teil vor der ersten Überschrift
		// gehört zu keiner Kategorie (z. B. Full-Changelog-Zeile).
		const sections = body.split(/^### /m);
		for (const section of sections.slice(1)) {
			const [heading, ...rest] = section.split('\n');
			const key = categoryKey(heading ?? '');
			const index = KEYS.indexOf(key);
			if (index === -1) continue;
			for (const text of collectBullets(rest.join('\n'))) {
				buckets[index].push({ version: release.tag_name, text });
			}
		}
	}

	return CATEGORY_TITLES.flatMap((title, index): ChangelogCategory[] =>
		buckets[index].length > 0 ? [{ title, entries: buckets[index] }] : [],
	);
}

/** Rendert die Einträge einer Kategorie als Markdown-Liste (eine Zeile je Bullet). */
export const entriesToMarkdown = (entries: ChangelogEntry[]): string =>
	entries.map((entry) => `- ${entry.text} (${entry.version})`).join('\n');
