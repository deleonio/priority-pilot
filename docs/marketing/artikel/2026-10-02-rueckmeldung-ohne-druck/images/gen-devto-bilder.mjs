import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '/Users/moppitz/Workspace/priority-pilot/docs/marketing/artikel/2026-10-02-rueckmeldung-ohne-druck/images';
mkdirSync(OUT, { recursive: true });

const BG = '#0f131a';
const BORDER = '#2a3140';
const INK = '#e6edf3';
const MUTED = '#9aa4b2';
const ROT = '#f0503c';
const GRUEN = '#43d488';
const GELB = '#efc23c';
const FONT = "Inter, 'Segoe UI', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
// Hierarchie: Überschrift 26 · Card-Fließtext 22 · Label 19 · Feinnotiz 17 · Bildtitel 20
const S = { head: 26, body: 22, label: 19, note: 17, title: 20 };

const frame = (
	title,
	caption,
	body,
	w,
	h,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
	<rect width="${w}" height="${h}" fill="${BG}"/>
	<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="14" fill="none" stroke="${BORDER}" stroke-width="2"/>
	<text x="36" y="52" font-family="${FONT}" font-size="24" font-weight="600" fill="${INK}">Balamentum</text>
	<text x="${w - 36}" y="52" font-family="${FONT}" font-size="${S.title}" fill="${MUTED}" text-anchor="end">${title}</text>
	${body}
	<text x="36" y="${h - 30}" font-family="${FONT}" font-size="${S.title}" fill="${MUTED}">${caption}</text>
</svg>
`;

function ecgPath(x0, width, y0, periodPx, amp) {
	let d = '';
	for (let x = 0; x <= width; x += 3) {
		const t = (x % periodPx) / periodPx;
		let y = 0;
		if (t >= 0.3 && t < 0.38) y = -Math.sin(((t - 0.3) / 0.08) * (Math.PI / 2)) * amp * 2;
		else if (t >= 0.38 && t < 0.46) y = -amp * 2 + Math.sin(((t - 0.38) / 0.08) * (Math.PI / 2)) * amp * 2.7;
		else if (t >= 0.46 && t < 0.58) y = amp * 0.7 * Math.cos(((t - 0.46) / 0.12) * (Math.PI / 2));
		d += `${x === 0 ? 'M' : 'L'}${x0 + x},${(y0 + y).toFixed(1)} `;
	}
	return d;
}

// --- dev.to: die vier Streak-Regeln ---
function regeln() {
	const w = 1200;
	const h = 620;
	const karten = [
		['1', 'Today still has hours left', 'no pre-midnight break — today is not a break'],
		['2', 'The best mark never shrinks', 'a record, not a balance — gaps cost the run'],
		['3', 'Late completions rescue their day', 'finishing a day late credits the day it was due'],
		['4', 'The counting rule is in the UI', 'an open rule is a tool, a secret one an opponent'],
	];
	let body = '';
	karten.forEach(([nr, titel, note], i) => {
		const x = 60 + (i % 2) * 560;
		const y = 140 + Math.floor(i / 2) * 190;
		body += `<rect x="${x}" y="${y}" width="520" height="150" rx="12" fill="#161b22" stroke="${BORDER}" stroke-width="2"/>
		<circle cx="${x + 48}" cy="${y + 48}" r="24" fill="none" stroke="${GRUEN}" stroke-width="2.5"/>
		<text x="${x + 48}" y="${y + 57}" font-family="${MONO}" font-size="${S.body}" fill="${GRUEN}" text-anchor="middle">${nr}</text>
		<text x="${x + 96}" y="${y + 56}" font-family="${FONT}" font-size="${S.body}" font-weight="600" fill="${INK}">${titel}</text>
		<text x="${x + 96}" y="${y + 92}" font-family="${FONT}" font-size="${S.note}" fill="${MUTED}">${note}</text>`;
	});
	body += `<text x="60" y="558" font-family="${FONT}" font-size="${S.label}" fill="${MUTED}">Four rules, one effect: the counter collects — it never subtracts.</text>`;
	return frame(
		'A streak that only adds',
		'Illustration: the four rules behind the streak in Balamentum, as shipped.',
		body,
		w,
		h,
	);
}

// --- dev.to: Puls-Mapping ---
function pulsMapping() {
	const w = 1200;
	const h = 560;
	let body = '';
	// Achse: Balance 0 → 1
	body += `<line x1="120" y1="160" x2="1080" y2="160" stroke="${MUTED}" stroke-width="2"/>
	<polygon points="1092,160 1078,154 1078,166" fill="${MUTED}"/>
	<text x="120" y="120" font-family="${MONO}" font-size="${S.label}" fill="${MUTED}">balance 0</text>
	<text x="1080" y="120" font-family="${MONO}" font-size="${S.label}" fill="${MUTED}" text-anchor="end">1.0</text>
	<text x="600" y="120" font-family="${FONT}" font-size="${S.label}" fill="${MUTED}" text-anchor="middle">overall balance</text>`;
	// Zwei Zustände auf der Achse verankert
	const spur = (x0, farbe, period, kopf, mass, achseX) => {
		let s = `<line x1="${achseX}" y1="152" x2="${achseX}" y2="168" stroke="${INK}" stroke-width="2.5"/>`;
		s += `<line x1="${x0}" y1="330" x2="${x0 + 340}" y2="330" stroke="${BORDER}" stroke-width="1.5"/>`;
		s += `<path d="${ecgPath(x0, 340, 330, period, 24)}" fill="none" stroke="${farbe}" stroke-width="3" stroke-linejoin="round"/>`;
		s += `<text x="${x0}" y="250" font-family="${FONT}" font-size="${S.label}" font-weight="600" fill="${farbe}">${kopf}</text>`;
		s += `<text x="${x0}" y="410" font-family="${MONO}" font-size="${S.label}" fill="${MUTED}">${mass}</text>`;
		return s;
	};
	body += spur(140, ROT, 120, 'at 0 — skewed days', 'period 1.5 s', 120);
	body += spur(680, GRUEN, 208, 'at 1.0 — balanced days', 'period 2.6 s', 1080);
	body += `<text x="600" y="470" font-family="${FONT}" font-size="${S.label}" fill="${MUTED}" text-anchor="middle">the beat slows as the balance improves — no alarm, only urgency</text>`;
	return frame(
		'The calmer the balance, the calmer the pulse',
		'Illustration: the heartbeat period is the feedback — frequency mapped from overall balance.',
		body,
		w,
		h,
	);
}

// --- dev.to: drei Situationen, eine Tonalität ---
function situationen() {
	const w = 1200;
	const h = 560;
	const karte = (i, farbe, name, regel, beispiel) => {
		const x = 60 + i * 372;
		const zeilen = beispiel.match(/.{1,34}(\s|$)/g).map((z) => z.trim());
		let s = `<rect x="${x}" y="150" width="336" height="280" rx="12" fill="#161b22" stroke="${farbe}" stroke-width="2"/>`;
		s += `<text x="${x + 28}" y="196" font-family="${FONT}" font-size="${S.label}" fill="${farbe}" letter-spacing="1.5">${name.toUpperCase()}</text>`;
		s += `<text x="${x + 28}" y="238" font-family="${FONT}" font-size="${S.body}" font-weight="600" fill="${INK}">${regel}</text>`;
		zeilen.forEach((z, j) => {
			const vor = j === 0 ? '“' : '';
			const nach = j === zeilen.length - 1 ? '”' : '';
			s += `<text x="${x + 28}" y="${282 + j * 28}" font-family="${FONT}" font-size="${S.note}" fill="${MUTED}">${vor}${z}${nach}</text>`;
		});
		return s;
	};
	let body = '';
	body += karte(
		0,
		ROT,
		'deficit',
		'Offer a small step for today',
		'Your body could use a break. A short walk already does a lot today.',
	);
	body += karte(
		1,
		GELB,
		'overload',
		'Give permission to cut back',
		'Your day has limits. Pick the one thing that counts today — the rest may wait.',
	);
	body += karte(
		2,
		GRUEN,
		'on target',
		'Recognize what works',
		'You moved things forward today. It shows — keep going at your pace.',
	);
	body += `<text x="60" y="478" font-family="${FONT}" font-size="${S.label}" fill="${MUTED}">Verdict vocabulary — neglected, missed, failed — appears in none of them.</text>`;
	return frame(
		'Three situations, one tone',
		'Illustration: the care copy situations and what each one offers instead of judging.',
		body,
		w,
		h,
	);
}

// --- dev.to: Error-Copy im Vergleich ---
function errorCopy() {
	const w = 1200;
	const h = 480;
	let body = '';
	body += `<rect x="60" y="140" width="520" height="220" rx="12" fill="#161b22" stroke="${BORDER}" stroke-width="2"/>
	<text x="92" y="192" font-family="${FONT}" font-size="${S.label}" fill="${ROT}" letter-spacing="1.5">LOGS</text>
	<text x="92" y="240" font-family="${FONT}" font-size="${S.body}" fill="${INK}">“Oops! Something went wrong.”</text>
	<text x="92" y="286" font-family="${FONT}" font-size="${S.note}" fill="${MUTED}">no cause, no next step — the reader is left guessing</text>`;
	body += `<rect x="620" y="140" width="520" height="220" rx="12" fill="#161b22" stroke="${GRUEN}" stroke-width="2"/>
	<text x="652" y="192" font-family="${FONT}" font-size="${S.label}" fill="${GRUEN}" letter-spacing="1.5">CARES</text>
	<text x="652" y="240" font-family="${FONT}" font-size="${S.body}" fill="${INK}">“Saving failed — your changes are</text>
	<text x="652" y="270" font-family="${FONT}" font-size="${S.body}" fill="${INK}">still here. Try again?”</text>
	<text x="652" y="316" font-family="${FONT}" font-size="${S.note}" fill="${MUTED}">names the cause and the next step, no apology</text>`;
	body += `<text x="60" y="418" font-family="${FONT}" font-size="${S.label}" fill="${MUTED}">The same rule as every care text: inform, offer a way forward, never blame.</text>`;
	return frame(
		'Error copy follows the review question',
		'Illustration: two error messages for the same failure — one logs, one cares.',
		body,
		w,
		h,
	);
}

writeFileSync(`${OUT}/streak-regeln-en.svg`, regeln());
writeFileSync(`${OUT}/puls-mapping-en.svg`, pulsMapping());
writeFileSync(`${OUT}/situationen-en.svg`, situationen());
writeFileSync(`${OUT}/error-copy-en.svg`, errorCopy());
console.log('OK:', OUT);
