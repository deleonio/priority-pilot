import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { isAllowedGhArgs } from '../../.github/scripts/pi-gh-allowlist.ts';
import { writeMemoryFile } from '../../.github/scripts/pi-memory-write.ts';

/**
 * Ersatz für `bash` im pi-Tier `restricted` (#1193, Invoke in `setup-pi`): `gh` mit
 * Kommando-Allowlist und `memory_write` mit Pfadzwang auf `.ai-memory/`. Die Grenzen liegen
 * in den getesteten Modulen unter `.github/scripts/`; eine Ablehnung wirft und erscheint so
 * als Tool-Fehler im Lauf. Dünner Adapter ohne eigene Tests (ADR 0001).
 */

const run = promisify(execFile);

interface ToolApi {
	registerTool(tool: {
		name: string;
		label: string;
		description: string;
		parameters: object;
		execute(toolCallId: string, params: Record<string, unknown>): Promise<unknown>;
	}): void;
}

const text = (value: string) => ({ content: [{ type: 'text', text: value }], details: {} });

export default function restrictedTools(pi: ToolApi): void {
	pi.registerTool({
		name: 'gh',
		label: 'gh',
		description:
			'Ruft die GitHub-CLI ohne Shell auf. Erlaubt: issue view|list|comment, issue edit nur mit --title/--add-label/--remove-label, api graphql mit reiner Query oder den Mutationen updateIssueComment, addSubIssue, addBlockedBy (Query als -f query=..., Texte als -f name=... statt Dateien). Alles andere wird abgelehnt.',
		parameters: {
			type: 'object',
			properties: {
				args: { type: 'array', items: { type: 'string' }, description: 'Argumente ohne das führende "gh"' },
			},
			required: ['args'],
		},
		async execute(_toolCallId, params) {
			const args = params.args as string[];
			if (!isAllowedGhArgs(args)) throw new Error(`gh abgelehnt (nicht in der Allowlist): gh ${args.join(' ')}`);
			const { stdout, stderr } = await run('gh', args, { maxBuffer: 32 * 1024 * 1024 });
			return text(stdout || stderr);
		},
	});

	pi.registerTool({
		name: 'memory_write',
		label: 'memory_write',
		description: 'Schreibt eine Datei unter .ai-memory/ (Pfad relativ zu .ai-memory/). Andere Ziele werden abgelehnt.',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Zielpfad, z. B. issue-123-triage.md' },
				content: { type: 'string', description: 'Vollständiger Dateiinhalt' },
			},
			required: ['path', 'content'],
		},
		async execute(_toolCallId, params) {
			writeMemoryFile(process.cwd(), params.path as string, params.content as string);
			return text(`geschrieben: ${params.path as string}`);
		},
	});
}
