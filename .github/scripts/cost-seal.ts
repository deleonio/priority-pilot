// Siegel-Lauf: merge die Kosten-Datensätze EINES Tickets aus allen Artefakten in die
// Repo-Datei .costs/<n>.json — aufgerufen vom Documenter (Phase 6) NACH dem Merge,
// wenn alle Phasen des Tickets gelaufen sind und die Artifact-Nummer final ist.
//
// WARUM TERMINAL STATT JE PHASE: .costs/-Commits aus jeder Phase würden parallele
// Schreiber auf denselben Ordner schicken (Konflikte auf main, s. SCHEMA.md). Der
// Documenter ist der EINZIGE Schreiber je Ticket-Datei: er läuft nach dem Merge,
// serialisiert durch die statische Phasen-Queue, und jede Datei gehört zu genau
// einem Ticket. Die Artefakte bleiben der 90-Tage-Zwischenpuffer, die Repo-Datei
// wird die dauerhafte Instanz (User-Anweisung: Kosten pro Lauf eingecheckt).
//
// IDEMPOTENT über das Dedupe aus cost-aggregate.ts (timestamp|phase|tokensIn|tokensOut):
// Ein Re-Run des Documenters oder ein erneut geladenes Re-Run-Artefakt zählt nicht
// doppelt; ohne inhaltliche Änderung wird nichts geschrieben (changed=false) und der
// Aufrufer committet nicht.
//
// Stil-Spiegel von cost-aggregate.ts: Node-Eintritt, keine externen Deps, ESM,
// ausschliesslich löschbare TypeScript-Syntax (läuft mit `node` ohne tsx).

import { findRecordFiles, mergeEntries, mergeRecords } from './cost-aggregate.ts';
import { readCostRecords, scanForSecrets, writeCostRecords, type CostEntry } from './cost-record.ts';

export type SealResult = {
	/** Vollständige, deduplizierte, chronologisch sortierte Eintragsliste. */
	entries: CostEntry[];
	/** Einträge, die gegenüber der Bestandsdatei NEU sind. */
	added: number;
	/** true = Datei wurde (neu) geschrieben; false = Bestand war bereits vollständig. */
	changed: boolean;
	/** Nicht lesbare Artefakt-Dateien (Untererfassung, kein Abbruchgrund). */
	skipped: string[];
	/** >0 = Secret-Verdacht im gemergten Datensatz: NICHT geschrieben, Bestand bleibt. */
	secretFindings: number;
};

/**
 * Siegelt den Datensatz eines Issues: Artefakte unter `dir` + Bestandsdatei im Repo
 * (`rootDir/.costs/<issueId>.json`, i. d. R. der Workspace-Checkout) → EINE Datei.
 *
 * Bei Dedupe-Kollisionen (gleicher timestamp|phase|tokens) gewinnt das ARTEFAKT vor
 * dem Bestand: Die Artefakte stammen aus der jüngsten Erfassung — nachgereifte Felder
 * (z. B. turns/valueCost aus einer späteren Skript-Version) aktualisieren so den
 * Bestand, statt an der älteren Form zu haften.
 *
 * `changed` = Längendifferenz ODER serialisierter Unterschied: Die gemergte Liste
 * umfasst die Bestandsschlüssel immer (Set-Union), neue Einträge vergrössern sie
 * zwingend; der String-Vergleich fängt zusätzlich Feld-Aktualisierungen desselben
 * Laufs (Schlüssel-Ordnung ist über toEntry deterministisch, also stabil).
 */
export function sealCostRecord(issueId: string | number, dir: string, opts: { rootDir?: string } = {}): SealResult {
	const existing = readCostRecords(issueId, opts);
	const { entries: artifactEntries, skipped } = mergeRecords(findRecordFiles(dir));
	const merged = mergeEntries([...artifactEntries, ...existing]);

	// Secret-Scan VOR dem Schreiben (AK5 aus #515): Der Seal ist der erste Commit-Pfad
	// von .costs-Inhalt auf main — ein Token-Schnipsel aus einem Transcript-Feld darf
	// dort nicht landen. Bei Treffern wird nicht geschrieben (Bestand bleibt unangetastet,
	// changed=false → kein Commit); die Meldung reist über `skipped` und secretFindings.
	// Der Match darin wird bewusst gekürzt, damit die Meldung selbst nichts leakt.
	const findings = scanForSecrets(JSON.stringify(merged));
	if (findings.length > 0) {
		return {
			entries: existing,
			added: 0,
			changed: false,
			skipped: [
				...skipped,
				...findings.map((f) => `secret-match: ${f.pattern} (${f.match.slice(0, 8)}…${f.match.slice(-4)})`),
			],
			secretFindings: findings.length,
		};
	}

	const existingTimes = new Set(existing.map((e) => e.timestamp));
	const added = merged.filter((e) => !existingTimes.has(e.timestamp)).length;
	const changed = merged.length !== existing.length || JSON.stringify(merged) !== JSON.stringify(existing);

	if (changed) writeCostRecords(issueId, merged, opts);
	return { entries: merged, added, changed, skipped, secretFindings: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI — vom Documenter-Workflow aufgerufen:
//   node .github/scripts/cost-seal.ts --issue 42 --dir /tmp/costs [--root-dir .]
// ─────────────────────────────────────────────────────────────────────────────

const flag = (argv: readonly string[], name: string): string | undefined => {
	const idx = argv.indexOf(`--${name}`);
	return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
};

const main = (argv: readonly string[]): number => {
	const issue = flag(argv, 'issue');
	const dir = flag(argv, 'dir');
	if (!issue || !dir) {
		process.stderr.write('cost-seal: --issue <n> --dir <verzeichnis> erforderlich\n');
		return 2;
	}
	const result = sealCostRecord(issue, dir, { rootDir: flag(argv, 'root-dir') });
	process.stdout.write(
		`entries=${result.entries.length}\nadded=${result.added}\nchanged=${result.changed}\n` +
			(result.skipped.length > 0 ? `skipped=${result.skipped.length}\n` : '') +
			(result.secretFindings > 0 ? `secretFindings=${result.secretFindings}\n` : ''),
	);
	// Secret-Treffer einzeln ausgeben (Pattern + gekürzter Match, s. sealCostRecord):
	// Der Aufrufer kann nur verwarnen — die Zeilen sind die Spur für die Nachbearbeitung.
	for (const s of result.skipped) if (s.startsWith('secret-match: ')) process.stdout.write(`${s}\n`);
	return 0;
};

// Nur ausführen, wenn direkt aufgerufen — als Import (Tests) nebenwirkungsfrei.
if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
