/**
 * OpenRouter Provider Stub
 * Spec: docs/spec/issue-638.md - "OpenRouterProvider stub class (placebo implementation returning empty results)"
 *
 * This is a placeholder implementation. The real implementation will come in the implementation phase.
 */

export class OpenRouterProvider {
	async classifyPillars(): Promise<unknown[]> {
		return []; // Placebo implementation
	}

	async parseTaskText(): Promise<unknown> {
		return {}; // Placebo implementation
	}

	async adviseActivities(): Promise<unknown[]> {
		return []; // Placebo implementation
	}
}
