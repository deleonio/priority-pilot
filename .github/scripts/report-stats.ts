// Statistik- und Darstellungs-Grundlage der repo-weiten Kosten-/Turn-Berichte
// (tokens-report.ts, turns-report.ts, audit-basis.ts). Reine Funktionen, keine I/O.
//
// WARUM EIN EIGENES MODUL: Die Berichte sollen beantworten, ob eine Harness-Änderung
// etwas gebracht hat. Dafür brauchen sie dieselbe Bezugseinheit (Ticket-Kohorte je
// Abschlusswoche), dieselben robusten Lagemaße (Median, p75 statt Ø — Kosten und Turns
// je Ticket sind rechtsschief) und dieselbe relative Darstellung (Index gegen eine
// Baseline, gleitende Fenster über die letzten N Tickets). Drei Renderer mit je eigener
// Kopie dieser Rechnungen driften auseinander — die Formatierer waren bereits vierfach
// vorhanden und in einer Tabellenzeile mit Komma UND Punkt gemischt.
//
// Stil-Spiegel von cost-aggregate.ts: keine externen Deps, ESM, löschbare TS-Syntax.

// ─── Formatierung (konsequent de-DE, Währung mit Punkt wie bisher) ───────────

export const num = (n: number): string => n.toLocaleString('de-DE');
export const usd = (n: number): string => `$${n.toFixed(2)}`;
export const mio = (n: number): string =>
	`${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio`;
export const pct = (n: number): string => `${(n * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
/** Zahl mit fester Nachkommastellen-Zahl (de-DE). */
export const frac = (n: number, digits: number): string =>
	n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** Ø-Werte mit einer Nachkommastelle; ohne Bezugsgröße „—" statt einer Division durch 0. */
export const avg = (part: number, count: number): string => (count > 0 ? frac(part / count, 1) : '—');
/** Verhältniszahl mit zwei Nachkommastellen; ohne Bezugsgröße „—". */
export const ratio = (part: number, base: number): string => (base > 0 ? frac(part / base, 2) : '—');
export const share = (part: number, total: number): number => (total > 0 ? part / total : 0);

/** Unicode-Balken (10 Zeichen █/░) plus Prozent — Anteile direkt in der Tabellenzeile sichtbar. */
export const bar = (part: number, total: number): string => {
	const anteil = share(part, total);
	const filled = Math.round(Math.max(0, Math.min(1, anteil)) * 10);
	return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${pct(anteil)}`;
};

// ─── Zeitraster (Berlin-Tage, ISO-Wochen) ────────────────────────────────────

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

/** ISO-Woche eines Zeitstempels (Berlin-Tag → Woche) — die Kurzform, die jeder Bericht braucht. */
export const weekOf = (timestamp: string): string => isoWeek(berlinDay(timestamp));

/**
 * Abschlusswoche eines Tickets: ISO-Woche des LETZTEN `documenter`-Laufs (des Siegels).
 * Kohorten-Anker aller Ticket-Kennzahlen je Woche — ob ein Ticket first-pass-grün war
 * oder was es gekostet hat, weiß man erst am Ende; die Woche, in der es „berührt" wurde,
 * zählt Tickets doppelt und mischt halbe Tickets in zwei Wochen. Ohne documenter: undefined.
 */
export const sealWeek = (entries: ReadonlyArray<{ phase?: string; timestamp: string }>): string | undefined => {
	const seal = entries
		.filter((e) => e.phase === 'documenter')
		.map((e) => e.timestamp)
		.sort()
		.pop();
	return seal === undefined ? undefined : weekOf(seal);
};

// ─── Lage- und Streuungsmaße ──────────────────────────────────────────────────

/** Quantil (0..1) über aufsteigend sortierte Werte; unteres Element, ohne Interpolation. */
export const quantile = (sorted: readonly number[], q: number): number => {
	if (sorted.length === 0) return Number.NaN;
	const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
	return sorted[idx] as number;
};

/** Quantil über UNSORTIERTE Werte (sortiert eine Kopie). */
export const quantileOf = (values: readonly number[], q: number): number =>
	quantile(
		[...values].sort((a, b) => a - b),
		q,
	);

export const median = (values: readonly number[]): number => quantileOf(values, 0.5);

/**
 * Wilson-Intervall für einen Anteil k/n (z = 1,96 → 95 %). Robuster als das Normal-
 * Intervall bei kleinen n und Randwerten (0 % / 100 %), genau der Fall der Wochen-Kohorten
 * mit 5 bis 40 Tickets. Bei n = 0: [0, 1] — keine Aussage.
 */
export const wilson = (k: number, n: number, z = 1.96): { low: number; high: number } => {
	if (n <= 0) return { low: 0, high: 1 };
	const p = k / n;
	const z2 = z * z;
	const denom = 1 + z2 / n;
	const centre = (p + z2 / (2 * n)) / denom;
	const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
	return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
};

/** Mindest-n, ab dem ein Anteil ein Intervall bekommt — darunter ist das Band breiter als die Aussage. */
export const MIN_N_INTERVAL = 8;
/** Mindest-n einer Kohorte, damit ihr Median in Trend-Linien und Index eingeht. */
export const MIN_N_COHORT = 5;

