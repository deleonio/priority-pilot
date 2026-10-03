import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = '/Users/moppitz/Workspace/priority-pilot/docs/marketing/artikel/2026-10-02-rueckmeldung-ohne-druck/images';
mkdirSync(OUT, { recursive: true });

// Tokens aus frontend/src/app.css (Dark-Theme)
const BG = '#0f131a';
const BORDER = '#2a3140';
const INK = '#e6edf3';
const MUTED = '#9aa4b2';
const ROT = '#f0503c';
const GRUEN = '#43d488';
const FONT = "Inter, 'Segoe UI', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

// Schriftgrößen-Hierarchie: Überschrift 26 · Card-Fließtext 22 · Label 19 · Feinnotiz 17 · Bildtitel 20
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

// --- Ruhepuls: zwei EKG-Spuren ---
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

function pulse(de) {
	const w = 1200;
	const h = 620;
	const y0 = 370;
	const panel = (x0, farbe, period, kopf, mass) => {
		let s = `<line x1="${x0}" y1="${y0}" x2="${x0 + 470}" y2="${y0}" stroke="${BORDER}" stroke-width="1.5"/>`;
		s += `<path d="${ecgPath(x0, 470, y0, period, 34)}" fill="none" stroke="${farbe}" stroke-width="3" stroke-linejoin="round"/>`;
		s += `<text x="${x0}" y="130" font-family="${FONT}" font-size="${S.head}" font-weight="600" fill="${farbe}">${kopf}</text>`;
		// Periodenmaß
		const ay = y0 + 78;
		s += `<line x1="${x0}" y1="${ay}" x2="${x0 + period}" y2="${ay}" stroke="${MUTED}" stroke-width="1.5"/>`;
		s += `<line x1="${x0}" y1="${ay - 8}" x2="${x0}" y2="${ay + 8}" stroke="${MUTED}" stroke-width="1.5"/>`;
		s += `<line x1="${x0 + period}" y1="${ay - 8}" x2="${x0 + period}" y2="${ay + 8}" stroke="${MUTED}" stroke-width="1.5"/>`;
		s += `<text x="${x0 + period / 2}" y="${ay + 30}" font-family="${MONO}" font-size="${S.label}" fill="${MUTED}" text-anchor="middle">${mass}</text>`;
		return s;
	};
	const body =
		panel(90, ROT, 120, de ? 'unausgewogen' : 'unbalanced', de ? '1,5 s' : '1.5 s') +
		panel(660, GRUEN, 208, de ? 'ausgewogen' : 'balanced', de ? '2,6 s' : '2.6 s');
	return frame(
		de ? 'Ruhepuls der Balance-Figur' : 'Resting pulse of the balance figure',
		de
			? 'Illustration: derselbe Puls in zwei Lagen — die Frequenz wird ruhiger, je ausgewogener die Balance steht.'
			: 'Illustration: the same pulse in two states — the frequency calms as the balance improves.',
		body,
		w,
		h,
	);
}

