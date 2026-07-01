import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Vertrag-Tests — Pipeline-Härten (Härten-Audit 2026-07-01).
//
// Diese Tests sichern die deterministischen Gates, die den LLM-vertrauten Zustandsuebergaengen
// hinzugefuegt wurden (Prinzip "Gate statt Erinnerung"). Frueher waren kritische Uebergaenge
// (Stop-Guard, Label-Umschaltung, Opt-in-Diagnose, Doppel-Run-Schutz) NUR als Prompt-Anweisung
// vorhanden — die Spec suggerierte harte Garantien, die Realitaet war LLM-Vertrauen. Die neuen
// Shell-Gates machen diese Garantien deterministisch. Diese Tests verhindern, dass sie still
// wieder entfernt werden ( analog zu claude-pr-fixup.test.ts / model-delegation.test.ts).
//
// Testebene: statische YAML-Datei-Checks (node:test via tsx, ci.yml Z. ~89).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');

const readWorkflow = (name: string): string =>
	readFileSync(join(REPO_ROOT, '.github', 'workflows', name), 'utf8');
const readRepoFile = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

// Die Workflows, die alle drei Agent-Pfade (Claude/GLM/Mistral) enthalten.
const CLAUDE_WORKFLOWS = [
	'claude-triage.yml',
	'claude-retriage.yml',
	'claude-spec.yml',
	'claude-implement.yml',
	'claude-pr-review.yml',
	'claude-pr-fixup.yml',
] as const;

describe('C2 — Deterministischer Agent-Secret-Check (kein stiller Skip)', () => {
	for (const wf of CLAUDE_WORKFLOWS) {
		it(`${wf} enthaelt einen "Agent-Secret prüfen"-Step (kein stiller Skip bei fehlendem Secret)`, () => {
			const yml = readWorkflow(wf);
			assert.match(
				yml,
				/name: Agent-Secret pr[fü]fen \(kein stiller Skip\)/,
				`${wf} muss den deterministischen Agent-Secret-Check-Step enthalten (Haerten C2/S2)`,
			);
			// Der Step muss auf die drei Secrets pro Pfad pruefen (case-Statement).
			assert.match(yml, /CLAUDE_CODE_OAUTH_TOKEN:/, `${wf}: Agent-Secret-Check muss CLAUDE_CODE_OAUTH_TOKEN pruefen`);
			assert.match(yml, /ZAI_API_KEY:/, `${wf}: Agent-Secret-Check muss ZAI_API_KEY pruefen (GLM-Pfad)`);
			assert.match(yml, /MISTRAL_API_KEY:/, `${wf}: Agent-Secret-Check muss MISTRAL_API_KEY pruefen (Mistral-Pfad)`);
			// Bei Fehlen muss der Lauf deterministisch abbrechen (exit 1), nicht still skippen.
			assert.match(yml, /::error title=Agent-Secret fehlt/, `${wf}: fehlendes Secret muss ::error:: ausgeben (bewusstes Opt-in)`);
		});
	}

	it('Negativkontrolle: kein Workflow enthaelt mehr einen stillen Skip ohne Secret-Pruefung (Platzhalter-Test)', () => {
		// Dieser Test ist absichtlich trivial — er dokumentiert, dass die Agent-Schritte nicht mehr
		// ungeprueft laufen. Die funktionale Pruefung steckt in den Tests oben (Step existiert + exit 1).
		for (const wf of CLAUDE_WORKFLOWS) {
			assert.ok(readWorkflow(wf).length > 0, `${wf} ist leer — das waere ein stiller Ausfall`);
		}
	});
});

describe('C1 — Deterministischer Stop-Guard in claude-pr-fixup.yml (> 10 PR-Commits)', () => {
	it('fixup.yml enthaelt einen deterministischen "Stop-Guard"-Step (nicht nur Prompt)', () => {
		const yml = readWorkflow('claude-pr-fixup.yml');
		assert.match(
			yml,
			/name: Stop-Guard \(> 10 PR-Commits\)/,
			'claude-pr-fixup.yml muss einen deterministischen Stop-Guard-Step enthalten (Haerten C1/S1)',
		);
		// Der Step muss Commits deterministisch zaehlen (nicht dem LLM vertrauen).
		assert.match(yml, /--json commits --jq/, 'Stop-Guard muss Commits via gh-API zaehlen (deterministisch)');
		// Funktionale Schwelle (Verhaltens-Assert, nicht nur String-Präsenz).
		assert.match(yml, /-gt 10/, 'Stop-Guard muss bei > 10 PR-Commits stoppen (funktionale Schwelle)');
		// Bei Stop: stop=true Output + PR-Autor pingen (Verhaltens-Assert).
		assert.match(yml, /stop=true/, 'Stop-Guard muss stop=true setzen bei > 10 Commits');
		assert.match(yml, /gh pr comment/, 'Stop-Guard muss den PR-Autor via Kommentar pingen');
	});

	it('fixup.yml: die Agent-Schritte respektieren den Stop-Guard (stop != true)', () => {
		const yml = readWorkflow('claude-pr-fixup.yml');
		// Negativkontrolle: ohne die if-Bedingung wuerde der Agent trotz Stop laufen.
		const agentIfs = yml.match(/if:[^\n]*stop-guard\.outputs\.stop != 'true'[^\n]*/g);
		assert.ok(
			agentIfs && agentIfs.length >= 3,
			'Alle drei Agent-Schritte (Claude/Mistral/GLM) muessen `steps.stop-guard.outputs.stop != \'true\'` in ihrem if haben',
		);
	});
});

