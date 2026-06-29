/**
 * Rote Spec-Tests für Issue #177
 *
 * AK-1: AGENTS.md dokumentiert alle drei Aufrufpfade des Kreuzverhoer-Agents
 *        (Chat-Trigger, Slash-Command, CI via ai:needs-review) in einem eigenen Unterabschnitt.
 *
 * AK-2–4: Der Haupt-prompt:-Block in claude-pr-review.yml enthält einen expliziten
 *          Komplexitätsbewertungsschritt, der den Sonnet-Koordinator anweist, triviale PRs an
 *          `light` (Haiku) und komplexe an `heavy` (Opus) zu delegieren; Standard-Reviews
 *          führt er selbst durch. Hinweis: Der --append-system-prompt enthält diese Delegation
 *          bereits generisch; der Haupt-Prompt soll sie als expliziten ersten Schritt ergänzen.
 *
 * Die Tests prüfen ausschließlich Dateiinhalt — kein Produktivcode, keine Laufzeitlogik.
 * Sie werden grün, sobald die Implementierung die Dateien entsprechend ergänzt.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// process.cwd() when running tests is the server/ package root; .. reaches project root
const ROOT = resolve(process.cwd(), '..');

async function readProjectFile(rel: string): Promise<string> {
	return readFile(resolve(ROOT, rel), 'utf-8');
}

/**
 * Extrahiert den Haupt-prompt:-Block aus dem Claude-Step in claude-pr-review.yml.
 * Der Block beginnt bei `prompt: |` und endet vor `claude_args:`.
 * So wird --append-system-prompt (das die Delegation bereits enthält) ausgeschlossen.
 */
function extractMainPromptBlock(workflowContent: string): string {
	const promptStart = workflowContent.indexOf('          prompt: |');
	const claudeArgsStart = workflowContent.indexOf('          claude_args:', promptStart);
	if (promptStart < 0 || claudeArgsStart < 0) return '';
	return workflowContent.slice(promptStart, claudeArgsStart);
}

describe('AK-1 — AGENTS.md: Aufrufpfade des Kreuzverhoer-Agents', () => {
	it('enthält einen eigenen Unterabschnitt "Aufrufpfade" unter dem PR-Review-Abschnitt', async () => {
		const content = await readProjectFile('AGENTS.md');
		const prReviewIdx = content.indexOf('## PR-Review');
		assert.ok(prReviewIdx >= 0, 'Abschnitt ## PR-Review muss in AGENTS.md existieren');
		const afterPrReview = content.slice(prReviewIdx);
		assert.ok(
			afterPrReview.includes('Aufrufpfade'),
			'AGENTS.md muss nach ## PR-Review einen "Aufrufpfade"-Unterabschnitt enthalten',
		);
	});

	it('dokumentiert den Chat-Trigger-Pfad mit konkreten Trigger-Phrasen', async () => {
		const content = await readProjectFile('AGENTS.md');
		const prReviewIdx = content.indexOf('## PR-Review');
		assert.ok(prReviewIdx >= 0, 'Abschnitt ## PR-Review muss existieren');
		const afterPrReview = content.slice(prReviewIdx);
		// Der Chat-Trigger-Pfad muss im Aufrufpfade-Abschnitt mit Trigger-Phrasen aufgeführt sein
		const aufrufIdx = afterPrReview.indexOf('Aufrufpfade');
		assert.ok(aufrufIdx >= 0, 'Aufrufpfade-Abschnitt muss existieren');
		const aufrufSection = afterPrReview.slice(aufrufIdx);
		// Mindestens zwei der bekannten Trigger-Phrasen müssen im Aufrufpfade-Abschnitt stehen
		const phrasen = ['nimm das auseinander', 'stress-teste', 'challenge mich', 'Kreuzverhör'].filter((p) =>
			aufrufSection.toLowerCase().includes(p.toLowerCase()),
		);
		assert.ok(
			phrasen.length >= 2,
			`AGENTS.md muss im Aufrufpfade-Abschnitt mind. 2 Chat-Trigger-Phrasen nennen; gefunden: ${phrasen.join(', ')}`,
		);
	});

	it('dokumentiert den Slash-Command-Pfad im Aufrufpfade-Abschnitt', async () => {
		const content = await readProjectFile('AGENTS.md');
		const prReviewIdx = content.indexOf('## PR-Review');
		assert.ok(prReviewIdx >= 0, 'Abschnitt ## PR-Review muss existieren');
		const afterPrReview = content.slice(prReviewIdx);
		const aufrufIdx = afterPrReview.indexOf('Aufrufpfade');
		assert.ok(aufrufIdx >= 0, 'Aufrufpfade-Abschnitt muss existieren');
		// Im Aufrufpfade-Abschnitt (vor dem nächsten ##-Abschnitt) muss /kreuzverhoer-review stehen
		const aufrufSection = afterPrReview.slice(aufrufIdx);
		const nextSectionIdx = aufrufSection.indexOf('\n## ', 1);
		const boundedSection = nextSectionIdx > 0 ? aufrufSection.slice(0, nextSectionIdx) : aufrufSection;
		assert.ok(
			boundedSection.includes('/kreuzverhoer-review'),
			'AGENTS.md muss /kreuzverhoer-review als Slash-Command-Pfad im Aufrufpfade-Abschnitt nennen',
		);
	});

	it('dokumentiert den CI-Pfad (GitHub Actions, ai:needs-review) im Aufrufpfade-Abschnitt', async () => {
		const content = await readProjectFile('AGENTS.md');
		const prReviewIdx = content.indexOf('## PR-Review');
		assert.ok(prReviewIdx >= 0, 'Abschnitt ## PR-Review muss existieren');
		const afterPrReview = content.slice(prReviewIdx);
		const aufrufIdx = afterPrReview.indexOf('Aufrufpfade');
		assert.ok(aufrufIdx >= 0, 'Aufrufpfade-Abschnitt muss existieren');
		const aufrufSection = afterPrReview.slice(aufrufIdx);
		const nextSectionIdx = aufrufSection.indexOf('\n## ', 1);
		const boundedSection = nextSectionIdx > 0 ? aufrufSection.slice(0, nextSectionIdx) : aufrufSection;
		// CI-Pfad muss ai:needs-review als Auslösebedingung im Aufrufpfade-Abschnitt nennen
		assert.ok(
			boundedSection.includes('ai:needs-review'),
			'AGENTS.md muss im Aufrufpfade-Abschnitt den CI-Pfad via ai:needs-review nennen',
		);
	});
});

