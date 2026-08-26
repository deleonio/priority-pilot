import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findRecordFiles, mergeRecords, renderReport, totalsByPhase } from './cost-aggregate.ts';
import type { CostEntry } from './cost-record.ts';

/**
 * Der Aggregator ist die einzige Stelle, an der aus verstreuten Artefakten EINE Zahl wird.
 * Falsch summiert bleibt unbemerkt — eine Kostentabelle sieht immer plausibel aus.
 * Deshalb prüfen diese Tests vor allem die Fälle, in denen sie still falsch würde:
 * verlorene Unterordner, doppelt gezählte Re-Runs und ein als „$0.00" gerendeter Fremdtarif.
 */

let root: string;

const entry = (over: Partial<CostEntry> = {}): CostEntry => ({
	issueId: '912',
	timestamp: '2026-08-20T02:00:00Z',
	tokensIn: 1000,
	tokensOut: 100,
	cost: 0.05,
	...over,
});

const writeArtifact = (dirName: string, entries: CostEntry[]): void => {
	const dir = join(root, dirName);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, '912.json'), `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
};

before(() => {
	root = mkdtempSync(join(tmpdir(), 'cost-agg-'));
});

after(() => rmSync(root, { recursive: true, force: true }));

describe('cost-aggregate — Dateien finden', () => {
	it('findet gleichnamige Dateien in getrennten Artefakt-Unterordnern', () => {
		// download-artifact legt jedes Artefakt in einen eigenen Ordner; ALLE heissen 912.json.
		// Ein flaches Listing fände genau eine und verlöre die übrigen Phasen still.
		writeArtifact('claude-costs-analyse-issue-912-1', [entry({ phase: 'analyse' })]);
		writeArtifact('claude-costs-implement-issue-912-2', [entry({ phase: 'implement' })]);
		writeArtifact('claude-costs-review-issue-912-3', [entry({ phase: 'review' })]);

		assert.equal(findRecordFiles(root).length, 3);
	});

	it('liefert für ein leeres Verzeichnis eine leere Liste statt zu werfen', () => {
		const empty = mkdtempSync(join(tmpdir(), 'cost-agg-empty-'));
		assert.deepEqual(findRecordFiles(empty), []);
		rmSync(empty, { recursive: true, force: true });
	});

	it('wirft nicht bei einem nicht existierenden Verzeichnis', () => {
		assert.deepEqual(findRecordFiles(join(root, 'gibt-es-nicht')), []);
	});
});

describe('cost-aggregate — Zusammenführen', () => {
	const write = (dir: string, entries: CostEntry[]): string => {
		const full = join(root, 'merge', dir);
		mkdirSync(full, { recursive: true });
		const file = join(full, '912.json');
		writeFileSync(file, JSON.stringify(entries), 'utf8');
		return file;
	};

	it('sortiert chronologisch, unabhängig von der Dateireihenfolge', () => {
		const a = write('spaet', [entry({ phase: 'review', timestamp: '2026-08-20T03:00:00Z' })]);
		const b = write('frueh', [entry({ phase: 'analyse', timestamp: '2026-08-19T18:00:00Z' })]);
		const { entries } = mergeRecords([a, b]);
		assert.deepEqual(
			entries.map((e) => e.phase),
			['analyse', 'review'],
		);
	});

	it('zählt einen Re-Run mit identischem Datensatz NICHT doppelt', () => {
		const same = entry({ phase: 'implement', timestamp: '2026-08-20T02:51:00Z' });
		const a = write('lauf', [same]);
		const b = write('rerun', [same]);
		const { entries } = mergeRecords([a, b]);
		assert.equal(entries.length, 1);
	});

	it('behält zwei ECHTE Läufe derselben Phase (unterschiedlicher Timestamp)', () => {
		const a = write('fixup-1', [entry({ phase: 'fixup', timestamp: '2026-08-20T04:00:00Z' })]);
		const b = write('fixup-2', [entry({ phase: 'fixup', timestamp: '2026-08-20T05:00:00Z' })]);
		const { entries } = mergeRecords([a, b]);
		assert.equal(entries.length, 2);
	});

	it('überspringt kaputte Dateien und meldet sie, statt den Bericht zu verlieren', () => {
		const broken = join(root, 'merge', 'kaputt', '912.json');
		mkdirSync(join(root, 'merge', 'kaputt'), { recursive: true });
		writeFileSync(broken, '{ das ist kein JSON', 'utf8');
		const ok = write('heil', [entry({ phase: 'analyse' })]);

		const { entries, skipped } = mergeRecords([broken, ok]);
		assert.equal(entries.length, 1, 'der heile Datensatz muss erhalten bleiben');
		assert.deepEqual(skipped, [broken]);
	});
});

describe('cost-aggregate — Summen je Phase', () => {
	it('summiert Token und Kosten und zählt die Läufe', () => {
		const totals = totalsByPhase([
			entry({ phase: 'implement', tokensIn: 1000, tokensOut: 100, cost: 0.1, timestamp: '2026-08-20T01:00:00Z' }),
			entry({ phase: 'implement', tokensIn: 500, tokensOut: 50, cost: 0.05, timestamp: '2026-08-20T02:00:00Z' }),
		]);
		assert.equal(totals.length, 1);
		assert.equal(totals[0].runs, 2);
		assert.equal(totals[0].tokensIn, 1500);
		assert.equal(totals[0].tokensOut, 150);
		assert.ok(Math.abs(totals[0].cost - 0.15) < 1e-9);
	});

	it('behält die Reihenfolge des ersten Auftretens (Pipeline-Ablauf, nicht alphabetisch)', () => {
		const totals = totalsByPhase([
			entry({ phase: 'analyse', timestamp: '2026-08-19T18:00:00Z' }),
			entry({ phase: 'implement', timestamp: '2026-08-20T02:00:00Z' }),
			entry({ phase: 'documenter', timestamp: '2026-08-20T03:00:00Z' }),
		]);
		assert.deepEqual(
			totals.map((t) => t.phase),
			['analyse', 'implement', 'documenter'],
			'alphabetisch wäre analyse, documenter, implement — das verschleiert die Kette',
		);
	});

	it('markiert Fremdtarife, wenn ein Nicht-Claude-Lauf kein bepreistes Modell nennt', () => {
		const totals = totalsByPhase([entry({ phase: 'implement', provider: 'zai', cost: 0 })]);
		assert.equal(totals[0].foreignTariff, true, 'ohne `model` ist der Preis nicht belegbar');
	});

	it('markiert bepreiste z.ai-Laeufe NICHT als Fremdtarif', () => {
		// Seit der Aufnahme der GLM-Listenpreise ist `cost` hier echt — die Kostenspalte
		// zu entwerten wuerde den groessten Teil des Datensatzes unsichtbar machen.
		const totals = totalsByPhase([entry({ phase: 'implement', provider: 'zai', model: 'glm-5.3', cost: 0.48 })]);
		assert.equal(totals[0].foreignTariff, false);
	});

	it('markiert openrouter weiterhin als Fremdtarif — dort gibt es keine Preisliste', () => {
		const totals = totalsByPhase([
			entry({ phase: 'implement', provider: 'openrouter', model: 'deepseek/deepseek-v3.2', cost: 0 }),
		]);
		assert.equal(totals[0].foreignTariff, true);
	});

	it('behandelt fehlende Cache-Felder als 0 statt NaN (Alt-Datensätze)', () => {
		const totals = totalsByPhase([entry({ phase: 'analyse' })]);
		assert.equal(totals[0].cacheCreationTokens, 0);
		assert.equal(totals[0].cacheReadTokens, 0);
	});

	it('summiert turns und valueCost je Phase (Issue #984)', () => {
		const totals = totalsByPhase([
			entry({ phase: 'review', turns: 40, valueCost: 0.5, timestamp: '2026-08-24T01:00:00Z' }),
			entry({ phase: 'review', turns: 30, valueCost: 0.25, timestamp: '2026-08-24T02:00:00Z' }),
		]);
		assert.equal(totals[0].turns, 70);
		assert.ok(Math.abs(totals[0].valueCost - 0.75) < 1e-9);
	});

	it('erkennt Wert-Daten je Phase (hasValueData), nicht nur global — gemischte Tickets', () => {
		// Rollout-Fenster: jedes laufende Ticket hat Alt-Läufe und neue in EINEM Bericht.
		const totals = totalsByPhase([
			entry({ phase: 'analyse', timestamp: '2026-08-23T01:00:00Z' }), // Alt: ohne turns/valueCost
			entry({ phase: 'implement', turns: 7, valueCost: 0.1234, timestamp: '2026-08-24T01:00:00Z' }),
		]);
		const byPhase = new Map(totals.map((t) => [t.phase, t]));
		assert.equal(byPhase.get('analyse')?.hasValueData, false, 'Alt-Phase ohne erfasste Wert-Daten');
		assert.equal(byPhase.get('implement')?.hasValueData, true, 'Neu-Phase mit erfassten Wert-Daten');
	});

	it('behandelt fehlende turns/valueCost als 0 statt NaN (Alt-Datensätze)', () => {
		const totals = totalsByPhase([entry({ phase: 'analyse' })]);
		assert.equal(totals[0].turns, 0);
		assert.equal(totals[0].valueCost, 0);
	});

	it('fasst Einträge ohne Phase unter einem eigenen Schlüssel zusammen', () => {
		const totals = totalsByPhase([entry({ phase: undefined })]);
		assert.equal(totals[0].phase, '(ohne Phase)');
	});
});

describe('cost-aggregate — Bericht', () => {
	it('rendert KEINE Dollar-Summe, wenn ein Fremdtarif beteiligt war', () => {
		// Das ist der eigentliche Fehlerfall: `cost` ist bei zai per Konstruktion 0.
		// Als "$0.0000" gerendert liest sich das wie "war kostenlos" — eine Falschaussage,
		// auf die hin jemand eine Migrationsentscheidung treffen könnte.
		const report = renderReport('912', [entry({ phase: 'implement', provider: 'zai', cost: 0 })]);
		assert.match(report, /Fremdtarif/);
		assert.match(report, /Die Kostenspalte ist unvollständig/);
		assert.doesNotMatch(report, /\*\*\$0\.0000\*\*/);
	});

	it('rendert für reine Altdaten „—" statt $0.0000 in der Wert-Spalte (Issue #984)', () => {
		// Dasselbe Prinzip wie beim Fremdtarif: Ein Altdatensatz OHNE turns/valueCost ist
		// „nicht erfasst", nicht „null Prompts / wertlos" — die Spalte muss das sagen.
		const report = renderReport('912', [entry({ phase: 'implement', provider: 'zai', cost: 0 })]);
		assert.match(report, /vor der Erfassung dieser Felder/);
		assert.doesNotMatch(report, /\*\*\$0\.0000\*\*/);
	});

	it('rendert Zahlen, sobald ein Eintrag turns/valueCost trägt', () => {
		const report = renderReport('912', [
			entry({ phase: 'analyse', provider: 'zai', cost: 0, timestamp: '2026-08-23T01:00:00Z' }),
			entry({
				phase: 'implement',
				provider: 'zai',
				cost: 0,
				turns: 5,
				valueCost: 0.042,
				timestamp: '2026-08-24T01:00:00Z',
			}),
		]);
		assert.match(report, /\*\*5\*\*/, 'Turns-Summe');
		assert.match(report, /\*\*\$0\.0420\*\*/, 'Wert-Summe');
		assert.doesNotMatch(report, /vor der Erfassung dieser Felder/);
	});

	it('entscheidet „—" je PHASE, nicht nur global — gemischtes Ticket (Rollout-Fenster)', () => {
		// Dasselbe Prinzip wie bei reinen Altdaten, nur auf Phasenebene: Global entschieden
		// („irgendein Eintrag hat Daten") zeigt die reine Alt-Phase weiter „0" Turns und
		// „$0.0000" — die Falschaussage, vor der der „—"-Pfad gerade schützt.
		const report = renderReport('912', [
			entry({ phase: 'analyse', timestamp: '2026-08-23T01:00:00Z' }), // Alt: ohne turns/valueCost
			entry({ phase: 'implement', turns: 7, valueCost: 0.1234, timestamp: '2026-08-24T01:00:00Z' }),
		]);
		assert.match(report, /\| analyse \| 1 \| — \|/, 'Alt-Phase: Turns „—" statt 0');
		assert.match(report, /\| implement \| 1 \| 7 \|/, 'Neu-Phase: echte Turns');
		assert.match(report, /\| — \| \$0\.0500 \|/, 'Alt-Phase: Wert „—" statt $0.0000');
		assert.match(report, /\| \$0\.1234 \| \$/, 'Neu-Phase: echter Wert');
		assert.match(report, /\*\*7\*\*/, 'Summenzeile bleibt global: Zahlen');
	});

	it('rendert eine Dollar-Summe, wenn alle Läufe über claude liefen', () => {
		const report = renderReport('912', [
			entry({ phase: 'analyse', provider: 'claude', cost: 0.25, timestamp: '2026-08-19T18:00:00Z' }),
			entry({ phase: 'implement', provider: 'claude', cost: 0.75, timestamp: '2026-08-20T02:00:00Z' }),
		]);
		assert.match(report, /\*\*\$1\.0000\*\*/);
		assert.doesNotMatch(report, /Die Kostenspalte ist unvollständig/);
	});

	it('sagt bei leerer Eingabe offen, dass nichts gefunden wurde', () => {
		const report = renderReport('912', []);
		assert.match(report, /Keine Kosten-Datensätze gefunden/);
		assert.match(report, /90 Tage/);
	});

	it('weist übersprungene Dateien als Untererfassung aus', () => {
		const report = renderReport('912', [entry({ phase: 'analyse', provider: 'claude' })], ['/tmp/kaputt/912.json']);
		assert.match(report, /untererfasst/);
		assert.match(report, /\/tmp\/kaputt\/912\.json/);
	});

	it('nennt den erfassten Zeitraum', () => {
		const report = renderReport('912', [
			entry({ phase: 'analyse', timestamp: '2026-08-19T18:07:00Z' }),
			entry({ phase: 'documenter', timestamp: '2026-08-20T03:01:00Z' }),
		]);
		assert.match(report, /2026-08-19T18:07:00Z bis 2026-08-20T03:01:00Z/);
	});
});
