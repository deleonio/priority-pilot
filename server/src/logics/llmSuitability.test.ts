/**
 * Rote Spec-Tests für #2349 (Spec docs/spec/issue-2349.md) — AK1/AK2: Heuristik-Klassifikation
 * der KI-Eignung. Rot, bis `llmSuitability.ts` existiert.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLlmSuitability } from './llmSuitability.js';

type Category = 'draft' | 'summary' | 'research';

const CASES: Record<string, Record<Category, string>> = {
	de: {
		draft: 'E-Mail an Krankenkasse wegen Kur-Antrag entwerfen',
		summary: 'Vertragsunterlagen der Versicherung zusammenfassen',
		research: 'Recherchiere passende Kinderärzte in der Nähe',
	},
	en: {
		draft: 'Draft an email to the insurance about the spa application',
		summary: 'Summarize the insurance contract documents',
		research: 'Research pediatricians nearby',
	},
	es: {
		draft: 'Redactar un correo al seguro sobre la solicitud de cura',
		summary: 'Resumir los documentos del contrato del seguro',
		research: 'Investigar pediatras cercanos',
	},
	fr: {
		draft: "Rédiger un e-mail à l'assurance pour la demande de cure",
		summary: "Résumer les documents du contrat d'assurance",
		research: 'Rechercher des pédiatres à proximité',
	},
	it: {
		draft: "Scrivere una e-mail all'assicurazione per la richiesta di cura",
		summary: "Riassumere i documenti del contratto dell'assicurazione",
		research: 'Cercare pediatri nelle vicinanze',
	},
	nl: {
		draft: 'Een e-mail aan de verzekeraar opstellen over de kuuraanvraag',
		summary: 'De verzekeringsdocumenten samenvatten',
		research: 'Kinderartsen in de buurt opzoeken',
	},
	pl: {
		draft: 'Napisać e-mail do ubezpieczalni w sprawie wniosku o kurację',
		summary: 'Streścić dokumenty umowy ubezpieczenia',
		research: 'Wyszukać pediatrów w pobliżu',
	},
	pt: {
		draft: 'Redigir um e-mail ao seguro sobre o pedido de cura',
		summary: 'Resumir os documentos do contrato do seguro',
		research: 'Pesquisar pediatras na região',
	},
	ru: {
		draft: 'Составить письмо в страховую по заявлению на курс лечения',
		summary: 'Кратко изложить документы страхового договора',
		research: 'Найти информацию о детских врачах поблизости',
	},
	sv: {
		draft: 'Skriva ett e-postmeddelande till försäkringen om kuransökan',
		summary: 'Sammanfatta försäkringsavtalets dokument',
		research: 'Undersöka barnläkare i närheten',
	},
};

describe('classifyLlmSuitability (#2349)', () => {
	for (const [lang, byCategory] of Object.entries(CASES)) {
		for (const [category, title] of Object.entries(byCategory)) {
			it(`AK1 ${lang}: „${title}“ → ${category}`, () => {
				assert.equal(classifyLlmSuitability(title, null), category);
			});
		}
	}

	it('AK1: Beschreibung allein kann die Kategorie liefern', () => {
		assert.equal(classifyLlmSuitability('Kur-Antrag', 'Brief an die Krankenkasse entwerfen'), 'draft');
	});

	for (const title of ['Fenster putzen', 'Wash the windows', 'Milch kaufen', 'Zahnarzt anrufen']) {
		it(`AK2: „${title}“ → null`, () => {
			assert.equal(classifyLlmSuitability(title, null), null);
		});
	}

	it('AK2: leere Eingabe → null', () => {
		assert.equal(classifyLlmSuitability('', null), null);
	});
});
