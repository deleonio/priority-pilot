/**
 * OpenRouter Provider Stub
 * Spec: docs/spec/issue-638.md - "OpenRouterProvider stub class (placebo implementation returning empty results)"
 *
 * This is a placeholder implementation. The real implementation will come in the implementation phase.
 */

import type { ClassifyPillarsInput, AdviseActivitiesInput } from './mistral.js';

export class OpenRouterProvider {
	async classifyPillars(_input: ClassifyPillarsInput): Promise<unknown[]> {
		return []; // Placebo implementation
	}

	async parseTaskText(_text: string): Promise<unknown> {
		return {}; // Placebo implementation
	}

	async adviseActivities(_input: AdviseActivitiesInput): Promise<unknown[]> {
		return []; // Placebo implementation
	}
}
