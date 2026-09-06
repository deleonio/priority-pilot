precision highp float;

/*
 * Glasherz — WebGL-Fassung des Dashboard-Herzens (Lebensbalance).
 *
 * Dieselbe Bildsprache wie das SVG in HeartBalance.tsx, nur das Material ist Glas: Die Kontur ist
 * der selbe Herzpfad (rechte Halfte, an x=50 gespiegelt, als Kantabstand), die gemeinsame
 * Wasserlinie tragt den Fullstand, die Farbstreifen unter der Oberflache die Ist-Verteilung, die
 * Welle lauft mit Wellenlange/Auslenkung/Drift wie im SVG (16/3/7s).
 *
 * Dialekt bewusst GLSL ES 1.00 (gl_FragColor, keine Array-Konstruktoren, entrollte Kontur per
 * Makro): lauft unverandert im Preview-Viewer (WebGL1) und im WebGL2-Kontext der App. Ohne
 * `GLASS_APP` gelten die hellen Theme-Farben als Konstanten (Preview); die App ubergibt dieselben
 * Werte als Uniforms aus den CSS-Rollen (--pp-pillar-*, --pp-surface-*, --pp-border-strong).
 */

uniform vec2 u_resolution;
uniform float u_time;

uniform float u_fill;
uniform bool u_animated;
uniform float u_rise_duration;
uniform float u_wave_length;
uniform float u_wave_amplitude;
uniform float u_wave_duration;

#ifdef GLASS_APP
uniform vec3 u_band_colors[8];
uniform float u_band_edges[8];
uniform float u_band_count;
uniform vec3 u_vessel;
uniform vec3 u_outline;
uniform vec3 u_seam;
#endif

const float VIEW_W = 100.0;
const float VIEW_H = 92.0;
const float PI2 = 6.2831853;

/* ---------- Kontur: rechte Halfte des Herzpfads, 10 Stutzpunkte je Kubikkurve ---------- */

const vec2 P0 = vec2(50.00, 88.00);
const vec2 P1 = vec2(58.58, 81.52);
const vec2 P2 = vec2(66.30, 75.26);
const vec2 P3 = vec2(73.17, 69.23);
const vec2 P4 = vec2(79.15, 63.39);
const vec2 P5 = vec2(84.25, 57.75);
const vec2 P6 = vec2(88.45, 52.29);
const vec2 P7 = vec2(91.73, 46.99);
const vec2 P8 = vec2(94.10, 41.86);
const vec2 P9 = vec2(95.52, 36.86);
const vec2 P10 = vec2(96.00, 32.00);
const vec2 P11 = vec2(95.65, 27.38);
const vec2 P12 = vec2(94.65, 23.15);
const vec2 P13 = vec2(93.06, 19.33);
const vec2 P14 = vec2(90.94, 15.94);
const vec2 P15 = vec2(88.38, 13.00);
const vec2 P16 = vec2(85.42, 10.54);
const vec2 P17 = vec2(82.13, 8.59);
const vec2 P18 = vec2(78.59, 7.17);
const vec2 P19 = vec2(74.86, 6.30);
const vec2 P20 = vec2(71.00, 6.00);
const vec2 P21 = vec2(68.33, 6.15);
const vec2 P22 = vec2(65.74, 6.58);
const vec2 P23 = vec2(63.25, 7.27);
const vec2 P24 = vec2(60.87, 8.21);
const vec2 P25 = vec2(58.63, 9.38);
const vec2 P26 = vec2(56.53, 10.75);
const vec2 P27 = vec2(54.60, 12.32);
const vec2 P28 = vec2(52.86, 14.06);
const vec2 P29 = vec2(51.32, 15.96);
const vec2 P30 = vec2(50.00, 18.00);

float sdSeg(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * h);
}

/* Kantabstand + Innerhalb-Paritat in einem Durchlauf: q ist bereits auf x >= 50 gefaltet. */
#define E(a, b) d = min(d, sdSeg(q, a, b)); if ((a.y > q.y) != (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) inside = 1.0 - inside;

/* ---------- Themen: Farben und Bandgrenzen (App: Uniforms, Preview: Konstanten) ---------- */

