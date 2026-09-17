precision highp float;

/*
 * Balance-Figuren — WebGL-Fassung der Startseiten-Bilder der Lebensbalance.
 *
 * Dieselbe Bildsprache wie das SVG in BalanceFigure.tsx, nur das Material kommt hinzu. Sechs
 * Figuren, ein Programm: Blasen (0), Ringe (1), Strahlen (2), Scheiben (3), Blüte (4), Kristall (5).
 * Sie bekommen dieselben Werte — je Saeule das Verhaeltnis Ist zu Soll (lib/balanceMetric.ts) — und
 * unterscheiden sich allein darin, wie sie es zeigen. Radien, Winkel und Phasen kommen aus
 * lib/balanceFigure.ts; beide Fassungen rechnen dieselbe Geometrie, hier nur je Bildpunkt statt je
 * Element.
 *
 * Dialekt bewusst GLSL ES 1.00 (gl_FragColor, keine dynamische Array-Indizierung ausserhalb von
 * Schleifen mit konstanten Grenzen): laeuft unveraendert in WebGL1- und WebGL2-Kontexten.
 *
 * Ausgabe ist **premultipliziert** (der Kontext wird mit premultipliedAlpha: true erzeugt) — die
 * Formen liegen halbtransparent uebereinander, und nur so bleibt ihre Ueberlagerung ohne dunklen
 * Saum ueber der Karte.
 */

uniform vec2 u_resolution;
uniform float u_time;
uniform bool u_animated;

/*
 * Fortschritt des Auftakts, 0–1, **von der Komponente gerechnet** — nicht aus u_time abgeleitet.
 * Grund: Die Render-Loop laeuft nur, wenn das Bild sichtbar und der Tab im Vordergrund ist. Waere
 * der Auftakt an die Shader-Uhr gebunden, stuende sie bei einem Standbild auf 0 und das Bild waere
 * leer statt fertig — genau der Fall „Dashboard im Hintergrund-Tab geoeffnet".
 */
uniform float u_rise;

/* Ruhepuls: Sekunden je Schlag, ruhiger je ausgewogener. */
uniform float u_beat;

/* 0 = Blasen, 1 = Ringe, 2 = Strahlen, 3 = Scheiben (derselbe Stapel wie 0, anderes Material),
 * 4 = Blüte, 5 = Kristall (dieselbe Silhouette wie 4, anderes Material). */
uniform float u_figure;

/* Je Saeule: Farbe und Bewegung — in jeder Figur dieselbe. */
uniform vec3 u_colors[8];
uniform float u_phase[8];
uniform float u_swing[8];
uniform float u_rot[8];
uniform float u_dir[8];
uniform float u_count;

/* Blasen: Grundradius, absteigend sortiert (Slot 0 liegt hinten). */
uniform float u_orb_radius[8];

/* Ringe: Spurmitte, Strichstaerke und Bogenlaenge als Anteil des Umlaufs. */
uniform float u_arc_radius[8];
uniform float u_arc_width[8];
uniform float u_arc_sweep[8];

/* Strahlen: Mittelwinkel (Grad), halbe Oeffnung (Grad) und Laenge. Blüte und Kristall nutzen
 * Winkel und Laenge als Stützpunkte ihrer Silhouette (Laenge = Radius der Lappenspitze). */
uniform float u_ray_angle[8];
uniform float u_ray_spread[8];
uniform float u_ray_length[8];

/*
 * Die Soll-Marke, in der Einheit der jeweiligen Figur: Blasen-Radius, Bogen-Anteil oder
 * Strahl-Laenge. Sie ist in jeder Figur dieselbe Aussage — „hier steht die Saeule genau auf
 * ihrem Ziel" — und macht die Abweichung ohne Zahl ablesbar.
 */
uniform float u_target;

/* Zifferblatt: Zahl der leuchtenden Striche (0–100) und die fuenf Stuetzstellen der Farbrampe. */
uniform float u_ring_active;
uniform vec3 u_ring_stops[5];

/* Farbe der Karte, auf der das Bild liegt — Bezug fuer die aufgehellte Fuellung und die Marke. */
uniform vec3 u_surface;

/* Staerke des Kontaktschattens unter jeder Blase (0 = aus). */
uniform float u_shadow;