describe('H1 — Deterministische Label-Post-Assertion in claude-pr-review.yml', () => {
	it('review.yml enthaelt eine "Label-Post-Assertion" (Safe-Default ai:needs-changes)', () => {
		const yml = readWorkflow('claude-pr-review.yml');
		assert.match(
			yml,
			/name: Label-Post-Assertion \(Safe-Default ai:needs-changes\)/,
			'claude-pr-review.yml muss eine deterministische Label-Post-Assertion enthalten (Haerten H1/S4)',
		);
		// Verhaltens-Assert (nicht nur String-Präsenz): der Safe-Default muss funktional das Label setzen.
		assert.match(
			yml,
			/--add-label ai:needs-changes/,
			'Label-Post-Assertion muss funktional `--add-label ai:needs-changes` setzen (nicht nur im Namen erwähnen)',
		);
		// Der Step muss nach Agent-Ende pruefen, ob ein Ergebnis-Label existiert, sonst Safe-Default.
		assert.match(
			yml,
			/Safe-Default ai:needs-changes/,
			'Label-Post-Assertion muss bei fehlendem Ergebnis-Label ai:needs-changes als Safe-Default setzen',
		);
	});

	it('review.yml: Label-Post-Assertion laeuft NUR bei Agent success/failure (NICHT bei cancelled/skipped)', () => {
		const yml = readWorkflow('claude-pr-review.yml');
		// Negativkontrolle: laeuft sie bei cancelled, wuerde sie das Timeout-Signal (S3) stoeren.
		const assertionBlock = yml.match(
			/name: Label-Post-Assertion[\s\S]*?run:/,
		);
		assert.ok(assertionBlock, 'Label-Post-Assertion-Block nicht gefunden');
		assert.match(
			assertionBlock[0],
			/steps\.claude\.outcome == 'success'/,
			'Label-Post-Assertion darf nur bei success/failure laufen, nicht bei cancelled (S3 übernimmt Timeout)',
		);
		assert.doesNotMatch(
			assertionBlock[0].split('run:')[0],
			/outcome == 'cancelled'/,
			'Label-Post-Assertion darf NICHT bei cancelled laufen',
		);
	});
});

describe('H2 — Merge-Konflikt-Step in claude-pr-fixup.yml (UNKNOWN-Race, kein [skip ci])', () => {
	it('fixup.yml behandelt die UNKNOWN-Race bei mergeable (nicht still conflict=false)', () => {
		const yml = readWorkflow('claude-pr-fixup.yml');
		assert.match(
			yml,
			/is_unknown|UNKNOWN/,
			'Merge-Konflikt-Step muss die UNKNOWN-Race (async mergeable) explizit behandeln (Haerten H2)',
		);
		assert.match(yml, /conflict=unknown/, 'UNKNOWN muss zu conflict=unknown fuehren, nicht zu falschem conflict=false');
	});

	it('fixup.yml: Merge-Commit hat KEIN [skip ci] mehr (CI validiert den gemergten Stand)', () => {
		const yml = readWorkflow('claude-pr-fixup.yml');
		// Der Merge-Befehl darf [skip ci] nicht enthalten (Haerten H2 — sonst schluege ein
		// semantisch kaputter Auto-Merge erst beim finalen Fix-Push auf).
		const mergeCmd = yml.match(/git merge origin[^;\n]*-m "[^"]*"/);
		assert.ok(mergeCmd, 'git merge-Befehl nicht gefunden');
		assert.doesNotMatch(
			mergeCmd[0],
			/\[skip ci\]/,
			'Merge-Commit darf KEIN [skip ci] enthalten — CI muss den gemergten Stand validieren',
		);
	});

	it('fixup.yml: Agent-Prompts instruieren KEIN [skip ci] bei manueller Konflikt-Auflösung (M-3)', () => {
		const yml = readWorkflow('claude-pr-fixup.yml');
		// Negativkontrolle: frueher stand [skip ci] in den Prompts für manuelle Konflikt-Commits —
		// das widerspricht dem H2-Ziel (semantisch kaputter Auto-Merge schluege erst beim finalen
		// Fix-Push auf). [skip ci] darf in KEINEM "Fix merge conflict"-Commit-Befehl stehen.
		assert.doesNotMatch(
			yml,
			/Fix merge conflict[^\n]*\[skip ci\]/,
			'Agent-Prompts dürfen [skip ci] NICHT bei manueller Konflikt-Auflösung instruieren (Haerten M-3/H2)',
		);
	});
});

