import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Die KOSTEN-BASIS ist Schritt 1 des Prompt-Audits (.github/prompts/prompt-audit.md): Aus
 * 140+ Dateien wird EINE Turn-Aussage, nach der der Audit seine Funde priorisiert. Falsch
 * summiert oder falsch gemittelt fällt still aus — die Tabelle sieht immer plausibel aus.
 * Geprüft wird deshalb die Rechenlogik: Turn-Summen je Phase und gesamt, der Ausschluss der
 * Läufe ohne `turns`-Feld (vor #984) aus Ø- und Je-Ticket-Werten, und die Phase ganz ohne
 * Turn-Daten.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'costs-summary.sh');

type Entry = { issueId: string; phase: string; cost: number; turns?: number };

const entry = (issueId: string, phase: string, turns?: number, cost = 1): Entry =>
	turns === undefined ? { issueId, phase, cost } : { issueId, phase, cost, turns };

const run = (entries: Entry[]): string => {
	const dir = mkdtempSync(join(tmpdir(), 'costs-summary-'));
	try {
		const byIssue = new Map<string, Entry[]>();
		for (const e of entries) byIssue.set(e.issueId, [...(byIssue.get(e.issueId) ?? []), e]);
		for (const [issue, list] of byIssue) writeFileSync(join(dir, `${issue}.json`), JSON.stringify(list), 'utf8');

		const res = spawnSync('bash', [script, dir], { encoding: 'utf8' });
		assert.equal(res.status, 0, `Skript crashte: ${res.stderr}`);
		return res.stdout;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
};

/** Eine Tabellenzeile als Spalten-Array (ohne die leeren Ränder der Markdown-Pipes). */
const row = (out: string, phase: string): string[] => {
	const line = out.split('\n').find((l) => l.startsWith(`| ${phase} |`));
	assert.ok(line, `Zeile für «${phase}» fehlt in:\n${out}`);
	return line
		.split('|')
		.slice(1, -1)
		.map((c) => c.trim());
};

const turnsTotal = (out: string, phase: string): string => row(out, phase)[5];
const turnsAvg = (out: string, phase: string): string => row(out, phase)[6];
const kennzahlen = (out: string): string => {
	const line = out.split('\n').find((l) => l.startsWith('Schleifen-Raten'));
	assert.ok(line, `Kennzahlen-Zeile fehlt in:\n${out}`);
	return line;
};

describe('costs-summary.sh — Turn-Kennzahlen der KOSTEN-BASIS', () => {
	it('summiert Turns je Phase und repo-weit', () => {
		const out = run([
			entry('100', 'implement', 10),
			entry('100', 'implement', 20),
			entry('100', 'review', 5),
			entry('200', 'review', 15),
		]);

		assert.equal(turnsTotal(out, 'implement'), '30');
		assert.equal(turnsTotal(out, 'review'), '20');
		assert.equal(turnsTotal(out, '**Gesamt**'), '50');
	});

	it('lässt Läufe ohne turns-Feld die Ø-Werte nicht verwässern und weist sie in der Fußnote aus', () => {
		const out = run([entry('100', 'implement', 10), entry('100', 'implement', 20), entry('100', 'implement')]);

		assert.equal(turnsAvg(out, 'implement'), '15', 'Ø über 10 und 20 — der dritte Lauf hat keine Turn-Daten');
		assert.equal(turnsAvg(out, '**Gesamt**'), '15');
		assert.equal(row(out, 'implement')[1], '3', 'Runs zählen weiter alle Läufe');
		assert.match(out, /Hinweis: 1 von 3 Läufen ohne turns-Feld/);
	});

	it('rechnet Turns/Ticket über die Tickets mit Turn-Daten', () => {
		const out = run([
			entry('100', 'implement', 10),
			entry('200', 'implement', 30),
			entry('300', 'implement'), // ganz ohne Turn-Daten: darf den Nenner nicht erhöhen
		]);

		assert.match(kennzahlen(out), /Turns\/Ticket = 20\b/);
		assert.equal(row(out, 'implement')[2], '3', 'Tickets zählen weiter alle Tickets');
	});

	it('zeigt eine Phase ganz ohne Turn-Daten als «—», nicht als 0', () => {
		const out = run([entry('100', 'implement', 10), entry('100', 'documenter')]);

		assert.equal(turnsTotal(out, 'documenter'), '—');
		assert.equal(turnsAvg(out, 'documenter'), '—');
	});

	it('verschweigt die Fußnote, wenn alle Läufe Turn-Daten haben', () => {
		const out = run([entry('100', 'implement', 10), entry('100', 'review', 4)]);

		assert.doesNotMatch(out, /Hinweis:/);
		assert.match(kennzahlen(out), /Turns\/Ticket = 14\b/);
	});
});
