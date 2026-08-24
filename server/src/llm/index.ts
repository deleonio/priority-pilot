/**
 * LLM-Modul — Barrel-Exporte.
 *
 * Jede Anfrage läuft an den EINEN aktiven Provider (#951); die frühere
 * Mistral→OpenRouter-Kaskade ist entfernt.
 */

export type {
	PillarClassifier,
	ParseTaskParser,
	ActivityAdvisor,
	PillarSuggestion,
	ParsedTask,
	ActivityAdvice,
	ClassifyPillarsInput,
	AdviseActivitiesInput,
	LektoratFunction,
	LektoratInput,
	LektoratOutput,
} from './llm.js';

export { lektoratTextWithMistral } from './llm.js';
