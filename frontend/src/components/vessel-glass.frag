precision highp float;

/*
 * Glasgefaess — WebGL-Fassung des Balance-Messkolbens (Lebensbalance).
 *
 * Dieselbe Bildsprache wie das SVG in VesselBalance.tsx, nur das Material ist Glas: Die Kontur ist
 * derselbe Kolbenpfad (rechte Halfte, an x=50 gespiegelt, als Kantabstand), die gemeinsame
 * Wasserlinie tragt den Fullstand, die Farbstreifen unter der Oberflache die Ist-Verteilung, die
 * Welle laeuft mit Wellenlaenge/Auslenkung/Drift wie im SVG (16/1.3/7s). Die Skalenstriche an
 * beiden Waenden (25/50/75 % der Hoehe, `SCALE_TICKS` in vesselGeometry.ts) liegen als duenne
 * Distanzstreifen ueber Gefaess und Wasser.
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
uniform float u_depth_waves;
uniform float u_depth_strength;
uniform float u_shadow;

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

/* ---------- Kontur: rechte Halfte des Kolbenpfads, 8 Stuetzpunkte je Kubikkurve ---------- */

const vec2 P0 = vec2(50.00, 6.00);
const vec2 P1 = vec2(58.10, 6.03);
const vec2 P2 = vec2(65.79, 6.12);
const vec2 P3 = vec2(72.96, 6.28);
const vec2 P4 = vec2(79.45, 6.52);
const vec2 P5 = vec2(85.14, 6.85);
const vec2 P6 = vec2(89.88, 7.27);
const vec2 P7 = vec2(93.55, 7.78);
const vec2 P8 = vec2(96.00, 8.40);
const vec2 P9 = vec2(94.75, 9.17);
const vec2 P10 = vec2(93.70, 10.13);
const vec2 P11 = vec2(92.84, 11.28);
const vec2 P12 = vec2(92.15, 12.63);
const vec2 P13 = vec2(91.63, 14.17);
const vec2 P14 = vec2(91.28, 15.91);
const vec2 P15 = vec2(91.07, 17.85);
const vec2 P16 = vec2(91.00, 20.00);
const vec2 P17 = vec2(91.00, 27.50);
const vec2 P18 = vec2(91.00, 34.98);
const vec2 P19 = vec2(91.00, 42.45);
const vec2 P20 = vec2(91.00, 49.88);
const vec2 P21 = vec2(91.00, 57.26);
const vec2 P22 = vec2(91.00, 64.58);
const vec2 P23 = vec2(91.00, 71.83);
const vec2 P24 = vec2(91.00, 79.00);
const vec2 P25 = vec2(90.88, 80.80);
const vec2 P26 = vec2(90.54, 82.43);
const vec2 P27 = vec2(89.97, 83.89);
const vec2 P28 = vec2(89.19, 85.15);
const vec2 P29 = vec2(88.19, 86.21);
const vec2 P30 = vec2(86.99, 87.04);
const vec2 P31 = vec2(85.59, 87.65);
const vec2 P32 = vec2(84.00, 88.00);
const vec2 P33 = vec2(79.87, 88.00);
const vec2 P34 = vec2(75.73, 88.00);
const vec2 P35 = vec2(71.57, 88.00);
const vec2 P36 = vec2(67.38, 88.00);
const vec2 P37 = vec2(63.13, 88.00);
const vec2 P38 = vec2(58.83, 88.00);
const vec2 P39 = vec2(54.46, 88.00);
const vec2 P40 = vec2(50.00, 88.00);

float sdSeg(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * h);
}

/* Kantabstand + Innerhalb-Paritat in einem Durchlauf: q ist bereits auf x >= 50 gefaltet. */
#define E(a, b) d = min(d, sdSeg(q, a, b)); if ((a.y > q.y) != (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) inside = 1.0 - inside;

/*
 * Tiefenwelle: eine versetzte, langsamer driftende Schicht unter der Hauptoberflaeche — nur
 * innerhalb des Wassers sichtbar, halbtransparent abgedunkelt. Textueller Makro statt Funktion,
 * weil GLSL keine Closures kennt (p, level, drift, water, aa kommen aus dem Aufrufort in main).
 */
