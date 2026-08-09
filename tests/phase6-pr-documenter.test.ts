/**
 * Rote Spec-Tests für Issue #513
 *
 * "Phase 6 (PR-Documenter) in Doku & Phasen-Diagramm konsistent aufnehmen"
 *
 * Akzeptanzkriterien (aus Issue-Body):
 * AC1: In jeder Doku-Datei, die Phasen auflistet/beschreibt (mind. Agent-Doku AGENTS.md),
 *      ist die PR-Documenter-Phase als 6. Phase einheitlich enthalten.
 * AC2: Beschreibung der Phase ist inhaltlich korrekt: Nach Merge eines PR überarbeitet/optimiert
 *      sie dessen Titel und Beschreibung.
 * AC3: Phasenummerierung, Benennung und Reihenfolge sind über alle Vorkommen konsistent
 *      (keine verwaiste „5 Phasen"-Zählung / keine geschlossene 5er-Workflow-Menge).
 * AC4: Das Mermaid-Phasen-Diagramm enthält Phase 6 an der richtigen Position (nach PR-Merge)
 *      und rendert fehlerfrei.
 *
 * Die Tests prüfen ausschließlich Dateiinhalt — kein Produktivcode, keine Laufzeitlogik.
 * Sie werden grün, sobald die Implementierung die PR-Documenter-Phase als 6. Phase in die
 * Doku aufnimmt.
 *
 * Abgrenzung: Die „5 Phasen" in ai-context-optimization-github-actions.md bezeichnen die
 * CI/CD-Pipeline (Trigger/Setup/Build/Package/Deploy) — ein ANDERES Konzept als die KI-Agent-
 * Phasen und daher kein Widerspruch (bewusst außerhalb des AC3-Scopes gehalten).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');

async function readProjectFile(rel: string): Promise<string> {
	return readFile(resolve(ROOT, rel), 'utf-8');
}

/** Marker, die im Phasen-Kontext eindeutig auf den PR-Documenter (Post-Merge Documentation) zeigen. */
const DOC_MARKER = /pr-documenter|pr-?post-?merge|post-?merge[\s-]*documentation|document[\s-]*merged/i;

describe('AC1 — PR-Documenter als 6. Phase in phasenauflistender Doku', () => {
	it('enthält in AGENTS.md (Agent-Doku) die PR-Documenter-Phase als sechste Phase', async () => {
		const content = await readProjectFile('AGENTS.md');

		const sectionStart = content.indexOf('## KI-Agent — Pipeline-Phasen');
		assert.ok(sectionStart >= 0, 'AGENTS.md muss den Abschnitt "## KI-Agent — Pipeline-Phasen" enthalten');
		const nextSection = content.indexOf('\n## ', sectionStart + 1);
		const table = nextSection > 0 ? content.slice(sectionStart, nextSection) : content.slice(sectionStart);

		// Datenzeilen der Phasentabelle: erste Spalte ist **<Name>**
		const phaseRows = [...table.matchAll(/^\| \*\*([^*]+)\*\*\s+\|/gm)].map((m) => m[1].trim());
		assert.ok(phaseRows.length > 0, 'Phasentabelle muss Datenzeilen enthalten');

		assert.ok(
			phaseRows.length >= 6,
			`Phasentabelle muss mindestens 6 Phasen enthalten (aktuell ${phaseRows.length}: ${phaseRows.join(', ')}). ` +
				`Die 6. Phase ist der PR-Documenter (überarbeitet nach Merge Titel & Beschreibung).`,
		);

		const lastPhase = phaseRows[phaseRows.length - 1];
		assert.ok(
			DOC_MARKER.test(lastPhase),
			`Die letzte (6.) Phase muss der PR-Documenter sein, ist aber "${lastPhase}".`,
		);
	});
});

describe('AC2 — inhaltlich korrekte Beschreibung der PR-Documenter-Phase', () => {
	it('beschreibt: nach PR-Merge werden Titel und Beschreibung überarbeitet/optimiert', async () => {
		const content = await readProjectFile('AGENTS.md');

		const idx = content.search(DOC_MARKER);
		assert.ok(
			idx >= 0,
			'AGENTS.md muss die PR-Documenter-Phase erwähnen (z. B. "PR-Documenter" / "Post-Merge Documentation")',
		);

		// Kontextfenster um den Phasen-Eintrag (Trigger/Wissensbasis/Output-Spalten + Umfeld)
		const window = content.slice(Math.max(0, idx - 400), Math.min(content.length, idx + 800));

		assert.ok(
			/merge/i.test(window),
			'Die Phasenbeschreibung muss auf den PR-Merge Bezug nehmen ("Merge"), da der PR-Documenter NACH dem Merge läuft.',
		);
		assert.ok(
			/titel/i.test(window),
			'Die Phasenbeschreibung muss erwähnen, dass der PR-Titel überarbeitet/optimiert wird.',
		);
		assert.ok(
			/beschreib/i.test(window),
			'Die Phasenbeschreibung muss erwähnen, dass die PR-Beschreibung überarbeitet/optimiert wird.',
		);
	});
});

