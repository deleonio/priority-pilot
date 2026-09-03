// Gesamt-Übersicht über ALLE versiegelten Kosten-Datensätze (.costs/*.json) — das
// Gegenstück zu cost-aggregate.ts (EIN Ticket): Es rendert die repo-weite Tabelle,
// mit der die Bearbeitungseffizienz beurteilt wird (oberstes Ziel, s. Issue #984).
//
// Datenbasis sind die versiegelten Dateien, NICHT die 90-Tage-Artefakte: Der Report
// zeigt damit genau das, was dauerhaft erhalten ist. Läuft lokal und im Workflow
// „Kosten-Übersicht" (manuell, read-only) in die Job-Summary:
//   node .github/scripts/costs-report.ts --dir .costs
//
// Stil-Spiegel von cost-aggregate.ts: Node-Eintritt, keine externen Deps, ESM,
// ausschliesslich löschbare TypeScript-Syntax.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { totalsByPhase } from './cost-aggregate.ts';
import type { CostEntry } from './cost-record.ts';

export type TicketTotal = {
	issue: string;
	runs: number;
	turns: number;
	tokensIn: number;
	tokensOut: number;
	valueCost: number;
	cost: number;
	first: string;
	last: string;
	/** Phasen-Verteilung in Erstauftreten-Reihenfolge, z. B. „analyse:1 … fixup:4". */
	phases: string[];
};

const ZERO = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/** Roh-Einträge EINER Ticket-Datei — Zwischenschritt zwischen Datei und Summenzeile. */
export type TicketEntries = { issue: string; entries: CostEntry[] };

/**
 * Liest alle `<issueId>.json` unter `dir` roh ein — die gemeinsame Datenquelle aller
 * repo-weiten Berichte (Kosten hier, Turns in turns-report.ts). Kaputte Dateien werden
 * übersprungen und gemeldet, statt den Bericht scheitern zu lassen; ein nicht lesbares
 * Verzeichnis meldet sich als einzelner Skip.
 */
export function readTickets(dir: string): { tickets: TicketEntries[]; skipped: string[] } {
	const tickets: TicketEntries[] = [];
	const skipped: string[] = [];
	let names: string[] = [];
	try {
		names = readdirSync(dir);
	} catch {
		return { tickets, skipped: [dir] };
	}
	for (const name of names.sort()) {
		if (!name.endsWith('.json') || name === 'SCHEMA.md') continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(join(dir, name), 'utf8'));
		} catch {
			skipped.push(name);
			continue;
		}
		if (!Array.isArray(parsed)) {
			skipped.push(name);
			continue;
		}
		const entries = parsed as CostEntry[];
		if (entries.length === 0) continue;
		tickets.push({ issue: name.replace(/\.json$/, ''), entries });
	}
	return { tickets, skipped };
}

/** Summiert die Einträge EINES Tickets zur Berichtszeile. */
const ticketTotal = ({ issue, entries }: TicketEntries): TicketTotal => {
	const byPhase = new Map<string, number>();
	const total: TicketTotal = {
		issue,
		runs: entries.length,
		turns: 0,
		tokensIn: 0,
		tokensOut: 0,
		valueCost: 0,
		cost: 0,
		first: entries[0]?.timestamp ?? '',
		last: entries[entries.length - 1]?.timestamp ?? '',
		phases: [],
	};
	for (const e of entries) {
		total.turns += ZERO(e.turns);
		total.tokensIn += ZERO(e.tokensIn);
		total.tokensOut += ZERO(e.tokensOut);
		total.valueCost += ZERO(e.valueCost);
		total.cost += ZERO(e.cost);
		const phase = e.phase ?? '(ohne)';
		byPhase.set(phase, (byPhase.get(phase) ?? 0) + 1);
	}
	total.phases = [...byPhase.entries()].map(([phase, n]) => `${phase}:${n}`);
	return total;
};

// Schleifen-Kandidaten zuerst: absteigend nach Wert, dann Issue-Nummer aufsteigend —
// der Bericht soll die Ausreisser oben zeigen, nicht sie in 50 Zeilen verstecken.
const byValue = (a: TicketTotal, b: TicketTotal): number =>
	b.valueCost - a.valueCost || Number(a.issue) - Number(b.issue);

