import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests — Merge-getriebenes Unblocking abhängiger Issues.
//
// Sichert den neuen Workflow `claude-issue-unblock.yml`:
// Wird ein PR gemergt, werden die Issues, die das gemergte Issue nativ *blockt*
// (GitHub-Issue-Dependencies), freigegeben — aber nur, wenn ALLE ihre Blocker
// geschlossen sind (Fan-in-Gate). Freigabe = `ai:analyzed` ENTFERNEN → das
// re-triggert `01-claude-triage.yml` (Re-Analyse gegen den neuen Code-Stand), die
// dann 🟢 → `ai:spec-ready` setzt oder 🟡/🔴 → nur `ai:analyzed` + Hinweise.
//
// Das Entfernen MUSS per GitHub-App-Token erfolgen: ein mit `GITHUB_TOKEN`
// entferntes Label löst KEINE Folge-Workflows aus → keine Re-Triage.
//
// Testebene: statische YAML-Verträge (node:test via tsx, Muster
// claude-pr-conflict-scan.test.ts / pipeline-hardening.test.ts, ci.yml Z. ~89).
// Tests werden ROT, bis Produktivcode (claude-issue-unblock.yml) angelegt ist.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

const unblockYml = (): string =>
	readFileSync(join(REPO_ROOT, '.github', 'workflows', 'claude-issue-unblock.yml'), 'utf8');

// ─── AK1 — Trigger: nur bei gemergtem PR ─────────────────────────────────────

describe('AK1 — Trigger: pull_request closed + merged == true', () => {
	it('Workflow triggert auf pull_request mit types: [closed]', () => {
		const yml = unblockYml();
		assert.match(yml, /on:/, 'Workflow muss einen on:-Block haben');
		assert.match(yml, /pull_request:/, 'Workflow muss auf pull_request triggern (Merge-Event)');
		assert.match(yml, /types:\s*\[\s*closed\s*\]/, 'Workflow muss auf types: [closed] triggern');
	});

	it('job-if verlangt merged == true (ein bloßes Schließen ohne Merge darf NICHTS auslösen)', () => {
		const yml = unblockYml();
		assert.match(
			yml,
			/pull_request\.merged\s*==\s*true/,
			'job-if muss github.event.pull_request.merged == true fordern — sonst würde jedes Schließen (auch ohne Merge) Nachfolger freigeben',
		);
	});

	it('Negativkontrolle: kein Trigger auf issues.labeled/opened (das ist Sache von triage/spec/implement)', () => {
		const yml = unblockYml();
		// Der Workflow triggert ausschließlich auf pull_request — kein issues-Event.
		// Das Regex zielt auf einen on:-Block mit issues: (z.B. `on:\n  issues:`),
		// nicht auf issues: im permissions:-Block oder in Kommentaren.
		assert.doesNotMatch(
			yml,
			/^on:\s*\n\s*issues:/m,
			'Der Unblock-Workflow darf NICHT auf issues-Events triggern — er reagiert ausschließlich auf gemergte PRs',
		);
	});
});

// ─── AK2 — Gemergtes Issue via closingIssuesReferences ───────────────────────

describe('AK2 — Auflösung des gemergten Issues über closingIssuesReferences (kein Branch-Namen-Raten)', () => {
	it('Workflow liest das verknüpfte Issue via closingIssuesReferences', () => {
		const yml = unblockYml();
		assert.match(
			yml,
			/closingIssuesReferences/,
			'Workflow muss das gemergte Issue über closingIssuesReferences ermitteln (Muster 02-claude-spec.yml/03-claude-implement.yml), nicht über den Branch-Namen raten',
		);
	});
});

// ─── AK3 — Blocking-Abfrage: wen blockt das gemergte Issue? ───────────────────

describe('AK3 — Native Dependency-Abfrage: Kandidaten = Issues, die das gemergte Issue blockt', () => {
	it('Workflow fragt die native blocking-Relation ab (dependencies/blocking)', () => {
		const yml = unblockYml();
		assert.match(
			yml,
			/dependencies\/blocking/,
			'Workflow muss die nativen GitHub-Issue-Dependencies nutzen (REST issues/N/dependencies/blocking), um die abhängigen Nachfolger zu finden',
		);
	});
});

// ─── AK4 — Fan-in-Gate: ALLE Blocker müssen geschlossen sein ──────────────────