#ifdef GLASS_APP
vec3 bandColorAt(float t) {
	vec3 c = u_band_colors[0];
	for (int i = 1; i < 8; i++) {
		float hit = step(u_band_edges[i], t) * step(float(i), u_band_count - 1.0);
		c = mix(c, u_band_colors[i], hit);
	}
	return c;
}

float seamFactor(float t) {
	float m = 0.0;
	for (int i = 1; i < 8; i++) {
		float active = step(float(i), u_band_count - 1.0);
		m = max(m, active * (1.0 - smoothstep(0.0, 0.006, abs(t - u_band_edges[i]))));
	}
	return m;
}

vec3 vesselColor() { return u_vessel; }
vec3 outlineColor() { return u_outline; }
vec3 seamColor() { return u_seam; }
#else
/* Helle Rampe aus app.css: --pp-pillar-1..5, funf gleichbreite Bander. */
vec3 bandColorAt(float t) {
	vec3 c = vec3(0.1647, 0.4706, 0.8392);
	c = mix(c, vec3(0.9216, 0.4078, 0.2039), step(0.2, t));
	c = mix(c, vec3(0.1059, 0.6863, 0.4784), step(0.4, t));
	c = mix(c, vec3(0.9294, 0.6314, 0.0000), step(0.6, t));
	c = mix(c, vec3(0.9098, 0.4824, 0.6431), step(0.8, t));
	return c;
}

float seamFactor(float t) {
	float m = 1.0 - smoothstep(0.0, 0.006, abs(t - 0.2));
	m = max(m, 1.0 - smoothstep(0.0, 0.006, abs(t - 0.4)));
	m = max(m, 1.0 - smoothstep(0.0, 0.006, abs(t - 0.6)));
	m = max(m, 1.0 - smoothstep(0.0, 0.006, abs(t - 0.8)));
	return m;
}

vec3 vesselColor() { return vec3(0.9333, 0.9451, 0.9647); }
vec3 outlineColor() { return vec3(0.4824, 0.5176, 0.5765); }
vec3 seamColor() { return vec3(1.0); }
#endif

/* ---------- Hilfen ---------- */

float easeOutCubic(float x) {
	float v = 1.0 - x;
	return 1.0 - v * v * v;
}

/* Weicher elliptischer Glanzpunkt (rotiert), Stärke 1 im Zentrum, gaußartig abfallend. */
float spec(vec2 p, vec2 c, vec2 r, float rot) {
	vec2 v = p - c;
	vec2 u = vec2(v.x * cos(rot) + v.y * sin(rot), -v.x * sin(rot) + v.y * cos(rot));
	vec2 z = u / r;
	return exp(-dot(z, z));
}

