/**
 * Rote Spec-Tests — Issue #157: "Triage: Issue schließen, wenn Anforderungen bereits erfüllt"
 * --------------------------------------------------------------------------------------------
 * Der Triage-Workflow analysiert Issues, setzt Labels und postet Kommentare — schließt Issues
 * aber nie selbst. Dieses Issue verlangt einen neuen Schritt 6 im Triage-Ablauf, der ein
 * Ticket automatisch schließt, wenn die Analyse ergibt, dass die beschriebenen Anforderungen
 * bereits vollständig im Code erfüllt sind. Alle anderen Issues bleiben offen.
 *
 * Geänderte Dateien: `.ai-knowledge/ticket-triage.md` (neuer Schritt 6) und
 * `.claude/commands/triage-ticket.md` (Referenz auf den neuen Schritt).
 *
 * Tests sind HEUTE ROT, weil Schritt 6 in keiner der Dateien existiert — sie werden GRÜN,
 * sobald die Umsetzung die Auto-Close-Logik gemäß den Akzeptanzkriterien beschreibt.
 * Es wird KEIN Produktivcode geschrieben — nur der Vertrag als ausführbare Tests verankert.
 *
 * Quelle der Akzeptanzkriterien: Triage-/Re-Triage-Kommentar (🟢) an Issue #157.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const TRIAGE_MD = resolve(repoRoot, '.ai-knowledge/ticket-triage.md');
const SLASH_CMD_MD = resolve(repoRoot, '.claude/commands/triage-ticket.md');

let triage = '';
let slashCmd = '';

before(() => {
	triage = readFileSync(TRIAGE_MD, 'utf8');
	slashCmd = existsSync(SLASH_CMD_MD) ? readFileSync(SLASH_CMD_MD, 'utf8') : '';
});

// ── AK-1: Ticket wird geschlossen, wenn Anforderungen bereits erfüllt sind ───────────────────
describe('AK-1 — Auto-Close wenn Anforderungen bereits erfüllt', () => {
	it('ticket-triage.md enthält einen Schritt 6 (Autonomes Schließen)', () => {
		assert.match(
			triage,
			/##\s*Schritt 6/,
			'ticket-triage.md muss einen "## Schritt 6" für das autonome Schließen beschreiben',
		);
	});

	it('Schritt 6 beschreibt das Kriterium "Anforderungen bereits erfüllt" als einziges Schließ-Kriterium', () => {
		const lower = triage.toLowerCase();
		const hasKriterium =
			/anforderungen[\s\S]{0,60}bereits[\s\S]{0,60}erfüllt|erfüllt[\s\S]{0,60}anforderungen/.test(lower) ||
			/requirements[\s\S]{0,60}already[\s\S]{0,60}met/.test(lower);
		assert.ok(
			hasKriterium,
			'Schritt 6 muss das Kriterium "Anforderungen bereits im Code erfüllt" als Auslöser für das Schließen benennen',
		);
	});

	it('Schritt 6 beschreibt den gh-Befehl zum Schließen mit --reason completed', () => {
		assert.match(
			triage,
			/gh issue close[\s\S]{0,80}--reason[^\n]*completed/,
			'Schritt 6 muss `gh issue close <nr> --reason "completed"` (oder completed-Variante) enthalten',
		);
	});
});

// ── AK-2: Reguläre offene Issues werden NICHT geschlossen ────────────────────────────────────
describe('AK-2 — Reguläre Issues bleiben offen', () => {
	it('Schritt 6 stellt klar, dass nur bei eindeutigem Beleg geschlossen wird', () => {
		const lower = triage.toLowerCase();
		const mentionsConcreteProof =
			/konkreter?\s+beleg|commit(-sha|-hash|[\s-]sha)|pr[-\s]nr|datei.*zeile|nachweis/.test(lower);
		assert.ok(
			mentionsConcreteProof,
			'Schritt 6 muss verlangen, dass ein konkreter Beleg (Commit-SHA, PR-Nr. o. Datei/Zeile) vorliegt — kein Schließen auf Basis von Vermutungen',
		);
	});

	it('Schritt 6 schreibt vor, bei Unsicherheit das Ticket offen zu lassen', () => {
		const lower = triage.toLowerCase();
		const mentionsUnsicher =
			/unsicher|unklär|nicht\s+sicher|offen\s+lass|bei\s+zweifel|bei\s+unsicherheit/.test(lower);
		assert.ok(
			mentionsUnsicher,
			'Schritt 6 muss regeln: Bei Unsicherheit bleibt das Ticket offen (kein spekulatives Schließen)',
		);
	});
});

// ── AK-3: Grenzfall — Unklare Erfüllung → bleibt offen, Ampel 🟡 ─────────────────────────────
describe('AK-3 — Grenzfall: Unklar → offen lassen', () => {
	it('Schritt 6 erwähnt explizit den 🟡-Fall (Unsicherheit) als Grund für "nicht schließen"', () => {
		const mentionsYellow = triage.includes('🟡') || triage.toLowerCase().includes('gelb');
		const mentionsUnsicher = triage.toLowerCase().includes('unsicher') || triage.toLowerCase().includes('unklär');
		assert.ok(
			mentionsYellow || mentionsUnsicher,
			'Schritt 6 muss den Grenzfall (unklar → nicht schließen, Mensch entscheiden lassen) erwähnen',
		);
	});
});

// ── AK-4: Schließ-Kommentar enthält konkreten Beleg ──────────────────────────────────────────
describe('AK-4 — Schließ-Kommentar mit konkretem Beleg', () => {
	it('Schritt 6 fordert einen Kommentar VOR dem Schließen', () => {
		const lower = triage.toLowerCase();
		const commentBeforeClose =
			/kommentar[\s\S]{0,200}gh issue close|gh issue comment[\s\S]{0,200}gh issue close/.test(lower);
		assert.ok(
			commentBeforeClose,
			'Schritt 6 muss vorschreiben, erst einen Schließ-Kommentar zu posten und dann das Issue zu schließen',
		);
	});

	it('Schritt 6 verlangt den Beleg im Kommentar (Commit-SHA, PR-Nr. oder Datei/Zeile)', () => {
		const lower = triage.toLowerCase();
		const hasBeleg =
			/beleg[\s\S]{0,100}kommentar|kommentar[\s\S]{0,100}beleg|commit.{0,40}sha|pr.{0,20}nummer|datei.{0,20}zeile/.test(
				lower,
			);
		assert.ok(
			hasBeleg,
			'Schritt 6 muss den konkreten Beleg als Pflichtbestandteil des Schließ-Kommentars einfordern',
		);
	});
});

// ── Konsistenz: triage-ticket.md (Slash-Command) referenziert den Auto-Close-Schritt ─────────
describe('Konsistenz — Slash-Command triage-ticket.md', () => {
	it('triage-ticket.md beschreibt einen Schritt, der Issues schließt wenn Anforderungen erfüllt sind', () => {
		const lower = slashCmd.toLowerCase();
		// Muss "schließ" UND eines der Kriterien-Schlüsselwörter enthalten — nicht nur "Schritt 6" für Labeling.
		const mentionsClose =
			/gh issue close|autonomes? schließ|schließ[^\n]{0,80}anforderungen|anforderungen[^\n]{0,80}schließ/.test(lower);
		assert.ok(
			mentionsClose,
			'triage-ticket.md (Slash-Command) muss den Auto-Close-Schritt beschreiben (gh issue close oder Schließen bei erfüllten Anforderungen)',
		);
	});

	it('triage-ticket.md nennt "bereits erfüllt" oder gleichwertig als Schließ-Bedingung', () => {
		const lower = slashCmd.toLowerCase();
		const mentionsCondition =
			/bereits erfüllt|anforderungen.*erfüllt|erfüllt.*schließ|requirements.*met/.test(lower);
		assert.ok(
			mentionsCondition,
			'triage-ticket.md muss die Bedingung "Anforderungen bereits erfüllt" als Auslöser für das Schließen nennen',
		);
	});
});
