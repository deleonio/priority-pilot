import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// PR #585 — Spec-Crash "VERDICT ready, aber kein Spec-PR mit Tests". Ursache: Claude
// schrieb "Closes 582" (ohne "#") in den PR-Body → closingIssuesReferences bleibt leer →
// die Phasen-Workflows (02-spec, 03-implement) finden ihren eigenen PR nicht mehr.
// pr-for-issue.sh liefert einen deterministischen Body-Fallback ("NNN in:body"), sobald die
// closingReferences leer ausfällt.
//
// Testebene: das ECHTE Helper-Skript läuft mit gestubptem `gh` (kein Netz, kein jq nötig).
// Der Stub unterscheidet am `--search`-Flag Primärpfad (closingRef) vs. Fallback (Body) und
// protokolliert die Aufrufreihenfolge — so ist der Fallbackvertrag ausführbar gesichert
// (node:test via tsx, ci.yml:103: ".github/scripts/"*.test.ts).

const HERE = dirname(fileURLToPath(import.meta.url));
const HELPER = join(HERE, 'pr-for-issue.sh');

// Stub-`gh`: Aufruftyp am `--search`-Flag erkennen, konfigurierten Wert liefern + mitloggen.
const STUB_GH = `#!/usr/bin/env bash
log="\${GH_STUB_LOG:?}"
is_search=0
for a in "$@"; do [ "$a" = "--search" ] && is_search=1; done
if [ "$is_search" = "1" ]; then
  printf '%s' "\${STUB_FALLBACK_RESULT:-}"
  printf 'fallback\\n' >> "$log"
else
  printf '%s' "\${STUB_PRIMARY_RESULT:-}"
  printf 'primary\\n' >> "$log"
fi
exit 0
`;

type Opts = {
	primary?: string;
	fallback?: string;
	draft?: 'yes' | 'no' | 'any';
	out?: 'first' | 'all' | 'count';
};

const runHelper = (opts: Opts): { out: string; calls: string[] } => {
	const dir = mkdtempSync(join(tmpdir(), 'pr-for-issue-'));
	const log = join(dir, 'calls.log');
	writeFileSync(log, '');
	writeFileSync(join(dir, 'gh'), STUB_GH, { mode: 0o755 });
	const out = execFileSync(
		'bash',
		[HELPER, '--repo', 'acme/test', '--issue', '582', '--draft', opts.draft ?? 'any', '--out', opts.out ?? 'first'],
		{
			env: {
				...process.env,
				PATH: `${dir}:${process.env.PATH}`,
				GH_STUB_LOG: log,
				STUB_PRIMARY_RESULT: opts.primary ?? '',
				STUB_FALLBACK_RESULT: opts.fallback ?? '',
			},
			encoding: 'utf8',
		},
	);
	return { out, calls: readFileSync(log, 'utf8').split('\n').filter(Boolean) };
};

// AK1 — Primärpfad trifft (closingRef belegt, "Closes #NNN"): Fallback wird NICHT angerufen.
describe('AK1 — closingReferences belegt → Primärpfad, kein Fallback', () => {
	it('liefert PR-Nummer aus Primärpfad und ruft --search nicht auf', () => {
		const { out, calls } = runHelper({ primary: '585', fallback: '999' });
		assert.equal(out, '585');
		assert.deepEqual(calls, ['primary'], 'Fallback darf nicht angerufen werden, wenn Primärpfad trifft');
	});
});

// AK2 — REGRESSION #585: closingRef leer ("Closes NNN" ohne "#") → Body-Fallback findet PR.
describe('AK2 — closingReferences leer → Body-Fallback (PR #585)', () => {
	it('fällt auf --search zurück und liefert die PR-Nummer aus dem Body-Treffer', () => {
		const { out, calls } = runHelper({ primary: '', fallback: '585' });
		assert.equal(out, '585');
		assert.deepEqual(calls, ['primary', 'fallback'], 'Fallback muss nach leerem Primärpfad folgen');
	});
});

// AK3 — Beide Pfade leer → kein Treffer, kein Crash (first leer, count 0).
describe('AK3 — kein Treffer: first leer / count 0, kein Crash', () => {
	it('first: leere Ausgabe, Exit 0 (kein "null"-String)', () => {
		const { out } = runHelper({ primary: '', fallback: '', out: 'first' });
		assert.equal(out, '');
	});
	it('count: normalisiert auf 0 (sonst crasht [ -gt 0 ] im Caller)', () => {
		const { out } = runHelper({ primary: '', fallback: '', out: 'count' });
		assert.equal(out, '0');
	});
});

// AK4 — count-Modus triggert Fallback auch bei primary="0" (length liefert nie leer).
//       Ohne diese Härte würde der skip-guard (02/03, count) trotz fehlendem "#" nie
//       zurückfallen — der ready-PR bliebe unsichtbar, Spec/Implement liefen doppelt.
describe('AK4 — count: primary="0" triggert dennoch Fallback', () => {
	it('bei primary 0 und fallback-Treffer wird die Body-Anzahl geliefert', () => {
		const { out, calls } = runHelper({ primary: '0', fallback: '1', out: 'count' });
		assert.equal(out, '1');
		assert.deepEqual(calls, ['primary', 'fallback'], 'count=0 muss Fallback nach sich ziehen');
	});
});