describe('H3 — Deterministischer Doppel-Run-Guard in spec/implement', () => {
	it('claude-spec.yml enthaelt einen "Doppel-Run-Guard"-Step', () => {
		const yml = readWorkflow('claude-spec.yml');
		assert.match(
			yml,
			/name: Doppel-Run-Guard \(existierender PR mit Closes #N\)/,
			'claude-spec.yml muss einen deterministischen Doppel-Run-Guard enthalten (Haerten H3)',
		);
		assert.match(yml, /skip=true/, 'Doppel-Run-Guard muss skip=true setzen bei existierendem PR');
	});

	it('claude-implement.yml enthaelt einen "Doppel-Run-Guard"-Step (ready-PR)', () => {
		const yml = readWorkflow('claude-implement.yml');
		assert.match(
			yml,
			/name: Doppel-Run-Guard \(ready-PR existiert bereits\)/,
			'claude-implement.yml muss einen deterministischen Doppel-Run-Guard enthalten (Haerten H3)',
		);
		assert.match(yml, /skip=true/, 'Doppel-Run-Guard muss skip=true setzen bei existierendem ready-PR');
	});

	it('spec.yml + implement.yml: Agent-Schritte respektieren den Doppel-Run-Guard', () => {
		for (const wf of ['claude-spec.yml', 'claude-implement.yml'] as const) {
			const yml = readWorkflow(wf);
			const agentIfs = yml.match(/if:[^\n]*doppel-guard\.outputs\.skip != 'true'[^\n]*/g);
			assert.ok(
				agentIfs && agentIfs.length >= 3,
				`${wf}: alle drei Agent-Schritte muessen \`steps.doppel-guard.outputs.skip != 'true'\` in ihrem if haben`,
			);
		}
	});
});

describe('S3 — Timeout-Alarm fuer PR-Workflows (review/fixup)', () => {
	for (const wf of ['claude-pr-review.yml', 'claude-pr-fixup.yml'] as const) {
		it(`${wf} postet bei Timeout einen sichtbaren PR-Kommentar (kein stiller PR-Stall)`, () => {
			const yml = readWorkflow(wf);
			assert.match(
				yml,
				/name: Bei Timeout PR-Kommentar \(Alarm\)/,
				`${wf} muss einen Timeout-Alarm-Step enthalten (Haerten S3)`,
			);
			// cancel-in-progress:false → outcome=cancelled ist echtes Timeout. Der Schritt postet
			// einen Kommentar, damit der PR nicht unsichtbar stale (PR-Workflows setzen kein ai:to-big-issue).
			assert.match(yml, /gh pr comment/, `${wf}: Timeout-Alarm muss einen PR-Kommentar posten`);
		});
	}
});

describe('M1 — Zentrale Node-Version (.nvmrc, kein Version-Drift)', () => {
	it('.nvmrc existiert im Repo-Root', () => {
		assert.ok(existsSync(join(REPO_ROOT, '.nvmrc')), '.nvmrc muss existieren (zentrale Node-Version)');
		const content = readRepoFile('.nvmrc').trim();
		assert.match(content, /^\d+\.\d+\.\d+$/, `.nvmrc muss eine konkrete Node-Version (x.y.z) enthalten, nicht "${content}"`);
	});

	it('ci/implement/fixup/deploy nutzen node-version-file: .nvmrc (kein harter Version-Drift)', () => {
		for (const wf of ['ci.yml', 'claude-implement.yml', 'claude-pr-fixup.yml', 'deploy.yml'] as const) {
			const yml = readWorkflow(wf);
			assert.match(
				yml,
				/node-version-file: \.nvmrc/,
				`${wf} muss node-version-file: .nvmrc nutzen (Haerten M1 — sonst Version-Drift wie früher 26.4.0 vs 26.3.1)`,
			);
			// Negativkontrolle: keine harte node-Version mehr (die den Drift verursachten).
			assert.doesNotMatch(
				yml,
				/node-version:\s*\d+\.\d+\.\d+/,
				`${wf} darf keine harte node-version: x.y.z mehr haben (würde .nvmrc umgehen)`,
			);
		}
	});
});

describe('M3 — retriage nur auf created (nicht edited — Spam-Vektor)', () => {
	it('claude-retriage.yml triggert nur auf issue_comment created, NICHT edited', () => {
		const yml = readWorkflow('claude-retriage.yml');
		// Haerten M3: edited ist ein Spam-/Missbrauchsvektor (nachtraegliches @claude in alten
		// Kommentar ohne sichtbaren neuen Kommentar). Nur created feuert zuverlaessig und sichtbar.
		const onBlock = yml.match(/on:[\s\S]*?types:\s*\[([^\]]+)\]/);
		assert.ok(onBlock, 'on-Block mit types nicht gefunden in claude-retriage.yml');
		assert.match(onBlock[1], /\bcreated\b/, 'retriage muss auf created triggern');
		assert.doesNotMatch(
			onBlock[1],
			/\bedited\b/,
			'retriage darf NICHT auf edited triggern (Spam-Vektor — Haerten M3)',
		);
	});
});

