import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Der HAS_TESTS-Check in 02-claude-spec.yml prueft, ob ein Spec-PR Test-Dateien enthaelt,
// und bestimmt indirekt, ob ai:ready gesetzt wird. Frueher nutzte er jq's
// test("\.(test|spec)\.(ts|tsx)$") — gojq (gh's eingebauter Parser) wertet Backslash-Escapes
// in String-Literalen als *invalid escape* (exit 1), schluckt den Fehler durch
// `2>/dev/null || echo "false"` und setzte so HAS_TESTS=false -> ai:ready wurde 20+ Laeufe
// lang nie gesetzt, bis jemand manuell eingriff (PR #485, Issue #489).
//
// Regressions-Test: das buggy Pattern darf nicht im Code vorkommen, endswith() muss verwendet
// werden, und HAS_TESTS muss via ::notice sichtbar gemacht werden (kein stilles Schlucken).
//
// Testebene: statische Auswertung von YAML (node:test via tsx, ci.yml).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

// Kommentarzeilen entfernen — sonst schlagen Erklaerungen und Beispiele als Befehl durch.
const codeOf = (yml: string): string =>
	yml
		.split('\n')
		.filter((l) => !/^\s*#/.test(l))
		.join('\n');

describe('Spec — HAS_TESTS-Check umgeht den gojq-Backslash-Bug', () => {
	const yml = codeOf(read('.github', 'workflows', '02-claude-spec.yml'));

	it('kein jq test() mit Backslash-Escape im Pattern (gojq: invalid escape sequence)', () => {
		// gojq wertet test("\.…") als *invalid escape* — exit 1, geschluckt durch 2>/dev/null,
		// HAS_TESTS=false, ai:ready nie gesetzt. Siehe PR #485 / Issue #489.
		assert.doesNotMatch(
			yml,
			/test\("\\./,
			'jq test() mit Backslash-Escape ("\.") — gojq (gh) wertet das als invalid escape, ' +
				'schluckt den Parse-Fehler via 2>/dev/null, setzt HAS_TESTS=false und ai:ready wird nie gesetzt',
		);
	});

	it('HAS_TESTS nutzt endswith() statt test() fuer .test/.spec-Dateien', () => {
		// endswith() ist semantisch aequivalent zu \.(test|spec)\.(ts|tsx)$ und gojq-safe.
		assert.match(
			yml,
			/endswith\("\.test\.ts"\)/,
			'HAS_TESTS muss endswith()-basiert pruefen — test("\.") schlaegt in gojq fehl',
		);
	});

	it('HAS_TESTS-Wert wird via ::notice sichtbar (kein stilles 2>/dev/null-Schlucken)', () => {
		// Bevor der Bug gefunden wurde, war HAS_TESTS=false 20+ Laeufe lang unsichtbar.
		assert.match(
			yml,
			/::notice::.*HAS_TESTS/,
			'HAS_TESTS muss via ::notice sichtbar gemacht werden — 2>/dev/null hat den Fehler 20+ Laeufe lang gefuehlt',
		);
	});
});

// Spec-Prompt muss das Test-Konzept (Testumfang) berücksichtigen — nur nützliche Tests, keine
// dogmatische Coverage. Der CI-Prompt hatte früher nur „rote Tests je AK" ohne Qualitäts-Filter;
// die Folge waren String-Match-/Change-Detector-Tests (insb. auf Doku-Seiten), die PR #558 immer
// wieder löschen musste. Wurzel ist der fehlende Docs-Carve-out + die fehlenden Aufnahmekriterien
// im Spec-Prompt. Diese Spec sichert die Pflicht-Bestandteile gegen erneutes Verstummen.

describe('Spec — Prompt berücksichtigt das Test-Konzept (nur nützliche Tests)', () => {
	const raw = read('.github', 'workflows', '02-claude-spec.yml');
	const prompt = raw.match(/cat > \/tmp\/claude-prompt\.txt << 'CLAUDE_EOF'\s*\n([\s\S]*?)CLAUDE_EOF/)?.[1] ?? '';
	assert.ok(prompt, 'Claude-Prompt-Block nicht in 02-claude-spec.yml gefunden');

	// AC1: Aufnahmekriterien — ein Test nur bei Auswertung/Spiegel/Schutz (das Testumfang-Dreieck).
	it('AC1: nennt die drei Aufnahmekriterien (Auswertung/Spiegel/Schutz)', () => {
		assert.match(prompt, /Auswertung/, 'Spec-Prompt muss das Aufnahmekriterium "Auswertung" nennen.');
		assert.match(prompt, /Spiegel/, 'Spec-Prompt muss das Aufnahmekriterium "Spiegel" nennen.');
		assert.match(prompt, /Schutz/, 'Spec-Prompt muss das Aufnahmekriterium "Schutz" nennen.');
	});

	// AC2: Change-Detector-Verbot — „Datei enthält den String, den ich geschrieben habe" ist verboten.
	it('AC2: verbietet Change-Detector-Tests ("String, den ich geschrieben habe")', () => {
		assert.match(
			prompt,
			/Change-Detector/i,
			'Spec-Prompt muss Change-Detector-Tests ("String, den ich geschrieben habe") explizit verbieten — ' +
				'sie finden per Konstruktion keinen Fehler und sind die Pathologie, die PR #558 immer wieder rückbauen musste.',
		);
	});

	// AC3: Docs-Carve-out — reines Doku/Pattern (Markdown) bekommt KEINEN Test (Wurzel von #549/#557/#558).
	it('AC3: Docs-Carve-out — reines Markdown bekommt keinen Test', () => {
		assert.match(
			prompt,
			/DOKU|DOCS-CARVE-OUT|docs\/.*KEINEN Test/i,
			'Spec-Prompt muss den Docs-Carve-out enthalten: reine Doku/Pattern-Markdown-Seiten bekommen KEINEN ' +
				'Test (String-Match auf Markdown = Change-Detector). Das ist die Wurzel von #549/#557/#558.',
		);
	});

	// AC4: Mutations-Probe — vor dem Commit das Verhalten brechen, Test muss rot werden.
	it('AC4: verlangt Mutations-Probe vor dem Commit', () => {
		assert.match(
			prompt,
			/Mutations-Probe/i,
			'Spec-Prompt muss die Mutations-Probe verlangen (Verhalten brechen → Test muss rot, sonst raus) — ' +
				'das ist die Gegenprobe gegen plausible, aber wertlose Tests.',
		);
	});

	// AC5: keine dogmatische Coverage — Qualität vor Quantität.
	it('AC5: Qualitäts-über-Quantität-Regel (keine dogmatische Coverage)', () => {
		assert.match(
			prompt,
			/KEINE dogmatische Coverage|lieber 3 Tests mit Biss/i,
			'Spec-Prompt muss klarstellen: keine dogmatische Coverage, Qualität vor Quantität („lieber 3 mit Biss als 12 Statistik-Füller").',
		);
	});
});
