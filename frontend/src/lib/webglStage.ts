import {
	buildArcs,
	buildHands,
	buildOrbits,
	buildOrbs,
	buildPetals,
	buildRays,
	buildWedges,
	targetRadius,
	type FigureMotion,
} from './balanceFigure';
import type { BalanceMetrics } from './balanceMetric';
import type { FigureKind } from './balanceVariant';
import { PILLAR_RAMP_SIZE } from './pillarRamp';

/**
 * Das geteilte WebGL-Gerüst der beiden Zifferblatt-Figuren (`BalanceFigureGL`, `HeartGlass`):
 * WebGL2-Kontext, Programm-Aufbau mit Compile-/Link-Prüfung, Fullscreen-Dreieck, Uniform-Helfer,
 * Resize mit Backing-Größen-Guard und die Farb-Packing-Routinen. Was die Figuren unterscheidet —
 * Kontextoptionen, Shader-Quellen, Uniforms, Zeichenroutine — bleibt je Komponente.
 */

type Rgb = [number, number, number];

/** Liest eine CSS-Farbe (`#rgb`, `#rrggbb`, `rgb()`) als 0–1-Vektor; unlesbar bleibt schwarz. */
export const parseColor = (value: string): Rgb => {
	const text = value.trim();
	const hex = /^#([0-9a-f]{3})$/i.exec(text) ?? /^#([0-9a-f]{6})$/i.exec(text);
	if (hex) {
		const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1];
		return [
			parseInt(digits.slice(0, 2), 16) / 255,
			parseInt(digits.slice(2, 4), 16) / 255,
			parseInt(digits.slice(4, 6), 16) / 255,
		];
	}
	const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(text);
	if (rgb) {
		return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
	}
	return [0, 0, 0];
};

/** Ein Fullscreen-Dreieck — die ganze Zeichnung leistet der Fragment-Shader. */
const VERTEX_SOURCE = ['attribute vec2 a_pos;', 'void main() {', '	gl_Position = vec4(a_pos, 0.0, 1.0);', '}'].join(
	'\n',
);

/** Zahl der Uniform-Plätze je Säule — weitere Säulen laufen im letzten (neutralen) zusammen. */
export const SLOTS = 8;

/** Zahl der Band-Uniforms im Glas-Herzen — Streifen darüber laufen im letzten (neutralen) zusammen. */
export const BAND_SLOTS = 8;

/**
 * Holt den WebGL2-Kontext mit den Optionen der Figur (z. B. `premultipliedAlpha`). Wirft, wenn der
 * Browser ihn nicht anbietet — der Aufrufer fängt und fällt auf das SVG zurück.
 */
export const createWebGLContext = (
	canvas: HTMLCanvasElement,
	options: WebGLContextAttributes,
): WebGL2RenderingContext => {
	const gl = canvas.getContext('webgl2', options);
	if (!gl) throw new Error('WebGL2 nicht verfügbar');
	return gl;
};

/**
 * Baut das Shader-Programm auf — Vertex-Quelle ist fest das geteilte Fullscreen-Dreieck, die
 * Fragment-Quelle kommt je Figur. Wirft bei jedem Problem (Compile-Fehler, Link-Fehler); der
 * Aufrufer fängt und fällt auf das SVG zurück. So bleibt der Erfolgspfad frei von Sonderfällen.
 */
export const buildProgram = (gl: WebGL2RenderingContext, fragmentSource: string): WebGLProgram => {
	const compile = (type: number, source: string): WebGLShader => {
		const shader = gl.createShader(type);
		if (!shader) throw new Error('Shader-Objekt nicht verfügbar');
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			throw new Error(gl.getShaderInfoLog(shader) || 'Shader-Kompilierung fehlgeschlagen');
		}
		return shader;
	};

	const program = gl.createProgram();
	if (!program) throw new Error('Programm-Objekt nicht verfügbar');
	gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SOURCE));
	gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) ?? 'Programm-Verknüpfung fehlgeschlagen');
	}
	return program;
};

/** Legt den Fullscreen-Dreieck-Puffer an und bindet das `a_pos`-Attribut des Programms.
 *  Der Buffer wird zurückgegeben, damit der Aufrufer ihn im Cleanup freigeben kann. */
export const bindFullscreenTriangle = (gl: WebGL2RenderingContext, program: WebGLProgram): WebGLBuffer => {
	const buffer = gl.createBuffer();
	if (!buffer) throw new Error('Buffer-Objekt nicht verfügbar');
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const attribute = gl.getAttribLocation(program, 'a_pos');
	gl.enableVertexAttribArray(attribute);
	gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
	return buffer;
};

/** Uniform-Helfer: löst die Ortsnamen der Programm-Uniforms auf. */
export const createUniform = (
	gl: WebGL2RenderingContext,
	program: WebGLProgram,
): ((name: string) => WebGLUniformLocation | null) => {
	return (name) => gl.getUniformLocation(program, name);
};

