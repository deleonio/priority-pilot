import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '/Users/moppitz/Workspace/priority-pilot/docs/marketing/artikel/2026-10-01-zifferblatt/images';
mkdirSync(OUT, { recursive: true });

// Tokens aus frontend/src/app.css (Dark-Theme)
const NEON = ['#f0210f', '#e7f831', '#5af2a6', '#4324db', '#c22aef', '#e665ea', '#dd31af'];
const RING = ['#f0503c', '#f5893a', '#efc23c', '#a9dc46', '#43d488'];
const BG = '#0f131a';
const BORDER = '#2a3140';
const INK = '#e6edf3';
const MUTED = '#9aa4b2';
const FONT = "Inter, 'Segoe UI', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

const BALANCE = 0.62; // Demo-Gesamt-Balance für die Illustration
// Demo-Säulen: colorIndex folgt der Säulen-id (Seed-Reihenfolge), Anzeige nach Stärke
const PILLARS_DE = [
	{ name: 'Beziehungen', ratio: 1.35, color: NEON[2] },
	{ name: 'Körper', ratio: 1.15, color: NEON[0] },
	{ name: 'Wirksamkeit', ratio: 0.9, color: NEON[3] },
	{ name: 'Mentale Gesundheit', ratio: 0.65, color: NEON[1] },
	{ name: 'Sinn', ratio: 0.45, color: NEON[4] },
];
// Reihenfolge für das Ist/Soll-Diagramm: Seed-Reihenfolge (Körper zuerst)
const PILLARS_DE_SEED = [
	{ name: 'Körper', ratio: 1.15, color: NEON[0] },
	{ name: 'Mentale Gesundheit', ratio: 0.65, color: NEON[1] },
	{ name: 'Beziehungen', ratio: 1.35, color: NEON[2] },
	{ name: 'Wirksamkeit', ratio: 0.9, color: NEON[3] },
	{ name: 'Sinn', ratio: 0.45, color: NEON[4] },
];
const PILLARS_EN = [
	{ name: 'Relationships', ratio: 1.35, color: NEON[2] },
	{ name: 'Body', ratio: 1.15, color: NEON[0] },
	{ name: 'Agency', ratio: 0.9, color: NEON[3] },
	{ name: 'Mental health', ratio: 0.65, color: NEON[1] },
	{ name: 'Meaning', ratio: 0.45, color: NEON[4] },
];

const fmt = (v, de) => (de ? v.toFixed(2).replace('.', ',') : v.toFixed(2));
const ringColor = (t) => {
	const stops = [0, 25, 50, 75, 100];
	const s = Math.min(t, 99.99);
	let i = 0;
	while (i < 4 && s >= stops[i + 1]) i++;
	const f = (s - stops[i]) / 25;
	const c = (k) =>
		Math.round(
			parseInt(RING[i].slice(1 + k * 2, 3 + k * 2), 16) * (1 - f) +
				parseInt(RING[i + 1].slice(1 + k * 2, 3 + k * 2), 16) * f,
		);
	return `#${[0, 1, 2].map((k) => c(k).toString(16).padStart(2, '0')).join('')}`;
};

const tickRing = (cx, cy, sc, value) => {
	let s = '';
	for (let i = 0; i < 100; i++) {
		const a = ((i * 3.6 - 90) * Math.PI) / 180;
		const r0 = 40 * sc;
		const len = (i % 10 === 0 ? 7.5 : 5) * sc;
		const lit = i < Math.round(value * 100);
		s += `<line x1="${(cx + r0 * Math.cos(a)).toFixed(1)}" y1="${(cy + r0 * Math.sin(a)).toFixed(1)}" x2="${(cx + (r0 + len) * Math.cos(a)).toFixed(1)}" y2="${(cy + (r0 + len) * Math.sin(a)).toFixed(1)}" stroke="${ringColor(i)}" stroke-width="${(1.4 * sc).toFixed(1)}" opacity="${lit ? 1 : 0.15}" stroke-linecap="round"/>`;
	}
	return s;
};

const defs = `
	<defs>
		<filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
			<feGaussianBlur stdDeviation="6" result="b"/>
			<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
		</filter>
		<radialGradient id="bubble" cx="35%" cy="30%" r="75%">
			<stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>
			<stop offset="30%" stop-color="#ffffff" stop-opacity="0.08"/>
			<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
		</radialGradient>
	</defs>`;

