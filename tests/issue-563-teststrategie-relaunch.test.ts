/**
 * Rote Spec-Tests für Issue #563 (Epic: Teststrategie-Relaunch)
 *
 * Das Epic #563 bricht die Strategie "Testsuite auf die real gelebte Spezifikation
 * reduzieren" in 6 Teil-Issues (#564–#569) herunter. Diese Tests prüfen die
 * Akzeptanzkriterien des Epics als **Struktur-/Black-Box-Assertionen über das Repo**
 * (Datei-Existenz, Inhalt von Doku, CI-Konfiguration) — kein Produktivcode, keine
 * Laufzeitlogik. Sie werden erst grün, wenn die Teil-Issues ihre Artefakte
 * abliefern (Spec-Dokument, ADR, Quarantäne-Verzeichnis, Spec-First in DoD/Routine).
 *
 * Testebene: statische Auswertung von Repo-Dateien (node:test via tsx, tests-Workspace).
 *
 * Mapping AK → Test (siehe KI-ANALYSE-Block in #563):
 *   #564 / T1 — Alte Suite in Quarantäne, CI läuft grün ohne sie
 *   #565 / T4 — Referenzierbare Spezifikation der 4 Kern-Workflows
 *   #566 / T2+T3 — Produktivtests sind Black-Box mit genau einem Spec-Bezug
 *   #567 / T5 — ADR zu ungetesteten GitHub-Workflows
 *   #568 / T6 — Spec-First in DoD / PR-Template verankert
 *   #569     — Claude-Routine arbeitet spec-first
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..'); // tests/ liegt direkt an der Repo-Wurzel

const read = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');
const exists = (...parts: string[]): boolean => existsSync(join(REPO_ROOT, ...parts));
const isDir = (...parts: string[]): boolean => exists(...parts) && statSync(join(REPO_ROOT, ...parts)).isDirectory();

/** Alle Markdown-Dateien unter einem Verzeichnis (eine Ebene Tiefe reicht für docs/). */
function markdownIn(dirParts: string[]): Array<{ path: string; content: string }> {
	if (!isDir(...dirParts)) return [];
	const out: Array<{ path: string; content: string }> = [];
	const stack: string[][] = [dirParts];
	while (stack.length > 0) {
		const dir = stack.pop()!;
		for (const entry of readdirSync(join(REPO_ROOT, ...dir))) {
			const rel = [...dir, entry];
			if (isDir(...rel)) {
				stack.push(rel);
			} else if (/\.md$/i.test(entry)) {
				out.push({ path: rel.join('/'), content: readFileSync(join(REPO_ROOT, ...rel), 'utf8') });
			}
		}
	}
	return out;
}

describe('AK #564 / T1 — Alte Testsuite in Quarantäne, CI läuft grün ohne sie', () => {
	it('legt ein Quarantäne-Verzeichnis an, das die alte Suite aufnimmt (Leitplanke 2)', () => {
		// Altlasten werden nicht gelöscht, sondern aus dem CI-Lauf entfernt und als
		// Nachschlagewerk erhalten. Daher muss ein Quarantäne-Verzeichnis existieren.
		const candidates = ['tests/__quarantine__', 'tests/quarantine', 'quarantine', '__quarantine__'];
		const present = candidates.filter((p) => isDir(...p.split('/')));
		assert.ok(
			present.length > 0,
			`Es fehlt ein Quarantäne-Verzeichnis (erwartet eines von: ${candidates.join(', ')}), das die alte Suite aufnimmt`,
		);
	});

	it('schließt das Quarantäne-Verzeichnis aus dem CI-Testlauf aus', () => {
		// CI darf die alte Suite nicht mehr automatisch ausführen. ci.yml muss das
		// Quarantäne-Verzeichnis referenzieren/exkludieren — sonst läuft sie still mit.
		const ci = read('.github', 'workflows', 'ci.yml');
		assert.match(
			ci,
			/quarant[aä]in/i,
			'ci.yml muss das Quarantäne-Verzeichnis referenzieren/exkludieren, damit die alte Suite nicht mehr im CI-Lauf ausgeführt wird',
		);
	});
});

describe('AK #565 / T4 — Referenzierbare Spezifikation der 4 Kern-Workflows', () => {
	it('enthält ein als Spec erkennbares Dokument, das alle 4 Kern-Workflows benennt', () => {
		// 4 Kern-Workflows laut #563: Aufgabe anlegen, Abhängigkeit setzen,
		// Kantengewicht setzen, Prio berechnen. "Kantengewicht" ist der trennscharfe
		// Indikator — kein existierendes docs/*.md enthält ihn bisher.
		const fourWorkflows = ['aufgabe', 'abhängigkeit', 'kantengewicht', 'prio'];

		const docs = markdownIn(['docs']);
		const spec = docs.find(
			(d) =>
				// Als Spezifikation erkennbar (Dateiname oder Inhalt)
				/spec|spezifik|journey|kern-workflow|kernworkflow/i.test(d.path + '\n' + d.content) &&
				fourWorkflows.every((kw) => d.content.toLowerCase().includes(kw)),
		);

		assert.ok(
			spec,
			'Es fehlt ein referenzierbares Spec-Dokument unter docs/, das alle 4 Kern-Workflows ' +
				'(Aufgabe anlegen, Abhängigkeit setzen, Kantengewicht setzen, Prio berechnen) benennt ' +
				'und als Spezifikation/User-Journey-Dokument erkennbar ist',
		);
	});
});