/** Liest alle <issueId>.json unter `dir` und summiert je Ticket. Kaputte Dateien übersprungen+gemeldet. */
export function ticketTotals(dir: string): { tickets: TicketTotal[]; skipped: string[] } {
	const { tickets, skipped } = readTickets(dir);
	return { tickets: tickets.map(ticketTotal).sort(byValue), skipped };
}

const num = (n: number): string => n.toLocaleString('de-DE');
const usd = (n: number): string => `$${n.toFixed(2)}`;
const mio = (n: number): string => `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio`;
export const pct = (n: number): string => `${(n * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
const share = (part: number, total: number): number => (total > 0 ? part / total : 0);

/** Unicode-Balken (10 Zeichen █/░) plus Prozent — Anteile direkt in der Tabellenzeile sichtbar. */
export const bar = (part: number, total: number): string => {
	const anteil = share(part, total);
	const filled = Math.round(Math.max(0, Math.min(1, anteil)) * 10);
	return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${pct(anteil)}`;
};

// Kalenderformat für Berlin-Tage: en-CA liefert ISO-ähnlich „2026-09-03“ ohne Nachformatieren.
const berlinFmt = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Europe/Berlin',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

/** Kalendertag in Berlin-Lokalzeit („2026-09-03“) — der Report zählt menschliche Tage, keine UTC-Slices; unlesbare Stempel fallen auf den UTC-Slice zurück. */
export const berlinDay = (timestamp: string): string => {
	const d = new Date(timestamp);
	return Number.isNaN(d.getTime()) ? timestamp.slice(0, 10) : berlinFmt.format(d);
};