// Nachtrags-Findings aus dem adversarialen Gegencheck des Haerten-Audits (2026-07-01): drei
// Bugs, die die eigentlich schon geschlossenen Haerten-Punkte C1/C2 ueber Rand-Faelle wieder
// geoeffnet haetten, plus ein komplett uebersehener Roadmap-Punkt (L1).

describe('C2-Nachtrag — Agent-Secret-Check ist case-insensitiv (AI_AGENT=GLM/Glm/glm)', () => {
	for (const wf of CLAUDE_WORKFLOWS) {
		it(`${wf}: Secret-Check lowered AI_AGENT vor dem case-Vergleich (GHA-if ist case-insensitiv, Bash-case nicht)`, () => {
			const yml = readWorkflow(wf);
			assert.match(
				yml,
				/case "\$\{AI_AGENT,,\}" in/,
				`${wf}: case-Statement muss \${AI_AGENT,,} (lowercase) vergleichen — sonst routet AI_AGENT=GLM (Grossschreibung) am Secret-Check vorbei in den *)-Default-Zweig und prueft das falsche Secret`,
			);
		});
	}
});

describe('C1-Nachtrag — Stop-Guard ist fail-closed bei gh-API-Ausfall (nicht fail-open)', () => {
	it('fixup.yml: bei gh-API-Fehler wird stop=true gesetzt, NICHT commits=0 (das wuerde den Guard wirkungslos machen)', () => {
		const yml = readWorkflow('claude-pr-fixup.yml');
		const stopGuardBlock = yml.match(/name: Stop-Guard \(> 10 PR-Commits\)[\s\S]*?echo "stop=false"/);
		assert.ok(stopGuardBlock, 'Stop-Guard-Block nicht gefunden');
		assert.doesNotMatch(
			stopGuardBlock[0],
			/commits=0/,
			'Stop-Guard darf bei gh-API-Fehler NICHT commits=0 setzen (faellt sonst fail-open — der Guard wird bei anhaltendem API-Ausfall wirkungslos)',
		);
		// Der gh-API-Fehlerzweig muss selbst stop=true setzen (fail-closed).
		const fetchFailBlock = stopGuardBlock[0].match(/if ! commits=[\s\S]*?fi/);
		assert.ok(fetchFailBlock, 'gh-API-Fehler-Zweig des Stop-Guards nicht gefunden');
		assert.match(
			fetchFailBlock[0],
			/stop=true/,
			'Stop-Guard muss bei gh-API-Fehler fail-closed stop=true setzen',
		);
	});
});

describe('L1-Nachtrag — Triage/Retriage instruieren Zwischenstandssicherung (~18 Min)', () => {
	for (const wf of ['claude-triage.yml', 'claude-retriage.yml'] as const) {
		it(`${wf}: Agent-Prompt enthaelt eine ~18-Min-Zwischenstand-Anweisung (Symmetrie zu spec/implement)`, () => {
			const yml = readWorkflow(wf);
			assert.match(
				yml,
				/SPAETESTENS nach ~18 Minuten den Zwischenstand/,
				`${wf} muss die Agents anweisen, bei drohendem Timeout (~18 Min) den bisherigen Analyse-Zwischenstand zu sichern (Haerten L1)`,
			);
		});
	}
});
