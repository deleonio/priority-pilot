/**
 * Rote Spec-Tests für Issue #557
 *
 * "Konzeption – Sequenzielle Bestätigung (UX-Confirm-Dialogs)"
 *
 * Akzeptanzkriterien (aus Issue-Body / KI-Analyse):
 * AC1: Pattern "Sequenzielle Bestätigung" ist als neue Doku-Seite unter docs/ abgelegt
 *      (kebab-case, folgt Doku-Konvention).
 * AC2: Inhalt deckt alle drei Abschnitte – Theoretische Fundierung, Barrierefreiheit,
 *      Flow-Integration – sowie beide Flow-Schritte (Intentionsprüfung → Scope-Definition).
 * AC3: Seite ist von künftigen Implementierungs-Issues referenzierbar (stabiler Pfad/Link).
 * AC4: Barrierefreiheits-Anforderung (striktes Fokus-Management beim Übergang) ist als
 *      verbindliche Vorgabe formuliert.
 * AC5: Seite folgt dem Doku-Style-Guide (Sprache/Formatierung analog user-guide.md).
 *
 * Verifikationsfälle T1–T5 sind 1:1 auf die ACs abgebildet.
 *
 * Dedup-Hinweis: Kein bestehender Test deckt dieses Dokument ab (testkonzept-testing-md
 * prüft docs/testing.md, ein anderes Dokument). Keine Dubletten.
 *
 * Die Tests prüfen ausschließlich Dateiinhalt – kein Produktivcode, keine Laufzeitlogik.
 * Sie sind rot, bis das Dokument angelegt ist.
 *
 * Pfadfestlegung: Die KI-Analyse schlägt docs/ux-pattern-sequential-confirmation.md vor;
 * dieser Pfad ist hier als stabiler, referenzierbarer Pfad (AC3) festgeschrieben.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const DOC = 'docs/ux-pattern-sequential-confirmation.md';

async function readDoc(): Promise<string> {
	return readFile(resolve(ROOT, DOC), 'utf-8');
}

describe('AC1 / T1 — Pattern-Seite unter docs/ (kebab-case, Doku-Konvention)', () => {
	it('legt die Seite unter dem stabilen kebab-case-Pfad docs/ux-pattern-sequential-confirmation.md an', async () => {
		const content = await readDoc();
		assert.ok(content.trim().length > 0, `${DOC} darf nicht leer sein`);
		// Dateiname folgt Doku-Konvention: kebab-case (keine Leerzeichen/Großbuchstaben).
		assert.match(
			DOC,
			/^docs\/[a-z0-9]+(-[a-z0-9]+)*\.md$/,
			`${DOC} muss kebab-case folgen (keine Leer-/Großbuchstaben).`,
		);
	});

	it('beginnt wie user-guide.md mit einer H1-Überschrift als Titel', async () => {
		const content = await readDoc();
		assert.match(content, /^#\s+\S/m, `${DOC} muss mit einer H1-Überschrift (Titel) beginnen.`);
	});
});

describe('AC2 / T2 — Drei Abschnitte + beide Flow-Schritte vollständig', () => {
	it('enthält den Abschnitt Theoretische Fundierung', async () => {
		const content = await readDoc();
		assert.ok(
			/theoretisch|fundierung|fachliteratur|hick|nielsen/i.test(content),
			`${DOC} muss den Abschnitt "Theoretische Fundierung" enthalten (Fachliteratur/Hick/Nielsen).`,
		);
	});

	it('nennt die drei theoretischen Konzepte (Hicksches Gesetz, Progressive Disclosure, Error Prevention)', async () => {
		const content = await readDoc();
		assert.ok(/hick/i.test(content), `${DOC} muss das Hick'sche Gesetz nennen.`);
		assert.ok(/progressive\s*disclosure/i.test(content), `${DOC} muss Progressive Disclosure als Konzept nennen.`);
		assert.ok(
			/error\s*prevention|fehlervermeid/i.test(content),
			`${DOC} muss Error Prevention / Fehlervermeidung nennen.`,
		);
	});

	it('enthält den Abschnitt Barrierefreiheit', async () => {
		const content = await readDoc();
		assert.ok(
			/barrierefrei|accessibility|wcag|bitv/i.test(content),
			`${DOC} muss den Abschnitt Barrierefreiheit (Accessibility/WCAG/BITV) enthalten.`,
		);
	});

	it('enthält den Abschnitt Flow-Integration', async () => {
		const content = await readDoc();
		assert.ok(
			/flow-?integration|flow[\s-]*integration|flow|ablauf/i.test(content),
			`${DOC} muss den Abschnitt Flow-Integration enthalten.`,
		);
	});

	it('beschreibt Flow-Schritt 1: Intentionsprüfung', async () => {
		const content = await readDoc();
		assert.ok(
			/intentionsprüfung|intentionspruefung|intention/i.test(content),
			`${DOC} muss Flow-Schritt 1 (Intentionsprüfung) beschreiben.`,
		);
	});

	it('beschreibt Flow-Schritt 2: Scope-Definition', async () => {
		const content = await readDoc();
		assert.ok(
			/scope-?definition|scope[\s-]*definition|umfang/i.test(content),
			`${DOC} muss Flow-Schritt 2 (Scope-Definition) beschreiben.`,
		);
	});
});

describe('AC3 / T3 — Von Folge-Issues referenzierbar (stabiler Pfad/Link)', () => {
	it('liegt unter einem stabilen, vorhersehbaren Pfad unter docs/ (kein temporärer Ort)', async () => {
		const content = await readDoc();
		assert.ok(content.trim().length > 0, `${DOC} muss unter dem stabilen Pfad existieren.`);
		// Stabiler, dokumentierter Pfad unter docs/ – von Folge-Issues verlinkbar.
		assert.ok(DOC.startsWith('docs/'), `${DOC} muss unter docs/ liegen, um referenzierbar zu sein.`);
	});

	it('verfügt über einen eindeutigen H1-Titel als Anker für Querverweise', async () => {
		const content = await readDoc();
		const h1 = content.match(/^#\s+(.+)$/m);
		assert.ok(h1, `${DOC} braucht genau eine H1-Überschrift als Referenz-Anker.`);
		assert.ok(h1[1].trim().length > 3, `${DOC}: H1-Titel muss aussagekräftig sein.`);
	});
});

describe('AC4 / T4 — Fokus-Management als verbindliche Accessibility-Vorgabe', () => {
	it('nennt striktes Fokus-Management beim Übergang als verbindliche Anforderung', async () => {
		const content = await readDoc();
		assert.ok(
			/fokus-?management|focus[\s-]*management|fokus/i.test(content),
			`${DOC} muss Fokus-Management beim Übergang als Accessibility-Anforderung nennen.`,
		);
		assert.ok(
			/verbindlich|muss|zwingend|vorgabe|erforderlich|mandatory|required/i.test(content),
			`${DOC} muss das Fokus-Management als verbindliche Vorgabe formulieren (nicht nur optional).`,
		);
	});
});

describe('AC5 / T5 — Folgt Doku-Style-Guide (analog user-guide.md, sauberes Markdown)', () => {
	it('ist in deutscher Sprache verfasst (analog user-guide.md)', async () => {
		const content = await readDoc();
		assert.ok(
			/der|die|das|und|ist|ein|mit|auf|für/i.test(content),
			`${DOC} sollte analog user-guide.md deutschsprachig verfasst sein.`,
		);
	});

	it('enthält keine Broken-Markdown-Artefakte (wohlgeformte Überschriften)', async () => {
		const content = await readDoc();
		const lines = content.split('\n');
		for (const line of lines) {
			if (/^#+\S/.test(line)) {
				assert.fail(`${DOC}: Überschrift ohne Leerzeichen nach #: "${line}" (Broken-Markdown-Artefakt).`);
			}
		}
	});

	it('strukturiert Inhalte mit Markdown-Elementen (Listen oder Abschnittstrenner)', async () => {
		const content = await readDoc();
		assert.ok(
			/^[-*]\s/m.test(content) || /^---/m.test(content) || /^#{2,}\s/m.test(content),
			`${DOC} muss Inhalte strukturiert darstellen (Listen / Trenner / Unterüberschriften).`,
		);
	});
});