/** ISO-Woche eines Berlin-Kalendertags („2026-W35“) — Anker ist der Donnerstag der Woche. */
export const isoWeek = (day: string): string => {
	const d = new Date(`${day}T12:00:00Z`);
	const thursday = new Date(d);
	thursday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
	const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
	const week = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
	return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

/** Markdown-Bericht: Summen, Phasen-Verteilung, Tabelle je Ticket (Wert absteigend). */
export function renderReport(dir: string): string {
	// EINMAL lesen, zweimal auswerten: Ticket-Summen für die Tabelle, Roh-Einträge für die
	// Phasen-/Trend-Rechnungen. Die Phasen-Reihenfolge folgt damit der Ticket-Nummer
	// (≈ Zeitachse) statt der Wert-Sortierung — was `totalsByPhase` ohnehin meint.
	const { tickets: raw, skipped } = readTickets(dir);
	const tickets = raw.map(ticketTotal).sort(byValue);
	const lines: string[] = [];
	lines.push('## 💰 Kosten-Übersicht — alle versiegelten Tickets', '');
	if (tickets.length === 0) {
		lines.push(`Keine Datensätze unter \`${dir}\` gefunden.`, '');
		return `${lines.join('\n')}\n`;
	}

	// Einträge in der Reihenfolge der Tabelle unten (Wert absteigend) — `totalsByPhase` ordnet
	// die Phasen nach ihrem ersten Auftreten in der Eingabe, und diese Reihenfolge ist die
	// bisherige des Berichts.
	const byIssue = new Map(raw.map((t) => [t.issue, t.entries]));
	const allEntries: CostEntry[] = tickets.flatMap((t) => byIssue.get(t.issue) ?? []);
	const phases = totalsByPhase(allEntries);
	const sum = tickets.reduce(
		(a, t) => ({
			runs: a.runs + t.runs,
			turns: a.turns + t.turns,
			tokensIn: a.tokensIn + t.tokensIn,
			tokensOut: a.tokensOut + t.tokensOut,
			valueCost: a.valueCost + t.valueCost,
			cost: a.cost + t.cost,
		}),
		{ runs: 0, turns: 0, tokensIn: 0, tokensOut: 0, valueCost: 0, cost: 0 },
	);
	const anyTurns = sum.turns > 0;
	// Zeitraum über ALLE Tickets (min/max), nicht über die Enden der wert-sortierten
	// Liste — der billigste Ticket-Datensatz stammt selten vom ersten Tag. Anzeige in
	// Berlin-Tagen, wie überall im Report.
	const first = tickets.reduce((min, t) => (t.first < min ? t.first : min), tickets[0].first);
	const last = tickets.reduce((max, t) => (t.last > max ? t.last : max), tickets[0].last);

	// KPI-Kopf: die vier Ziele aus docs/kosten-optimierungsplan.md („Erfolgsmessung") direkt
	// gegen die Ist-Werte — der Report soll bewerten, nicht nur aufschlüsseln. Läufe ohne
	// Modell-/Cache-Felder (Altdaten) fließen in die jeweilige Kennzahl nicht ein.
	const messende = allEntries.filter((e) => ZERO(e.valueCost) > 0);
	const vcTickets = tickets.filter((t) => t.valueCost > 0);
	const kpiRows: string[] = [];
	if (vcTickets.length > 0) {
		const jeTicket = sum.valueCost / vcTickets.length;
		kpiRows.push(`| Ø Wert je Ticket (nur messende) | ${usd(jeTicket)} | < $3.00 | ${jeTicket < 3 ? '🟢' : '🔴'} |`);
	}
	const reviewRuns = allEntries.filter((e) => e.phase === 'review').length;
	const runden = reviewRuns / tickets.length;
	kpiRows.push(
		`| Review-Runden je Ticket | ${runden.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} | ≤ 1,2 | ${runden <= 1.2 ? '🟢' : '🔴'} |`,
	);
	const mitCache = allEntries.filter(
		(e): e is CostEntry & { cacheReadTokens: number } => typeof e.cacheReadTokens === 'number',
	);
	const cacheIn = mitCache.reduce((a, e) => a + ZERO(e.tokensIn), 0);
	const cacheRead = mitCache.reduce((a, e) => a + ZERO(e.cacheReadTokens), 0);
	if (cacheIn > 0) {
		kpiRows.push(
			`| Cache-Effizienz (Read / Input) | ${pct(share(cacheRead, cacheIn))} | > 95 % | ${cacheRead / cacheIn > 0.95 ? '🟢' : '🔴'} |`,
		);
	}
	const mitModell = allEntries.filter(
		(e): e is CostEntry & { model: string } => typeof e.model === 'string' && e.model.length > 0,
	);
	const opusRuns = mitModell.filter((e) => /opus/i.test(e.model)).length;
	const haikuRuns = mitModell.filter((e) => /haiku/i.test(e.model)).length;
	if (mitModell.length > 0) {
		const opus = share(opusRuns, mitModell.length);
		const haiku = share(haikuRuns, mitModell.length);
		kpiRows.push(
			`| Modell-Mix Opus / Haiku | ${pct(opus)} / ${pct(haiku)} | < 10 % / > 50 % | ${opus < 0.1 && haiku > 0.5 ? '🟢' : '🔴'} |`,
		);
	}

	// Block-Aufschlüsselung: echter Input / Cache-Write / Cache-Read aus tokensIn ableiten.
	// Grund: die Summe verdeckt, wo das Geld fliesst — Cache-Read ist rabattiert (0,1x)
	// und trotzdem oft der groesste Block; Output-Disziplin optimiert nur einen Anteil.
	const blockTokens = (p: PhaseTotal): { input: number; write: number; read: number } => ({
		input: Math.max(0, p.tokensIn - p.cacheCreationTokens - p.cacheReadTokens),
		write: p.cacheCreationTokens,
		read: p.cacheReadTokens,
	});

	lines.push(
		`**${tickets.length} Tickets · ${sum.runs} Läufe · Zeitraum ${berlinDay(first)} bis ${berlinDay(last)}**`,
		'',
	);
	if (kpiRows.length > 0) {
		lines.push(
			'| Kennzahl | Ist | Ziel | Status |',
			'| --- | ---: | ---: | :---: |',
			...kpiRows,
			'',
			'> Ziele aus `docs/kosten-optimierungsplan.md` (26.08.). Der Modell-Mix zielte auf den',
			'> Claude-Fuhrpark — glm-Läufe zählen zu keiner Klasse, der z.ai-Standard (#1060) macht',
			'> den Haiku-Anteil als Hebel obsolet.',
			'',
		);
	}
	lines.push(
		'| Phase | Läufe | Turns | Input | Cache-W (1,25×) | Cache-R (0,1×) | Token out | Wert (USD) | Anteil |',
		'| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |',
	);
	for (const p of phases) {
		const b = blockTokens(p);
		lines.push(
			`| ${p.phase} | ${p.runs} | ${anyTurns ? num(p.turns) : '—'} | ${mio(b.input)} | ${mio(b.write)} | ${mio(b.read)} | ${num(p.tokensOut)} | ${usd(p.valueCost)} | ${bar(p.valueCost, sum.valueCost)} |`,
		);
	}
	const sumBlocks = phases.reduce(
		(a, p) => {
			const b = blockTokens(p);
			return { input: a.input + b.input, write: a.write + b.write, read: a.read + b.read };
		},
		{ input: 0, write: 0, read: 0 },
	);
	lines.push(
		`| **Summe** | **${sum.runs}** | **${anyTurns ? num(sum.turns) : '—'}** | **${mio(sumBlocks.input)}** | **${mio(sumBlocks.write)}** | **${mio(sumBlocks.read)}** | **${num(sum.tokensOut)}** | **${usd(sum.valueCost)}** | ${bar(1, 1)} |`,
		'',
	);

	// Block-Kosten-Verteilung: USD je Block über alle Phasen. Roh-Bewertung zu
	// mid-Klassenpreisen (3/15 je M), dann auf die valueCost-Summe skaliert — je
	// Eintrag gerechnete Klassen-Preise sind fuer den Ueberblick zu fein; Anteile
	// stimmen, der Gesamtwert bleibt konsistent zur Tabelle oben.
	const rawIn = (sumBlocks.input / 1e6) * 3;
	const rawWrite = (sumBlocks.write / 1e6) * 3 * 1.25;
	const rawRead = (sumBlocks.read / 1e6) * 3 * 0.1;
	const rawOut = (sum.tokensOut / 1e6) * 15;
	const rawSum = rawIn + rawWrite + rawRead + rawOut || 1;
	const scale = sum.valueCost / rawSum;
	const blockRow = (label: string, tokens: number, usd: number): string =>
		`| ${label} | ${mio(tokens)} | $${usd.toFixed(2)} | ${bar(usd, sum.valueCost)} |`;
	lines.push(
		'### Kosten nach Block',
		'',
		'| Block | Token | Wert (USD) | Anteil |',
		'| --- | ---: | ---: | :--- |',
		blockRow('Input (echt)', sumBlocks.input, rawIn * scale),
		blockRow('Cache-Write (1,25×)', sumBlocks.write, rawWrite * scale),
		blockRow('Cache-Read (0,1×)', sumBlocks.read, rawRead * scale),
		blockRow('Output', sum.tokensOut, rawOut * scale),
		'',
		'> Cache-Read ist rabattiert, aber bei hoher Turn-Zahl der größte Treiber;',
		'> Output ist pro Token am teuersten. Achtung: Datensätze vor der',
		'> Cache-Erfassung zählen komplett als „echter Input“ und überzeichnen ihn.',
		'',
	);

	// Zeitlicher Trend der Durchschnittskosten je Run (nur messende Läufe, valueCost > 0).
	// Grund: ein Trend ist der Kompass für Optimierungen — Tagesmittel glätten Ticket-Streuung,
	// Phasen-Mittel zeigen, WELCHE Phase den Trend treibt. Läufe ohne Messung (valueCost=0,
	// vor #984) würden den Trend gegen 0 ziehen und sind ausgeschlossen. Tages-Grenzen
	// gelten in Berlin-Lokalzeit — ein UTC-Slice würde Abend-Läufe nach 0 Uhr dem Vortag zuschlagen.
	const byDay = new Map<string, { runs: number; vc: number }>();
	const byWeek = new Map<string, { runs: number; vc: number; issues: Set<string> }>();
	const byWeekPhase = new Map<string, Map<string, { runs: number; vc: number }>>();
	for (const e of messende) {
		const vc = ZERO(e.valueCost);
		const day = berlinDay(e.timestamp);
		let d = byDay.get(day);
		if (!d) {
			d = { runs: 0, vc: 0 };
			byDay.set(day, d);
		}
		d.runs += 1;
		d.vc += vc;
		const wk = isoWeek(day);
		let w = byWeek.get(wk);
		if (!w) {
			w = { runs: 0, vc: 0, issues: new Set<string>() };
			byWeek.set(wk, w);
		}
		w.runs += 1;
		w.vc += vc;
		w.issues.add(e.issueId);
		const ph = e.phase ?? '(ohne)';
		let wm = byWeekPhase.get(wk);
		if (!wm) {
			wm = new Map();
			byWeekPhase.set(wk, wm);
		}
		let pw = wm.get(ph);
		if (!pw) {
			pw = { runs: 0, vc: 0 };
			wm.set(ph, pw);
		}
		pw.runs += 1;
		pw.vc += vc;
	}
	const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
	if (days.length > 0) {
		lines.push('### Zeitlicher Trend — nur messende Läufe', '');
		lines.push('```mermaid');
		lines.push('xychart-beta');
		lines.push('\ttitle "Ø Kosten je Run (USD)"');
		lines.push('\tx-axis ["' + days.map(([d]) => d.slice(5)).join('", "') + '"]');
		lines.push(
			'\ty-axis "Ø USD je Run" 0 --> ' + Math.max(2, Math.ceil(Math.max(...days.map(([, v]) => v.vc / v.runs)) + 0.5)),
		);
		lines.push('\tbar "Ø je Run" [' + days.map(([, v]) => (v.vc / v.runs).toFixed(3)).join(', ') + ']');
		lines.push('```');
		// Kumulierte Linie im EIGENEN Chart — andere Skala als der Ø-Balken, gemeinsame
		// Achse würde die Balken plätten.
		const cumSeries: string[] = [];
		let cum = 0;
		for (const [, v] of days) {
			cum += v.vc;
			cumSeries.push(cum.toFixed(2));
		}
		lines.push('```mermaid');
		lines.push('xychart-beta');
		lines.push('\ttitle "Kumulierter Wert (USD)"');
		lines.push('\tx-axis ["' + days.map(([d]) => d.slice(5)).join('", "') + '"]');
		lines.push('\ty-axis "USD kumuliert" 0 --> ' + Math.ceil(cum + 1));
		lines.push('\tline "Kumuliert" [' + cumSeries.join(', ') + ']');
		lines.push('```');
		lines.push(
			'',
			'> Nur Läufe mit Messung (valueCost > 0, seit #984). Wenige Runs pro Tag können den',
			'> Tageswert stark bewegen — der Trend zählt, nicht der Einzelpunkt. Tages-Grenzen gelten in Berliner Zeit.',
			'',
		);
		// Wochen-Raster: Wochen statt Tage — weniger Rauschen, und Ø je Ticket ist direkt
		// am Zielwert aus dem Optimierungsplan (< $3,00) ablesbar.
		const weeks = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b));
		lines.push('| Woche | Läufe | Tickets | Wert (USD) | Ø Wert je Ticket |');
		lines.push('| --- | ---: | ---: | ---: | ---: |');
		for (const [wk, w] of weeks) {
			lines.push(`| ${wk} | ${w.runs} | ${w.issues.size} | ${usd(w.vc)} | ${usd(w.vc / w.issues.size)} |`);
		}
		lines.push('');
		// Phasen-Trendtabelle: Ø je Phase je Woche — zeigt, welche Phase den Trend treibt.
		const phaseNames = [...new Set(messende.map((e) => e.phase ?? '(ohne)'))];
		lines.push('| Woche | ' + phaseNames.join(' | ') + ' |');
		lines.push('| --- |' + ' ---: |'.repeat(phaseNames.length));
		for (const [wk] of weeks) {
			const wm = byWeekPhase.get(wk) ?? new Map<string, { runs: number; vc: number }>();
			const cells = phaseNames.map((ph) => {
				const pw = wm.get(ph);
				return pw ? `$${(pw.vc / pw.runs).toFixed(2)}` : '—';
			});
			lines.push(`| ${wk} | ${cells.join(' | ')} |`);
		}
		lines.push('');
		// Richtung: letzte 7 Kalendertage gegen die 8–14 davor — Anker ist der jüngste
		// messende Datensatz, deterministisch aus den Daten statt von der Wanduhr;
		// gezählt in Berlin-Tagen, konsistent zum Trend oben.
		const anchorDay = Math.max(...messende.map((e) => Date.parse(`${berlinDay(e.timestamp)}T00:00:00Z`)));
		const dirNew = new Map<string, { runs: number; vc: number }>();
		const dirOld = new Map<string, { runs: number; vc: number }>();
		const addDir = (m: Map<string, { runs: number; vc: number }>, ph: string, vc: number): void => {
			let x = m.get(ph);
			if (!x) {
				x = { runs: 0, vc: 0 };
				m.set(ph, x);
			}
			x.runs += 1;
			x.vc += vc;
		};
		for (const e of messende) {
			const age = (anchorDay - Date.parse(`${berlinDay(e.timestamp)}T00:00:00Z`)) / 86_400_000;
			if (age < 0 || age > 13) continue;
			const fenster = age <= 6 ? dirNew : dirOld;
			const ph = e.phase ?? '(ohne)';
			addDir(fenster, ph, ZERO(e.valueCost));
			addDir(fenster, '(gesamt)', ZERO(e.valueCost));
		}
		const avgFenster = (x?: { runs: number; vc: number }): string => (x && x.runs > 0 ? usd(x.vc / x.runs) : '—');
		const richtung = (alt?: { runs: number; vc: number }, neu?: { runs: number; vc: number }): string => {
			if (!alt || alt.runs < 2 || !neu || neu.runs < 2) return '—';
			const raw = (neu.vc / neu.runs - alt.vc / alt.runs) / (alt.vc / alt.runs);
			// Schwelle an der ROHEN Änderung, nicht am gerundeten Prozentwert: 9,95 % würde
			// auf 10 runden und als „↑ 10 %“ erscheinen, obwohl die Fußnote „→ = unter
			// ±10 %“ verspricht. Das Runden gehört allein in die Anzeige.
			if (Math.abs(raw) < 0.1) return '→';
			return `${raw > 0 ? '↑' : '↓'} ${Math.round(Math.abs(raw) * 100)} %`;
		};
		const richtRow = (label: string, ph: string): void =>
			lines.push(
				`| ${label} | ${avgFenster(dirOld.get(ph))} → ${avgFenster(dirNew.get(ph))} | ${richtung(dirOld.get(ph), dirNew.get(ph))} |`,
			);
		lines.push('### Richtung — letzte 7 vs. 8–14 Tage', '');
		lines.push('| Phase | Ø je Run | Trend |');
		lines.push('| --- | ---: | :---: |');
		for (const ph of phaseNames) {
			if (dirNew.has(ph) || dirOld.has(ph)) richtRow(ph, ph);
		}
		richtRow('**Alle Phasen**', '(gesamt)');
		lines.push(
			'',
			'> Anker ist der jüngste Datensatz (Kalendertage, Berliner Zeit). „—" = zu wenige Runs (< 2) im Fenster,',
			'> „→" = unter ±10 % Änderung. „Alle Phasen" verschiebt sich auch mit dem Phasen-Mix',
			'> (z. B. kaum implement-Läufe im alten Fenster) — je Phase lesen, nicht nur die Summe.',
			'',
		);
	}

	lines.push(
		'| Ticket | Läufe | Turns | Token in | Wert (USD) | Echt (USD) | Anteil | Phasen |',
		'| --- | ---: | ---: | ---: | ---: | ---: | :--- | --- |',
	);
	for (const t of tickets) {
		lines.push(
			`| [#${t.issue}](https://github.com/deleonio/priority-pilot/issues/${t.issue}) | ${t.runs} | ${t.turns > 0 ? num(t.turns) : '—'} | ${mio(t.tokensIn)} | ${usd(t.valueCost)} | ${t.cost > 0 ? usd(t.cost) : '—'} | ${bar(t.valueCost, sum.valueCost)} | ${t.phases.join(' ')} |`,
		);
	}
	const top5 = tickets.slice(0, 5).reduce((a, t) => a + t.valueCost, 0);
	lines.push('', `> **Top 5 Tickets** stehen für ${pct(share(top5, sum.valueCost))} des Gesamtwerts.`);

	if (!anyTurns) {
		lines.push(
			'> ℹ️ Keine Turns erfasst — alle Datensätze stammen von Läufen vor der Turns-Erfassung (Issue #984).',
			'',
		);
	}
	lines.push(
		'> Wert = Verbrauchsbewertung (echter Listenpreis, wo vorhanden — sonst Modellklasse), Echt = gemessene Kosten zu Listenpreisen von Anthropic und z.ai (ohne Preisliste, also openrouter: 0, s. `.costs/SCHEMA.md`). Sortiert nach Wert absteigend — oben stehen die teuersten Durchläufe und damit die ersten Optimierungskandidaten (Review-/Fixup-Schleifen).',
		'',
	);
	if (skipped.length > 0) {
		lines.push(`> ⚠️ ${skipped.length} Datei(en) nicht lesbar und übersprungen: ${skipped.join(', ')}`, '');
	}
	return `${lines.join('\n')}\n`;
}

const main = (argv: readonly string[]): number => {
	let dir = '.costs';
	const idx = argv.indexOf('--dir');
	if (idx >= 0 && idx + 1 < argv.length) dir = argv[idx + 1] ?? '.costs';
	process.stdout.write(renderReport(dir));
	return 0;
};

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