describe('AC3 — konsistente Phasenzählung (keine verwaiste "5 Phasen"-Menge)', () => {
	it('führt die Agent-Workflows nicht mehr als geschlossene 5er-Menge ohne PR-Documenter auf', async () => {
		const content = await readProjectFile('AGENTS.md');

		// Kanonische Inline-Aufzählung der Agent-Phasen; darf nicht bei Fixup als letzte Phase
		// enden, ohne den PR-Documenter als 6. Phase zu nennen.
		const orphanedFive = /\(Triage,\s*Spec,\s*Umsetzung,\s*Review,\s*Fixup\s*\)/;

		assert.ok(
			!orphanedFive.test(content),
			'AGENTS.md zählt die Agent-Workflows noch als geschlossene 5er-Menge ' +
				'"(Triage, Spec, Umsetzung, Review, Fixup)" — muss um die 6. Phase (PR-Documenter) ergänzt werden.',
		);
	});

	it('nennt die gleiche Anzahl Phasen im Header-Kommentar des PR-Documenter-Workflows wie in der Doku (6)', async () => {
		const wf = await readProjectFile('.github/workflows/pr-post-merge-documentation.yml');
		const agents = await readProjectFile('AGENTS.md');

		// Der Workflow-Header beschreibt sich selbst als 6-Phasen-Routine.
		const wfClaims6 = /6[\s-]*phase/i.test(wf);
		const agentsTableHas6 = (agents.match(/^\| \*\*([^*]+)\*\*\s+\|/gm) || []).length >= 6;

		assert.ok(wfClaims6, 'PR-Documenter-Workflow deklariert sich als 6-Phasen-Routine (Bezugspunkt).');
		assert.ok(
			agentsTableHas6,
			'AGENTS.md Phasentabelle muss ebenfalls 6 Phasen führen — konsistent mit dem PR-Documenter-Workflow.',
		);
	});
});

describe('AC4 — Mermaid-Phasen-Diagramm mit Phase 6 nach PR-Merge', () => {
	async function getMermaidBlock(): Promise<string> {
		const content = await readProjectFile('docs/pipeline-flow.md');
		const start = content.indexOf('```mermaid');
		assert.ok(start >= 0, 'docs/pipeline-flow.md muss einen Mermaid-Block enthalten');
		const bodyStart = content.indexOf('\n', start) + 1;
		const end = content.indexOf('```', bodyStart);
		assert.ok(end > bodyStart, 'Mermaid-Block muss geschlossen sein (schließender ```)');
		return content.slice(bodyStart, end);
	}

	it('enthält die PR-Documenter-Phase als Knoten, positioniert nach dem PR-Merge', async () => {
		const mermaid = await getMermaidBlock();
		const lower = mermaid.toLowerCase();

		assert.ok(/merge/i.test(mermaid), 'Diagramm muss den Merge-Knoten enthalten ("PR gemergt")');
		assert.ok(
			DOC_MARKER.test(mermaid),
			'Diagramm muss einen PR-Documenter-Knoten enthalten (Phase 6 = Post-Merge Documentation)',
		);

		const mergeIdx = lower.indexOf('merge');
		const docIdx = mermaid.search(DOC_MARKER);
		assert.ok(
			docIdx > mergeIdx,
			`PR-Documenter muss im Diagramm NACH dem PR-Merge positioniert sein (merge@${mergeIdx}, documenter@${docIdx}).`,
		);
	});

	it('rendert fehlerfrei: Klammersetzung der Knoten/Labels ist ausgeglichen', async () => {
		const mermaid = await getMermaidBlock();

		// Kommentare (%% …) und Kanten-Labels (|…|) entfernen — sie enthalten Klammern,
		// die nicht zur Knoten-Syntax gehören und die Bilanz verfälschen würden.
		const stripped = mermaid.replace(/%%[^\n]*/g, '').replace(/\|[^|\n]*\|/g, '');

		const count = (ch: string) => [...stripped].filter((c) => c === ch).length;
		const pairs: Array<[string, string]> = [
			['[', ']'],
			['(', ')'],
			['{', '}'],
		];

		for (const [open, close] of pairs) {
			assert.equal(
				count(open),
				count(close),
				`Mermaid-Klammersetzung unausgewogen: "${open}" = ${count(open)}, "${close}" = ${count(
					close,
				)} — das bricht das Rendering.`,
			);
		}
		assert.match(stripped, /^\s*(flowchart|graph)\b/m, 'Mermaid-Block muss mit "flowchart"/"graph" beginnen.');
	});
});
