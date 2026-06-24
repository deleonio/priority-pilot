/**
 * Rote Spec-Tests — Issue #123: "Review Workflow soll Review Kommentar aktualisieren"
 * -----------------------------------------------------------------------------------
 * Der Kreuzverhör-Review postet heute pro Runde einen NEUEN Kommentar — über die
 * Fixup-Schleife (`ai:needs-review` → Review → `ai:needs-changes` → Fixup → …) sammeln
 * sich so viele KI-Kommentare an und der PR wird unübersichtlich. Gewünscht ist genau
 * EIN gepflegter, markierter KI-Sammelkommentar pro PR plus eine History-Tabelle der
 * behobenen Anmerkungen.
 *
 * Dieses Ticket ändert ausschließlich Prozess-/Prompt-Dokumentation (KEIN Produktivcode).
 * Die Akzeptanzkriterien sind daher als **Doku-Vertrag** über drei Dateien formuliert und
 * hier als echte, ausführbare Tests verankert. Sie sind heute ROT (die Regel steht noch
 * in keiner der Dateien) und werden GRÜN, sobald die Umsetzung den Marker-Suche-+-Update-
 * Ansatz in allen drei Dateien beschreibt — ohne dass dieser Test angepasst wird.
 *
 * Quelle der Akzeptanzkriterien: Triage-/Re-Triage-Kommentar (🟢) an Issue #123.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Repo-Wurzel relativ zu dieser Datei (server/src/ai-workflows/<file> → ../../..).
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

/** Versteckter HTML-Marker, der den einen KI-Sammelkommentar pro PR identifiziert. */
const MARKER = '<!-- ai-review -->';

const PR_REVIEW_MD = resolve(repoRoot, '.ai-knowledge/pr-review.md');
const SLASH_CMD_MD = resolve(repoRoot, '.claude/commands/kreuzverhoer-review.md');
const WORKFLOW_YML = resolve(repoRoot, '.github/workflows/claude-pr-review.yml');

let prReview = '';
let slashCmd = '';
let workflow = '';

before(() => {
	prReview = readFileSync(PR_REVIEW_MD, 'utf8');
	slashCmd = readFileSync(SLASH_CMD_MD, 'utf8');
	workflow = readFileSync(WORKFLOW_YML, 'utf8');
});

/** Anzahl nicht-überlappender Vorkommen von `needle` in `haystack`. */
const countOccurrences = (haystack: string, needle: string): number =>
	needle.length === 0 ? 0 : haystack.split(needle).length - 1;

/** Beschreibt der Text die "Update-statt-Neuanlage"-Logik (Marker-Suche per API + PATCH)? */
const describesUpdateInPlace = (text: string): boolean => {
	const lower = text.toLowerCase();
	const mentionsExistingLookup = /bestehend|vorhanden|suche|finde/.test(lower);
	const mentionsUpdate = /aktualisier|fortschreib|update|patch|edit/.test(lower);
	return mentionsExistingLookup && mentionsUpdate;
};

// ── AK-1: Ohne bestehenden KI-Kommentar wird GENAU EIN markierter Kommentar angelegt ─────────
describe('AK-1 — genau ein markierter KI-Sammelkommentar pro PR', () => {
	it('pr-review.md führt den versteckten Marker als Identifikator des Sammelkommentars ein', () => {
		assert.ok(
			prReview.includes(MARKER),
			`pr-review.md muss den Marker ${MARKER} als Kennzeichen des einen KI-Sammelkommentars beschreiben`,
		);
	});

	it('pr-review.md beschreibt die Neuanlage NUR, wenn noch kein markierter Kommentar existiert', () => {
		const lower = prReview.toLowerCase();
		const mentionsCreateOnce = /nicht gefunden|existiert (noch )?kein|kein.*vorhanden|einmalig.*anleg|neu anleg/.test(
			lower,
		);
		assert.ok(
			mentionsCreateOnce,
			'pr-review.md muss klarstellen, dass ein neuer Kommentar nur entsteht, wenn noch keiner markierter existiert',
		);
	});
});

