/**
 * Rote Spec-Tests für Issue #564
 *
 * "[Teststrategie] Alte Testsuite in Quarantäne verschieben" (Teil des Epics #563)
 *
 * Akzeptanzkriterien (aus Issue-Body / KI-ANALYSE):
 * AC1: CI läuft grün und führt die Quarantäne-Tests nicht aus.
 * AC2: Quarantäne-Verzeichnis existiert im Repo, enthält die verschobenen Tests
 *      und bleibt über die Versionskontrolle einsehbar (Nachschlagewerk).
 * AC3: Produktive (nicht-quarantänierte) Tests bleiben vollständig erhalten –
 *      keine versehentliche Mit-Quarantänisierung.
 * AC4: CI-Konfiguration schließt das Quarantäne-Verzeichnis explizit aus
 *      (Exclude-Pattern / Pfad).
 *
 * Durch diese Spec festgelegte Konvention:
 *  - Das Quarantäne-Verzeichnis ist tests/__quarantine__/ (versioniert, ein Ort).
 *  - „Alte" Black-Box-Reproduktionen werden per `git mv` HINEIN verschoben
 *    (nicht kopiert) – in der aktiven Suite bleiben sie nicht doppelt liegen.
 *  - Aktive Test-Runner erfassen das Verzeichnis nicht:
 *      • tests-Workspace: `node --import tsx --test "*.test.ts"` (nicht-rekursiv)
 *      • ci.yml Meta-Tests: scoped auf .github/workflows + .github/scripts
 *      • pnpm -r test: nur Workspace-Skripte; quarantine ist kein Workspace.
 *
 * Die Tests prüfen ausschließlich Repo-Struktur & CI-Konfiguration – kein
 * Produktivcode. Sie sind ROT, solange das Quarantäne-Verzeichnis bzw. der
 * explizite CI-Exclude fehlen, und werden GRÜN, sobald die Implementierung die
 * Suite gemäß Konvention verschoben und abgesichert hat.
 *
 * Abgrenzung (offener Punkt aus der KI-ANALYSE, 🟡): WELCHE konkreten Tests in
 * Quarantäne wandern, ist eine Kurationsentscheidung nach dem Leitprinzip
 * (Black-Box-Reproduktion von Code/YAML). Diese Auswahl ist menschlich/AI zu
 * treffen und mechanisch nicht testierbar – AC3 deckt daher nur die strukturelle
 * Hälfte (kein doppelter/halber Move), nicht die inhaltliche Kurationskorrektheit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Der tests-Workspace führt seine Skripte mit cwd = tests/ aus → die Repo-Root
// liegt eine Ebene höher (gleiche Auflösung wie phase6-pr-documenter.test.ts).
const ROOT = resolve(process.cwd(), '..');
const QUARANTINE = join(ROOT, 'tests', '__quarantine__');
const QUARANTINE_REL = 'tests/__quarantine__';

const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|mjs)$/;

async function readProjectFile(rel: string): Promise<string> {
	return readFile(join(ROOT, rel), 'utf-8');
}

/** Alle per Git getrackten Dateien unterhalb eines Pathspecs (relative Pfade). */
function gitLsFiles(pathspec: string): string[] {
	const out = execFileSync('git', ['-C', ROOT, 'ls-files', pathspec], { encoding: 'utf-8' });
	return out.split('\n').filter(Boolean);
}

/** SHA-1 einer Datei (für Duplikat-Erkennung Move vs. Kopie). */
function hashFile(absPath: string): string {
	return createHash('sha1').update(readFileSync(absPath)).digest('hex');
}

/**
 * Rekursiv alle Test-Dateien unter `dir` (synthetisch, unabhängig von Glob-Regeln
 * der Runner). node_modules und __quarantine__ werden nie betreten.
 */
function listTestFiles(dir: string): string[] {
	const result: string[] = [];
	if (!existsSync(dir)) return result;
	const stack = [dir];
	while (stack.length) {
		const cur = stack.pop()!;
		for (const entry of readdirSync(cur, { withFileTypes: true })) {
			if (entry.name === 'node_modules' || entry.name === '__quarantine__') continue;
			const full = join(cur, entry.name);
			if (entry.isDirectory()) stack.push(full);
			else if (TEST_FILE.test(entry.name)) result.push(full);
		}
	}
	return result;
}