describe('AK4 — Fan-in-Gate: nur freigeben, wenn ALLE Blocker des Kandidaten geschlossen sind', () => {
	it('Workflow prüft die blocked_by-Relation des Kandidaten (nicht nur den einen gemergten Blocker)', () => {
		const yml = unblockYml();
		assert.match(
			yml,
			/dependencies\/blocked_by/,
			'Workflow muss vor der Freigabe alle Blocker des Kandidaten prüfen (REST issues/N/dependencies/blocked_by) — sonst würde ein Kandidat mit mehreren offenen Blockern zu früh freigegeben',
		);
	});

	it('Workflow prüft den state der Blocker im Fan-in-select (offene Blocker verhindern die Freigabe)', () => {
		const yml = unblockYml();
		// Gezielt auf den Fan-in-select asserten — NICHT auf ein beliebiges "open" (der B-Zustands-Guard
		// [ "$Bstate" != "open" ] enthält ebenfalls "open", prüft aber etwas anderes). Löschte man den
		// Fan-in-Filter, muss dieser Test rot werden.
		assert.match(
			yml,
			/select\(\s*\.state\s*==\s*"open"/,
			'Der Fan-in-select muss offene Blocker per .state == "open" filtern (autoritativ, nicht nur der Summary-Count)',
		);
		// Und er muss die Blocker-Nummer (als $n gebunden, korrektes jq-Scoping) gegen die gemergte
		// Menge prüfen, um die gerade gemergte(n) Issue-Nummer(n) auszuschließen (Race-Schutz).
		assert.match(
			yml,
			/\(\.number\s*\|\s*tostring\)\s*as\s*\$n/,
			'Der Fan-in muss die Blocker-Nummer als $n binden (korrektes jq-Scoping außerhalb von index())',
		);
		assert.match(
			yml,
			/\$merged\s*\|\s*index\(\$n\)/,
			'Der Fan-in muss die gemergte Menge via $merged | index($n) ausschließen (Race-Schutz)',
		);
	});

	it('Negativkontrolle: ai:analyzed wird NICHT entfernt, bevor das blocked_by-Gate geprüft wurde', () => {
		const yml = unblockYml();
		// Die blocked_by-Abfrage muss VOR dem remove-label ai:analyzed im Datei-Text stehen.
		const blockedByPos = yml.indexOf('dependencies/blocked_by');
		const removeIdx = yml.search(/remove-label[^\n]*ai:analyzed/);
		assert.ok(blockedByPos !== -1, 'blocked_by-Abfrage nicht gefunden');
		assert.ok(removeIdx !== -1, 'remove-label ai:analyzed nicht gefunden');
		assert.ok(
			blockedByPos < removeIdx,
			'Das Fan-in-Gate (blocked_by-Abfrage) muss VOR dem Entfernen von ai:analyzed stehen — sonst kein Schutz gegen Freigabe bei weiteren offenen Blockern',
		);
	});
});

// ─── AK5 — Aktion: ai:analyzed ENTFERNEN (nicht ai:spec-ready setzen) ─────────

describe('AK5 — Freigabe = ai:analyzed entfernen → Re-Triage (NICHT direkt ai:spec-ready setzen)', () => {
	it('Workflow entfernt das Label ai:analyzed vom Kandidaten', () => {
		const yml = unblockYml();
		assert.match(
			yml,
			/remove-label[^\n]*ai:analyzed/,
			'Workflow muss `--remove-label "ai:analyzed"` aufrufen — das re-triggert 01-claude-triage.yml (Re-Analyse gegen den neuen Code-Stand)',
		);
	});

	it('Negativkontrolle: Workflow setzt NICHT direkt ai:spec-ready/ai:ready (Re-Analyse entscheidet das)', () => {
		const yml = unblockYml();
		assert.doesNotMatch(
			yml,
			/add-label[^\n]*ai:spec-ready/,
			'Workflow darf ai:spec-ready NICHT selbst setzen — die Re-Triage entscheidet nach erneuter Machbarkeitsprüfung (🟢) darüber',
		);
		assert.doesNotMatch(
			yml,
			/add-label[^\n]*ai:ready\b/,
			'Workflow darf ai:ready NICHT setzen — das ist Sache der Spec-Stufe',
		);
	});
});

// ─── AK6 — App-Token PFLICHT (sonst keine Re-Triage) ─────────────────────────

describe('AK6 — Label-Entfernen per App-Token (GITHUB_TOKEN triggert keine Re-Triage)', () => {
	it('Workflow erzeugt ein GitHub-App-Token (create-github-app-token oder APP_ID/APP_PRIVATE_KEY)', () => {
		const yml = unblockYml();
		const hasAppToken = /create-github-app-token/.test(yml) || (/APP_ID/.test(yml) && /APP_PRIVATE_KEY/.test(yml));
		assert.ok(
			hasAppToken,
			'Workflow muss ein App-Token nutzen — mit GITHUB_TOKEN entfernte Labels lösen KEINE Folge-Workflows (Re-Triage) aus (bekanntes GHA-Verhalten, dokumentiert in 01-claude-triage.yml)',
		);
	});

	it('Negativkontrolle: der Label-Step läuft NICHT unter GH_TOKEN: github.token', () => {
		const yml = unblockYml();
		// Das Entfernen von ai:analyzed darf nicht unter dem Standard-github.token laufen —
		// sonst feuert das unlabeled-Event nicht und die Re-Triage bleibt aus.
		const removeStepUsesGithubToken =
			/remove-label[\s\S]{0,400}GH_TOKEN:\s*$\{\{\s*github\.token/.test(yml) ||
			/GH_TOKEN:\s*$\{\{\s*github\.token[\s\S]{0,400}remove-label/.test(yml);
		assert.ok(
			!removeStepUsesGithubToken,
			'Das Entfernen von ai:analyzed darf NICHT unter GH_TOKEN: ${{ github.token }} laufen — es muss das App-Token (steps.gh-token.outputs.token, mit Fallback auf App-Token) nutzen, sonst keine Re-Triage',
		);
		// GH_TOKEN nutzt den gh-token-Fallback-Step (bevorzugt App-Token, fällt auf
		// GITHUB_TOKEN zurück wenn App-Token nicht verfügbar)
		assert.match(
			yml,
			/GH_TOKEN:\s*\$\{\{\s*steps\.gh-token\.outputs\.token/,
			'Der gh-Step muss den gh-token-Fallback (steps.gh-token.outputs.token) als GH_TOKEN nutzen — der bevorzugt das App-Token',
		);
		// Der gh-token-Step selbst muss versuchen, das App-Token zu nutzen
		assert.match(
			yml,
			/steps\.app-token\.outputs\.token/,
			'Der gh-token-Fallback-Step muss das App-Token (steps.app-token.outputs.token) referenzieren — es ist der primäre Versuch',
		);
	});
});

// ─── AK7 — Guards: nur passende Kandidaten ───────────────────────────────────

describe('AK7 — Guards: nur offene, analysierte, noch nicht in der Kette laufende Kandidaten', () => {
	it('Workflow überspringt Sammelknoten (ai:to-big-issue)', () => {
		const yml = unblockYml();
		assert.match(
			yml,
			/ai:to-big-issue/,
			'Workflow muss ai:to-big-issue-Sammelknoten überspringen (die tragen keine ausführbare Arbeit, ihre Sub-Issues laufen einzeln)',
		);
	});

	it('Workflow berücksichtigt nur Kandidaten mit ai:analyzed und überspringt bereits fortgeschrittene (ai:spec-ready/ai:ready)', () => {
		const yml = unblockYml();
		assert.match(yml, /ai:analyzed/, 'Workflow muss ai:analyzed als Vorbedingung des Kandidaten prüfen');
		assert.match(
			yml,
			/ai:spec-ready|ai:ready/,
			'Workflow muss bereits fortgeschrittene Kandidaten (ai:spec-ready/ai:ready) überspringen (Idempotenz, kein Zurückwerfen laufender Issues)',
		);
	});
});

// ─── AK8 — Sauberer Skip bei fehlenden Secrets ───────────────────────────────

describe('AK8 — Preflight-Skip bei fehlenden APP_ID/APP_PRIVATE_KEY (kein roter Lauf)', () => {
	it('Workflow enthält einen Preflight-Check auf APP_ID und APP_PRIVATE_KEY', () => {
		const yml = unblockYml();
		assert.match(yml, /APP_ID/, 'Workflow muss APP_ID im Preflight prüfen');
		assert.match(yml, /APP_PRIVATE_KEY/, 'Workflow muss APP_PRIVATE_KEY im Preflight prüfen');
	});

	it('Preflight gibt ::warning:: aus und bricht sauber ab (kein exit 1 direkt nach dem Secret-Check)', () => {
		const yml = unblockYml();
		assert.match(
			yml,
			/::warning::/,
			'Workflow muss bei fehlenden Secrets ::warning:: ausgeben (Muster pr-needs-review-label.yml)',
		);
		const preflight = yml.match(/APP_ID[\s\S]{0,500}/);
		assert.ok(preflight, 'Preflight-Block nicht gefunden');
		const earlyExit = preflight[0].match(/::warning::[\s\S]{0,100}exit 1/);
		assert.ok(
			!earlyExit,
			'Preflight-Skip darf keinen harten exit 1 nach ::warning:: haben — der Lauf soll grün enden (sauberer Skip)',
		);
	});
});

// ─── AK9 — Repo-Scoping: ohne Checkout müssen gh-Befehle --repo tragen ────────

describe('AK9 — Repo-Scoping: reine gh-API ohne actions/checkout → --repo Pflicht', () => {
	it('Alle gh pr/issue/label-Befehle sind repo-gescoped (Negativkontrolle: kein bare gh ohne --repo)', () => {
		const yml = unblockYml();
		const ghCmds = yml.match(/gh (?:pr|issue|label) \w+[^\n]*/g) ?? [];
		assert.ok(ghCmds.length > 0, 'keine gh pr/issue/label-Befehle gefunden');
		for (const cmd of ghCmds) {
			assert.match(cmd, /--repo/, `gh-Befehl ohne --repo (Workflow ohne Checkout): ${cmd.trim()}`);
		}
	});
});

// ─── AK10 — Kein eigener LLM-Auflöser (reiner gh-Job) ─────────────────────────

describe('AK10 — Reiner gh-Job: keine eigene KI-Action', () => {
	it('Negativkontrolle: der Workflow enthält keinen anthropics/claude-Step', () => {
		const yml = unblockYml();
		assert.doesNotMatch(
			yml,
			/anthropics\/claude/,
			'Workflow darf keinen eigenen LLM-Auflöser enthalten — die Re-Analyse übernimmt 01-claude-triage.yml (via ai:analyzed-Entfernen)',
		);
	});
});