const float VIEW = 100.0;
const float CENTER = 50.0;
const float PI2 = 6.2831853;

/* Geometrie-Konstanten, zahlengleich zu lib/balanceFigure.ts. */
const float SWING = 0.12;
const float RING_INNER = 40.0;
const float TICK_LENGTH = 5.0;
const float TICK_LENGTH_MAJOR = 7.5;
const float TICK_STEP = 3.6;

/*
 * Deckkraft der Blasenfuellung. Bewusst niedrig: Eine Seifenblase ist innen fast klar und traegt
 * ihre Farbe in der Haut. Vor allem aber liegen hier bis zu acht Blasen uebereinander — bei einer
 * satten Fuellung verdeckte die vorderste (die schwaechste Saeule) alle anderen, und der Stapel
 * waere nur noch eine Scheibe. Die Zuordnung Farbe/Saeule traegt der Saum, nicht die Flaeche.
 */
const float FILL_ALPHA = 0.08;

/*
 * Anteil Kartenfarbe in der Fuellung. Ohne ihn laufen fuenf uebereinanderliegende Saeulenfarben zu
 * einem grauen Klumpen zusammen (Rot + Gelb + Gruen + Blau + Violett ist nun einmal Grau); mit ihm
 * bleibt der Stapel licht und jede Farbe erkennbar. Die reine Saeulenfarbe traegt der Saum.
 */
const float FILL_TINT = 0.45;

/* Staerke des Neon-Scheins um jede Form (additives Licht, siehe unten). */
const float GLOW = 0.45;

/* Striche der Soll-Marke ueber den vollen Umlauf — gleiche Anmutung wie `stroke-dasharray` im SVG. */
const float TARGET_DASHES = 36.0;

/* Atmung und Wippen der Lappen — bewusst kleiner als die Blasen-Auslenkung: Der Radius ist hier
 * der Wert selbst, eine grosse Auslenkung liesse eine schwache Saeule zeitweise stark aussehen. */
const float PETAL_SWING = 0.06;
const float PETAL_SWAY = 1.6;

/* Deckkraft der unausgefuellten Ringspur — sie zeigt, wie weit es noch waere. */
const float ARC_TRACK_ALPHA = 0.16;

float easeOutCubic(float x) {
	float v = 1.0 - x;
	return 1.0 - v * v * v;
}

/* Weicher elliptischer Glanzpunkt (rotiert), Staerke 1 im Zentrum, gaussartig abfallend. */
float spec(vec2 p, vec2 c, vec2 r, float rot) {
	vec2 v = p - c;
	vec2 u = vec2(v.x * cos(rot) + v.y * sin(rot), -v.x * sin(rot) + v.y * cos(rot));
	vec2 z = u / r;
	return exp(-dot(z, z));
}

/* Farbe des Strichs `index` (0–99) aus den fuenf Stuetzstellen — vier gleich lange Abschnitte. */
vec3 ringColor(float index) {
	float position = (index / 99.0) * 4.0;
	vec3 c = mix(u_ring_stops[0], u_ring_stops[1], clamp(position, 0.0, 1.0));
	c = mix(c, u_ring_stops[2], clamp(position - 1.0, 0.0, 1.0));
	c = mix(c, u_ring_stops[3], clamp(position - 2.0, 0.0, 1.0));
	c = mix(c, u_ring_stops[4], clamp(position - 3.0, 0.0, 1.0));
	return c;
}

/* Kuerzester Abstand zweier Winkel in Grad (−180 … 180). */
float angleDelta(float a, float b) {
	float d = mod(a - b + 180.0, 360.0) - 180.0;
	return d;
}

