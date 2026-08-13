/**
 * Mistral Provider Implementation
 * Spec: docs/spec/issue-638.md - "MistralProvider class implements interface with existing Mistral logic"
 *
 * Wraps the existing Mistral functions (classifyPillarsWithMistral, parseTaskTextWithMistral,
 * adviseActivitiesWithMistral) into a class that implements the provider interface.
 */

import {
	classifyPillarsWithMistral,
	parseTaskTextWithMistral,
	adviseActivitiesWithMistral,
	type ClassifyPillarsInput,
	type AdviseActivitiesInput,
} from './mistral.js';

/**
 * MistralProvider implements the provider interface using the existing Mistral functions.
 */
export class MistralProvider {
	/**
	 * Classify a task onto pillars using Mistral.
	 * Spec issue-638.md: "MistralProvider class implements interface with existing Mistral logic"
	 */
	async classifyPillars(input: ClassifyPillarsInput) {
		return classifyPillarsWithMistral(input);
	}

	/**
	 * Parse task text using Mistral.
	 * Spec issue-638.md: "MistralProvider class implements interface with existing Mistral logic"
	 */
	async parseTaskText(text: string) {
		return parseTaskTextWithMistral(text);
	}

	/**
	 * Advise activities using Mistral.
	 * Spec issue-638.md: "MistralProvider class implements interface with existing Mistral logic"
	 */
	async adviseActivities(input: AdviseActivitiesInput) {
		return adviseActivitiesWithMistral(input);
	}
}