/** Anteil als „6/10 = 60 % (31–83 %)"; unter MIN_N_INTERVAL ohne Intervall, bei n = 0 „—". */
export const shareWithInterval = (k: number, n: number): string => {
	if (n <= 0) return '—';
	const head = `${k}/${n} = ${pct(k / n)}`;
	if (n < MIN_N_INTERVAL) return head;
	const { low, high } = wilson(k, n);
	return `${head} (${Math.round(low * 100)}–${Math.round(high * 100)} %)`;
};

// ─── Relative Darstellung ─────────────────────────────────────────────────────

/** Index Wert / Baseline × 100; ohne Baseline (0 oder NaN) NaN. */
export const indexTo = (baseline: number, value: number): number =>
	baseline > 0 && Number.isFinite(baseline) && Number.isFinite(value) ? (value / baseline) * 100 : Number.NaN;

/** Index als Text („87"), NaN als „—". */
export const fmtIndex = (idx: number): string => (Number.isFinite(idx) ? String(Math.round(idx)) : '—');

/** Schwelle, unter der eine Änderung als „→" (Rauschen) gilt. */
export const TREND_THRESHOLD = 0.1;

/**
 * Richtungs-Pfeil mit Prozent: „↑ 25 %", „↓ 8 %" oder „→" unter ±10 %. Entscheidet an der
 * ROHEN Änderung, nicht am gerundeten Prozentwert: 9,95 % würde auf 10 runden und als
 * „↑ 10 %“ erscheinen, obwohl die Fußnote „→ = unter ±10 %“ verspricht.
 */
export const trendArrow = (before: number, after: number): string => {
	if (!(before > 0) || !Number.isFinite(after)) return '—';
	const raw = (after - before) / before;
	if (Math.abs(raw) < TREND_THRESHOLD) return '→';
	return `${raw > 0 ? '↑' : '↓'} ${Math.round(Math.abs(raw) * 100)} %`;
};

/**
 * Gleitender Median über die letzten `window` Werte — je Position i der Median von
 * values[max(0, i-window+1) .. i]. Gedacht für chronologisch sortierte Ticket-Werte
 * (letzte 20 Tickets statt Kalenderwochen: bei 4 Wochen Daten mit n = 5 bis 40 je Woche
 * ist das Kalenderraster grob und schwankt mit der Kohortengröße).
 */
export const rollingMedian = (values: readonly number[], window: number): number[] =>
	values.map((_, i) => median(values.slice(Math.max(0, i - window + 1), i + 1)));

// ─── Sammel-Helfer ───────────────────────────────────────────────────────────

/** Map-Eintrag holen oder anlegen — ersetzt das vierfach kopierte `let x = m.get(k); if (!x) …`. */
export const getOrInit = <K, V>(map: Map<K, V>, key: K, init: () => V): V => {
	let v = map.get(key);
	if (v === undefined) {
		v = init();
		map.set(key, v);
	}
	return v;
};

export const groupBy = <T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> => {
	const out = new Map<K, T[]>();
	for (const item of items) getOrInit(out, key(item), () => []).push(item);
	return out;
};

// ─── Mermaid xychart ─────────────────────────────────────────────────────────

export type ChartSeries = { kind: 'bar' | 'line'; name: string; values: readonly number[]; digits?: number };

export type ChartSpec = {
	title: string;
	labels: readonly string[];
	series: readonly ChartSeries[];
	yLabel: string;
	/** Untergrenze der y-Achse (Default: Maximum aller Serien + 10 %, mindestens 1). */
	yMax?: number;
};

/**
 * Ein Mermaid-`xychart-beta`-Block als Markdown-Zeilen. EIN Emitter statt sechs Kopien —
 * und die Stelle, an der Lücken behandelt werden: xychart kennt kein „null", ein fehlender
 * Wert würde als 0 gezeichnet (und 0 % Erstgrün heißt „alles nachgearbeitet", nicht
 * „keine Kohorte"). Positionen, an denen IRGENDEINE Serie NaN liefert, werden deshalb
 * samt Label entfernt. Ohne verbleibende Position kommt ein leeres Array zurück.
 */
export const xychart = (spec: ChartSpec): string[] => {
	const keep = spec.labels.map((_, i) => spec.series.every((s) => Number.isFinite(s.values[i] ?? Number.NaN)));
	const labels = spec.labels.filter((_, i) => keep[i]);
	if (labels.length === 0) return [];
	const series = spec.series.map((s) => ({ ...s, values: s.values.filter((_, i) => keep[i]) }));
	const yMax = spec.yMax ?? Math.max(1, Math.ceil(Math.max(...series.flatMap((s) => s.values as number[])) * 1.1 || 1));
	const lines = ['```mermaid', 'xychart-beta', `\ttitle "${spec.title}"`];
	lines.push(`\tx-axis ["${labels.join('", "')}"]`);
	lines.push(`\ty-axis "${spec.yLabel}" 0 --> ${yMax}`);
	for (const s of series) {
		lines.push(`\t${s.kind} "${s.name}" [${s.values.map((v) => v.toFixed(s.digits ?? 1)).join(', ')}]`);
	}
	lines.push('```');
	return lines;
};
