/**
 * Rote Spec-Tests fuer Issue #536:
 * "Fix: PR Auto-Label (ai:needs-review) muss Label entfernen bevor es neu setzt".
 *
 * Problem (gegen Code verifiziert): der Entfernen-Schritt von pr-needs-review-label.yml
 * strippt zwar ai:needs-changes/ai:ready-to-merge/ai:needs-human, aber
 * NICHT ai:needs-review selbst. Der nachfolgende Setz-Schritt hat einen Idempotenz-Check
 * (No-op, falls das Label schon klebt). Haengt ai:needs-review also bereits am PR (z. B.
 * innerhalb eines Review-Loops), no-op't das Setzen → es wird kein `labeled`-Event gefeuert →
 * der Kreuzverhoer-Review (04-claude-pr-review.yml, Trigger `pull_request: [labeled]`) startet
 * bei einem menschlichen synchronize-Push nicht.
 *
 * Fix: ai:needs-review in den Entfernen-Loop aufnehmen, damit das Neu-Setzen immer ein echtes
 * Hinzufuegen ist → genau ein `labeled`-Event → Review startet.
 *
 * Diese Tests sind ROT, solange der Entfernen-Schritt ai:needs-review NICHT selbst entfernt.
 * Es wird KEIN Produktivcode geschrieben — nur der Vertrag festgehalten. Die Basis-Vertragsteile
 * fuer diesen Workflow (Trigger-Typen, draft==false, App-Token, Fork-Ausschluss, Idempotenz-
 * Guard) sind bereits in pr-needs-review-label.test.ts (#116) abgedeckt und werden hier NICHT
 * dupliziert.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
// server/src/ci -> Repo-Wurzel
const repoRoot = join(HERE, '..', '..', '..');
const read = (...parts: string[]): string => readFileSync(join(repoRoot, ...parts), 'utf8');

/** Normalisiert Whitespace fuer robuste, formatunabhaengige Teilstring-Pruefungen. */
const squash = (text: string): string => text.replace(/\s+/g, ' ');

describe('Issue #536 — ai:needs-review wird vor dem Neu-Setzen entfernt (Re-Trigger)', () => {
	const wf = () => read('.github', 'workflows', 'pr-needs-review-label.yml');

	describe('AK1 — jeder Lauf entfernt ALLE Pipeline-Labels inkl. ai:needs-review', () => {
		it('der Entfernen-Loop (--remove-label) fuehrt ai:needs-review selbst auf', () => {
			const yml = wf();
			// Der Entfernen-Schritt ist der mit `--remove-label`. Sein regierender `for label in …`
			// ist der letzte solche Loop VOR dem remove-Aufruf.
			const removeCall = yml.indexOf('--remove-label');
			assert.notStrictEqual(removeCall, -1, 'Entfernen-Schritt (--remove-label) nicht gefunden');
			const loops = [...yml.slice(0, removeCall).matchAll(/for\s+label\s+in\s+([^\n]+)/g)];
			assert.ok(loops.length > 0, 'kein `for label in`-Loop im Entfernen-Schritt gefunden');
			const removalLabels = loops[loops.length - 1][1];
			assert.match(
				removalLabels,
				/\bai:needs-review\b/,
				"AK1: der Entfernen-Loop muss ai:needs-review enthalten — sonst wird es nie zurückgesetzt und das Neu-Setzen no-op't",
			);
		});
	});

	describe('AK2 — ai:needs-review wird IMMER neu gesetzt (auch wenn es vorher schon klebte)', () => {
		it('Entfernen von ai:needs-review geschieht VOR dem --add-label im selben Lauf', () => {
			const yml = wf();
			// Es muss einen Entfernen-Loop geben, der ai:needs-review stript …
			const removal = yml.match(/for\s+label\s+in\s+[^\n]*\bai:needs-review\b[^\n]*/);
			assert.ok(removal, 'AK2: kein Entfernen-Loop, der ai:needs-review stript — Neu-Setzen ist nicht garantiert');
			// … und dessen Position muss VOR dem Neu-Setzen liegen (Reihenfolge Entfernen → Setzen).
			const removalPos = yml.indexOf(removal![0]);
			const addCall = yml.match(/--add-label[^\n]*\bai:needs-review\b[^\n]*/);
			assert.ok(addCall, 'AK2: --add-label ai:needs-review fehlt');
			const addPos = yml.indexOf(addCall![0]);
			assert.ok(
				removalPos > -1 && removalPos < addPos,
				"AK2: ai:needs-review muss VOR dem Neu-Setzen entfernt werden (Reihenfolge), sonst no-op't der Idempotenz-Check des Setz-Schritts das Neu-Setzen",
			);
		});
	});

	describe('AK3 — das `labeled`-Event wird zuverlässig ausgelöst (Consumer-Vertrag)', () => {
		// Produzenten-Seite: das zuverlässige Feuern folgt aus AK1/AK2 (Entfernen erzwingt ein
		// echtes Hinzufuegen). Consumer-Seite: 04-claude-pr-review.yml muss auf `labeled` hoeren,
		// damit das gefeuerte Event den Review auch startet — dieser Guard ist hier festgehalten.
		it('04-claude-pr-review.yml triggert auf pull_request-Typ `labeled`', () => {
			const review = read('.github', 'workflows', '04-claude-pr-review.yml');
			assert.match(
				review,
				/on:[\s\S]*?pull_request:[\s\S]*?types:\s*\[[^\]]*\blabeled\b[^\]]*\]/,
				'AK3: 04-claude-pr-review.yml muss auf `labeled` triggern, damit das gefeuerte Event den Review startet',
			);
		});
	});

	describe('AK4 — Review startet auch bei bereits vorhandenem ai:needs-review-Label', () => {
		// Voller Vertrag = Produzent feuert zuverlässig (AK1/AK2) UND Consumer startet gezielt
		// fuer ai:needs-review. Guard auf der Consumer-Seite:
		it('04-claude-pr-review.yml fordert ai:needs-review im job-if, bevor der Review startet', () => {
			const review = squash(read('.github', 'workflows', '04-claude-pr-review.yml'));
			assert.match(
				review,
				/contains\([^)]*labels[^)]*ai:needs-review/,
				'AK4: 04-claude-pr-review.yml muss `contains(labels, ai:needs-review)` im if verlangen',
			);
		});
	});

	describe('AK5 — keine Endlosschleife durch wiederholtes Setzen des Labels', () => {
		// Remove + Neu-Setzen darf diesen Workflow nicht selbst wieder anstossen. Zwei Guards:
		it('pr-needs-review-label.yml triggert NICHT auf den Typ `labeled`', () => {
			const yml = wf();
			const typesLines = [...yml.matchAll(/types:\s*\[([^\]]*)\]/g)].map((m) => m[1]);
			assert.ok(typesLines.length > 0, 'keine `types:`-Zeile gefunden — Extraktion kaputt?');
			for (const t of typesLines) {
				assert.doesNotMatch(
					t,
					/\blabeled\b/,
					'AK5: Trigger-Typ `labeled` wuerde Remove+Neu-Setzen sofort wieder anstossen (Endlosschleife)',
				);
			}
		});

		it('der job-if schliesst Bot-Aktoren aus (keine Selbstverstärkung über das App-Token)', () => {
			assert.match(
				squash(wf()),
				/sender\.type\s*!=\s*['"]Bot['"]/,
				'AK5: job-if muss `sender.type != "Bot"` enthalten, damit App-Token-Bot-Pushes den Loop nicht befeuern',
			);
		});
	});
});
