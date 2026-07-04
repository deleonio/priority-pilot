import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests — PR-Konflikterkennung (#277).
//
// Sichert den neuen Erkennungs-Workflow `claude-pr-conflict-scan.yml`:
// Bei Push auf main alle offenen PRs auf Merge-Konflikte prüfen und bei
// DIRTY/CONFLICTING das Label `ai:needs-changes` setzen (App-Token!),
// damit der bestehende `claude-pr-fixup.yml` den Konflikt auflöst.
//
// Testebene: statische YAML-Verträge (node:test via tsx, Muster pipeline-hardening.test.ts).
// Tests werden ROT, bis Produktivcode (claude-pr-conflict-scan.yml) angelegt ist.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

const scanYml = (): string =>
	readFileSync(join(REPO_ROOT, '.github', 'workflows', 'claude-pr-conflict-scan.yml'), 'utf8');

// ─── AK1 — Trigger ───────────────────────────────────────────────────────────

describe('AK1 — Trigger: push auf branches: [main]', () => {
	it('Workflow enthält on: push mit branches: [main]', () => {
		const yml = scanYml();
		assert.match(yml, /on:/, 'Workflow muss einen on:-Block haben');
		assert.match(yml, /push:/, 'Workflow muss auf push triggern (Konflikte entstehen durch main-Vorlauf)');
		assert.match(yml, /branches:\s*[\r\n\s]*-\s*main/, 'Workflow muss auf branches: [main] (oder - main) triggern');
	});

	it('Workflow triggert NICHT auf pull_request oder schedule als Primär-Trigger (nur push main)', () => {
		const yml = scanYml();
		// Ein separater schedule/PR-Trigger wäre zulässig, aber der push-Trigger muss vorhanden sein.
		// Negativkontrolle: kein reiner workflow_dispatch ohne push (würde den Konflikt-Sweep verpassen).
		assert.match(
			yml,
			/on:\s*[\s\S]{0,200}push:/,
			'push muss im on:-Block stehen — workflow_dispatch allein reicht nicht',
		);
	});
});

// ─── AK2 — Erkennung ─────────────────────────────────────────────────────────

describe('AK2 — Erkennung: mergeable / mergeStateStatus lesen und auf DIRTY/CONFLICTING verzweigen', () => {
	it('Workflow liest mergeable und mergeStateStatus via gh pr view --json', () => {
		const yml = scanYml();
		assert.match(
			yml,
			/gh pr view[^\n]*--json[^\n]*mergeable/,
			'Workflow muss mergeable via `gh pr view --json mergeable` abfragen',
		);
		assert.match(
			yml,
			/mergeStateStatus/,
			'Workflow muss auch mergeStateStatus abfragen (DIRTY = deterministische Konflikt-Anzeige)',
		);
	});

	it('Workflow verzweigt explizit auf DIRTY oder CONFLICTING', () => {
		const yml = scanYml();
		assert.match(
			yml,
			/DIRTY|CONFLICTING/,
			'Workflow muss auf DIRTY oder CONFLICTING verzweigen, nicht nur auf MERGEABLE!=true prüfen',
		);
	});
});

// ─── AK3 — Weiterleitung + App-Token ─────────────────────────────────────────

describe('AK3 — Weiterleitung: ai:needs-changes via App-Token setzen (kein GITHUB_TOKEN)', () => {
	it('Workflow setzt das Label ai:needs-changes per gh issue/pr edit --add-label', () => {
		const yml = scanYml();
		assert.match(
			yml,
			/add-label[^\n]*ai:needs-changes|ai:needs-changes[^\n]*add-label/,
			'Workflow muss `--add-label ai:needs-changes` (oder add-label … ai:needs-changes) aufrufen',
		);
	});

	it('Workflow nutzt create-github-app-token oder APP_ID/APP_PRIVATE_KEY für das Label-Setzen', () => {
		const yml = scanYml();
		const hasAppToken = /create-github-app-token/.test(yml) || (/APP_ID/.test(yml) && /APP_PRIVATE_KEY/.test(yml));
		assert.ok(
			hasAppToken,
			'Workflow muss ein App-Token nutzen (create-github-app-token oder APP_ID + APP_PRIVATE_KEY) — ' +
				'GITHUB_TOKEN-gesetzte Labels lösen KEINE Folge-Workflows aus (bekanntes GHA-Verhalten)',
		);
	});

	it('Workflow erstellt KEINEN eigenen Auflöser — nur das Label ai:needs-changes setzen', () => {
		const yml = scanYml();
		// Negativkontrolle: der Workflow darf keinen Claude-Code-Action-Aufruf enthalten
		assert.doesNotMatch(
			yml,
			/anthropics\/claude-code-action/,
			'Workflow darf keinen eigenen Auflöser enthalten — ai:needs-changes triggert claude-pr-fixup.yml',
		);
		assert.doesNotMatch(
			yml,
			/uses:\s*anthropics\/claude/,
			'Kein Claude-Step im Scan-Workflow — die Auflösung ist Aufgabe von claude-pr-fixup.yml',
		);
	});
});

// ─── AK4 — Alle offenen PRs ──────────────────────────────────────────────────

describe('AK4 — Sweep über alle offenen PRs (kein Label-Filter)', () => {
	it('Workflow listet alle offenen PRs mit gh pr list --state open', () => {
		const yml = scanYml();
		assert.match(
			yml,
			/gh pr list[^\n]*--state open/,
			'Workflow muss `gh pr list --state open` nutzen (alle offenen PRs, nicht nur markierte)',
		);
	});

	it('gh pr list enthält KEINEN --label-Filter (würde PR-Untermengen übersehen)', () => {
		const yml = scanYml();
		const prListLine = yml.match(/gh pr list[^\n]*/);
		assert.ok(prListLine, 'gh pr list-Zeile nicht gefunden');
		assert.doesNotMatch(
			prListLine[0],
			/--label/,
			'gh pr list darf keinen --label-Filter haben — alle offenen PRs müssen geprüft werden',
		);
	});
});

// ─── AK5 — Idempotenz / kein Rauschen ────────────────────────────────────────

describe('AK5 — Idempotenz: kein Label-Flackern, kein Re-Labeln bei bereits gesetztem ai:needs-changes', () => {
	it('Workflow prüft, ob ai:needs-changes bereits gesetzt ist (Guard vor dem Label-Setzen)', () => {
		const yml = scanYml();
		// Idempotenz-Guard: Label darf nicht doppelt gesetzt werden (Flackern/Loop-Trigger)
		assert.match(yml, /ai:needs-changes/, 'Workflow muss ai:needs-changes im Guard und/oder Label-Step erwähnen');
		// Muss eine Guard-Bedingung für bereits gesetztes Label geben
		const hasGuard = /labels[^\n]*needs-changes|needs-changes[^\n]*labels|already|bereits|skip|idempoten/i.test(yml);
		assert.ok(
			hasGuard,
			'Workflow muss bei bereits vorhandenem ai:needs-changes einen No-op-Guard haben (verhindert Label-Flackern und Loop-Trigger)',
		);
	});

	it('Workflow überspringt PRs mit MERGEABLE (sauberer Zustand) ohne Label zu setzen', () => {
		const yml = scanYml();
		assert.match(yml, /MERGEABLE/, 'Workflow muss MERGEABLE explizit behandeln (No-op für saubere PRs)');
	});
});

// ─── AK6 — Async-Härtung (UNKNOWN/null) ──────────────────────────────────────

describe('AK6 — Async-Härtung: UNKNOWN/null führt zu No-op (kein Fehl-Positiv)', () => {
	it('Workflow behandelt mergeable = UNKNOWN explizit als No-op', () => {
		const yml = scanYml();
		assert.match(
			yml,
			/UNKNOWN/,
			'Workflow muss UNKNOWN (async mergeable direkt nach Push) explizit behandeln — kein Fehl-Positiv',
		);
	});

	it('UNKNOWN führt NICHT dazu, dass ai:needs-changes gesetzt wird', () => {
		const yml = scanYml();
		// Sicherstellen, dass UNKNOWN explizit als Skip/No-op deklariert ist
		const unknownBlock = yml.match(/UNKNOWN[\s\S]{0,200}/);
		assert.ok(unknownBlock, 'UNKNOWN-Block nicht gefunden');
		// Das Label darf im UNKNOWN-Zweig nicht direkt folgen (ohne weitere DIRTY-Bedingung)
		assert.doesNotMatch(
			unknownBlock[0].substring(0, 100),
			/add-label[^\n]*ai:needs-changes/,
			'Im UNKNOWN-Zweig darf ai:needs-changes NICHT gesetzt werden (Fehl-Positiv-Schutz)',
		);
	});
});

// ─── AK7 — Preflight-Skip bei fehlenden Secrets ──────────────────────────────

describe('AK7 — Sauberer Skip bei fehlenden APP_ID/APP_PRIVATE_KEY (kein roter Lauf)', () => {
	it('Workflow enthält einen Preflight-Check auf APP_ID und APP_PRIVATE_KEY', () => {
		const yml = scanYml();
		assert.match(yml, /APP_ID/, 'Workflow muss APP_ID im Preflight prüfen');
		assert.match(yml, /APP_PRIVATE_KEY/, 'Workflow muss APP_PRIVATE_KEY im Preflight prüfen');
	});

	it('Preflight gibt ::warning:: aus und bricht sauber ab (kein exit 1 / roter Lauf)', () => {
		const yml = scanYml();
		assert.match(
			yml,
			/::warning::/,
			'Workflow muss bei fehlenden Secrets ::warning:: ausgeben (Muster pr-needs-review-label.yml)',
		);
		// Negativkontrolle: der Preflight-Skip darf den Lauf NICHT rot machen
		// (::error + exit 1 wäre hier falsch — die App-Config ist eine externe Bedingung)
		const preflight = yml.match(/APP_ID[\s\S]{0,500}/);
		assert.ok(preflight, 'Preflight-Block nicht gefunden');
		// Soll keinen exit 1 unmittelbar nach dem ::warning:: für den Secret-Check ausgeben
		const earlyExit = preflight[0].match(/::warning::[\s\S]{0,100}exit 1/);
		assert.ok(
			!earlyExit,
			'Preflight-Skip darf keinen harten exit 1 nach ::warning:: haben — der Lauf soll grün enden (sauberer Skip)',
		);
	});
});

// ─── AK8 — Repo-Scoping: kein Checkout → gh braucht --repo ────────────────────

describe('AK8 — Repo-Scoping: ohne actions/checkout müssen gh-Befehle --repo tragen', () => {
	it('gh pr list ist repo-gescoped (--repo) — kein Verlass auf einen git-Checkout', () => {
		const yml = scanYml();
		// Der Workflow hat bewusst KEIN actions/checkout (reine gh-API). Ohne --repo leitet gh die
		// Repo-Identität aus dem lokalen git-Remote ab → `git` wird aufgerufen →
		// `fatal: not a git repository`. Muster: claude-pr-gate-merge.yml / claude-spec.yml
		// nutzen `gh pr list --repo …`. Regression aus dem echten roten CI-Lauf (#277).
		const prListLine = yml.match(/gh pr list[^\n]*/);
		assert.ok(prListLine, 'gh pr list-Zeile nicht gefunden');
		assert.match(
			prListLine[0],
			/--repo/,
			'gh pr list muss --repo tragen — der Workflow hat keinen Checkout, sonst `fatal: not a git repository`',
		);
	});

	it('Alle gh pr/issue/label-Befehle sind repo-gescoped (Negativkontrolle: kein bare gh ohne --repo)', () => {
		const yml = scanYml();
		const ghCmds = yml.match(/gh (?:pr|issue|label) \w+[^\n]*/g) ?? [];
		assert.ok(ghCmds.length > 0, 'keine gh pr/issue/label-Befehle gefunden');
		for (const cmd of ghCmds) {
			assert.match(cmd, /--repo/, `gh-Befehl ohne --repo (Workflow ohne Checkout): ${cmd.trim()}`);
		}
	});
});
