/**
 * LLM-Modul — Barrel-Exporte.
 *
 * Jede Anfrage läuft als Kaskade: Mistral (Primär-Call) → OpenRouter (Verfeinerung mit
 * Mistral's Antwort als Zweitmeinung). Fällt ein Provider aus, liefert der andere allein
 * das Ergebnis. Die Key-Verfügbarkeit steuert, welche Stufen aktiv sind.
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
} from './llm.js';
