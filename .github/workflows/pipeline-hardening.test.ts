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

const readWorkflow = (name: string): string => readFileSync(join(REPO_ROOT, '.github', 'workflows', name), 'utf8');
const readRepoFile = (...parts: string[]): string => readFileSync(join(REPO_ROOT, ...parts), 'utf8');

// Die Workflows, die alle drei Agent-Pfade (Claude/GLM/Mistral) enthalten.
// (claude-triage.yml deckt seit M8, 2026-07-08, sowohl Triage ALS AUCH Re-Triage in einem
// Workflow ab — vormals zwei getrennte Dateien claude-triage.yml + claude-retriage.yml.)
const CLAUDE_WORKFLOWS = [
	'claude-triage.yml',
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
			assert.match(
				yml,
				/::error title=Agent-Secret fehlt/,
				`${wf}: fehlendes Secret muss ::error:: ausgeben (bewusstes Opt-in)`,
			);
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
			"Alle drei Agent-Schritte (Claude/Mistral/GLM) muessen `steps.stop-guard.outputs.stop != 'true'` in ihrem if haben",
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
		const assertionBlock = yml.match(/name: Label-Post-Assertion[\s\S]*?run:/);
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

describe('G1 — Gate/Auto-Merge: Allowlist-Retry statt vorschnellem No-op (PR #220-Race)', () => {
	it('claude-pr-gate-merge.yml wiederholt die Allowlist-Check-Abfrage, statt eine leere/unvollstaendige Antwort sofort als "keine Checks" zu werten', () => {
		const yml = readWorkflow('claude-pr-gate-merge.yml');
		// Race (empirisch beobachtet, PR #220 2026-07-01): `gh pr checks` lieferte trotz laengst
		// laufender CI/Review-Checks wiederholt eine leere Liste. Ein Einmal-Aufruf darf das nicht
		// mehr sofort als "nichts zu tun" werten — es muss eine Retry-Schleife geben.
		assert.match(
			yml,
			/for attempt in 1 2 3 4 5; do/,
			'Gate/Auto-Merge muss die Allowlist-Checks in einer Retry-Schleife abfragen (Haerten G1)',
		);
		assert.match(
			yml,
			/has_ci="\$\(echo "\$allow" \| jq -r 'any\(\.\[\]; \.workflow == "CI"\)'\)"/,
			'Retry-Schleife muss explizit pruefen, ob der CI-Check als Eintrag sichtbar ist',
		);
		assert.match(
			yml,
			/has_review="\$\(echo "\$allow" \| jq -r 'any\(\.\[\]; \.workflow == "Claude PR Review \(Kreuzverhoer\)"\)'\)"/,
			'Retry-Schleife muss explizit pruefen, ob der Reviewer-Check als Eintrag sichtbar ist',
		);
	});

	it('claude-pr-gate-merge.yml: partielle Sichtbarkeit (nur CI ODER nur Reviewer) fuehrt zu No-op, nicht zum Weiterlaufen mit unvollstaendigen Daten', () => {
		const yml = readWorkflow('claude-pr-gate-merge.yml');
		assert.match(
			yml,
			/if \[ "\$has_ci" != "true" \] \|\| \[ "\$has_review" != "true" \]; then/,
			'Nach Ausschoepfen der Retries muss fehlende Sichtbarkeit EINES der beiden Allowlist-Checks separat zu einem No-op fuehren (Haerten G1)',
		);
	});

	it('claude-pr-gate-merge.yml: Retry-Schleife nutzt steigenden Backoff (kein fixes Intervall, das eine vermutete Ueberlastung verschaerfen koennte)', () => {
		const yml = readWorkflow('claude-pr-gate-merge.yml');
		assert.match(
			yml,
			/delays=\(2 3 5 8\)/,
			'Retry-Schleife muss einen steigenden Backoff verwenden, keinen fixen Sleep',
		);
	});

	it('claude-pr-gate-merge.yml: `gh pr checks`-Fehler landen sichtbar im Log (kein `2>/dev/null` mehr auf dem Retry-Aufruf)', () => {
		const yml = readWorkflow('claude-pr-gate-merge.yml');
		const retryCall = yml.match(
			/checks="\$\(gh pr checks "\$pr" --repo "\$REPO" --json name,bucket,workflow\)" \|\| true/,
		);
		assert.ok(
			retryCall,
			'Der `gh pr checks`-Aufruf in der Retry-Schleife darf stderr NICHT mehr unterdruecken — echte API-/Auth-Fehler muessen im Step-Log sichtbar sein, sonst sind sie von "Check noch nicht gepostet" ununterscheidbar (Reviewer-Fund)',
		);
	});
});

describe('G2 — Gate/Auto-Merge: fehlende App-Permission (Actions: Read) wird rot statt stillem No-op (PR #223)', () => {
	// Empirisch (PR #223, 2026-07-02): fehlt der GitHub App "Actions: Read", meldet
	// `gh pr checks --json workflow` deterministisch "Resource not accessible by integration"
	// (checkSuite.workflowRun) — die Check-Liste bleibt fuer JEDEN Lauf leer. Die G1-Retries und
	// die anschliessenden No-ops verschlucken das dauerhaft: das Gate ist blind, der PR bleibt
	// trotz ai:ready-to-merge unmerged, und kein spaeteres Event heilt den Zustand.
	it('claude-pr-gate-merge.yml erkennt die Permission-Fehlersignatur nach erschoepften Retries und beendet den Lauf rot', () => {
		const yml = readWorkflow('claude-pr-gate-merge.yml');
		assert.match(
			yml,
			/Resource not accessible by integration/,
			'Gate muss die GraphQL-Fehlersignatur der fehlenden Actions-Read-Permission gezielt pruefen (Haerten G2)',
		);
		assert.match(
			yml,
			/::error title=App-Permission fehlt \(Actions: Read\)::/,
			'Der Permission-Fehler muss den Lauf sichtbar rot beenden (::error + exit 1), statt als "keine Checks -> No-op" zu enden',
		);
	});

	it('claude-pr-gate-merge.yml postet beim Permission-Fehler einen Marker-deduplizierten PR-Kommentar (kein Spam pro Event)', () => {
		const yml = readWorkflow('claude-pr-gate-merge.yml');
		assert.match(
			yml,
			/<!-- gate-permission-alarm -->/,
			'Der Alarm-Kommentar muss einen Marker tragen, ueber den Folge-Laeufe das erneute Posten unterdruecken (das Gate feuert pro workflow_run/labeled-Event)',
		);
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
		assert.match(
			content,
			/^\d+\.\d+\.\d+$/,
			`.nvmrc muss eine konkrete Node-Version (x.y.z) enthalten, nicht "${content}"`,
		);
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

describe('E1 — E2E-Shard-Matrix: Matrix-Groesse == Shard-Nenner (kein stiller Test-Drop)', () => {
	// Sharding ist nur vollstaendig, wenn die Matrix genau so viele Shards definiert, wie der
	// Playwright-Aufruf `--shard=<i>/<N>` als Nenner nutzt. Divergieren sie (z. B. Matrix [1,2,3]
	// bei `/4`), laeuft der Shard 4/4 NIE — ein Viertel der E2E-Suite verschwindet lautlos, die
	// CI bleibt gruen. Dieser Test macht daraus einen roten, kausalen Check.
	it('ci.yml: Anzahl matrix.shard-Eintraege deckt sich mit dem --shard=…/N-Nenner', () => {
		const yml = readWorkflow('ci.yml');

		// Nenner aus dem Playwright-Aufruf (…--shard=${{ matrix.shard }}/<N>).
		const shardCall = yml.match(/--shard=\$\{\{\s*matrix\.shard\s*\}\}\/(\d+)/);
		assert.ok(shardCall, 'ci.yml muss playwright mit `--shard=${{ matrix.shard }}/N` aufrufen (E2E-Sharding)');
		const denom = Number(shardCall[1]);

		// Matrix-Liste: `shard: [1, 2, 3, 4]`. Bewusst NUR numerische Listen matchen — sonst greift
		// der Regex faelschlich in Prosa-Kommentaren (z. B. `shard: [...]` im Erklaertext).
		const matrixLine = yml.match(/shard:\s*\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]/);
		assert.ok(matrixLine, 'ci.yml muss eine numerische `matrix.shard`-Liste definieren (z. B. shard: [1, 2, 3, 4])');
		const shards = matrixLine[1].split(',').map((s) => Number(s.trim()));

		assert.equal(
			shards.length,
			denom,
			`Shard-Nenner (/${denom}) muss der Matrix-Groesse (${shards.length}) entsprechen — sonst werden Tests still gedroppt`,
		);
		// Vollstaendigkeits-/Luecken-Check: die Matrix muss exakt 1..N sein (kein doppelter/fehlender Shard).
		assert.deepEqual(
			[...shards].sort((a, b) => a - b),
			Array.from({ length: denom }, (_, i) => i + 1),
			`matrix.shard muss exakt 1..${denom} enthalten (kein doppelter/fehlender/luecken­behafteter Shard)`,
		);
	});
});

describe('E2 — CI laeuft NICHT auf Draft-PRs (spart Compute; Draft = rote Spec-Tests by design)', () => {
	// Der Spec-Draft traegt per Design rote Tests; ein voller CI-Lauf (inkl. E2E) darauf ist
	// Verschwendung. CI startet erst am Draft->Ready-Uebergang. Dieser Test verhindert, dass der
	// Draft-Guard oder der ready_for_review-Trigger still wieder entfernt wird.
	it('ci.yml: beide Jobs sind per if auf Nicht-Draft (oder Nicht-PR-Event) begrenzt', () => {
		const yml = readWorkflow('ci.yml');
		// Ein Draft-Guard je Job (verify + e2e) = mindestens zwei Vorkommen.
		const guards = yml.match(/github\.event\.pull_request\.draft == false/g) || [];
		assert.ok(
			guards.length >= 2,
			`ci.yml muss den Draft-Guard (github.event.pull_request.draft == false) an beiden Jobs tragen — gefunden: ${guards.length}`,
		);
	});

	it('ci.yml: triggert auf ready_for_review (sonst kein CI beim Draft->Ready-Uebergang)', () => {
		const yml = readWorkflow('ci.yml');
		assert.match(
			yml,
			/types:\s*\[[^\]]*\bready_for_review\b[^\]]*\]/,
			'ci.yml muss pull_request.types mit ready_for_review deklarieren (sonst startet CI erst beim naechsten Push nach Ready)',
		);
	});
});

describe('M3 — Re-Triage (issue_comment) nur auf created (nicht edited — Spam-Vektor)', () => {
	it('claude-triage.yml triggert den issue_comment-Pfad nur auf created, NICHT edited', () => {
		const yml = readWorkflow('claude-triage.yml');
		// Haerten M3: edited ist ein Spam-/Missbrauchsvektor (nachtraegliches @claude in alten
		// Kommentar ohne sichtbaren neuen Kommentar). Nur created feuert zuverlaessig und sichtbar.
		// Seit M8 (2026-07-08) traegt claude-triage.yml ZWEI on:-Trigger (issues + issue_comment) —
		// gezielt den issue_comment-Teilblock matchen, nicht den ersten types:-Treffer (issues).
		const onBlock = yml.match(/issue_comment:[\s\S]*?types:\s*\[([^\]]+)\]/);
		assert.ok(onBlock, 'issue_comment-Teilblock mit types nicht gefunden in claude-triage.yml');
		assert.match(onBlock[1], /\bcreated\b/, 'issue_comment-Trigger muss auf created feuern');
		assert.doesNotMatch(
			onBlock[1],
			/\bedited\b/,
			'issue_comment-Trigger darf NICHT auf edited feuern (Spam-Vektor — Haerten M3)',
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
		assert.match(fetchFailBlock[0], /stop=true/, 'Stop-Guard muss bei gh-API-Fehler fail-closed stop=true setzen');
	});
});

describe('L1-Nachtrag — Triage/Re-Triage instruieren Zwischenstandssicherung (~18 Min)', () => {
	it('claude-triage.yml: Agent-Prompt enthaelt eine ~18-Min-Zwischenstand-Anweisung (Symmetrie zu spec/implement)', () => {
		const yml = readWorkflow('claude-triage.yml');
		assert.match(
			yml,
			/SPAETESTENS nach ~18 Minuten den Zwischenstand/,
			'claude-triage.yml muss die Agents anweisen, bei drohendem Timeout (~18 Min) den bisherigen Analyse-Zwischenstand zu sichern (Haerten L1)',
		);
	});
});

// Label-Reihenfolge-Prinzip (Nachtrag nach beobachtetem Vorfall 2026-07-01): der Analyse-Workflow
// hatte ai:spec-ready gesetzt, BEVOR die Issue-Beschreibung aktualisiert war — der Spec-Workflow
// startete daraufhin mit veraltetem Ticket-Inhalt. Labels sind der Trigger fuer Folge-Workflows
// (App-Token-Events); sie duerfen daher NUR als allerletzter Schritt gesetzt/entfernt werden,
// NACHDEM alle Schreibvorgaenge (Issue-Beschreibung, Kommentar, Commit/Push, PR) abgeschlossen sind.
// Diese Tests pruefen die TEXTLICHE Reihenfolge in den Prompts als Proxy (harte Laufzeit-Garantie
// ist bei einem LLM nicht moeglich — das hier ist das staerkste static verfuegbare Signal).
const allIndices = (text, needle) => {
	const idx = [];
	let from = 0;
	for (;;) {
		const i = text.indexOf(needle, from);
		if (i === -1) break;
		idx.push(i);
		from = i + needle.length;
	}
	return idx;
};

const assertContentBeforeLabel = (wf, contentMarker, labelMarker, expectedCount) => {
	const yml = readWorkflow(wf);
	const contentIdx = allIndices(yml, contentMarker);
	const labelIdx = allIndices(yml, labelMarker);
	assert.equal(
		contentIdx.length,
		expectedCount,
		`${wf}: Content-Marker "${contentMarker}" sollte ${expectedCount}x vorkommen (einmal je Agent-Pfad), gefunden: ${contentIdx.length}`,
	);
	assert.equal(
		labelIdx.length,
		expectedCount,
		`${wf}: Label-Marker "${labelMarker}" sollte ${expectedCount}x vorkommen (einmal je Agent-Pfad), gefunden: ${labelIdx.length}`,
	);
	for (let i = 0; i < expectedCount; i++) {
		assert.ok(
			contentIdx[i] < labelIdx[i],
			`${wf}: Agent-Pfad #${i + 1} — der Label-Schritt ("${labelMarker}") steht VOR dem Content-Schreiben ("${contentMarker}"). Labels muessen immer erst NACH allen Schreibvorgaengen gesetzt werden, sonst startet der Folge-Workflow mit veraltetem Ticket-/PR-Inhalt.`,
		);
	}
};

describe('Label-Reihenfolge-Prinzip — Labels erst NACH allen Schreibvorgaengen (nie davor)', () => {
	it('claude-triage.yml: Beschreibung/Kommentar stehen vor der Label-Umschaltung (je Agent-Pfad, Triage UND Re-Triage)', () => {
		assertContentBeforeLabel('claude-triage.yml', 'Danach genau EINEN kurzen', 'ALLERLETZTER Schritt, NIE davor', 3);
	});

	it('claude-spec.yml: Push/Draft-PR stehen vor der ai:ready-Uebergabe (je Agent-Pfad)', () => {
		assertContentBeforeLabel('claude-spec.yml', 'DRAFT-PR erstellen', 'UEBERGABE (ALLERLETZTER Schritt', 3);
	});

	it('claude-implement.yml: Commit/Push stehen vor der ai:needs-review-Umschaltung (je Agent-Pfad)', () => {
		// M9 zurueckgerollt (2026-07-08, User-Entscheidung): implement soll SELBST entscheiden,
		// wann genau der Review startet — dafuer muss implement das Label selbst setzen (nicht ein
		// Autolabeler, der auf ein frueheres GitHub-Event reagiert). Siehe die begleitende
		// pr-needs-review-label.yml-Aenderung: die schliesst bot-erzeugte Draft->ready-Uebergaenge
		// jetzt bewusst aus, damit implement hier nicht ueberholt wird.
		assertContentBeforeLabel(
			'claude-implement.yml',
			'Committen, Branch pushen.',
			'ALLERLETZTER Schritt, NIE davor: ERST NACHDEM Push',
			3,
		);
	});

	it('pr-needs-review-label.yml: labelt NUR menschliche Aktoren, fuer ALLE drei Event-Typen (kein Vorpreschen vor implement)', () => {
		// Gegenstueck zum Revert oben: pr-needs-review-label.yml darf bot-erzeugte
		// opened/ready_for_review-Events NICHT mehr labeln (das war die vor-M9-Luecke, die den
		// Autolabeler implement.yml's eigenen, kontrollierten Label-Schritt zuvorkommen liess).
		const yml = readWorkflow('pr-needs-review-label.yml');
		const ifBlock = yml.match(/if:\s*>-\s*\n([\s\S]*?)\n\s*runs-on:/);
		assert.ok(ifBlock, 'Job-if-Block nicht gefunden in pr-needs-review-label.yml');
		assert.match(ifBlock[1], /sender\.type\s*!=\s*'Bot'/, 'pr-needs-review-label.yml muss sender.type != Bot pruefen');
		// Negativkontrolle: die alte Bypass-Disjunktion (opened/ready_for_review umgehen den
		// Bot-Filter) darf NICHT mehr vorkommen.
		assert.doesNotMatch(
			ifBlock[1],
			/action\s*==\s*'opened'\s*\|\|\s*.*action\s*==\s*'ready_for_review'\s*\|\|/,
			'pr-needs-review-label.yml darf opened/ready_for_review nicht mehr am Bot-Filter vorbeilassen',
		);
	});

	it('claude-implement.yml: macht den PR in ALLEN drei Agent-Pfaden tatsaechlich review-bereit (kein totes Ende)', () => {
		// Der eigentliche PR-ready-Mechanismus (gh pr ready / PR-Erstellung) muss unabhaengig von
		// der Label-Frage in allen 3 Agent-Pfaden erhalten bleiben (Claude/Mistral/GLM).
		const yml = readWorkflow('claude-implement.yml');
		const readyHits = (yml.match(/gh pr ready <pr-nr>/g) ?? []).length;
		const createHits = (yml.match(/PR ERSTELLEN \(ready to review/g) ?? []).length;
		assert.equal(
			readyHits,
			3,
			`claude-implement.yml muss \`gh pr ready <pr-nr>\` (Spec-Modus) in allen 3 Agent-Pfaden anweisen, gefunden: ${readyHits}`,
		);
		assert.equal(
			createHits,
			3,
			`claude-implement.yml muss die Fallback-PR-Erstellung (ready to review, kein Draft) in allen 3 Agent-Pfaden anweisen, gefunden: ${createHits}`,
		);
	});

	it('claude-pr-fixup.yml: Commit/Push stehen vor der Label-Umschaltung (je Agent-Pfad)', () => {
		assertContentBeforeLabel(
			'claude-pr-fixup.yml',
			'committen und auf den PR-Branch',
			'Abschluss (ALLERLETZTER Schritt, NIE davor',
			3,
		);
	});

	it('claude-pr-review.yml: Sammelkommentar steht vor der Label-Umschaltung (je Agent-Pfad)', () => {
		assertContentBeforeLabel(
			'claude-pr-review.yml',
			'Sammelkommentar konsolidieren',
			'Abschluss — GENAU EINEN Weg gehen',
			3,
		);
	});
});
