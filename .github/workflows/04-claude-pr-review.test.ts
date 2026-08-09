import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Issue #530: Der Review-Workflow brach mit `exit 1` ab, sobald der
// <!-- ai-review -->-Marker fehlte — selbst bei klarem VERDICT: ready-to-merge.
// PR #528 hat den harten exit 1 bereits entschärft (Verdict-Fallback im case).
// Diese Spec treibt die NOCH FEHLENDEN Akzeptanzkriterien (Create-or-Update des
// Markers AK2, Idempotenz/kein Duplikat AK4) — beides aktuell ROT — und sichert
// die bereits erfüllten AK1 (exit 0 bei klarem Verdict ohne Marker) und AK3
// (Label ready-to-merge) sowie das erhaltene Fehlerverhalten (T3) als Regression-Guards.
// T1–T4 aus dem Issue-Body mappen 1:1 auf AK1–AK4 + T3 → bewusst nicht dupliziert.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const read = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

// Kommentarzeilen entfernen — sonst schlagen Erklaerungen und Beispiele als Befehl durch.
const codeOf = (yml: string): string =>
	yml
		.split('\n')
		.filter((l) => !/^\s*#/.test(l))
		.join('\n');

// Nur der Label-Post-Assertion-Schritt trägt die Marker-/Verdict-Logik (#530).
const stepOf = (yml: string): string => yml.match(/name:\s*Label-Post-Assertion[\s\S]*?(?=\n      - name:)/)?.[0] ?? '';

describe('Review — Robustheit bei fehlendem <!-- ai-review -->-Marker (#530)', () => {
	const yml = codeOf(read('.github', 'workflows', '04-claude-pr-review.yml'));
	const step = stepOf(yml);

	// AK1 (Regression-Guard): klarer Verdict -> exit 0, auch ohne Marker.
	it('AK1: fehlender Marker löst bei KLAREM Verdict KEIN exit 1 aus (Workflow wird grün)', () => {
		const caseBlock = step.match(/case\s+"\$verdict"\s*in[\s\S]*?esac/)?.[0] ?? '';
		assert.ok(caseBlock, 'case "$verdict" in ... esac im Label-Post-Assertion-Step nicht gefunden');
		const clearArms = caseBlock.match(/ready-to-merge\|needs-changes\|needs-human\)[\s\S]*?;;/)?.[0] ?? '';
		assert.doesNotMatch(
			clearArms,
			/\bexit\s+1\b/,
			'Bei klarem Verdict (ready-to-merge|needs-changes|needs-human) darf ein fehlender Marker KEIN exit 1 auslösen — sonst bricht der Workflow trotz erfolgreicher Review ab (#530).',
		);
	});

	// AK2 (ROT — Treiber): fehlender Marker -> Workflow ERSTELLT ihn (Create-or-Update).
	it('AK2: fehlt der <!-- ai-review -->-Marker, legt der Workflow ihn per gh pr comment an (Create-or-Update)', () => {
		// Aktuell wird bei fehlendem Marker nur ::warning ausgegeben — der Kommentar fehlt
		// dann dauerhaft. Erwartet: gh pr comment mit <!-- ai-review --> im Body als Fallback.
		assert.match(
			step,
			/gh pr comment[^\n]*<!-- ai-review -->/,
			'Fehlt der <!-- ai-review -->-Marker, muss der Workflow ihn selbst per `gh pr comment ... <!-- ai-review -->` ERSTELLEN (Create-or-Update) — nicht nur verwarnen und auf Claude hoffen.',
		);
	});

	// AK3 (Regression-Guard): ready-to-merge -> Label zuverlässig gesetzt.
	it('AK3: bei VERDICT ready-to-merge wird ai:ready-to-merge zuverlässig gesetzt', () => {
		assert.match(
			yml,
			/--add-label\s+ai:ready-to-merge/,
			'Bei ready-to-merge muss der Workflow zuverlässig ai:ready-to-merge setzen (auch wenn der Marker-Kommentar fehlt).',
		);
	});

	// AK4 (ROT — Treiber): bestehenden Marker aktualisieren, kein Duplikat.
	it('AK4: bestehender <!-- ai-review -->-Marker wird aktualisiert — Create-ODER-Update, kein Duplikat', () => {
		assert.ok(
			/REVIEW_COMMENT_ID/.test(step),
			'Der Workflow muss den bestehenden Marker-Kommentar per ID erfassen (REVIEW_COMMENT_ID), um ihn aktualisieren statt duplizieren zu können.',
		);
		// Entweder: bestehenden Kommentar per ID updaten (PATCH) …
		const patchesById =
			/-X\s+PATCH[\s\S]{0,120}REVIEW_COMMENT_ID/.test(step) || /REVIEW_COMMENT_ID[\s\S]{0,120}-X\s+PATCH/.test(step);
		// … oder: Create explizit nur bei LEERER ID (Marker existiert nicht) -> kein Duplikat.
		const createOnlyIfMissing =
			/-z\s+"\$REVIEW_COMMENT_ID"[\s\S]{0,300}<!-- ai-review -->/.test(step) ||
			/<!-- ai-review -->[\s\S]{0,300}-z\s+"\$REVIEW_COMMENT_ID"/.test(step);
		assert.ok(
			patchesById || createOnlyIfMissing,
			'Bestehende <!-- ai-review -->-Kommentare müssen aktualisiert werden (PATCH der erfassten ID), oder das Erstellen muss explizit an eine LEERE REVIEW_COMMENT_ID geknüpft sein — sonst droht bei jedem Lauf ein Duplikat.',
		);
	});
});

describe('Review — Fehlerverhalten bleibt erhalten (#530 T3)', () => {
	const yml = codeOf(read('.github', 'workflows', '04-claude-pr-review.yml'));
	const step = stepOf(yml);

	// T3 (Regression-Guard): kein klares Verdict UND kein Marker -> kontrolliert exit 1.
	it('T3: bei KEINEM klaren Verdict UND fehlendem Marker scheitert der Workflow kontrolliert (exit 1)', () => {
		const caseBlock = step.match(/case\s+"\$verdict"\s*in[\s\S]*?esac/)?.[0] ?? '';
		assert.ok(caseBlock, 'case "$verdict"-Block im Label-Post-Assertion-Step nicht gefunden');
		assert.match(
			caseBlock,
			/\*\)[\s\S]*?exit\s+1/,
			'Bei fehlendem Marker UND keinem klaren Verdict (*) muss der Workflow hart scheitern (exit 1) — echtes Fehlerverhalten (Claude hat nichts geleistet) darf nicht verschluckt werden.',
		);
	});
});