#define STRATUM(dur, off, drop, ampScale, dark, strength) \
	{ \
		float phS = PI2 * ((p.x + drift * u_wave_length / dur) / u_wave_length) + off; \
		float surfS = level + u_wave_amplitude * ampScale * sin(phS) + drop; \
		float mS = smoothstep(surfS - aa, surfS + aa, p.y) * water * strength; \
		liquid = mix(liquid, liquid * dark, mS); \
	}

/* ---------- Skala: waagrechte Striche an beiden Waenden (25/50/75 % der Hoehe) ---------- */

/* `SCALE_TICKS` in vesselGeometry.ts: Strich an der linken Wand, +2 Einheiten insets, 6 Einheiten
   lang. Die Faltung an x=50 spiegelt die Abstaende automatisch auf die rechte Wand — deshalb
   genuegen die drei linken Segmente. */

const vec2 TICK_1 = vec2(11.0, 67.5);
const vec2 TICK_2 = vec2(17.0, 67.5);
const vec2 TICK_3 = vec2(11.0, 47.0);
const vec2 TICK_4 = vec2(17.0, 47.0);
const vec2 TICK_5 = vec2(11.0, 26.5);
const vec2 TICK_6 = vec2(17.0, 26.5);

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
/* Helle Rampe aus app.css: --pp-pillar-1..5 (Neon in Lesbarkeits-Brechung), funf gleichbreite Bander. */
vec3 bandColorAt(float t) {
	vec3 c = vec3(0.8392, 0.0, 0.4314);
	c = mix(c, vec3(0.0, 0.5294, 0.6588), step(0.2, t));
	c = mix(c, vec3(0.0863, 0.6431, 0.0863), step(0.4, t));
	c = mix(c, vec3(0.6588, 0.5725, 0.0), step(0.6, t));
	c = mix(c, vec3(0.5412, 0.1216, 0.8392), step(0.8, t));
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
	E(P30, P31)
	E(P31, P32)
	E(P32, P33)
	E(P33, P34)
	E(P34, P35)
	E(P35, P36)
	E(P36, P37)
	E(P37, P38)
	E(P38, P39)
	E(P39, P40)
	float sd = inside > 0.5 ? -d : d;
	float silhouette = smoothstep(aa, -aa, sd);

	/* Skala: nur Abstand zu den Strichsegmenten — keine Paritaet, sie sind keine Flaeche. */
	float tick = min(min(sdSeg(q, TICK_1, TICK_2), sdSeg(q, TICK_3, TICK_4)), sdSeg(q, TICK_5, TICK_6));

	/* Glaswand-Nähe (1 an der Kontur, fällt nach ~3,5 Einheiten ab) und Tiefenmaß 0 oben … 1 unten. */
	float wall = exp(min(sd, 0.0) / 3.5);
	float depth = clamp((p.y - 6.0) / 82.0, 0.0, 1.0);

	/* Aufstieg einmalig von unten (still gesetzt: sofort auf Stand, wie die Still-Klasse im SVG). */
	float rise = u_animated ? easeOutCubic(clamp(u_time / u_rise_duration, 0.0, 1.0)) : 1.0;
	float fill = clamp(u_fill, 0.0, 1.0) * rise;
	float level = mix(88.0, 6.0, fill);

	/*
	 * Wasserlinie: gemeinsame Welle über die Kolbenbreite (Drift nach links wie das SVG), an der
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

	/*
	 * Tiefenwellen: zwei versetzte, langsamer driftende Schichten unter der Hauptoberflaeche. Sie
	 * geben dem Wasser Tiefe, ohne die Wasserlinie — und damit den Fuellstand — zu verwässern; die
	 * Hauptwelle behaelt den Meniskus als einzige helle Kante. Ihr Abstand (drop) ist so gewaehlt,
	 * dass jede Schicht selbst im Wellental unter der vorherigen bleibt — sonst sähe die tiefste
	 * Schicht ueber der Oberflaeche, der Fehler, der die Tiefenwelle im SVG unmoeglich macht.
	 */
	/* Drei unterscheidbare Geschwindigkeiten (Nutzer-Auftrag 2026-09-06): Oberflaeche 7 s,
	   Tiefenschicht 1: 14 s, Tiefenschicht 2: 23 s — identisch zum SVG (DEPTH_WAVE_LAYERS). */
	STRATUM(14.0, 2.1, 3.4, 1.35, 0.82, step(1.0, u_depth_waves) * u_depth_strength)
	STRATUM(23.0, 4.2, 6.8, 1.7, 0.70, step(2.0, u_depth_waves) * u_depth_strength * 0.66)

	liquid *= mix(1.05, 0.78, depth);
	liquid *= 1.0 - 0.14 * wall;
	liquid *= 1.0 + 0.05 * cos(phase);

	/* Meniskus-Glanz knapp unter der Oberfläche. */
	liquid += vec3(0.35) * exp(-max(p.y - surface, 0.0) / 1.6) * water;

	/* Leeres Gefäß: eingesenkte Fläche, unten und zur Wand dunkler. */
	vec3 vessel = vesselColor() * mix(1.02, 0.93, depth);
	vessel *= 1.0 - 0.10 * wall * (0.4 + 0.6 * depth);

	vec3 col = mix(vessel, liquid, water * 0.92);

	/*
	 * Lichtrichtung (oben links) als Mass 0–1 — steuert Fresnel-Saum, Kontur-Verlauf und Schatten.
	 */
	float lit = clamp(0.5 + ((50.0 - p.x) * 0.35 + (6.0 - p.y) * 0.65) / 60.0, 0.0, 1.0);

	/* Glas: heller Fresnel-Saum kurz innerhalb der Kontur, zur Schattenseite auslaufend. */
	col += vec3(0.20) * smoothstep(0.0, 1.0, -sd) * smoothstep(3.4, 1.0, -sd) * (0.25 + 0.75 * lit);
	col += vec3(0.04) * smoothstep(4.5, 6.0, -sd) * smoothstep(9.5, 6.0, -sd);

	/* Glanzlichter auf Kolbenbauch und Rand: Licht von oben links, auf der Fluessigkeit ebenso sichtbar. */
	col += vec3(0.13) * spec(p, vec2(26.0, 30.0), vec2(7.0, 13.0), -0.15);
	col += vec3(0.09) * spec(p, vec2(50.0, 10.0), vec2(13.0, 1.8), 0.0);
	col += vec3(0.05) * spec(p, vec2(70.0, 58.0), vec2(3.0, 3.0), 0.0);

	/*
	 * Kontur: schmal (Gesamtstaerke 1,2) und mit Lichtrichtung gefärbt — zur Schattenseite dunkler
	 * statt zur Lichtseite aufgehellt: Jede Stelle bleibt >= 3:1 gegen die Karte (WCAG 1.4.11,
	 * Farb- keine Strichstaerkefrage).
	 */
	float outline = 1.0 - smoothstep(0.6 - aa, 0.6 + aa, abs(sd));
	vec3 outlineCol = mix(outlineColor(), outlineColor() * 0.78, 1.0 - lit);
	col = mix(col, outlineCol, outline);

	/* Skalenstriche: duenn und zurueckhaltend ueber Gefaess und Wasser, in Konturfarbe abgeschwaecht. */
	float tickLine = (1.0 - smoothstep(0.35 - aa, 0.35 + aa, tick)) * silhouette;
	col = mix(col, outlineCol, tickLine * 0.5);

	/*
	 * Weicher Schatten unterm Kolben: hebt die Silhouette von der Karte, nur unterhalb der Mitte
	 * (Licht von oben links) und nur ausserhalb der Kontur — beim flachen Boden direkt darunter.
	 */
	float alpha = max(silhouette, outline);
	float shadowMask = smoothstep(7.0, 1.0, sd) * smoothstep(55.0, 88.0, p.y);
	float shadowAlpha = (1.0 - alpha) * shadowMask * u_shadow;
	col = mix(col, vec3(0.42, 0.45, 0.50), (1.0 - alpha) * shadowMask);

	gl_FragColor = vec4(col, max(alpha, shadowAlpha));
}