void main() {
	/*
	 * Zeichenflaeche in Nutzereinheiten (y wie im SVG nach unten), Briefkasten-Skalierung: das
	 * quadratische 100x100-Feld behaelt sein Seitenverhaeltnis, egal welche Form das Canvas hat.
	 */
	float scale = min(u_resolution.x, u_resolution.y) / VIEW;
	vec2 p = vec2(CENTER)
		+ vec2(gl_FragCoord.x - 0.5 * u_resolution.x, 0.5 * u_resolution.y - gl_FragCoord.y) / scale;
	float aa = 1.5 / scale;
	vec2 d = p - vec2(CENTER);
	float radius = length(d);

	/* Winkel ab 12 Uhr im Uhrzeigersinn: 0–360 Grad und als Anteil des Umlaufs. */
	float degAngle = mod(degrees(atan(d.y, d.x)) + 90.0, 360.0);
	float turn = degAngle / 360.0;

	float time = u_animated ? u_time : 0.0;

	/* Auftakt: die Figur waechst aus dem Nichts, der Ring zieht sich auf. Still: sofort auf Stand. */
	float rise = easeOutCubic(clamp(u_rise, 0.0, 1.0));

	/* Gemeinsamer Ruhepuls — ein leises Atmen ueber die Figur, nicht ueber den Ring: das
	 * Zifferblatt ist die Skala und darf nicht mitwackeln. */
	float beat = 1.0 + 0.03 * sin(PI2 * time / max(u_beat, 0.1));

	/* Premultiplizierte Akkumulation. */
	vec3 acc = vec3(0.0);
	float alpha = 0.0;

	if (u_figure > 3.5) {
		/*
		 * ── Blüte (4) und Kristall (5): eine Silhouette, zwei Materialien ───────────────────────
		 *
		 * Alle Säulen bilden EINE geschlossene Form: je Säule ein Stützpunkt auf ihrem Winkel, so
		 * weit aussen wie ihr Wert. Die Kontur zwischen den Stützunkten mischt ihre Radien und
		 * Farben mit Dreiecksgewichten ueber den Ring (Partition der Eins, zahlengleich zu
		 * `petalRadiusAt` in lib/balanceFigure.ts) — die Blüte glaettet die Mischung, der Kristall
		 * laesst sie kantig. Damit traegt die Kante unterwegs beide Säulenfarben zugleich.
		 */
		bool soft = u_figure < 4.5;

		/* Position auf dem Ring: Stützpunkt 0 steht auf 12 Uhr, die Abstände sind gleich. */
		float count = max(u_count, 1.0);
		float gridStep = 360.0 / count;
		float position = degAngle / gridStep;

		float contour = 0.0;
		vec3 contourCol = vec3(0.0);
		float nodeAcc = 0.0;
		vec3 nodeColAcc = vec3(0.0);

		for (int k = 0; k < 8; k++) {
			float used = step(float(k), u_count - 1.0);

			/* Atmen der Spitze um ihren Wert; Wippen um den Winkel in eigener Richtung und Takt. */
			float phase = u_phase[k] + PI2 * time / u_swing[k];
			float r = u_ray_length[k] * rise * beat * (1.0 + PETAL_SWING * sin(phase));
			float a = radians(u_ray_angle[k] + 90.0 + u_dir[k] * PETAL_SWAY * sin(u_phase[k] + PI2 * time / u_rot[k]));

			float dist = abs(position - float(k));
			dist = min(dist, count - dist);
			if (dist < 1.0) {
				float share = soft ? 1.0 - smoothstep(0.0, 1.0, dist) : 1.0 - dist;
				contour += r * share * used;
				contourCol += u_colors[k] * share * used;
			}

			/* Leuchtender Knoten auf der Spitze — im Kristall der Kristallisationspunkt, in der
			 * Blüte ein sanfter Lichtpunkt. Er ankert jede Säule im Bild, auch im Gleichstand. */
			vec2 vertex = vec2(cos(a - 1.5707963), sin(a - 1.5707963)) * r;
			float nodeDist2 = dot(d - vertex, d - vertex);
			float node = exp(-nodeDist2 * (soft ? 1.1 : 0.85)) * used;
			float nodeGlow = exp(-nodeDist2 * 0.06) * 0.45 * used;
			nodeAcc += node;
			nodeColAcc += mix(u_colors[k], vec3(1.0), 0.55) * node + u_colors[k] * nodeGlow;
		}

		/* Konturfeld: negativ innerhalb der Silhouette. */
		float f = radius - contour;

		/*
		 * Fuellung. Blüte: wie eine Blase zur Kartenfarbe aufgehellt und fast klar — die Flaeche
		 * traegt Licht, die Kante die Farbe. Kristall: Facetten, die je nach Lage das Licht
		 * unterschiedlich fangen — die Helligkeit springt an den Kanten, das macht die Flaeche zum
		 * Kristall statt zum Kreis.
		 */
		float inside = smoothstep(aa, -aa, f);
		float facet = floor(position);
		float facetLum = 0.78 + 0.22 * sin((facet + 0.5) * 2.39996);
		vec3 fillColor = soft
			? mix(contourCol, u_surface, 0.45)
			: mix(contourCol, u_surface, 0.30) * facetLum;
		float fillAlpha = inside * (soft ? 0.10 : 0.22);
		acc = fillColor * fillAlpha + acc * (1.0 - fillAlpha);
		alpha = fillAlpha + alpha * (1.0 - fillAlpha);

		/* Knoten auf den Spitzen, ueber der Fuellung. */
		float nodeAlpha = clamp(nodeAcc, 0.0, 1.0);
		acc = nodeColAcc * nodeAlpha + acc * (1.0 - nodeAlpha);
		alpha = min(1.0, alpha + nodeAcc);

		/* Die Kante: schmal und hell, die Farbe wechselt unterwegs in die der Nachbar-Säule. */
		float edgeWidth = soft ? 0.9 + aa : 0.55 + aa;
		float edge = 1.0 - smoothstep(0.0, edgeWidth, abs(f));
		vec3 sheen = 0.5 + 0.5 * cos(PI2 * (vec3(0.0, 0.33, 0.67) + turn * 1.2 + time * 0.03));
		vec3 edgeCol = mix(contourCol, vec3(1.0), soft ? 0.16 : 0.30);
		if (soft) edgeCol = mix(edgeCol, sheen, 0.22);
		float edgeAlpha = edge * 0.95;
		acc = edgeCol * edgeAlpha + acc * (1.0 - edgeAlpha);
		alpha = edgeAlpha + alpha * (1.0 - edgeAlpha);

		/* Neon-Schein ausserhalb der Kontur — beim Kristall enger, seine Schaerfe bleibt Stilmittel. */
		float halo = exp(-max(f, 0.0) / (soft ? 1.8 : 1.1)) * (1.0 - inside);
		acc += contourCol * halo * GLOW * 0.8;
		alpha = min(1.0, alpha + halo * GLOW * 0.8);

		/* Soll-Marke als gestrichelter Kreis wie bei den Blasen: Spitze innerhalb heisst „kommt zu
		   kurz", ausserhalb „zieht davon". */
		float tr = u_target * rise * beat;
		float mark = (1.0 - smoothstep(0.0, 0.5 + aa, abs(radius - tr)))
			* step(0.45, fract(turn * TARGET_DASHES)) * 0.5;
		acc = u_surface * 0.35 * mark + acc * (1.0 - mark);
		alpha = mark + alpha * (1.0 - mark);
	} else if (u_figure < 0.5 || u_figure > 2.5) {
		/*
		 * ── Blasen (0) und Scheiben (3): derselbe Stapel, zwei Materialien ─────────────────────
		 *
		 * Geometrie, Reihenfolge und Bewegung sind identisch — nur das Shading trennt sie. Die
		 * Blase traegt ihre Farbe in einer duennen Haut und laesst den Rest durchscheinen; die
		 * Scheibe ist eine satte Flaeche mit harter Kante. Ein gemeinsamer Zweig, weil jede
		 * Trennung der Ellipsen-Mathematik zwei Stellen erzeugte, die auseinanderlaufen koennen.
		 */
		bool sharp = u_figure > 2.5;

		for (int i = 0; i < 8; i++) {
			float used = step(float(i), u_count - 1.0);

			float phase = u_phase[i] + PI2 * time / u_swing[i];
			float swing = sin(phase) * SWING;
			float r = u_orb_radius[i] * rise * beat;
			float ax = max(r * (1.0 + swing), 0.001);
			float ay = max(r * (1.0 - swing), 0.001);

			/* Drehung um den Mittelpunkt: Grundlage ist dieselbe Phase, damit still gesetzte Blasen
			 * schon in unterschiedlicher Lage stehen. */
			float rot = u_phase[i] + u_dir[i] * PI2 * time / u_rot[i];
			float cs = cos(rot);
			float sn = sin(rot);
			vec2 local = vec2(d.x * cs + d.y * sn, -d.x * sn + d.y * cs);

			/* Normierter Abstand: Kante bei k = 1. Die Kantenbreite folgt der kleineren Halbachse. */
			float w = aa / min(ax, ay);
			float k = length(local / vec2(ax, ay));
			float inside = smoothstep(1.0 + w, 1.0 - w, k);

			/*
			 * Kontaktschatten: dieselbe Ellipse, nach unten rechts versetzt — er laesst den Stapel als
			 * Stapel lesen statt als flache Scheiben. Sichtbar ist bewusst nur die **Sichel**, die
			 * neben der Blase heraussteht (`1 - inside`): Ein Schatten auch unter der eigenen Flaeche
			 * summierte sich bei fuenf Blasen zu einem grauen Klumpen in der Mitte.
			 */
			vec2 shadowLocal = local - vec2(1.1 * cs + 1.5 * sn, -1.1 * sn + 1.5 * cs);
			float ks = length(shadowLocal / vec2(ax, ay));
			// Scheiben bekommen **keinen** Schatten: Ein weicher Saum um eine harte Kante nimmt genau
			// die Schaerfe zurueck, die ihr Stilmittel ist. Ihre Tiefe traegt die Kantenlippe.
			float shadowAlpha = sharp ? 0.0 : smoothstep(1.0 + w * 3.0, 1.0 - w, ks) * (1.0 - inside) * u_shadow * used;
			acc *= 1.0 - shadowAlpha;
			alpha = shadowAlpha + alpha * (1.0 - shadowAlpha);

			/*
			 * Fuellung. Blase: stark zur Kartenfarbe aufgehellt und fast klar — sonst liefen fuenf
			 * uebereinanderliegende Saeulenfarben zu einem grauen Klumpen zusammen. Scheibe: die
			 * **reine** Saeulenfarbe, nur zur Mitte hin leicht abgedunkelt, damit die Flaeche eine
			 * Woelbung behaelt statt als Papierkreis zu wirken.
			 */
			vec3 body = sharp
				? u_colors[i] * mix(0.86, 1.04, clamp(k, 0.0, 1.0))
				: mix(u_colors[i], u_surface, FILL_TINT) * mix(0.95, 1.12, clamp(k, 0.0, 1.0));

			/*
			 * Seifenhaut: ein schmaler Fresnel-Saum kurz innerhalb der Kante, zur Lichtseite (oben
			 * links) staerker. Der Farbschimmer darin laeuft ueber k — das ist die Irisierung, die eine
			 * Seifenblase von einer Glasscheibe unterscheidet. Der Saum traegt die **reine**
			 * Saeulenfarbe: Er ist das Einzige, woran eine Saeule im Stapel noch zu erkennen ist,
			 * sobald weitere Blasen darueberliegen.
			 */
			float rim = smoothstep(0.82, 1.0, k) * inside;
			float lit = clamp(0.5 + (-local.x * 0.35 - local.y * 0.65) / max(r, 1.0), 0.0, 1.0);
			vec3 sheen = 0.5 + 0.5 * cos(PI2 * (vec3(0.0, 0.33, 0.67) + k * 0.9 + phase * 0.08));
			vec3 rimCol = mix(u_colors[i], sheen, 0.30) * (0.72 + 0.38 * lit);

			/* Glanzlicht oben links, mit der Blase mitskaliert. */
			float glint = spec(local, vec2(-0.40, -0.45) * r, vec2(0.30, 0.16) * r, 0.6);

			/*
			 * Scheibe: volle Deckkraft, harte Kante, kein Saum und kein Schein. Statt des Fresnel-
			 * Saums nur eine schmale helle Lippe direkt an der Kante — sie trennt zwei gleich satte
			 * Scheiben voneinander, ohne die Flaeche aufzuweichen.
			 */
			float lip = smoothstep(0.93, 1.0, k) * inside;
			vec3 discCol = mix(body, mix(u_colors[i], vec3(1.0), 0.7), lip);

			vec3 orbCol = sharp ? discCol : mix(body, rimCol, rim) + vec3(0.22) * glint * inside * (1.0 - rim);
			float orbAlpha = sharp ? inside * used : clamp(inside * FILL_ALPHA + rim * 0.9, 0.0, 1.0) * used;
			acc = orbCol * orbAlpha + acc * (1.0 - orbAlpha);
			alpha = orbAlpha + alpha * (1.0 - orbAlpha);

			/*
			 * Neon-Schein: ein weicher Hauch der Saeulenfarbe **ausserhalb** der Kante. Er wird
			 * addiert, nicht ueberblendet — Licht legt sich auf den Untergrund, es deckt ihn nicht zu.
			 * Das ist der Unterschied zwischen einer bunten Scheibe und einer leuchtenden Blase — und
			 * genau deshalb bekommt die Scheibe ihn nicht: Ihre Schaerfe ist ihr Stilmittel.
			 */
			float halo = sharp ? 0.0 : exp(-max(k - 1.0, 0.0) * 9.0) * (1.0 - inside) * used;
			acc += u_colors[i] * halo * GLOW;
			alpha = min(1.0, alpha + halo * GLOW);
		}

		/* Soll-Marke als gestrichelter Kreis: Blase innerhalb heisst „kommt zu kurz", ausserhalb
		   „zieht davon". */
		float tr = u_target * rise * beat;
		float mark = (1.0 - smoothstep(0.0, 0.5 + aa, abs(radius - tr)))
			* step(0.45, fract(turn * TARGET_DASHES)) * 0.5;
		acc = u_surface * 0.35 * mark + acc * (1.0 - mark);
		alpha = mark + alpha * (1.0 - mark);
	} else if (u_figure < 1.5) {
		/* ── Ringe: feste Spuren, die Bogenlaenge traegt den Wert ─────────────────────────────── */
		for (int i = 0; i < 8; i++) {
			float used = step(float(i), u_count - 1.0);

			/* Atmen der Spur: die Staerke schwingt leicht, die Lage bleibt — eine Uhr, deren Ringe
			   wandern, koennte man von Tag zu Tag nicht wiedererkennen. */
			float phase = u_phase[i] + PI2 * time / u_swing[i];
			float halfWidth = 0.5 * u_arc_width[i] * (1.0 + 0.10 * sin(phase));
			float band = smoothstep(halfWidth + aa, halfWidth - aa, abs(radius - u_arc_radius[i]));

			/* Winkel-Antialiasing in Umlauf-Anteilen: aussen ist ein Grad mehr Bogen als innen. */
			float aaTurn = aa / max(PI2 * u_arc_radius[i], 0.001);
			float sweep = u_arc_sweep[i] * rise;
			float filled = smoothstep(sweep + aaTurn, sweep - aaTurn, turn);

			/* Unausgefuellte Spur bleibt blass stehen — sie zeigt, wie weit es noch waere. */
			float track = band * ARC_TRACK_ALPHA * used;
			acc = u_colors[i] * track + acc * (1.0 - track);
			alpha = track + alpha * (1.0 - track);

			/* Gefuellter Bogen, zum Kopf hin heller: Das Ende der Strecke ist die Stelle, auf die
			   das Auge zuerst faellt. */
			float head = smoothstep(max(sweep - 0.12, 0.0), sweep, turn) * filled;
			vec3 arcCol = mix(u_colors[i], vec3(1.0), 0.28 * head);
			float arcAlpha = band * filled * used;
			acc = arcCol * arcAlpha + acc * (1.0 - arcAlpha);
			alpha = arcAlpha + alpha * (1.0 - arcAlpha);

			/* Neon-Schein quer zur Spur. */
			float halo = exp(-max(abs(radius - u_arc_radius[i]) - halfWidth, 0.0) / 1.8) * filled * used;
			acc += u_colors[i] * halo * GLOW * 0.5;
			alpha = min(1.0, alpha + halo * GLOW * 0.5);

			/* Soll-Marke: ein Strich quer ueber die Spur an der Stelle, an der die Saeule genau auf
			   ihrem Ziel stuende. */
			float mark = band * (1.0 - smoothstep(0.0, aaTurn + 0.004, abs(turn - u_target * rise))) * used;
			acc = u_surface * mark + acc * (1.0 - mark);
			alpha = mark + alpha * (1.0 - mark);
		}
	} else {
		/* ── Strahlen: feste Winkel, die Laenge traegt den Wert ────────────────────────────────── */
		for (int i = 0; i < 8; i++) {
			float used = step(float(i), u_count - 1.0);

			float phase = u_phase[i] + PI2 * time / u_swing[i];
			float len = u_ray_length[i] * rise * (1.0 + 0.05 * sin(phase));
			float delta = abs(angleDelta(degAngle - 90.0, u_ray_angle[i]));

			/*
			 * Der Strahl laeuft nach aussen spitz zu: Innen traegt er seine volle Oeffnung, an der
			 * Spitze nur noch ein Drittel. Das macht aus einem Tortenstueck einen Lichtstrahl.
			 */
			float taper = mix(1.0, 0.34, clamp(radius / max(len, 0.001), 0.0, 1.0));
			float spread = u_ray_spread[i] * taper;
			float aaDeg = degrees(aa / max(radius, 0.5));
			float across = smoothstep(spread + aaDeg, spread - aaDeg, delta);
			float along = smoothstep(len + aa, len - aa, radius) * smoothstep(0.0, 2.0, radius);
			float body = across * along * used;

			/* Ein Lichtpuls laeuft nach aussen — das ist die Bewegung, die einen Strahl ausmacht. */
			float pulse = 0.5 + 0.5 * sin(radius * 0.45 - time * 1.6 + u_phase[i]);
			vec3 rayCol = mix(u_colors[i], vec3(1.0), 0.30 * pulse);

			float rayAlpha = body * 0.85;
			acc = rayCol * rayAlpha + acc * (1.0 - rayAlpha);
			alpha = rayAlpha + alpha * (1.0 - rayAlpha);

			/* Neon-Schein quer zum Strahl. */
			float halo = exp(-max(delta - spread, 0.0) / 6.0) * along * used;
			acc += u_colors[i] * halo * GLOW * 0.6;
			alpha = min(1.0, alpha + halo * GLOW * 0.6);
		}

		/* Soll-Marke als gestrichelter Kreis quer ueber alle Strahlen. */
		float tr = u_target * rise;
		float mark = (1.0 - smoothstep(0.0, 0.5 + aa, abs(radius - tr)))
			* step(0.45, fract(turn * TARGET_DASHES)) * 0.5;
		acc = u_surface * 0.35 * mark + acc * (1.0 - mark);
		alpha = mark + alpha * (1.0 - mark);
	}

	/*
	 * Zifferblatt: 100 Striche ab 12 Uhr im Uhrzeigersinn. Gesucht wird der naechstgelegene Strich
	 * und der Abstand zu seiner Mittellinie — in Bogenlaenge, damit die Striche aussen nicht
	 * auffaechern.
	 */
	float slot = degAngle / TICK_STEP;
	float index = mod(floor(slot + 0.5), 100.0);
	float major = 1.0 - step(0.5, mod(index, 10.0));

	float across = abs(radians((slot - floor(slot + 0.5)) * TICK_STEP)) * radius;
	float halfWidth = mix(0.55, 0.9, major);
	float outer = RING_INNER + mix(TICK_LENGTH, TICK_LENGTH_MAJOR, major);
	float tick = smoothstep(halfWidth + aa, halfWidth - aa, across)
		* smoothstep(RING_INNER - aa, RING_INNER + aa, radius)
		* smoothstep(outer + aa, outer - aa, radius);

	/* Leuchtend bis zum Wert, danach dieselbe Farbe stark abgedunkelt: Die Skala bleibt sichtbar,
	   der Stand liest sich als Bogenlaenge. */
	float on = step(index + 0.5, u_ring_active * rise);
	vec3 tickCol = ringColor(index);
	float tickAlpha = tick * mix(0.22, 1.0, on);

	/* Schwacher Schein um die leuchtenden Striche — nur aussen, damit er die Figur nicht antastet. */
	float glow = exp(-max(abs(radius - (RING_INNER + 2.5)) - 2.5, 0.0) / 2.2) * on * 0.10
		* smoothstep(RING_INNER - 3.0, RING_INNER + 1.0, radius);

	acc = tickCol * tickAlpha + acc * (1.0 - tickAlpha) + tickCol * glow;
	alpha = tickAlpha + alpha * (1.0 - tickAlpha) + glow;

	gl_FragColor = vec4(acc, clamp(alpha, 0.0, 1.0));
}
