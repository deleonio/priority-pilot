import { PillarFeedback } from '../models/index.js';
import type { FeedbackExample } from '../llm/llm.js';

/**
 * Wie viele der jüngsten Nutzer-Korrekturen als gelernte Few-Shot-Beispiele in den Prompt fließen.
 * Begrenzt, damit der Prompt nicht unbegrenzt wächst (Token-/Kosten-Schutz); die neuesten Samples
 * sind am aussagekräftigsten (siehe #45).
 */
export const MAX_FEEDBACK_EXAMPLES = 10;

/**
 * Wie viele jüngste Zeilen maximal aus `pillar_feedback` gescannt werden, um daraus die
 * {@link MAX_FEEDBACK_EXAMPLES} nicht-leeren Beispiele zu gewinnen. Über-Fetch, weil leere
 * Korrektur-Samples (alle Vorschläge verworfen → `pillars: []`) zwar ein gültiger Fall sind,
 * aber als Few-Shot wertlos wären; würden sie das 10er-Fenster belegen, klassifizierte der Loop
 * still ohne die noch vorhandenen, nützlichen Korrekturen (siehe #45). Der Scan bleibt gedeckelt,
 * damit eine voll laufende Tabelle den Aufruf nicht ausbremst.
 */
export const FEEDBACK_SCAN_LIMIT = MAX_FEEDBACK_EXAMPLES * 10;

/**
 * Lädt die jüngsten **nicht-leeren** Korrektur-Samples als gelernte Few-Shot-Beispiele. Leere
 * Samples (Nutzer hat alle Vorschläge verworfen) werden übersprungen, damit sie das Fenster der
 * {@link MAX_FEEDBACK_EXAMPLES} nicht belegen und die noch vorhandenen, nützlichen Korrekturen
 * nicht verdrängen (siehe #45). Dafür wird bis zu {@link FEEDBACK_SCAN_LIMIT} Zeilen über-gefetcht
 * und erst nach dem Filtern auf die ersten N nicht-leeren begrenzt.
 *
 * Seit #430 werden die Samples **pro Nutzer** geladen (`userId`-Scope): Few-Shot-Beispiele eines
 * Nutzers dürfen nicht in die Klassifikation eines anderen Nutzers einsickern. Im Pass-Through-Modus
 * (kein Auth-Kontext → `userId === undefined`, lokale Entwicklung ohne Login) bleibt das Verhalten
 * **global** (Abwärtskompatibilität) — historische Samples ohne `userId` werden dann mit geladen.
 */
export const loadFeedbackExamples = async (userId?: number): Promise<FeedbackExample[]> => {
	const rows = await PillarFeedback.findAll({
		...(userId !== undefined ? { where: { userId } } : {}),
		order: [['createdAt', 'DESC']],
		limit: FEEDBACK_SCAN_LIMIT,
	});
	const examples: FeedbackExample[] = [];
	for (const row of rows) {
		if (row.pillars.length === 0) {
			continue;
		}
		examples.push({
			title: row.title,
			description: row.description ?? undefined,
			pillars: row.pillars.map((entry) => ({ pillarId: entry.pillarId, confidence: entry.confidence })),
		});
		if (examples.length >= MAX_FEEDBACK_EXAMPLES) {
			break;
		}
	}
	return examples;
};