// --- Zwei Schleifen: Verlust vs. Erhalt ---
function schleifen(de) {
	const w = 1200;
	const h = 620;
	const zeile = (y, label, farbe, boxes) => {
		let s = `<text x="75" y="${y - 18}" font-family="${FONT}" font-size="${S.note}" fill="${farbe}" letter-spacing="2">${label.toUpperCase()}</text>`;
		boxes.forEach((lines, i) => {
			const x = 75 + i * 270;
			s += `<rect x="${x}" y="${y}" width="240" height="76" rx="10" fill="#161b22" stroke="${farbe}" stroke-width="2"/>`;
			lines.forEach((line, j) => {
				const ty = y + (lines.length === 1 ? 46 : 32 + j * 26);
				s += `<text x="${x + 120}" y="${ty}" font-family="${FONT}" font-size="${S.body}" fill="${INK}" text-anchor="middle">${line}</text>`;
			});
			if (i < 3) {
				const ax = x + 240 + 4;
				s += `<line x1="${ax}" y1="${y + 38}" x2="${ax + 18}" y2="${y + 38}" stroke="${MUTED}" stroke-width="2"/>`;
				s += `<polygon points="${ax + 26},${y + 38} ${ax + 16},${y + 33} ${ax + 16},${y + 43}" fill="${MUTED}"/>`;
			}
		});
		// Rückschleife
		const x1 = 75 + 120;
		const x4 = 75 + 3 * 270 + 120;
		const ry = y + 102;
		s += `<path d="M${x4},${y + 76} L${x4},${ry} L${x1},${ry} L${x1},${y + 82}" fill="none" stroke="${MUTED}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
		s += `<polygon points="${x1},${y + 76} ${x1 - 5},${y + 86} ${x1 + 5},${y + 86}" fill="${MUTED}"/>`;
		return s;
	};
	const rows = de
		? {
				r1: [
					['Ein Zähler sammelt Tage'],
					['Ein Tag bleibt leer'],
					['Die Kette bricht', '— Reset auf null'],
					['Die App wird gemieden'],
				],
				r2: [
					['Ein Zähler sammelt Tage'],
					['Ein Tag bleibt leer'],
					['Die Bestmarke bleibt,', 'der Zähler zählt neu'],
					['Weiter ohne Strafe'],
				],
				l1: 'Verlust-Schleife',
				l2: 'Erhalt-Schleife',
			}
		: {
				r1: [
					['A counter collects days'],
					['One day stays empty'],
					['The chain resets', 'to zero'],
					['Avoiding the app'],
				],
				r2: [
					['A counter collects days'],
					['One day stays empty'],
					['The best survives,', 'the count starts over'],
					['Tomorrow, no penalty'],
				],
				l1: 'loss loop',
				l2: 'keeping loop',
			};
	const body = zeile(150, rows.l1, ROT, rows.r1) + zeile(360, rows.l2, GRUEN, rows.r2);
	return frame(
		de ? 'Zwei Schleifen' : 'Two loops',
		de
			? 'Illustration: derselbe Auslöser, zwei Ausgänge — der Unterschied ist, ob der Zähler etwas nimmt.'
			: 'Illustration: the same trigger, two outcomes — the difference is whether the counter takes something away.',
		body,
		w,
		h,
	);
}

// --- Die vier gestalteten Zustände ---
function states() {
	const w = 1200;
	const h = 560;
	const card = (i, icon, name, sub) => {
		const x = 60 + i * 280;
		let s = `<rect x="${x}" y="150" width="260" height="200" rx="12" fill="#161b22" stroke="${BORDER}" stroke-width="2"/>`;
		s += icon(x);
		s += `<text x="${x + 130}" y="278" font-family="${FONT}" font-size="${S.body}" font-weight="600" fill="${INK}" text-anchor="middle">${name}</text>`;
		s += `<text x="${x + 130}" y="310" font-family="${FONT}" font-size="${S.note}" fill="${MUTED}" text-anchor="middle">${sub}</text>`;
		return s;
	};
	const spinner = (x) =>
		`<circle cx="${x + 130}" cy="212" r="17" fill="none" stroke="${BORDER}" stroke-width="4"/>
		<path d="M ${x + 130} 195 A 17 17 0 0 1 ${x + 145} 220" fill="none" stroke="${GRUEN}" stroke-width="4" stroke-linecap="round"/>`;
	const empty = (x) =>
		`<rect x="${x + 105}" y="196" width="50" height="34" rx="6" fill="none" stroke="${MUTED}" stroke-width="2.5" stroke-dasharray="6 5"/>`;
	const error = (x) =>
		`<circle cx="${x + 130}" cy="212" r="17" fill="none" stroke="${ROT}" stroke-width="3"/>
		<path d="M${x + 124},${206} L${x + 136},218 M${x + 136},206 L${x + 124},218" stroke="${ROT}" stroke-width="3" stroke-linecap="round"/>`;
	const check = (x) =>
		`<circle cx="${x + 130}" cy="212" r="17" fill="none" stroke="${GRUEN}" stroke-width="3"/>
		<path d="M${x + 122},${212} L${x + 128},${219} L${x + 139},203" stroke="${GRUEN}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
	const body = `
	<text x="60" y="118" font-family="${FONT}" font-size="${S.label}" fill="${MUTED}">Feedback aimed at under 100 ms · icon and text, never color alone</text>
	${card(0, spinner, 'Loading…', 'skeleton over spinner')}
	${card(1, empty, 'Nothing here yet', 'an invitation to act')}
	${card(2, error, 'Saving failed', 'cause + next step, no apology')}
	${card(3, check, 'Saved', 'quiet, one moment, then still')}`;
	return frame(
		'The four designed states',
		'Illustration: loading, empty, error, success — every state a view can land in is designed, not defaulted.',
		body,
		w,
		h,
	);
}

// --- Fürsorge-Karte ---
function fursorge(de) {
	const w = 1200;
	const h = 520;
	const frage = de
		? 'Die Prüffrage: „Sorgt der Text, oder protokolliert er nur?“'
		: 'The review question: “Does the text care, or does it just log?”';
	const txt = de
		? {
				a: 'protokolliert',
				a1: '„Du hast deine Körper-Säule',
				a2: 'vernachlässigt.“',
				b: 'sorgt',
				b1: '„Dein Körper könnte eine Pause',
				b2: 'gebrauchen. Ein kurzer Spaziergang',
				b3: 'tut heute schon viel — klein',
				b4: 'anfangen zählt.“',
				foot: 'Beispiel aus der Fürsorge-Tonalität von Balamentum: Situation „Defizit“, Säule Körper.',
			}
		: {
				a: 'logs',
				a1: '“You have been neglecting',
				a2: 'your body pillar.”',
				b: 'cares',
				b1: '“Your body could use a break.',
				b2: 'A short walk or an earlier night',
				b3: 'already does a lot today — starting',
				b4: 'small counts.”',
				foot: 'Example from Balamentum’s care copy: situation “deficit”, pillar “body”.',
			};
	let body = '';
	body += `<text x="60" y="126" font-family="${FONT}" font-size="${S.head}" font-weight="600" fill="${INK}">${frage}</text>`;
	body += `<rect x="60" y="168" width="520" height="230" rx="12" fill="#161b22" stroke="#b42318" stroke-width="2"/>
	<circle cx="100" cy="210" r="13" fill="none" stroke="${ROT}" stroke-width="2.5"/>
	<path d="M93,203 L107,217 M107,203 L93,217" stroke="${ROT}" stroke-width="2.5"/>
	<text x="128" y="217" font-family="${FONT}" font-size="${S.label}" fill="${ROT}">${txt.a}</text>
	<text x="92" y="268" font-family="${FONT}" font-size="${S.body}" fill="${INK}">${txt.a1}</text>
	<text x="92" y="298" font-family="${FONT}" font-size="${S.body}" fill="${INK}">${txt.a2}</text>`;
	body += `<rect x="620" y="168" width="520" height="230" rx="12" fill="#161b22" stroke="#1a7f37" stroke-width="2"/>
	<circle cx="660" cy="210" r="13" fill="none" stroke="${GRUEN}" stroke-width="2.5"/>
	<path d="M653,210 L659,217 L670,202" stroke="${GRUEN}" stroke-width="2.5" fill="none"/>
	<text x="688" y="217" font-family="${FONT}" font-size="${S.label}" fill="${GRUEN}">${txt.b}</text>
	<text x="652" y="260" font-family="${FONT}" font-size="${S.body}" fill="${INK}">${txt.b1}</text>
	<text x="652" y="290" font-family="${FONT}" font-size="${S.body}" fill="${INK}">${txt.b2}</text>
	<text x="652" y="320" font-family="${FONT}" font-size="${S.body}" fill="${INK}">${txt.b3}</text>
	<text x="652" y="350" font-family="${FONT}" font-size="${S.body}" fill="${INK}">${txt.b4}</text>`;
	body += `<text x="60" y="448" font-family="${FONT}" font-size="${S.label}" fill="${MUTED}">${txt.foot}</text>`;
	return frame(
		de ? 'Texte, die sorgen' : 'Copy that cares',
		de ? 'Illustration: derselbe Befund, zwei Tonalitäten.' : 'Illustration: the same finding, two tones.',
		body,
		w,
		h,
	);
}

writeFileSync(`${OUT}/states-en.svg`, states());
console.log('OK:', OUT);