describe('AK #566 / T2+T3 — Produktivtests sind Black-Box mit genau einem Spec-Bezug', () => {
	it('schreibt die Konvention fest: jeder Produktivtest hat genau einen Spec-Bezug (T2)', () => {
		// Bevor die Tests das einhalten können, muss die Konvention definiert sein.
		const conv = read('.ai-knowledge', 'tdd-strategy.md');
		const hasOneSpecRef =
			/spec-bezug|genau ein(e|er)?\s*(spec|journey|akzeptanzkriterium)|eine journey|ein akzeptanzkriterium/i.test(conv);
		assert.ok(
			hasOneSpecRef,
			'tdd-strategy.md muss die Konvention festschreiben, dass jeder Produktivtest genau einen ' +
				'Spec-Bezug (genau eine Journey / genau ein Akzeptanzkriterium) hat',
		);
	});

	it('verankert Black-Box als Leitprinzip — kein Nachbauen interner Implementierung (T3)', () => {
		const conv = read('.ai-knowledge', 'tdd-strategy.md');
		const hasBlackBoxRule =
			/black-box|black box|implementierungsdetail|implementierung nachbauen|nie die implementierung|nicht die implementierung/i.test(
				conv,
			);
		assert.ok(
			hasBlackBoxRule,
			'tdd-strategy.md muss Black-Box als Leitprinzip festschreiben: Produktivtests prüfen ' +
				'Verhalten von außen und bauen keine interne Implementierung nach (T3)',
		);
	});
});

describe('AK #567 / T5 — ADR: GitHub-Workflows bleiben ungetestet', () => {
	it('legt ein referenzierbares ADR-Verzeichnis an', () => {
		assert.ok(isDir('docs', 'adr'), 'docs/adr/ fehlt — ADRs müssen referenzierbar abliegen');
	});

	it('ADR begründet, dass GitHub-Workflows ungetestet bleiben, mit abgegrenztem Scope', () => {
		const adrs = markdownIn(['docs', 'adr']);
		const adr = adrs.find((a) => /workflow|github.action/i.test(a.content));

		assert.ok(adr, 'Es fehlt ein ADR unter docs/adr/ zum Thema (ungetestete) GitHub-Workflows');
		assert.match(
			adr!.content,
			/ungetestet|nicht getestet|bleibt.*nicht.*getestet|ohne test/i,
			'Das ADR muss festhalten, dass GitHub-Workflows ungetestet bleiben',
		);
		// Begründung (Leitplanke 4: reines Plumbing, kein Netz)
		assert.ok(
			/grund|begründ|warum|plumbing|pure|kein netz|setup|config/i.test(adr!.content),
			'Das ADR muss eine Begründung enthalten (z. B. "reines Plumbing, kein Netz")',
		);
		// Abgegrenzter Scope (was ungetestet bleibt, was nicht)
		assert.ok(
			/scope|abgegrenzt|in scope|out of scope|ausgenommen|inklusive|exklusive|umfasst|betrifft/i.test(adr!.content),
			'Das ADR muss den Scope abgrenzen (was ungetestet bleibt, was nicht)',
		);
	});
});

describe('AK #568 / T6 — Spec-First in DoD und PR-Template verankert', () => {
	it('PR-Template (DoD-Checkliste) fordert die Spec-Pflicht (Spec/Kriterium vor Code)', () => {
		// Die PR-Checkliste IST das gelebte DoD. Sie muss spec-first fordern:
		// erst Kriterium/Spec, dann Test, dann Code (Leitplanke 5).
		const tpl = read('.github', 'pull_request_template.md');
		const hasSpecFirst =
			/spec-first|spezifikation.{0,20}pflicht|kriterium.{0,20}vor|erst.{0,15}(spec|spezifikation|kriterium)|spec.{0,15}dann.{0,15}test/i.test(
				tpl,
			);
		assert.ok(
			hasSpecFirst,
			'pull_request_template.md (DoD) muss die Spec-Pflicht erwähnen: Spec/Kriterium vor Test/Code (spec-first)',
		);
	});
});

describe('AK #569 — Claude-Routine arbeitet spec-first', () => {
	it('verankert die Spec-Block-Routine (Spec → Test → Code) in der Wissensbasis', () => {
		// Leitplanke 5+6: erst Kriterium/Spec, dann Test, dann Code; Spec-Block-Routine.
		// Die Routine lebt in .ai-knowledge (tdd-strategy/ticket-spec) und/oder AGENTS.md.
		const sources = ['.ai-knowledge/tdd-strategy.md', '.ai-knowledge/ticket-spec.md', 'AGENTS.md', 'CONTRIBUTING.md'];
		const joined = sources
			.filter((p) => exists(...p.split('/')))
			.map((p) => read(...p.split('/')))
			.join('\n');

		assert.ok(
			/spec-first|spezifikation zuerst|erst.{0,15}(spec|spezifikation).{0,30}dann.{0,15}test|spec.{0,15}dann.{0,15}test.{0,15}dann.{0,15}code|spec-block/i.test(
				joined,
			),
			'Die Claude-Routine (.ai-knowledge + AGENTS.md) muss spec-first festschreiben: ' +
				' erst Spec/Kriterium, dann Test, dann Code (Spec-Block-Routine)',
		);
	});
});