/*
 * Größe nur bei echter Änderung schreiben: Jedes Schreiben von `canvas.width` leert den
 * Zeichenbuffer — ungefiltert bei jedem Resize ein Flackern, etwa beim Scrollbalken.
 */
export const createResize = (
	gl: WebGL2RenderingContext,
	canvas: HTMLCanvasElement,
	resolution: WebGLUniformLocation | null,
): (() => void) => {
	let backingWidth = 0;
	let backingHeight = 0;
	return (): void => {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
		const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
		if (width === backingWidth && height === backingHeight) return;
		backingWidth = width;
		backingHeight = height;
		canvas.width = width;
		canvas.height = height;
		gl.viewport(0, 0, width, height);
		gl.uniform2f(resolution, width, height);
	};
};

/**
 * Packt die Formen einer Figur auf die acht Uniform-Plätze. Gibt es mehr Säulen als Plätze, werden
 * die **hinteren** abgeschnitten: Bei den Blasen ist die Liste groß → klein sortiert, ein Stapel
 * ohne seine größten Blasen wäre keine Aussage mehr; bei Ringen und Strahlen entscheidet die
 * Anzeigereihenfolge, und dort sind die ersten Säulen die, die der Nutzer zuerst sehen will.
 */
export const toSlots = (
	state: { figure: FigureKind; metrics: BalanceMetrics },
	colors: { pillars: Rgb[]; neutral: Rgb },
): {
	colors: Rgb[];
	motions: FigureMotion[];
	orbRadius: number[];
	arcRadius: number[];
	arcWidth: number[];
	arcSweep: number[];
	rayAngle: number[];
	raySpread: number[];
	rayLength: number[];
	wedgeMid: number[];
	wedgeHalf: number[];
	wedgeInner: number[];
	wedgeOuter: number[];
	target: number;
} => {
	const colorOf = (colorIndex: number): Rgb =>
		colorIndex < PILLAR_RAMP_SIZE ? colors.pillars[colorIndex] : colors.neutral;

	if (state.figure === 'ringe') {
		const arcs = buildArcs(state.metrics).slice(0, SLOTS);
		return {
			colors: arcs.map((arc) => colorOf(arc.colorIndex)),
			motions: arcs,
			orbRadius: [],
			arcRadius: arcs.map((arc) => arc.radius),
			arcWidth: arcs.map((arc) => arc.width),
			arcSweep: arcs.map((arc) => arc.sweep),
			rayAngle: [],
			raySpread: [],
			rayLength: [],
			wedgeMid: [],
			wedgeHalf: [],
			wedgeInner: [],
			wedgeOuter: [],
			target: arcs[0]?.target ?? 0,
		};
	}
	if (state.figure === 'strahlen') {
		const rays = buildRays(state.metrics).slice(0, SLOTS);
		return {
			colors: rays.map((ray) => colorOf(ray.colorIndex)),
			motions: rays,
			orbRadius: [],
			arcRadius: [],
			arcWidth: [],
			arcSweep: [],
			rayAngle: rays.map((ray) => ray.angle),
			raySpread: rays.map((ray) => ray.spread),
			rayLength: rays.map((ray) => ray.length),
			wedgeMid: [],
			wedgeHalf: [],
			wedgeInner: [],
			wedgeOuter: [],
			target: rays[0]?.targetLength ?? 0,
		};
	}
	// Blüte und Kristall teilen sich die Stützpunkte der Silhouette — Winkel und Radius belegen
	// dieselben Plätze wie die Strahlen (Mittelwinkel und Länge); nur ihr Material trennt sie.
	if (state.figure === 'bluete' || state.figure === 'kristall') {
		const petals = buildPetals(state.metrics).slice(0, SLOTS);
		return {
			colors: petals.map((petal) => colorOf(petal.colorIndex)),
			motions: petals,
			orbRadius: [],
			arcRadius: [],
			arcWidth: [],
			arcSweep: [],
			rayAngle: petals.map((petal) => petal.angle),
			raySpread: [],
			rayLength: petals.map((petal) => petal.radius),
			wedgeMid: [],
			wedgeHalf: [],
			wedgeInner: [],
			wedgeOuter: [],
			target: targetRadius(state.metrics),
		};
	}
	// Zeiger belegen die Strahlen-Plätze mit ihrer eigenen, schmaleren Geometrie.
	if (state.figure === 'zeiger') {
		const hands = buildHands(state.metrics).slice(0, SLOTS);
		return {
			colors: hands.map((hand) => colorOf(hand.colorIndex)),
			motions: hands,
			orbRadius: [],
			arcRadius: [],
			arcWidth: [],
			arcSweep: [],
			rayAngle: hands.map((hand) => hand.angle),
			raySpread: hands.map((hand) => hand.spread),
			rayLength: hands.map((hand) => hand.length),
			wedgeMid: [],
			wedgeHalf: [],
			wedgeInner: [],
			wedgeOuter: [],
			target: hands[0]?.targetLength ?? 0,
		};
	}
	// Bahnen, Meteore und Pendel teilen sich die Bahn-Geometrie — Winkel und große Halbachse auf
	// den Strahlen-Plätzen; welche Bewegung der Komet nimmt, wählt der Shader über `u_figure`.
	if (state.figure === 'bahnen' || state.figure === 'meteore' || state.figure === 'pendel') {
		const orbits = buildOrbits(state.metrics).slice(0, SLOTS);
		return {
			colors: orbits.map((orbit) => colorOf(orbit.colorIndex)),
			motions: orbits,
			orbRadius: [],
			arcRadius: [],
			arcWidth: [],
			arcSweep: [],
			rayAngle: orbits.map((orbit) => orbit.angle),
			raySpread: [],
			rayLength: orbits.map((orbit) => orbit.radius),
			wedgeMid: [],
			wedgeHalf: [],
			wedgeInner: [],
			wedgeOuter: [],
			target: targetRadius(state.metrics),
		};
	}
	// Segmente: Tortengrafik der Ist-Anteile auf eigenen Uniform-Plätzen.
	if (state.figure === 'segmente') {
		const wedges = buildWedges(state.metrics).slice(0, SLOTS);
		return {
			colors: wedges.map((wedge) => colorOf(wedge.colorIndex)),
			motions: wedges,
			orbRadius: [],
			arcRadius: [],
			arcWidth: [],
			arcSweep: [],
			rayAngle: [],
			raySpread: [],
			rayLength: [],
			wedgeMid: wedges.map((wedge) => wedge.angle),
			wedgeHalf: wedges.map((wedge) => (wedge.end - wedge.start) / 2),
			wedgeInner: wedges.map((wedge) => wedge.inner),
			wedgeOuter: wedges.map((wedge) => wedge.outer),
			target: wedges[0]?.targetRadius ?? 0,
		};
	}
	// Blasen und Scheiben teilen sich die Geometrie — nur ihr Material trennt sie (siehe Shader).
	const orbs = buildOrbs(state.metrics).slice(0, SLOTS);
	return {
		colors: orbs.map((orb) => colorOf(orb.colorIndex)),
		motions: orbs,
		orbRadius: orbs.map((orb) => orb.radius),
		arcRadius: [],
		arcWidth: [],
		arcSweep: [],
		rayAngle: [],
		raySpread: [],
		rayLength: [],
		wedgeMid: [],
		wedgeHalf: [],
		wedgeInner: [],
		wedgeOuter: [],
		target: targetRadius(state.metrics),
	};
};