function bubblesSVG(pillars, sc, cx, cy) {
	const maxRatio = Math.max(...pillars.map((p) => p.ratio));
	const sorted = [...pillars].sort((a, b) => b.ratio - a.ratio); // größte hinten
	let s = `<circle cx="${cx}" cy="${cy}" r="${(33 / maxRatio) * sc}" fill="none" stroke="${MUTED}" stroke-width="1.6" stroke-dasharray="6 5" opacity="0.65"/>`;
	for (const p of sorted) {
		const idx = pillars.indexOf(p);
		const a = ((idx * 72 - 90) * Math.PI) / 180; // stärkste Säule auf 12 Uhr
		const r = Math.max(8, (33 * p.ratio) / maxRatio);
		const d = (33 - r) * 0.5;
		const x = cx + d * Math.sin(a) * sc;
		const y = cy - d * Math.cos(a) * sc;
		s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * sc).toFixed(1)}" fill="${p.color}" opacity="0.18" filter="url(#glow)"/>`;
		s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * sc).toFixed(1)}" fill="${p.color}" fill-opacity="0.16" stroke="${p.color}" stroke-width="${(sc * 0.55).toFixed(1)}" stroke-opacity="0.95"/>`;
		s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * sc).toFixed(1)}" fill="url(#bubble)"/>`;
	}
	return s;
}

function legendSVG(pillars, x, y0, de) {
	let s = '';
	let y = y0;
	for (const p of pillars) {
		s += `<circle cx="${x}" cy="${y}" r="9" fill="${p.color}"/>`;
		s += `<text x="${x + 26}" y="${y + 8}" font-family="${FONT}" font-size="26" fill="${INK}">${p.name}</text>`;
		s += `<text x="${x + 350}" y="${y + 8}" font-family="${MONO}" font-size="24" fill="${MUTED}" text-anchor="end">${fmt(p.ratio, de)}</text>`;
		y += 62;
	}
	return s;
}

function frame(title, caption, body, w = 1200, h = 700) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
	<rect width="${w}" height="${h}" fill="${BG}"/>
	<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14" fill="none" stroke="${BORDER}" stroke-width="2"/>
	<text x="36" y="52" font-family="${FONT}" font-size="24" font-weight="600" fill="${INK}">Balamentum</text>
	<text x="${w - 36}" y="52" font-family="${FONT}" font-size="20" fill="${MUTED}" text-anchor="end">${title}</text>
	${body}
	<text x="36" y="${h - 30}" font-family="${FONT}" font-size="20" fill="${MUTED}">${caption}</text>
