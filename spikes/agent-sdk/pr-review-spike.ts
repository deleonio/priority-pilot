/**
 * Agent-SDK-Spike (Issue #114) — Prototyp EINES Workflow-Schritts ueber den Agent SDK,
 * nachgebaut anhand von `.github/workflows/claude-pr-review.yml` (liest den Diff eines PRs
 * und erzeugt einen Review-Kommentar). Ziel ist NICHT die Migration, sondern ein lokal
 * reproduzierbarer Vergleichspunkt gegen die heute genutzte `anthropics/claude-code-action`.
 *
 * Throwaway: liegt bewusst unter `spikes/` und wird NICHT in die Produktiv-Workflows gemerged.
 *
 * Headless-Auth (wie die Action im Runner): ueber Umgebungsvariable/Secret, nicht interaktiv.
 *   - `ANTHROPIC_API_KEY`       — direkter API-Key (laut Recherche der eindeutig unterstuetzte
 *                                 Pfad fuer SDK/Headless-Wrapper), oder
 *   - `CLAUDE_CODE_OAUTH_TOKEN` — dasselbe OAuth-Token, das der Claude-Pfad heute nutzt.
 *
 * Start (siehe README.md):
 *   ANTHROPIC_API_KEY=sk-... node --import tsx spikes/agent-sdk/pr-review-spike.ts <pr-diff-datei>
 */
import { readFileSync } from 'node:fs';

import { query } from '@anthropic-ai/claude-agent-sdk';

/** Liest das Headless-Secret aus der Umgebung — kein interaktiver Login (CI-tauglich). */
const resolveAuth = (): string => {
	const token = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_CODE_OAUTH_TOKEN;
	if (!token) {
		throw new Error(
			'Kein Headless-Secret gefunden: ANTHROPIC_API_KEY oder CLAUDE_CODE_OAUTH_TOKEN setzen ' +
				'(genau wie die claude-code-action im Runner).',
		);
	}
	return token;
};

/** Baut den Review-Prompt — bewusst minimal, spiegelt den Kern von claude-pr-review.yml. */
const buildReviewPrompt = (diff: string): string =>
	[
		'Du bist ein kritischer PR-Reviewer (Kreuzverhoer). Pruefe den folgenden Diff auf',
		'Korrektheit, fehlende Tests und Konventions-Verstoesse. Antworte mit einer Ampel',
		'(gruen/gelb/rot) und kurzen, konkreten Findings.',
		'',
		'```diff',
		diff,
		'```',
	].join('\n');

const main = async (): Promise<void> => {
	resolveAuth();

	const diffPath = process.argv[2];
	const diff = diffPath ? readFileSync(diffPath, 'utf8') : 'diff --git a/demo.ts b/demo.ts\n+const x = 1;';

	// Einstiegspunkt des Agent SDK: query() startet die Claude-Code-Maschinerie als Subprozess
	// und streamt strukturierte Nachrichten zurueck — die programmatische Einbettung, die die
	// fertige Action kapselt. Session-Fortsetzung waere hier ueber die `resume`-Option moeglich.
	try {
		const response = query({
			prompt: buildReviewPrompt(diff),
			options: {
				// Headless: keine Tool-Genehmigungs-Callbacks, deterministischer CI-Lauf.
				permissionMode: 'bypassPermissions',
			},
		});

		for await (const message of response) {
			if (message.type === 'assistant') {
				for (const block of message.message.content) {
					if (block.type === 'text') {
						process.stdout.write(block.text);
					}
				}
			}
		}
		process.stdout.write('\n');
	} catch (error) {
		console.error('Query failed:', error);
		process.exit(1);
	}
};

void main();
