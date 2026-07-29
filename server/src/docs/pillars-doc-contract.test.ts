import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Rote Spec-Tests für #476 — „Dokumentation nachziehen".
//
// Hintergrund: Die Lebensbalance-Säulen sind implementierungstechnisch längst **nutzerdefiniert**
// (Pillar-CRUD #422/#428, pro-Nutzer-Datenmodell & Migration #421, `Pillar.userId`,
//  per-user Seed/Scope). Die Fachdokumentation spricht aber weiterhin von „fünf festen / globalen
//  Säulen (für alle Nutzer identisch)":
//    - README.md (Zeile 13 sowie 56–57)
//    - .ai-knowledge/project.md (Zeile 4–5)
//
// Vertrag (#476): Die Doku beschreibt Säulen als **nutzerdefiniert** und verwendet **weder** die
// Formulierung „fünf festen Säulen" noch „für alle Nutzer identisch" / „globale Stammdaten".
// Diese Tests lesen die Markdown-Dateien ein und lehnen die veralteten Formulierungen ab — sie
// sind ROT, solange die Doku noch nicht nachgezogen wurde, und werden GRÜN, sobald Issue #476 die
// Beschreibungen auf nutzerdefinierte Säulen umstellt.
//
// KEIN Produktivcode — diese Tests prüfen ausschließlich die Fachdokumentation (Markdown), das
// eigentliche „Produkt" von Ticket #476. Es wird kein Produktivcode der Anwendung geändert.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

/** Liest eine Datei relativ zum Repo-Root als UTF-8-String (zeilen-erhaltend). */
const readRepoFile = (rel: string): string => readFileSync(resolve(repoRoot, rel), 'utf8');

const readme = readRepoFile('README.md');
const projectDoc = readRepoFile('.ai-knowledge/project.md');

describe('Dokumentation Säulen — nutzerdefiniert statt „fünf festen/globalen" (#476)', () => {
	// ── AK1: README spricht nicht mehr von „fünf festen Säulen" ───────────────────────────────
	it('README.md erwähnt keine „fünf festen Säulen" mehr (AK1)', () => {
		assert.doesNotMatch(
			readme,
			/fünf\s+festen?\s+Säulen/u,
			'README.md spricht weiterhin von „fünf festen Säulen" — das ist veraltet, ' +
				'da Säulen nutzerdefiniert sind. Bitte auf nutzerdefinierte Säulen umstellen.',
		);
	});

	// ── AK2: README beschreibt Säulen nicht als „für alle Nutzer identisch" / „globale Stammdaten"
	it('README.md beschreibt Säulen nicht als „für alle Nutzer identisch" / „globale Stammdaten" (AK2)', () => {
		assert.doesNotMatch(
			readme,
			/für\s+alle\s+Nutzer\s+identisch/u,
			'README.md bezeichnet Säulen als „für alle Nutzer identisch" — Säulen sind ' +
				'aber pro Nutzer. Bitte als nutzerdefiniert beschreiben.',
		);
		assert.doesNotMatch(
			readme,
			/globale\s+Stammdaten/u,
			'README.md bezeichnet Säulen als „globale Stammdaten" — Säulen sind aber ' +
				'pro Nutzer. Bitte als nutzerdefiniert beschreiben.',
		);
	});

	// ── AK3: .ai-knowledge/project.md spricht nicht mehr von „fünf festen Säulen"
	it('.ai-knowledge/project.md erwähnt keine „fünf festen Säulen" mehr (AK3)', () => {
		assert.doesNotMatch(
			projectDoc,
			/fünf\s+festen?\s+Säulen/u,
			'.ai-knowledge/project.md spricht weiterhin von „fünf festen Säulen" — das ' +
				'ist veraltet. Bitte auf nutzerdefinierte Säulen umstellen.',
		);
	});

	// ── AK4: project.md beschreibt Säulen nicht als „für alle Nutzer identisch" /
	//        „globale Stammdaten"
	it('.ai-knowledge/project.md beschreibt Säulen nicht als „für alle Nutzer identisch" / „globale Stammdaten" (AK4)', () => {
		assert.doesNotMatch(
			projectDoc,
			/für\s+alle\s+Nutzer\s+identisch/u,
			'.ai-knowledge/project.md bezeichnet Säulen als „für alle Nutzer identisch" ' +
				'— Säulen sind aber pro Nutzer. Bitte als nutzerdefiniert beschreiben.',
		);
		assert.doesNotMatch(
			projectDoc,
			/globale\s+Stammdaten/u,
			'.ai-knowledge/project.md bezeichnet Säulen als „globale Stammdaten" — ' +
				'Säulen sind aber pro Nutzer. Bitte als nutzerdefiniert beschreiben.',
		);
	});

	// ── AK5: Beide Doku-Dateien beschreiben Säulen aktiv als nutzerdefiniert / pro Nutzer
	it('README.md und project.md beschreiben Säulen als nutzerdefiniert / pro Nutzer (AK5)', () => {
		assert.match(
			readme,
			/nutzerdefiniert|pro\s+Nutzer|je\s+Nutzer/u,
			'README.md sollte Säulen als nutzerdefiniert / pro Nutzer beschreiben.',
		);
		assert.match(
			projectDoc,
			/nutzerdefiniert|pro\s+Nutzer|je\s+Nutzer/u,
			'.ai-knowledge/project.md sollte Säulen als nutzerdefiniert / pro Nutzer beschreiben.',
		);
	});
});
