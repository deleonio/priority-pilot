/**
 * Rote Spec-Tests für Issue #261
 *
 * AK-1: GraphQL addSubIssue muss als **Pflicht** (Pflichtschritt) gekennzeichnet sein,
 *       nicht optional. Die Markdown-Task-Liste dient nur als Fallback bei **API-Fehler**,
 *       nicht als generelle Alternative.
 *
 * AK-2: Wenn der Fallback (Markdown-Task-Liste) verwendet wird, muss der Ping-Kommentar
 *       (Schritt 4b) den API-Fehler dokumentieren.
 *
 * Die Tests prüfen ausschließlich Dateiinhalt — kein Produktivcode, keine Laufzeitlogik.
 * Sie werden grün, sobald die Implementierung `.ai-knowledge/ticket-triage.md` entsprechend
 * angepasst und "Pflicht" + "API-Fehler"-Bedingung hinzufügt.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');

async function readProjectFile(rel: string): Promise<string> {
	return readFile(resolve(ROOT, rel), 'utf-8');
}

describe('AK-1 — addSubIssue als Pflichtschritt', () => {
	it('kennzeichnet die GraphQL-Mutation addSubIssue als Pflichtschritt', async () => {
		const content = await readProjectFile('.ai-knowledge/ticket-triage.md');

		const addSubIssueIdx = content.indexOf('addSubIssue');
		assert.ok(addSubIssueIdx >= 0, 'ticket-triage.md muss "addSubIssue" erwähnen');

		// Suche "Pflicht" in einem Bereich von 500 Zeichen um addSubIssue
		const start = Math.max(0, addSubIssueIdx - 500);
		const end = Math.min(content.length, addSubIssueIdx + 500);
		const contextWindow = content.slice(start, end);

		assert.ok(
			contextWindow.includes('Pflicht'),
			'Der Abschnitt um "addSubIssue" (±500 Zeichen) muss das Wort "Pflicht" enthalten, um die Mutation als Pflichtschritt zu kennzeichnen',
		);
	});

	it('beschreibt Markdown-Task-Liste nur als Fallback bei API-Fehler', async () => {
		const content = await readProjectFile('.ai-knowledge/ticket-triage.md');

		const addSubIssueIdx = content.indexOf('addSubIssue');
		assert.ok(addSubIssueIdx >= 0, 'ticket-triage.md muss "addSubIssue" erwähnen');

		// Suche nach der Task-Liste-Erwähnung nach addSubIssue
		const afterAddSubIssue = content.slice(addSubIssueIdx);
		const taskListIdx = afterAddSubIssue.indexOf('Task-Liste');
		assert.ok(taskListIdx >= 0, 'Nach "addSubIssue" muss "Task-Liste" erwähnt sein');

		// Suche nach einer Fehler-Bedingung im Fallback-Abschnitt (bis zum nächsten Hauptabschnitt)
		const nextSectionIdx = afterAddSubIssue.indexOf('\n## ', taskListIdx);
		const fallbackSection = nextSectionIdx > 0 ? afterAddSubIssue.slice(0, nextSectionIdx) : afterAddSubIssue;

		// Prüfe, dass der Fallback-Abschnitt eine explizite API-Fehler-Bedingung erwähnt.
		// "nicht verfügbar" existiert bereits im alten Text — dieser Test prüft, ob die neue
		// Formulierung explizit auf einen Fehlerfall ("API-Fehler", "fehlschlägt",
		// "tatsächlichen Fehler", "nur bei") abzielt, nicht nur auf generelle Nichtverfügbarkeit.
		const hasApiFehlerCondition =
			fallbackSection.includes('API-Fehler') ||
			fallbackSection.includes('fehlschlägt') ||
			fallbackSection.includes('tatsächlich') ||
			(fallbackSection.includes('nur bei') && fallbackSection.includes('Fehler'));

		assert.ok(
			hasApiFehlerCondition,
			'Der Fallback-Abschnitt muss die Task-Liste explizit auf einen API-Fehler konditionieren ("API-Fehler", "fehlschlägt", "tatsächlich") — nicht nur "nicht verfügbar" (das ist die alte, zu lockere Formulierung)',
		);
	});
});

describe('AK-2 — Fallback-Dokumentation im Ping-Kommentar', () => {
	it('verlangt Hinweis auf API-Fehler im Ping-Kommentar beim Fallback', async () => {
		const content = await readProjectFile('.ai-knowledge/ticket-triage.md');

		const addSubIssueIdx = content.indexOf('addSubIssue');
		assert.ok(addSubIssueIdx >= 0, 'ticket-triage.md muss "addSubIssue" erwähnen');

		// Finde den Sub-Issue-Abschnitt (von addSubIssue bis zum nächsten ## Schritt)
		const afterAddSubIssue = content.slice(addSubIssueIdx);
		const nextStepIdx = afterAddSubIssue.indexOf('\n## Schritt 4');
		const subIssueSection = nextStepIdx > 0 ? afterAddSubIssue.slice(0, nextStepIdx) : afterAddSubIssue;

		// Prüfe, dass der Abschnitt Ping-Kommentar + Fallback-Dokumentation verbindet
		const hasPingMention =
			subIssueSection.includes('Ping') || subIssueSection.includes('4b') || subIssueSection.includes('Kommentar');

		const hasErrorDocumentation =
			subIssueSection.includes('API-Fehler') ||
			subIssueSection.includes('API-fehler') ||
			subIssueSection.includes('Fehler dokumentieren') ||
			subIssueSection.includes('Fehler hinweisen') ||
			subIssueSection.includes('Grund') ||
			subIssueSection.includes('begründen');

		assert.ok(hasPingMention, 'Der Sub-Issue-Abschnitt muss Ping-Kommentar oder Schritt 4b erwähnen');

		assert.ok(
			hasErrorDocumentation,
			'Der Sub-Issue-Abschnitt muss erwähnen, dass der API-Fehler dokumentiert/begründet werden muss (z. B. im Ping-Kommentar)',
		);

		// Zusätzliche Prüfung: Fallback und Dokumentation sollten räumlich nah beieinander sein
		const fallbackSectionWindow = subIssueSection.slice(
			subIssueSection.indexOf('Task-Liste') - 100,
			Math.min(subIssueSection.length, subIssueSection.indexOf('Task-Liste') + 500),
		);

		assert.ok(
			fallbackSectionWindow.length > 0 &&
				(fallbackSectionWindow.includes('Ping') ||
					fallbackSectionWindow.includes('4b') ||
					fallbackSectionWindow.includes('Kommentar')),
			'Fallback-Beschreibung (Task-Liste) sollte in räumlicher Nähe (±500 Zeichen) zu Ping/4b stehen',
		);
	});
});
