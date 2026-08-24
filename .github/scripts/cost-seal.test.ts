import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sealCostRecord } from './cost-seal.ts';
import { readCostRecords, writeCostRecords, type CostEntry } from './cost-record.ts';

/**
 * Der Siegel-Lauf ist die Stelle, an der flüchtige Artefakte zur dauerhaften Repo-Datei
 * werden. Falsch gemergt bleibt unbemerkt (eine Kostendatei sieht immer plausibel aus),
 * deshalb prüfen diese Tests genau die stillen Fehlerfälle: doppelt gezählte Re-Run-
 * Artefakte, verlorene Bestandseinträge und ein Commit-Loop, weil "unchanged" falsch
 * als "changed" erkannt wird.
 */

const entry = (over: Partial<CostEntry> = {}): CostEntry => ({
	issueId: '42',
	timestamp: '2026-08-24T10:00:00Z',
	tokensIn: 1000,
	tokensOut: 100,
	cost: 0.05,
	...over,
});

/** Schreibt ein "Artefakt" (eine Datei <n>.json) in einen eigenen Unterordner. */
const writeArtifact = (root: string, dirName: string, entries: CostEntry[]): string => {
	const dir = join(root, dirName);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, '42.json');
	writeFileSync(file, JSON.stringify(entries), 'utf8');
	return file;
};

describe('cost-seal — Zusammenführen', () => {
	it('merge Artefakte UND Bestandsdatei zu einer chronologischen Liste', () => {
		const artifacts = mkdtempSync(join(tmpdir(), 'cost-seal-art-'));
		const repo = mkdtempSync(join(tmpdir(), 'cost-seal-repo-'));
		try {
			writeArtifact(artifacts, 'claude-costs-analyse-issue-42-1', [
				entry({ phase: 'analyse', timestamp: '2026-08-24T09:00:00Z' }),
			]);
			writeArtifact(artifacts, 'claude-costs-review-issue-42-2', [
				entry({ phase: 'review', timestamp: '2026-08-24T11:00:00Z' }),
			]);
			writeCostRecords('42', [entry({ phase: 'implement', timestamp: '2026-08-24T10:00:00Z' })], {
				rootDir: repo,
			});

			const result = sealCostRecord('42', artifacts, { rootDir: repo });
			assert.deepEqual(
				result.entries.map((e) => e.phase),
				['analyse', 'implement', 'review'],
			);
			assert.equal(result.changed, true, 'Bestand war unvollständig → muss schreiben');
		} finally {
			rmSync(artifacts, { recursive: true, force: true });
			rmSync(repo, { recursive: true, force: true });
		}
	});

	it('zählt ein Re-Run-Artefakt mit identischem Inhalt NICHT doppelt', () => {
		const artifacts = mkdtempSync(join(tmpdir(), 'cost-seal-dup-'));
		const repo = mkdtempSync(join(tmpdir(), 'cost-seal-dup-repo-'));
		try {
			const same = [entry({ phase: 'fixup', timestamp: '2026-08-24T12:00:00Z' })];
			writeArtifact(artifacts, 'lauf', same);
			writeArtifact(artifacts, 'rerun', same);
			writeCostRecords('42', [entry({ phase: 'analyse', timestamp: '2026-08-24T09:00:00Z' })], {
				rootDir: repo,
			});

			const result = sealCostRecord('42', artifacts, { rootDir: repo });
			assert.equal(result.entries.length, 2, 'identisches Re-Run-Artefakt darf nicht addieren');
		} finally {
			rmSync(artifacts, { recursive: true, force: true });
			rmSync(repo, { recursive: true, force: true });
		}
	});

	it('changed=false (kein Commit), wenn der Bestand bereits vollständig ist', () => {
		const artifacts = mkdtempSync(join(tmpdir(), 'cost-seal-idem-'));
		const repo = mkdtempSync(join(tmpdir(), 'cost-seal-idem-repo-'));
		try {
			const entries = [entry({ phase: 'analyse', timestamp: '2026-08-24T09:00:00Z' })];
			writeArtifact(artifacts, 'lauf', entries);
			// Bewusst OHNE Bestand im Repo: der erste Seal erzeugt die Datei überhaupt.

			const first = sealCostRecord('42', artifacts, { rootDir: repo });
			assert.equal(first.changed, true, 'Initial-Seal gegen leeres Repo schreibt');
			const second = sealCostRecord('42', artifacts, { rootDir: repo });
			assert.equal(second.changed, false, 'erneuter Seal desselben Standes schreibt NICHT');
			assert.equal(second.added, 0);
			assert.equal(readCostRecords('42', { rootDir: repo }).length, 1);
		} finally {
			rmSync(artifacts, { recursive: true, force: true });
			rmSync(repo, { recursive: true, force: true });
		}
	});

	it('aktualisiert Felder eines Eintrags, wenn das Artefakt die jüngere Fassung trägt', () => {
		const artifacts = mkdtempSync(join(tmpdir(), 'cost-seal-up-'));
		const repo = mkdtempSync(join(tmpdir(), 'cost-seal-up-repo-'));
		try {
			// Bestand: alter Eintrag ohne turns/valueCost; Artefakt: gleicher Lauf, neue Felder.
			writeCostRecords('42', [entry({ phase: 'review' })], { rootDir: repo });
			writeArtifact(artifacts, 'lauf', [entry({ phase: 'review', turns: 33, valueCost: 0.42 })]);

			const result = sealCostRecord('42', artifacts, { rootDir: repo });
			assert.equal(result.changed, true, 'Feld-Update muss persistieren');
			const [sealed] = readCostRecords('42', { rootDir: repo });
			assert.equal(sealed.turns, 33);
			assert.ok(Math.abs((sealed.valueCost ?? 0) - 0.42) < 1e-9);
		} finally {
			rmSync(artifacts, { recursive: true, force: true });
			rmSync(repo, { recursive: true, force: true });
		}
	});

	it('schreibt NICHT und meldet Treffer, wenn der gemergte Datensatz ein Secret enthält', () => {
		const artifacts = mkdtempSync(join(tmpdir(), 'cost-seal-sec-'));
		const repo = mkdtempSync(join(tmpdir(), 'cost-seal-sec-repo-'));
		try {
			// Ein Transcript-Feld (hier: model) trägt einen Token-Schnipsel in die Datei.
			writeArtifact(artifacts, 'lauf', [entry({ phase: 'analyse', model: 'sk-ant-api03-0123456789abcdefghij' })]);

			const result = sealCostRecord('42', artifacts, { rootDir: repo });
			assert.equal(result.secretFindings, 1, 'genau ein Muster trifft');
			assert.equal(result.changed, false, 'Secret-Befund darf NICHT geschrieben werden');
			assert.equal(result.added, 0);
			assert.deepEqual(readCostRecords('42', { rootDir: repo }), [], 'keine Datei entstanden');
			assert.ok(
				result.skipped.some((s) => s.startsWith('secret-match: ')),
				'Treffer reist über skipped an den Aufrufer',
			);
			assert.ok(
				!result.skipped.some((s) => s.includes('0123456789abcdefghij')),
				'Meldung darf das Secret nicht im Klartext enthalten',
			);
		} finally {
			rmSync(artifacts, { recursive: true, force: true });
			rmSync(repo, { recursive: true, force: true });
		}
	});
});