void main() {
	/*
	 * Zeichenfläche in Nutzereinheiten (y wie im SVG nach unten), Briefkasten-Skalierung: das
	 * 100×92-Gefäß behält sein Seitenverhältnis, egal welche Form das Canvas hat (App: exakt
	 * 100:92 per CSS, Preview: quadratisch).
	 */
	float scale = min(u_resolution.x / VIEW_W, u_resolution.y / VIEW_H);
	vec2 p = vec2(50.0, 46.0)
		+ vec2(gl_FragCoord.x - 0.5 * u_resolution.x, 0.5 * u_resolution.y - gl_FragCoord.y) / scale;
	float aa = 1.5 / scale;

	/* Gefaltete Kontur: Kantabstand d und Parität inside → signierte Distanz sd (< 0 innen). */
	vec2 q = vec2(50.0 + abs(p.x - 50.0), p.y);
	float d = 1e5;
	float inside = 0.0;
	E(P0, P1)
	E(P1, P2)
	E(P2, P3)
	E(P3, P4)
	E(P4, P5)
	E(P5, P6)
	E(P6, P7)
	E(P7, P8)
	E(P8, P9)
	E(P9, P10)
	E(P10, P11)
	E(P11, P12)
	E(P12, P13)
	E(P13, P14)
	E(P14, P15)
	E(P15, P16)
	E(P16, P17)
	E(P17, P18)
	E(P18, P19)
	E(P19, P20)
	E(P20, P21)
	E(P21, P22)
	E(P22, P23)
	E(P23, P24)
	E(P24, P25)
	E(P25, P26)
	E(P26, P27)
	E(P27, P28)
	E(P28, P29)
	E(P29, P30)
	float sd = inside > 0.5 ? -d : d;
	float heart = smoothstep(aa, -aa, sd);

	/* Glaswand-Nähe (1 an der Kontur, fällt nach ~3,5 Einheiten ab) und Tiefenmaß 0 oben … 1 unten. */
	float wall = exp(min(sd, 0.0) / 3.5);
	float depth = clamp((p.y - 6.0) / 82.0, 0.0, 1.0);

	/* Aufstieg einmalig von unten (still gesetzt: sofort auf Stand, wie die Still-Klasse im SVG). */
	float rise = u_animated ? easeOutCubic(clamp(u_time / u_rise_duration, 0.0, 1.0)) : 1.0;
	float fill = clamp(u_fill, 0.0, 1.0) * rise;
	float level = mix(88.0, 6.0, fill);

	/*
	 * Wasserlinie: gemeinsame Welle über die Herzbreite (Drift nach links wie das SVG), an der
	 * Glaswand steigt die Flüssigkeit meniskenhaft an. Still: Welle in Grundform (Drift 0).
	 */
	float drift = u_animated ? u_time : 0.0;
	float phase = PI2 * ((p.x + drift * u_wave_length / u_wave_duration) / u_wave_length);
	float surface = level + u_wave_amplitude * sin(phase) - 2.2 * wall;
	float water = smoothstep(surface - aa, surface + aa, p.y);

	/*
	 * Brechung: nahe der Wand wirkt der Inhalt durch dickes Glas leicht zusammengedrückt — Band-
	 * grenzen und Fugen krümmen sich mit, statt vor der Wand zu enden.
	 */
	float xr = 50.0 + (p.x - 50.0) * (1.0 - 0.06 * wall);
	float t = clamp((xr - 4.0) / 92.0, 0.0, 1.0);

	vec3 liquid = bandColorAt(t);
	liquid = mix(liquid, seamColor(), seamFactor(t) * 0.55);
	liquid *= mix(1.05, 0.78, depth);
	liquid *= 1.0 - 0.14 * wall;
	liquid *= 1.0 + 0.05 * cos(phase);

	/* Meniskus-Glanz knapp unter der Oberfläche. */
	liquid += vec3(0.35) * exp(-max(p.y - surface, 0.0) / 1.6) * water;

	/* Leeres Gefäß: eingesenkte Fläche, unten und zur Wand dunkler. */
	vec3 vessel = vesselColor() * mix(1.02, 0.93, depth);
	vessel *= 1.0 - 0.10 * wall * (0.4 + 0.6 * depth);

	vec3 col = mix(vessel, liquid, water * 0.92);

	/* Glas: heller Fresnel-Saum kurz innerhalb der Kontur, zweite blassere „Dickenzeile“. */
	col += vec3(0.18) * smoothstep(0.0, 1.0, -sd) * smoothstep(3.4, 1.0, -sd);
	col += vec3(0.04) * smoothstep(4.5, 6.0, -sd) * smoothstep(9.5, 6.0, -sd);

	/* Glanzlichter auf den Lappen: Licht von oben links, auf der Flüssigkeit ebenso sichtbar. */
	col += vec3(0.12) * spec(p, vec2(31.0, 20.0), vec2(11.0, 3.2), -0.55);
	col += vec3(0.08) * spec(p, vec2(69.0, 25.0), vec2(6.5, 2.4), 0.45);
	col += vec3(0.05) * spec(p, vec2(24.0, 33.0), vec2(2.2, 2.2), 0.0);

	/* Kontur wie im SVG: border-strong, zentriert, Breite 2 — hält ≥ 3:1 (WCAG 1.4.11). */
	float outline = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, abs(sd));
	col = mix(col, outlineColor(), outline);

	gl_FragColor = vec4(col, max(heart, outline));
}