// ── AK-2: Bei Folge-Runde KEIN neuer Kommentar, sondern der bestehende wird aktualisiert ─────
describe('AK-2 — Folge-Runden aktualisieren den bestehenden Kommentar (ID bleibt gleich)', () => {
	it('pr-review.md beschreibt Marker-Suche per API und Update statt Neuanlage', () => {
		assert.ok(
			describesUpdateInPlace(prReview),
			'pr-review.md muss "bestehenden markierten Kommentar suchen → aktualisieren (statt neu anlegen)" beschreiben',
		);
	});

	it('pr-review.md nennt die API-basierte Suche/Aktualisierung (gh api / issues/comments)', () => {
		const lower = prReview.toLowerCase();
		assert.ok(
			/gh api/.test(lower) && /issues\/comments|issues\/<pr>\/comments|comments\/<id>/.test(lower),
			'pr-review.md muss die robuste Marker-Suche+Aktualisierung per `gh api …/issues/comments` beschreiben',
		);
	});
});

// ── AK-3: Behobene Findings erscheinen in einer History-Tabelle ──────────────────────────────
describe('AK-3 — History-Tabelle "Behobene Anmerkungen"', () => {
	it('pr-review.md beschreibt einen Abschnitt "Behobene Anmerkungen" für behobene Findings', () => {
		assert.match(
			prReview,
			/Behobene Anmerkungen/i,
			'pr-review.md muss einen Abschnitt "Behobene Anmerkungen" (History) beschreiben',
		);
	});

	it('pr-review.md trennt "Offene Findings" (aktuelle Runde) von der History-Tabelle', () => {
		assert.match(
			prReview,
			/Offene Findings/i,
			'pr-review.md muss "Offene Findings" (aktuelle Runde) von der History-Tabelle abgrenzen',
		);
	});

	it('pr-review.md beschreibt die History als Tabelle mit Runde und Status', () => {
		const lower = prReview.toLowerCase();
		assert.ok(
			lower.includes('tabell') && lower.includes('runde') && lower.includes('status'),
			'pr-review.md muss die History als Tabelle (Spalten u. a. Runde | Finding | Status) beschreiben',
		);
	});
});

// ── AK-4: Beide Agent-Pfade verhalten sich identisch; Label-Umschaltung unverändert ──────────
describe('AK-4 — Claude- und Mistral-Pfad identisch, Label-Umschaltung unverändert', () => {
	it('der Workflow beschreibt die Marker-/Update-Logik in BEIDEN Agent-Pfaden', () => {
		const markerHits = countOccurrences(workflow, MARKER);
		assert.ok(
			markerHits >= 2,
			`claude-pr-review.yml muss den Marker ${MARKER} in BEIDEN Pfaden (Claude + Mistral) nennen, gefunden: ${markerHits}`,
		);
	});

	it('der Workflow beschreibt in beiden Pfaden Suche + Update statt Neuanlage', () => {
		const lower = workflow.toLowerCase();
		const updateHits = countOccurrences(lower, 'aktualisier') + countOccurrences(lower, 'gh api');
		assert.ok(
			updateHits >= 2,
			'claude-pr-review.yml muss die Update-/Marker-Logik in beiden Agent-Prompts beschreiben (nicht nur in einem)',
		);
	});

	it('die Label-Umschaltung bleibt unverändert erhalten (steuert weiter das Ping-Pong)', () => {
		assert.ok(
			workflow.includes('ai:needs-changes'),
			'die Label-Umschaltung ai:needs-changes muss erhalten bleiben',
		);
		assert.ok(
			workflow.includes('ai:ready-to-merge'),
			'die Label-Umschaltung ai:ready-to-merge muss erhalten bleiben',
		);
	});
});

// ── AK-5: pr-review.md und kreuzverhoer-review.md sind konsistent (Single-Source-of-Truth) ───
describe('AK-5 — Doku konsistent (Single-Source-of-Truth gewahrt)', () => {
	it('der Slash-Command kreuzverhoer-review.md beschreibt denselben Marker-/Update-Ansatz', () => {
		const consistent = slashCmd.includes(MARKER) || describesUpdateInPlace(slashCmd);
		assert.ok(
			consistent,
			'kreuzverhoer-review.md muss den konsolidierten KI-Sammelkommentar (Marker + Update) konsistent zu pr-review.md beschreiben',
		);
	});

	it('beide Dokumente führen die History-/Konsolidierungs-Regel (kein Drift)', () => {
		// Bewusst eng formuliert: das bestehende "aktualisierter offener PR" (Auswahlkriterium)
		// darf NICHT als Treffer durchgehen — gemeint ist die Konsolidierungs-/History-Regel.
		assert.match(
			slashCmd,
			/Behobene Anmerkungen|History-Tabelle|Sammelkommentar|markierte[rn]? KI-Kommentar|<!-- ai-review -->/,
			'kreuzverhoer-review.md muss die Konsolidierungs-/History-Regel (Sammelkommentar/History) ebenfalls erwähnen',
		);
	});
});