describe('Issue #564 — Alte Testsuite in Quarantäne verschieben', () => {
	describe('AC2 — Quarantäne-Verzeichnis existiert & ist über die VCS einsehbar', () => {
		it('Verzeichnis tests/__quarantine__/ ist angelegt', () => {
			assert.ok(
				existsSync(QUARANTINE) && statSync(QUARANTINE).isDirectory(),
				'Quarantäne-Verzeichnis tests/__quarantine__/ muss existieren.',
			);
		});

		it('enthält mindestens eine verschobene Test-Datei (nicht leer)', () => {
			const testFiles = gitLsFiles(`${QUARANTINE_REL}/`).filter((f) => TEST_FILE.test(f));
			assert.ok(
				testFiles.length > 0,
				`Quarantäne muss verschobene Tests enthalten (getrackte Test-Dateien: ${testFiles.length}).`,
			);
		});

		it('alle Test-Dateien im Quarantäne-Verzeichnis sind unter Git getrackt (Nachschlagewerk via VCS)', () => {
			const onDisk = listTestFiles(QUARANTINE).map((f) => relative(ROOT, f));
			const tracked = new Set(gitLsFiles(`${QUARANTINE_REL}/`));
			const untracked = onDisk.filter((f) => !tracked.has(f));
			assert.deepEqual(
				untracked,
				[],
				`Quarantäne-Tests müssen committed sein (sonst nicht über VCS einsehbar): ${untracked.join(', ')}`,
			);
		});
	});

	describe('AC4 — CI-Konfiguration schließt den Quarantäne-Pfad explizit aus', () => {
		it('mindestens eine Test-Collection-Config erwähnt __quarantine__ als expliziten Exclude', async () => {
			// AC4 verlangt ein *explizites* Exclude-Pattern / einen Pfad – nicht nur eine
			// implizite Nicht-Erfassung. Wir prüfen die drei relevanten Sammel-Stellen.
			const candidates = ['tests/package.json', 'frontend/vitest.config.ts', '.github/workflows/ci.yml'];
			const contents = await Promise.all(candidates.map((rel) => readProjectFile(rel).catch(() => '')));
			const mentions = candidates.filter((_, i) => contents[i].includes('__quarantine__'));
			assert.ok(
				mentions.length > 0,
				`Eine Test-Collection-Config muss __quarantine__ explizit als Exclude führen (${candidates.join(', ')}).`,
			);
		});

		it('der tests-Workspace-Glob bleibt nicht-rekursiv (kein **, sonst würde __quarantine__ erfasst)', async () => {
			const pkg = JSON.parse(await readProjectFile('tests/package.json'));
			const testScript: string = pkg.scripts?.test ?? '';
			assert.ok(testScript.length > 0, 'tests/package.json benötigt ein test-Skript.');
			assert.ok(
				!testScript.includes('**'),
				`tests test-Skript darf nicht rekursiv sein (würde __quarantine__ erfassen): "${testScript}"`,
			);
		});

		it('Quarantäne ist nicht als eigener pnpm-Workspace gelistet (pnpm -r test läuft es nicht)', async () => {
			const ws = await readProjectFile('pnpm-workspace.yaml');
			assert.ok(!ws.includes('__quarantine__'), 'tests/__quarantine__/ darf nicht als pnpm-Workspace gelistet sein.');
		});
	});

	describe('AC1 — Quarantäne-Tests werden von keinem aktiven Runner erfasst', () => {
		// Vorbedingung: erst sobald Tests verschoben wurden, ist AC1 nicht-trivial.
		const requirePopulated = () => {
			const n = gitLsFiles(`${QUARANTINE_REL}/`).filter((f) => TEST_FILE.test(f)).length;
			assert.ok(n > 0, 'Vorbedingung: Quarantäne muss verschobene Tests enthalten.');
		};

		it('der tests-Workspace-Glob (tests/*.test.ts) erfasst keine Datei aus der Quarantäne', () => {
			requirePopulated();
			// Simuliert `node --import tsx --test "*.test.ts"` mit cwd=tests/: ausschließlich
			// direkte (Datei-)Kinder von tests/. Eine quarantäne-Datei dort wäre ein Fehler.
			const direct = readdirSync(join(ROOT, 'tests'), { withFileTypes: true })
				.filter((d) => d.isFile() && /\.test\.ts$/.test(d.name))
				.map((d) => d.name);
			const leaked = direct.filter((n) => n.toLowerCase().includes('quarantine'));
			assert.deepEqual(
				leaked,
				[],
				`Quarantäne-Tests dürfen nicht direkt unter tests/ liegen (vom Glob erfasst): ${leaked.join(', ')}`,
			);
		});

		it('kein CI-Test-Schritt in ci.yml referenziert den Quarantäne-Pfad', async () => {
			requirePopulated();
			const ci = await readProjectFile('.github/workflows/ci.yml');
			assert.ok(!ci.includes('__quarantine__'), 'ci.yml darf den Quarantäne-Pfad in keinem Test-Schritt erfassen.');
		});
	});

	describe('AC3 — Kein produktiver Test wird versehentlich mit-quarantänisiert', () => {
		it('jede Datei im Quarantäne-Verzeichnis ist eine genuine Test-Datei', () => {
			const tracked = gitLsFiles(`${QUARANTINE_REL}/`);
			assert.ok(tracked.length > 0, 'Vorbedingung: Quarantäne darf nicht leer sein.');
			const nonTest = tracked.filter((f) => !TEST_FILE.test(f));
			assert.deepEqual(
				nonTest,
				[],
				`Quarantäne darf nur Test-Dateien enthalten (kein produktiver Code): ${nonTest.join(', ')}`,
			);
		});

		it('kein Test liegt inhaltlich doppelt in Quarantäne UND aktiv (Move, keine Kopie)', () => {
			const quarantined = gitLsFiles(`${QUARANTINE_REL}/`).filter((f) => TEST_FILE.test(f));
			assert.ok(quarantined.length > 0, 'Vorbedingung: Quarantäne muss Test-Dateien enthalten.');
			// Content-Hash statt Basename: robust gegen Namens-Kollisionen (viele index.test.ts).
			const qHashes = new Set(quarantined.map((f) => hashFile(join(ROOT, f))));

			const activeRoots = ['tests', 'frontend', 'server', 'client', '.github'];
			const active = activeRoots.flatMap((r) => listTestFiles(join(ROOT, r))).map((f) => relative(ROOT, f));
			const duplicates = active.filter((f) => qHashes.has(hashFile(join(ROOT, f))));
			assert.deepEqual(
				duplicates,
				[],
				`Diese Tests liegen noch aktiv UND in Quarantäne (Move unvollständig / produktiver Test versehentlich mit-quarantänisiert): ${duplicates.join(', ')}`,
			);
		});
	});
});