describe('AK-2/AK-3/AK-4 — claude-pr-review.yml: Komplexitäts-Delegation im Haupt-Prompt', () => {
	it('AK-2/3/4: Haupt-prompt:-Block enthält einen expliziten Komplexitätsbewertungsschritt', async () => {
		const content = await readProjectFile('.github/workflows/claude-pr-review.yml');
		const mainPrompt = extractMainPromptBlock(content);
		assert.ok(mainPrompt.length > 0, 'Haupt-prompt:-Block muss im Claude-Step von claude-pr-review.yml existieren');
		const hasKomplexitaet =
			mainPrompt.includes('Komplexitaet') || mainPrompt.includes('Komplexität') || mainPrompt.includes('Komplexit');
		assert.ok(
			hasKomplexitaet,
			'Der Haupt-prompt:-Block muss eine Komplexitätsbewertung des PRs anweisen (nicht nur --append-system-prompt)',
		);
	});

	it('AK-2: Haupt-prompt:-Block weist Delegation an `light` (Haiku) für triviale PRs an', async () => {
		const content = await readProjectFile('.github/workflows/claude-pr-review.yml');
		const mainPrompt = extractMainPromptBlock(content);
		assert.ok(mainPrompt.length > 0, 'Haupt-prompt:-Block muss existieren');
		const delegiereLight =
			(mainPrompt.includes('light') && mainPrompt.includes('trivial')) ||
			(mainPrompt.includes('light') && mainPrompt.includes('Haiku')) ||
			(mainPrompt.includes('light') && mainPrompt.includes('klein'));
		assert.ok(delegiereLight, 'Haupt-prompt:-Block muss Delegation an `light` (Haiku) für triviale PRs anweisen');
	});

	it('AK-3: Haupt-prompt:-Block weist Delegation an `heavy` (Opus) für komplexe PRs an', async () => {
		const content = await readProjectFile('.github/workflows/claude-pr-review.yml');
		const mainPrompt = extractMainPromptBlock(content);
		assert.ok(mainPrompt.length > 0, 'Haupt-prompt:-Block muss existieren');
		const delegiereHeavy =
			(mainPrompt.includes('heavy') && mainPrompt.includes('komplex')) ||
			(mainPrompt.includes('heavy') && mainPrompt.includes('Opus')) ||
			(mainPrompt.includes('heavy') && mainPrompt.includes('architekton'));
		assert.ok(delegiereHeavy, 'Haupt-prompt:-Block muss Delegation an `heavy` (Opus) für komplexe PRs anweisen');
	});

	it('AK-4: Haupt-prompt:-Block weist Standard-Reviews auf Sonnet (ohne Subagenten) an', async () => {
		const content = await readProjectFile('.github/workflows/claude-pr-review.yml');
		const mainPrompt = extractMainPromptBlock(content);
		assert.ok(mainPrompt.length > 0, 'Haupt-prompt:-Block muss existieren');
		// Standard-Reviews ohne Subagenten-Aufruf — "selbst" oder "Sonnet" im Kontext Standard/normal
		const standardSonnet =
			(mainPrompt.includes('selbst') && (mainPrompt.includes('Standard') || mainPrompt.includes('normal'))) ||
			(mainPrompt.includes('Sonnet') && (mainPrompt.includes('Standard') || mainPrompt.includes('normal')));
		assert.ok(
			standardSonnet,
			'Haupt-prompt:-Block muss Standard-Reviews ohne Subagenten-Delegation auf Sonnet anweisen',
		);
	});
});
