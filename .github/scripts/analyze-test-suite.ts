#!/usr/bin/env tsx
/**
 * Test-Suite-Analyse nach TDD-Strategie (Substance over Quantity).
 * Findet: tautologische Tests, Redundanzen, fehlende Empty-Set-Probes, fehlende Mutation-Probes.
 *
 * Nutzung: pnpm dlx tsx@4.22.4 .github/scripts/analyze-test-suite.ts \
 *   --unit-results unit-results.txt --e2e-results e2e-results.txt --repo-root . --report-dir .ai-knowledge
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

interface CliArgs {
	unitResults: string;
	e2eResults: string;
	repoRoot: string;
	reportDir: string;
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2);
	const result: Partial<CliArgs> = {};
	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--unit-results':
				result.unitResults = args[++i];
				break;
			case '--e2e-results':
				result.e2eResults = args[++i];
				break;
			case '--repo-root':
				result.repoRoot = args[++i];
				break;
			case '--report-dir':
				result.reportDir = args[++i];
				break;
		}
	}
	if (!result.unitResults || !result.e2eResults || !result.repoRoot || !result.reportDir) {
		console.error('Missing required arguments');
		process.exit(1);
	}
	return result as CliArgs;
}

function findTestFiles(dir: string): string[] {
	const results: string[] = [];
	if (!existsSync(dir)) return results;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...findTestFiles(full));
		} else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
			results.push(full);
		}
	}
	return results;
}

interface Finding {
	category: 'tautological' | 'redundant' | 'emptySet' | 'mutation';
	file: string;
	testName: string;
	issue: string;
	fix: string;
	severity: 'critical' | 'warning' | 'info';
}

function analyzeTestFile(filePath: string, content: string): Finding[] {
	const findings: Finding[] = [];
	const relPath = relative(REPO_ROOT, filePath);

	// 1. Tautologische Tests: toBeCalled/toHaveBeenCalled OHNE Observable Outcome
	// Pattern: expect(fn).toHaveBeenCalled() aber KEIN expect auf DOM/API/State danach
	const testBlocks = content.match(/test\(["'][^"']*["'][\s\S]*?^\}\);/gm) || [];
	for (const block of testBlocks) {
		const nameMatch = block.match(/test\(["']([^"']+)["']/) || block.match(/it\(["']([^"']+)["']/) || [];
		const testName = nameMatch[1] || 'unnamed';

		// Prüft nur Mock-Calls?
		const hasMockAssertion = /\.(toHaveBeenCalled|toBeCalled|toHaveBeenCalledWith|toHaveBeenCalledTimes)\(/.test(block);
		// Hat Observable Outcome? (DOM, Response, State, Snapshot)
		const hasObservableOutcome =
			/expect\(.*\)\.(toBeVisible|toBeHidden|toHaveText|toHaveAttribute|toContain|toEqual|toMatchObject|toMatchSnapshot|resolves|rejects)/.test(
				block,
			) ||
			/await expect\(.*\)\.(poll|toPass)/.test(block) ||
			/page\.evaluate\(/.test(block) ||
			/page\.request\.(get|post|patch|delete|put)\(/.test(block);

		if (hasMockAssertion && !hasObservableOutcome) {
			findings.push({
				category: 'tautological',
				file: relPath,
				testName,
				issue: 'Prüft nur Mock/Implementation-Detail (toHaveBeenCalled), kein beobachtbares Verhalten',
				fix: 'Assertion auf Observable Outcome ergänzen (DOM, API-Response, State) oder Test entfernen',
				severity: 'critical',
			});
		}
	}

	// 2. Leere Mengen bei All-Quantoren (forEach/map/filter über extrahierte Items ohne Empty-Check)
	// Pattern: const items = [...matchAll(...)]; for (const item of items) { assert... }
	// OHNE assert.ok(items.length > 0) davor
	const allQuantorMatches =
		content.match(
			/const\s+\w+\s*=\s*\[[\s\S]*?matchAll\([\s\S]*?\]\s*;[\s\S]*?for\s*\(\s*const\s+\w+\s+of\s+\w+\s*\)\s*{/g,
		) || [];
	for (const match of allQuantorMatches) {
		// Prüfe ob Empty-Check davor steht (in den ~10 Zeilen davor)
		const idx = content.indexOf(match);
		const before = content.slice(Math.max(0, idx - 500), idx);
		const hasEmptyCheck = /assert\.ok\(.*length\s*>\s*0\)|if\s*\(.*length\s*===?\s*0\)/.test(before);
		if (!hasEmptyCheck) {
			findings.push({
				category: 'emptySet',
				file: relPath,
				testName: 'All-Quantor ohne Empty-Set-Probe',
				issue: 'Extraktion via matchAll kann leer sein → Loop läuft nie → Test geht grün, prüft aber nichts',
				fix: 'assert.ok(items.length > 0, "Extraktion liefert leere Menge — Regex/Selektor kaputt?") vor Loop einfügen',
				severity: 'critical',
			});
		}
	}

	return findings;
}

function analyzeRedundancy(testFiles: string[]): Finding[] {
	const findings: Finding[] = [];
	// Bekannte Redundanzen aus Codebase-Historie (manuell kuratiert, erweiterbar)
	// Wir prüfen auf Duplikate über Test-Namen/Inhalte hinweg

	const testSignatures = new Map<string, { file: string; testName: string; content: string }[]>();

	for (const file of testFiles) {
		const content = readFileSync(file, 'utf8');
		const relPath = relative(REPO_ROOT, file);
		const testBlocks = content.match(/test\(["'][^"']*["'][\s\S]*?^\}\);/gm) || [];
		for (const block of testBlocks) {
			const nameMatch = block.match(/test\(["']([^"']+)["']/) || block.match(/it\(["']([^"']+)["']/) || [];
			const testName = nameMatch[1] || 'unnamed';
			// Signatur: erste 200 chars des Testbodys (normalisiert)
			const sig = block.slice(0, 300).replace(/\s+/g, ' ').trim();
			if (!testSignatures.has(sig)) testSignatures.set(sig, []);
			testSignatures.get(sig)!.push({ file: relPath, testName, content: block });
		}
	}

	for (const [sig, occurrences] of testSignatures) {
		if (occurrences.length > 1) {
			// Doppelte Tests gefunden
			const keep = occurrences[0]; // ersten behalten
			for (let i = 1; i < occurrences.length; i++) {
				const dup = occurrences[i];
				findings.push({
					category: 'redundant',
					file: dup.file,
					testName: dup.testName,
					issue: `Identischer Test-Inhalt wie in ${keep.file}::${keep.testName}`,
					fix: `Entfernen — stärkste Formulierung (AK) in ${keep.file} behalten`,
					severity: 'warning',
				});
			}
		}
	}

	return findings;
}

function analyzeMutationGaps(testFiles: string[]): Finding[] {
	const findings: Finding[] = [];

	// Mutation-Gaps: Tests, die bei bekannten Mutations nicht rot werden
	// Wir prüfen bekannte Patterns aus der Codebase-Historie

	for (const file of testFiles) {
		const content = readFileSync(file, 'utf8');
		const relPath = relative(REPO_ROOT, file);

		// Pattern 1: Fokus-Tests ohne Tab-Test (AK4-Gap)
		if (relPath.includes('delete-dialog-focus') || content.includes('Initialfokus auf')) {
			const hasTabTest = /Tab\s+(bewegt|weitet|fokussiert)|page\.keyboard\.press\(['"]Tab['"]\)/.test(content);
			if (!hasTabTest) {
				findings.push({
					category: 'mutation',
					file: relPath,
					testName: 'Fokus-Vertrag ohne Tab-Freiheit',
					issue:
						'Test prüft Initialfokus, aber nicht dass Fokus frei beweglich ist (Tab funktioniert) — Fokus-Gefängnis wird nicht gecatched',
					fix: 'AK4 hinzufügen: waitForTimeout(150ms) → Tab → expect(deleteButton).toBeFocused()',
					severity: 'critical',
				});
			}
		}

		// Pattern 2: 375px-Overflow-Tests dupliziert
		const mobileTests = content.match(/test\(["'][^"']*375[^"']*["'][\s\S]*?^\}\);/gm) || [];
		for (const block of mobileTests) {
			const nameMatch = block.match(/test\(["']([^"']+)["']/) || [];
			const testName = nameMatch[1] || 'unnamed';
			const hasScrollWidth = /scrollWidth\s*<=\s*window\.innerWidth|noOverflow/.test(block);
			if (hasScrollWidth) {
				// Prüfen ob identischer Test woanders existiert (global check später)
				findings.push({
					category: 'redundant',
					file: relPath,
					testName,
					issue: '375px no-overflow Test — Pattern existiert in 21+ Specs identisch',
					fix: 'Zentrale Helper-Funktion nutzen oder nur 1 repräsentativen Test behalten',
					severity: 'warning',
				});
			}
		}

		// Pattern 3: Tests die nur "existiert" prüfen ohne Behavior
		const existenceTests =
			content.match(/test\(["'][^"']*existiert[^"']*["'][\s\S]*?^\}\);/gm) ||
			content.match(/test\(["'][^"']*vorhanden[^"']*["'][\s\S]*?^\}\);/gm) ||
			content.match(/test\(["'][^"']*gefunden[^"']*["'][\s\S]*?^\}\);/gm) ||
			[];
		for (const block of existenceTests) {
			const nameMatch = block.match(/test\(["']([^"']+)["']/) || [];
			const testName = nameMatch[1] || 'unnamed';
			const hasBehavior = /expect\(.*\)\.(toBeVisible|toBeHidden|toHaveText|toContain|toEqual|toMatch)/.test(block);
			if (!hasBehavior) {
				findings.push({
					category: 'tautological',
					file: relPath,
					testName,
					issue: 'Prüft nur Existenz/Vorhandensein, kein Verhalten',
					fix: 'Behavior-Assertion ergänzen oder entfernen wenn durch andere Tests abgedeckt',
					severity: 'info',
				});
			}
		}
	}

	return findings;
}

function generateReport(
	findings: Finding[],
	unitTotal: number,
	unitFail: number,
	e2eTotal: number,
	e2eFail: number,
	reportDir: string,
): string {
	const date = new Date().toISOString().slice(0, 10);
	const criticalCount = findings.filter((f) => f.severity === 'critical').length;
	const warningCount = findings.filter((f) => f.severity === 'warning').length;
	const infoCount = findings.filter((f) => f.severity === 'info').length;

	const byCategory = {
		tautological: findings.filter((f) => f.category === 'tautological'),
		redundant: findings.filter((f) => f.category === 'redundant'),
		emptySet: findings.filter((f) => f.category === 'emptySet'),
		mutation: findings.filter((f) => f.category === 'mutation'),
	};

	let md = `# Test-Optimierung Report — ${date}

> Generiert von \`.github/workflows/test-optimization.yml\` (TDD-Strategie v3, Stufen 1–3)

---

## 1. Zusammenfassung

| Metrik | Wert |
|--------|------|
| Unit-Tests gesamt | ${unitTotal} |
| Unit-Tests fehlgeschlagen | ${unitFail} |
| E2E-Tests (Shard 1/4) | ${e2eTotal} |
| E2E-Tests fehlgeschlagen | ${e2eFail} |
| **Tautologische Tests (Kandidaten)** | **${byCategory.tautological.length}** |
| **Redundante Tests** | **${byCategory.redundant.length}** |
| **Fehlende Empty-Set-Probes** | **${byCategory.emptySet.length}** |
| **Fehlende Mutation-Probes** | **${byCategory.mutation.length}** |
| **Kritische Findings** | **${criticalCount}** |
| Warnungen | ${warningCount} |
| Infos | ${infoCount} |

---

`;

	// 2. Tautologische Tests
	md += `## 2. Tautologische Tests (Implementation Detail vs. Behavior)\n\n`;
	md += `*Tests, die prüfen **wie** etwas implementiert ist, nicht **dass** es funktioniert.*\n\n`;
	if (byCategory.tautological.length === 0) {
		md += `(keine gefunden)\n\n`;
	} else {
		md += `| Test-Datei | Test-Name | Problem | Empfehlung | Severity |\n`;
		md += `|------------|-----------|---------|------------|----------|\n`;
		for (const f of byCategory.tautological) {
			md += `| ${f.file} | ${f.testName} | ${f.issue} | ${f.fix} | ${f.severity} |\n`;
		}
		md += `\n`;
	}

	// 3. Redundanzen
	md += `## 3. Redundanzen (Mehrere Tests, gleiche Invariante)\n\n`;
	md += `*Mehrere Formulierungen derselben Anforderung — nur die stärkste (AK) behalten.*\n\n`;
	if (byCategory.redundant.length === 0) {
		md += `(keine gefunden)\n\n`;
	} else {
		md += `| Invariante | Betroffene Tests | Stärkster Test (behalten) | Entfernen | Severity |\n`;
		md += `|------------|------------------|---------------------------|-----------|----------|\n`;
		for (const f of byCategory.redundant) {
			md += `| ${f.issue} | ${f.file}::${f.testName} | (manuell prüfen) | ${f.fix} | ${f.severity} |\n`;
		}
		md += `\n`;
	}

	// 4. Empty-Set-Probes
	md += `## 4. Fehlende Empty-Set-Probes (All-Quantoren)\n\n`;
	md += `*All-Quantor ohne Prüfung, dass die Menge nicht leer ist — Test geht grün, prüft aber nichts.*\n\n`;
	if (byCategory.emptySet.length === 0) {
		md += `(keine gefunden)\n\n`;
	} else {
		md += `| Test-Datei | All-Quantor | Fehlende Probe | Fix | Severity |\n`;
		md += `|------------|-------------|----------------|-----|----------|\n`;
		for (const f of byCategory.emptySet) {
			md += `| ${f.file} | ${f.testName} | ${f.issue} | ${f.fix} | ${f.severity} |\n`;
		}
		md += `\n`;
	}

	// 5. Mutation-Probes
	md += `## 5. Fehlende Mutation-Probes (Behavior nicht wirklich geprüft)\n\n`;
	md += `*Test geht grün, würde aber bei absichtlicher Verhaltens-Änderung NICHT rot.*\n\n`;
	if (byCategory.mutation.length === 0) {
		md += `(keine gefunden)\n\n`;
	} else {
		md += `| Test-Datei | Test-Name | Mutation, die nicht caught wird | Fix | Severity |\n`;
		md += `|------------|-----------|----------------------------------|-----|----------|\n`;
		for (const f of byCategory.mutation) {
			md += `| ${f.file} | ${f.testName} | ${f.issue} | ${f.fix} | ${f.severity} |\n`;
		}
		md += `\n`;
	}

	// 6. PR-Empfehlungen
	md += `## 6. Konkrete PR-Empfehlungen\n\n`;
	const topCritical = findings.filter((f) => f.severity === 'critical').slice(0, 5);
	if (topCritical.length === 0) {
		md += `(keine kritischen Findings — Test-Suite gesund)\n\n`;
	} else {
		md += `| Priorität | Datei | Test | Änderung |\n`;
		md += `|-----------|-------|------|----------|\n`;
		for (const f of topCritical) {
			md += `| 🔴 Critical | ${f.file} | ${f.testName} | ${f.fix} |\n`;
		}
		md += `\n`;
	}

	// 7. Nächste Schritte
	md += `## 7. Nächste Schritte\n\n`;
	md += `- [ ] Report prüfen\n`;
	md += `- [ ] Top-5 Entfernungs-Kandidaten als PR umsetzen\n`;
	md += `- [ ] Fehlende Probes nachrüsten\n`;
	if (criticalCount > 0) {
		md += `- [ ] Issue mit Label \`test-maintenance\` wurde auto-erstellt\n`;
	}
	md += `\n---\n*Report generiert am ${new Date().toISOString()}*\n`;

	const reportPath = join(reportDir, `test-optimization-report-${date}.md`);
	writeFileSync(reportPath, md);
	return reportPath;
}

function countTestResults(filePath: string): { total: number; failed: number } {
	if (!existsSync(filePath)) return { total: 0, failed: 0 };
	const content = readFileSync(filePath, 'utf8');
	const passed = (content.match(/^\s*✓/gm) || []).length;
	const failed = (content.match(/^\s*✖/gm) || []).length;
	return { total: passed + failed, failed };
}

async function main() {
	const args = parseArgs();

	console.log('🔍 Analysiere Test-Suite...');
	console.log(`  Unit-Results: ${args.unitResults}`);
	console.log(`  E2E-Results: ${args.e2eResults}`);
	console.log(`  Repo-Root: ${args.repoRoot}`);
	console.log(`  Report-Dir: ${args.reportDir}`);

	// Test-Dateien sammeln
	const testDirs = [
		join(args.repoRoot, 'frontend', 'e2e'),
		join(args.repoRoot, 'server', 'src'),
		join(args.repoRoot, '.github', 'workflows'),
		join(args.repoRoot, 'tests'),
	];

	let allTestFiles: string[] = [];
	for (const dir of testDirs) {
		allTestFiles.push(...findTestFiles(dir));
	}
	console.log(`  Gefunden: ${allTestFiles.length} Test-Dateien`);

	// Analysen durchführen
	let allFindings: Finding[] = [];

	for (const file of allTestFiles) {
		const content = readFileSync(file, 'utf8');
		allFindings.push(...analyzeTestFile(file, content));
	}

	allFindings.push(...analyzeRedundancy(allTestFiles));
	allFindings.push(...analyzeMutationGaps(allTestFiles));

	// Test-Counts
	const unitCounts = countTestResults(args.unitResults);
	const e2eCounts = countTestResults(args.e2eResults);

	// Report generieren
	const reportPath = generateReport(
		allFindings,
		unitCounts.total,
		unitCounts.failed,
		e2eCounts.total,
		e2eCounts.failed,
		args.reportDir,
	);

	console.log(`✅ Report geschrieben: ${reportPath}`);
	console.log(
		`   Findings: ${allFindings.length} (Critical: ${allFindings.filter((f) => f.severity === 'critical').length})`,
	);

	// Outputs für GitHub Actions (modern: GITHUB_OUTPUT file)
	const criticalFindings = allFindings.some((f) => f.severity === 'critical');
	const githubOutput = process.env.GITHUB_OUTPUT;
	if (githubOutput) {
		const { appendFileSync } = await import('node:fs');
		appendFileSync(githubOutput, `report_path=${reportPath}\n`);
		appendFileSync(githubOutput, `critical_findings=${criticalFindings}\n`);
	} else {
		// Fallback für lokale Ausführung
		console.log(`::set-output name=report_path::${reportPath}`);
		console.log(`::set-output name=critical_findings::${criticalFindings}`);
	}
}

main().catch((err) => {
	console.error('❌ Analyse fehlgeschlagen:', err);
	process.exit(1);
});
