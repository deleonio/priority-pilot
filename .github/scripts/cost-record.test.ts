import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Issue #515 — Pro-Ticket Token-/Kostenerfassung.
// Diese Spec-Tests fixieren den Contract für `.github/scripts/cost-record.ts` (noch nicht
// implementiert → rot). Die Datenquelle = GitHub-Workflow-Run-Output; je Issue wird ein
// Datensatz unter der Issue-ID fortlaufend ergänzt und später chronologisch ausgelesen.
// Stil-Spiegel von analyze-test-suite.test.ts / workflow-consistency.test.ts: node:test +
// assert/strict, deutsche describe/it. Testebene: reine Funktionen auf isoliertem tmp-Dir
// (kein Schreiben ins echte Repo), statische Auswertung der Schema-Datei (ci.yml via tsx).
//
// Akzeptanzkriterien → Testfälle:
//   AK1 Datensatz pro Issue unter Issue-ID   → T1 (Existenz + Pfad), T3 (Felder)
//   AK2 fortlaufend ergänzt/aktualisiert      → T1 (≥1 Eintrag), T2 (Anhängen, kein Überschreiben)
//   AK3 Format einheitlich, Schema dokumentiert → Format (JSON-Asserts) + Schema-Dok-Test
//   AK4 chronologisch sortierbar, maschinenlesbar → T4 (aufsteigend sortiert)
//   AK5 keine Secrets im Repo                 → T5 (scanForSecrets)

import { COSTS_DIR, appendCostRecord, readCostRecords, scanForSecrets, type CostEntry } from './cost-record.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const tmpRoot = (): string => mkdtempSync(join(tmpdir(), 'cost-record-'));
const recordFile = (rootDir: string, issueId: string | number): string => join(rootDir, COSTS_DIR, `${issueId}.json`);

// Beispiel-Einträge (Token in/out + Kosten), wie ein Workflow-Run sie liefern würde.
const entryA = { timestamp: '2026-08-09T10:00:00Z', tokensIn: 12000, tokensOut: 3400, cost: 0.18 };
const entryB = { timestamp: '2026-08-09T11:30:00Z', tokensIn: 8800, tokensOut: 2100, cost: 0.12 };

describe('Issue #515 / AK1+AK2 (T1): Workflow-Run erzeugt Datensatz für <issueId> mit ≥1 Eintrag', () => {
	it('legt nach appendCostRecord eine Datei unter der Issue-ID im .costs-Verzeichnis an', () => {
		const rootDir = tmpRoot();
		appendCostRecord('515', entryA, { rootDir });

		// Datei existiert unter <rootDir>/.costs/515.json (Issue-ID als Dateiname).
		const raw = readFileSync(recordFile(rootDir, '515'), 'utf8');
		const parsed = JSON.parse(raw) as { entries?: CostEntry[] } | CostEntry[];

		// ≥1 Eintrag — nach erststem Run ist der Datensatz nicht leer.
		const count = Array.isArray(parsed) ? parsed.length : (parsed.entries?.length ?? 0);
		assert.ok(count >= 1, `Nach einem Run muss ≥1 Eintrag vorhanden sein, hatte ${count}`);
	});

	it('legt die Datei unter der numerischen Issue-ID ab, nicht unter einem generischen Namen', () => {
		const rootDir = tmpRoot();
		appendCostRecord(515, entryA, { rootDir });

		// AK1: Datensatz ist *unter der Issue-ID* abgelegt ( adressierbar pro Ticket).
		const raw = readFileSync(recordFile(rootDir, 515), 'utf8');
		assert.doesNotThrow(() => JSON.parse(raw), 'Datensatz muss maschinenlesbares JSON sein');
	});
});

describe('Issue #515 / AK1 (T3): Eintrag enthält Issue-ID, Timestamp, Token in/out und Kosten', () => {
	it('speichert alle Pflichtfelder mit korrektem Typ im Datensatz', () => {
		const rootDir = tmpRoot();
		const written = appendCostRecord('515', entryA, { rootDir });

		const entry: CostEntry = Array.isArray(written) ? written[0] : written;
		// T3: mindestens Issue-ID, Timestamp, Token (in/out) und Kosten.
		assert.equal(entry.issueId, '515', 'issueId fehlt');
		assert.equal(entry.timestamp, entryA.timestamp, 'timestamp fehlt');
		assert.equal(entry.tokensIn, entryA.tokensIn, 'tokensIn fehlt');
		assert.equal(entry.tokensOut, entryA.tokensOut, 'tokensOut fehlt');
		assert.equal(entry.cost, entryA.cost, 'cost fehlt');
	});
});