</svg>
`;
}

// --- Hero: Zifferblatt „Blasen" ---
function hero(pillars, de) {
	const sc = 4.6;
	const cx = 390;
	const cy = 390;
	const body = `
	${tickRing(cx, cy, sc, BALANCE)}
	${bubblesSVG(pillars, sc, cx, cy)}
	<text x="${cx}" y="${cy + 40 * sc + 70}" font-family="${FONT}" font-size="24" fill="${MUTED}" text-anchor="middle">${de ? 'Gesamt-Balance 62 %' : 'Overall balance 62%'}</text>
	${legendSVG(pillars, 780, 160, de)}
	<line x1="780" y1="${160 + 62 * 4 + 40}" x2="820" y2="${160 + 62 * 4 + 40}" stroke="${MUTED}" stroke-width="1.6" stroke-dasharray="6 5"/>
	<text x="832" y="${160 + 62 * 4 + 47}" font-family="${FONT}" font-size="21" fill="${MUTED}">${de ? 'Soll-Marke (Ist = Soll)' : 'target mark (actual = target)'}</text>`;
	return frame(
		de ? 'Zifferblatt „Blasen“' : 'The “Bubbles” dial',
		de
			? 'Illustration: eine von neun Darstellungen derselben Auskunft — Kennzahl Ist ÷ Soll, 100 Striche je Prozentpunkt.'
			: 'Illustration: one of nine renderings of the same answer — metric actual ÷ target, 100 ticks, one per percent point.',
		body,
		1200,
		700,
	);
}

// --- Herz-Gefäß ---
function herz() {
	const sc = 4.6;
	const cx = 390;
	const cy = 380;
	const level = 0.62;
	const heart =
		'M50,86 C24,66 14,46 14,34 C14,21 24,14 34,14 C41,14 47,18 50,24 C53,18 59,14 66,14 C76,14 86,21 86,34 C86,46 76,66 50,86 Z';
	const ySurf = 86 - level * (86 - 14);
	const body = `
	${tickRing(cx, cy, sc, BALANCE)}
	<g transform="translate(${cx - 50 * sc}, ${cy - 50 * sc}) scale(${sc})">
		<clipPath id="heartClip"><path d="${heart}"/></clipPath>
		<path d="${heart}" fill="${BG}" stroke="none"/>
		<g clip-path="url(#heartClip)">
			<rect x="10" y="${ySurf}" width="80" height="${86 - ySurf}" fill="#b42318" opacity="0.85"/>
			<path d="M14,${ySurf} Q30,${ySurf - 2.4} 50,${ySurf + 0.6} T86,${ySurf}" fill="none" stroke="#f0503c" stroke-width="1.4"/>
		</g>
		<path d="${heart}" fill="none" stroke="#f0503c" stroke-width="1.8" opacity="0.95" filter="url(#glow)"/>
	</g>
	<text x="${cx}" y="${cy + 40 * sc + 70}" font-family="${FONT}" font-size="24" fill="${MUTED}" text-anchor="middle">Gesamt-Balance 62 %</text>
	<text x="790" y="300" font-family="${FONT}" font-size="26" fill="${INK}">Das Herz-Gefäß</text>
	<text x="790" y="344" font-family="${FONT}" font-size="21" fill="${MUTED}">Füllfläche = Kennzahl,</text>
	<text x="790" y="378" font-family="${FONT}" font-size="21" fill="${MUTED}">Welle und Meniskus als Material.</text>`;
	return frame(
		'Zifferblatt „Herz“',
		'Illustration: das Standard-Zifferblatt — dasselbe Ziffernring-Prinzip, 100 Striche je Prozentpunkt.',
		body,
		1200,
		700,
	);
}

// --- Ist/Soll-Diagramm (Fachartikel, konzeptionell ohne Dateinamen) ---
function istSoll() {
	const sc = 1;
	const baseY = 520;
	const scaleY = 380 / 1.6; // Skala bis Verhältnis 1,6
	let body = '';
	// Raster: 0,5 / 1,0 / 1,5
	for (const v of [0.5, 1.0, 1.5]) {
		const y = baseY - v * scaleY;
		body += `<line x1="120" y1="${y}" x2="640" y2="${y}" stroke="${BORDER}" stroke-width="1.5"/>`;
		body += `<text x="106" y="${y + 7}" font-family="${FONT}" font-size="19" fill="${MUTED}" text-anchor="end">${fmt(v, true)}</text>`;
	}
	// Soll-Linie bei 1,0
	const ySoll = baseY - 1.0 * scaleY;
	body += `<line x1="120" y1="${ySoll}" x2="640" y2="${ySoll}" stroke="${MUTED}" stroke-width="2.2" stroke-dasharray="8 6"/>`;
	body += `<text x="640" y="${ySoll - 14}" font-family="${FONT}" font-size="20" fill="${MUTED}" text-anchor="end">Soll (1,0)</text>`;
	PILLARS_DE_SEED.forEach((p, i) => {
		const x = 150 + i * 112;
		const h = p.ratio * scaleY;
		const parts = p.name.length > 10 ? p.name.split(' ') : [p.name];
		const label = parts.map((line, j) => `<tspan x="${x + 32}" dy="${j === 0 ? 0 : 22}">${line}</tspan>`).join('');
		body += `<rect x="${x}" y="${baseY - h}" width="64" height="${h}" rx="8" fill="${p.color}" fill-opacity="0.75"/>`;
		body += `<text x="${x + 32}" y="${baseY - h - 16}" font-family="${FONT}" font-size="22" fill="${INK}" text-anchor="middle">${fmt(p.ratio, true)}</text>`;
		body += `<text x="${x + 32}" y="${baseY + 34}" font-family="${FONT}" font-size="17" fill="${MUTED}" text-anchor="middle">${label}</text>`;
	});
	// Lesarten
	body += `<text x="740" y="190" font-family="${FONT}" font-size="24" font-weight="600" fill="${INK}">Die Lesart</text>`;
	const lesart = [
		['0,5', 'halb so viel wie nötig'],
		['1,0', 'genau auf Ziel'],
		['1,5', 'zieht davon'],
	];
	lesart.forEach(([v, t], i) => {
		const y = 236 + i * 52;
		body += `<text x="740" y="${y}" font-family="${MONO}" font-size="23" fill="${INK}">${v}</text>`;
		body += `<text x="800" y="${y}" font-family="${FONT}" font-size="23" fill="${MUTED}">${t}</text>`;
	});
	body += `<text x="740" y="440" font-family="${FONT}" font-size="21" fill="${MUTED}">Ungedeckelt: Übererfüllung ist</text>`;
	body += `<text x="740" y="472" font-family="${FONT}" font-size="21" fill="${MUTED}">genauso eine Aussage wie Rückstand.</text>`;
	return frame(
		'Fünf Säulen, Ist gegen Soll',
		'Illustration: die Kennzahl je Säule — Ist ÷ Soll. Demo-Daten; die gestrichelte Linie liegt bei 1,0.',
		body,
		1200,
		640,
	);
}

// --- Farb-Rampe (web.dev) ---
function farbrampe() {
	const light = ['#b61414', '#dbde0d', '#0ca974', '#0f009c', '#a722c8', '#6a1b64', '#a0306f'];
	const dark = NEON;
	let body = '';
	body += `<text x="60" y="120" font-family="${FONT}" font-size="21" fill="${MUTED}">Light theme (swatches on their own light surface)</text>`;
	body += `<rect x="40" y="124" width="836" height="104" rx="8" fill="#f7f8fa"/>`;
	light.forEach((c, i) => {
		body += `<rect x="${60 + i * 116}" y="140" width="96" height="72" rx="8" fill="${c}"/>`;
		body += `<text x="${108 + i * 116}" y="238" font-family="${MONO}" font-size="15" fill="${MUTED}" text-anchor="middle">${c}</text>`;
	});
	body += `<text x="60" y="308" font-family="${FONT}" font-size="21" fill="${MUTED}">Dark theme</text>`;
	dark.forEach((c, i) => {
		body += `<rect x="${60 + i * 116}" y="328" width="96" height="72" rx="8" fill="${c}"/>`;
		body += `<text x="${108 + i * 116}" y="426" font-family="${MONO}" font-size="15" fill="${MUTED}" text-anchor="middle">${c}</text>`;
	});
	const stats = [
		['21 pairs × 4 vision types', 'normal + protan/deutan/tritanopia'],
		['ΔE ≥ 7 (CIEDE2000)', 'worst pair: 12.6 light / 8.8 dark (tritanopia)'],
		['Pinned by a test', 'fails when any pair drops below ΔE 7'],
	];
	stats.forEach(([t, d], i) => {
		const x = 60 + i * 368;
		body += `<rect x="${x}" y="470" width="336" height="86" rx="10" fill="#161b22" stroke="${BORDER}" stroke-width="2"/>
		<text x="${x + 24}" y="506" font-family="${FONT}" font-size="21" fill="${INK}">${t}</text>
		<text x="${x + 24}" y="536" font-family="${FONT}" font-size="18" fill="${MUTED}">${d}</text>`;
	});
	body += `<text x="60" y="608" font-family="${FONT}" font-size="18" fill="${MUTED}">Color never carries meaning alone — the pillar name always appears as text beside it (WCAG 1.4.1).</text>`;
	return frame(
		'The validated pillar color ramp',
		'Illustration: seven neon colors per theme, validated — not guessed.',
		body,
		1200,
		660,
	);
}

// --- Fürsorge-Karte (Medium) ---
function fursorge() {
	let body = '';
	body += `<text x="60" y="128" font-family="${FONT}" font-size="25" fill="${INK}">Die Prüffrage: „Sorgt der Text, oder protokolliert er nur?“</text>`;
	body += `<rect x="60" y="170" width="520" height="220" rx="12" fill="#161b22" stroke="#b42318" stroke-width="2"/>
	<circle cx="100" cy="212" r="13" fill="none" stroke="#f0503c" stroke-width="2.5"/>
	<path d="M93,205 L107,219 M107,205 L93,219" stroke="#f0503c" stroke-width="2.5"/>
	<text x="128" y="220" font-family="${FONT}" font-size="21" fill="#f0503c">protokolliert</text>
	<text x="92" y="272" font-family="${FONT}" font-size="23" fill="${INK}">„Du hast deine Körper-Säule</text>
	<text x="92" y="304" font-family="${FONT}" font-size="23" fill="${INK}">vernachlässigt.“</text>`;
	body += `<rect x="620" y="170" width="520" height="220" rx="12" fill="#161b22" stroke="#1a7f37" stroke-width="2"/>
	<circle cx="660" cy="212" r="13" fill="none" stroke="#43d488" stroke-width="2.5"/>
	<path d="M653,212 L659,219 L670,204" stroke="#43d488" stroke-width="2.5" fill="none"/>
	<text x="688" y="220" font-family="${FONT}" font-size="21" fill="#43d488">sorgt</text>
	<text x="652" y="262" font-family="${FONT}" font-size="23" fill="${INK}">„Dein Körper könnte eine Pause</text>
	<text x="652" y="294" font-family="${FONT}" font-size="23" fill="${INK}">gebrauchen. Ein kurzer Spaziergang</text>
	<text x="652" y="326" font-family="${FONT}" font-size="23" fill="${INK}">tut heute schon viel — klein</text>
	<text x="652" y="358" font-family="${FONT}" font-size="23" fill="${INK}">anfangen zählt.“</text>`;
	body += `<text x="60" y="450" font-family="${FONT}" font-size="20" fill="${MUTED}">Beispiel aus der Fürsorge-Tonalität von Balamentum: Situation „Defizit“, Säule Körper.</text>`;
	return frame('Texte, die sorgen', 'Illustration: derselbe Befund, zwei Tonalitäten.', body, 1200, 520);
}

writeFileSync(`${OUT}/farbrampe-en.svg`, farbrampe());
console.log('OK:', OUT);