/** Shader-seitige Bandliste: Farbe plus **linke** Kante als Anteil der sichtbaren Herzbreite (0–1).
 *  Der Shader wechselt an `u_band_edges[i]` zur Farbe i (`bandColorAt`) — Kante i ist die Grenze,
 *  ab der Farbe i gilt; die Fläche bis zur nächsten Kante (bzw. bis 1.0 beim letzten) bleibt bei i. */
interface SlotBand {
	color: Rgb;
	edge: number;
}

/**
 * Streifen auf die Shader-Slots abbilden: Jede Kante liegt auf der **linken** Kante ihres Bandes
 * (`x0`, normiert auf die sichtbare Breite x 4–96) — der Shader beginnt Farbe i genau dort. Die
 * ersten 7 behalten Farbe; läuft die Liste über 8 hinaus (mehr Säulen als Uniform-Slots), läuft
 * der Rest ab der linken Kante des 8. Bandes im letzten Slot **neutral** zusammen — wie das SVG,
 * das ab der 8. Säule ohnehin nicht mehr einfärbt. Das letzte Band behält so seine Fläche bis 1.0.
 */
export const toSlotBands = (
	bands: { colorIndex: number; x0: number }[],
	colors: { pillars: Rgb[]; neutral: Rgb },
): SlotBand[] => {
	const edge = (band: { x0: number }): number => Math.max(0, Math.min(1, (band.x0 - 4) / 92));
	const colorOf = (band: { colorIndex: number }): Rgb =>
		band.colorIndex < PILLAR_RAMP_SIZE ? colors.pillars[band.colorIndex] : colors.neutral;
	if (bands.length <= BAND_SLOTS) {
		return bands.map((band) => ({ color: colorOf(band), edge: edge(band) }));
	}
	const head = bands.slice(0, BAND_SLOTS - 1).map((band) => ({ color: colorOf(band), edge: edge(band) }));
	return [...head, { color: colors.neutral, edge: edge(bands[BAND_SLOTS - 1]) }];
};