describe('Issue #515 / AK2 (T2): Zweiter Run hängt chronologisch an — kein Überschreiben', () => {
	it('erhält den ersten Eintrag unverändert und ergänzt den zweiten', () => {
		const rootDir = tmpRoot();
		appendCostRecord('515', entryA, { rootDir }); // Run 1
		appendCostRecord('515', entryB, { rootDir }); // Run 2

		const parsed = JSON.parse(readFileSync(recordFile(rootDir, '515'), 'utf8')) as CostEntry[];
		assert.equal(parsed.length, 2, 'Zweiter Run muss anhangen, nicht überschreiben');

		// Erster Eintrag (Werte aus Run 1) darf durch Run 2 nicht verändert worden sein.
		assert.deepEqual(parsed[0], { ...entryA, issueId: '515' }, 'erster Eintrag wurde überschrieben');
		assert.deepEqual(parsed[1], { ...entryB, issueId: '515' }, 'zweiter Eintrag fehlt/verfälscht');
	});
});

describe('Issue #515 / AK4 (T4): Auslese-Tool liefert alle Datensätze aufsteigend nach Zeit', () => {
	it('sortiert Einträge aufsteigend nach Timestamp, unabhängig von der Schreibreihenfolge', () => {
		const rootDir = tmpRoot();
		// Bewusst unsortiert eingefügt — die Reihenfolge darf nicht vom Append-Zustand abhängen.
		appendCostRecord('515', { timestamp: '2026-08-09T20:00:00Z', tokensIn: 1, tokensOut: 1, cost: 1 }, { rootDir });
		appendCostRecord('515', entryA, { rootDir }); // 10:00 — frühester
		appendCostRecord('515', entryB, { rootDir }); // 11:30

		const records = readCostRecords('515', { rootDir });
		assert.ok(records.length === 3, `readCostRecords muss alle Einträge liefern, hatte ${records.length}`);

		const ts = records.map((r) => r.timestamp);
		const sorted = [...ts].sort();
		assert.deepEqual(ts, sorted, 'readCostRecords muss aufsteigend nach Zeit sortieren');
	});

	it('liefert eine maschinenlesbare Struktur (Array von CostEntry)', () => {
		const rootDir = tmpRoot();
		appendCostRecord('515', entryA, { rootDir });
		const records = readCostRecords('515', { rootDir });
		assert.ok(Array.isArray(records), 'Rückgabe muss ein Array (maschinenlesbar) sein');
		assert.ok(
			records.every((r) => typeof r.cost === 'number'),
			'jeder Eintrag braucht numerische Felder',
		);
	});
});

describe('Issue #515 / AK3: Format einheitlich (JSON), Schema dokumentiert', () => {
	it('hält alle Datensätze als gültiges JSON (kein Mischformat YAML/JSON)', () => {
		const rootDir = tmpRoot();
		appendCostRecord('515', entryA, { rootDir });
		appendCostRecord(516, entryB, { rootDir });

		// Beide Issues müssen sich als JSON parsen lassen → einheitliches Format.
		assert.doesNotThrow(() => JSON.parse(readFileSync(recordFile(rootDir, '515'), 'utf8')));
		assert.doesNotThrow(() => JSON.parse(readFileSync(recordFile(rootDir, '516'), 'utf8')));
	});

	it('dokumentiert das Schema (.costs/SCHEMA.md) mit allen Pflichtfeldern', () => {
		// Schema ist Teil von AK3 — muss dokumentiert vorliegen.
		const schema = readFileSync(join(REPO_ROOT, COSTS_DIR, 'SCHEMA.md'), 'utf8');
		for (const field of ['issueId', 'timestamp', 'tokensIn', 'tokensOut', 'cost']) {
			assert.ok(schema.includes(field), `SCHEMA.md muss das Pflichtfeld „${field}" dokumentieren`);
		}
	});
});

describe('Issue #515 / AK5 (T5): Secret-Scan über den committeten Inhalt ist grün', () => {
	it('flaggt bekannte Secret-Muster (Token/Key), damit diese nicht ins Repo gelangen', () => {
		// Realistische Token-Präfixe der Pipeline (siehe docs/ci-architecture.md).
		const withSecret = 'cost 0.18 key=sk-ant-api03-abcdefghIJkmnopqrstuvwxyz1234567890';
		const findings = scanForSecrets(withSecret);
		assert.ok(findings.length >= 1, 'bekanntes Secret-Muster (sk-ant-…) muss erkannt werden');

		const withPat = 'run ok ghp_0123456789abcdefghijklmnopqrstuvwxyzAB tokens_in 100';
		assert.ok(scanForSecrets(withPat).length >= 1, 'GitHub-PAT (ghp_…) muss erkannt werden');
	});

	it('lässt saubere Cost-Inhalte unverändert durch (grün)', () => {
		const clean = JSON.stringify({
			entries: [{ issueId: '515', timestamp: '2026-08-09T10:00:00Z', tokensIn: 12000, tokensOut: 3400, cost: 0.18 }],
		});
		assert.equal(scanForSecrets(clean).length, 0, 'sauberer Cost-Datensatz darf keine Treffer liefern');
	});
});
