import { useEffect, useRef } from 'react';
import fragmentSource from './heart-glass.frag?raw';

/**
 * Das Herz der Startseite als **Glasgefäß in WebGL** — die flüssige Schwester des SVG in
 * `HeartBalance.tsx`. Kontur, Füllstand, Farbstreifen, Welle und Aufstieg folgen exakt demselben
 * Bildauftrag wie das SVG (siehe dort); das Shader-Programm `heart-glass.frag` fügt nur das
 * Material hinzu: Fresnel-Saum, Glanzlichter, Meniskus, Brechung an der Wand.
 *
 * **Warum WebGL und trotzdem kein Framework:** Der Effekt ist ein einziges gebundenes Dreieck —
 * three.js (~600 kB) wäre Wartungslast ohne Gegenwert. Der Shader ist bewusst GLSL ES 1.00
 * gehalten (kein `#version`, `gl_FragColor`): derselbe Quelltext läuft im Preview-Viewer (WebGL1)
 * und im WebGL2-Kontext hier.
 *
 * **Kosten-Rahmen (GPU-Floor):** DPR auf 2 geklemmt (gebundene Fläche), die Render-Loop stoppt
 * vollständig, wenn nichts zu tun ist — ohne Animation, außerhalb des Viewports oder bei
 * verstecktem Tab. `prefers-reduced-motion` und beide Animationsschalter wirken über `animated`
 * (still: Standbild in Grundform, wie die Still-Klasse des SVG). Der Puls bleibt CSS auf der
 * Bühne (`heart-balance-stage`) — der Shader skaliert nicht selbst.
 *
 * **Fallback ist das SVG:** WebGL2 fehlt oder fällt endgültig aus → die Bühne zeigt weiter das
 * bekannte Bild. Alles, was die Seite *sagt* (Zahl, Zustand, Legende), steht ohnehin als DOM
 * neben der Grafik.
 */

/** Ein Farbstreifen unter der Wasserlinie, aus `HeartBalance` (Spannen in Nutzereinheiten). */
export interface GlassBand {
	pillarId: number;
	colorIndex: number;
	x0: number;
	x1: number;
}

interface HeartGlassProps {
	/** Füllstand des Herzens (0–1), derselbe Wert wie die große Prozentzahl. */
	fill: number;
	/** Farbstreifen je Säule in Anzeigereihenfolge. */
	bands: GlassBand[];
	/** Wellen-Drift und Aufstieg erlauben (beide Animationsschalter + OS-Einstellung). */
	animated: boolean;
	/** Zugängliches Label der Grafik (dieselbe Formel wie das SVG-`aria-label`). */
	ariaLabel: string;
	/** Wird gerufen, wenn WebGL nicht aufgebaut werden kann — die Bühne fällt aufs SVG zurück. */
	onGiveUp: () => void;
}

/** Ein Fullscreen-Dreieck — die ganze Zeichnung leistet der Fragment-Shader. */
const VERTEX_SOURCE = ['attribute vec2 a_pos;', 'void main() {', '	gl_Position = vec4(a_pos, 0.0, 1.0);', '}'].join(
	'\n',
);

/** `GLASS_APP` schaltet den Shader von den Preview-Konstanten auf die Theme-Uniforms um. */
const FRAGMENT_SOURCE = `#define GLASS_APP 1\n${fragmentSource}`;

/** Wellen- und Aufstieg-Konstanten wie im SVG (`WAVE_LENGTH`, `WAVE_AMPLITUDE`, Drift 7 s). */
const WAVE_LENGTH = 16;
const WAVE_AMPLITUDE = 3;
const WAVE_DRIFT_DURATION = 7;
const RISE_DURATION = 1.4;

/** Zahl der Band-Uniforms im Shader — Streifen darüber laufen im letzten (neutralen) zusammen. */
const BAND_SLOTS = 8;
/** Höchster Rang der Säulen-Rampe (`--pp-pillar-1…8`) — wie `PILLAR_RAMP_SIZE` im SVG. */
const PILLAR_RAMP_SIZE = 8;

/** Liest eine CSS-Farbe (`#rgb`, `#rrggbb`, `rgb()`) als 0–1-Vektor; unlesbar bleibt schwarz. */
const parseColor = (value: string): [number, number, number] => {
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

/** Theme-Farben aus den CSS-Rollen lesen — dieselben Variablen, die das SVG füllen. */
const readThemeColors = () => {
	const style = getComputedStyle(document.documentElement);
	const read = (name: string): [number, number, number] => parseColor(style.getPropertyValue(name));
	return {
		pillars: Array.from({ length: PILLAR_RAMP_SIZE }, (_, index) => read(`--pp-pillar-${index + 1}`)),
		vessel: read('--pp-surface-2'),
		outline: read('--pp-border-strong'),
		// Fugen wie das SVG in Kartenfarbe; ab der 9. Säule färbt die Kontur-Farbe neutral.
		seam: read('--pp-surface-1'),
		neutral: read('--pp-border-strong'),
	};
};

type ThemeColors = ReturnType<typeof readThemeColors>;

/** Shader-seitige Bandliste: Farbe plus rechte Kante als Anteil der Herzbreite (0–1). */
interface SlotBand {
	color: [number, number, number];
	edge: number;
}

/**
 * Streifen auf die Shader-Slots abbilden: Die ersten 7 behalten Farbe und Breite; läuft die Liste
 * über 8 hinaus (mehr Säulen als Uniform-Slots), läuft der Rest im letzten Slot **neutral**
 * zusammen — wie das SVG, das ab der 9. Säule ohnehin nicht mehr einfärbt.
 */
const toSlotBands = (bands: GlassBand[], colors: ThemeColors): SlotBand[] => {
	if (bands.length <= BAND_SLOTS) {
		return bands.map((band) => ({
			color: band.colorIndex < PILLAR_RAMP_SIZE ? colors.pillars[band.colorIndex] : colors.neutral,
			edge: Math.max(0, Math.min(1, (band.x1 - 4) / 92)),
		}));
	}
	const head = bands.slice(0, BAND_SLOTS - 1).map((band) => ({
		color: band.colorIndex < PILLAR_RAMP_SIZE ? colors.pillars[band.colorIndex] : colors.neutral,
		edge: Math.max(0, Math.min(1, (band.x1 - 4) / 92)),
	}));
	return [...head, { color: colors.neutral, edge: 1 }];
};

interface GlassEngine {
	/** Uniforms neu setzen (Füllstand/Streifen/Theme) und ggf. ein Standbild zeichnen. */
	update: (fill: number, bands: GlassBand[], colors: ThemeColors) => void;
	/** Render-Loop-Politik neu bewerten (Animation an/aus). */
	setLooping: (animated: boolean) => void;
	/** GPU-Ressourcen freigeben — gehört zum Effect-Cleanup dazu. */
	destroy: () => void;
}

/**
 * Baut den WebGL-Zustand auf. Wirft bei jedem Problem (kein Kontext, Compile-Fehler) — der Aufrufer
 * fängt und fällt auf das SVG zurück. So bleibt der Erfolgspfad frei von Sonderfällen.
 */
const createEngine = (canvas: HTMLCanvasElement): GlassEngine => {
	const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
	if (!gl) throw new Error('WebGL2 nicht verfügbar');

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
	gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SOURCE));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) ?? 'Programm-Verknüpfung fehlgeschlagen');
	}
	gl.useProgram(program);

	const buffer = gl.createBuffer();
	if (!buffer) throw new Error('Buffer-Objekt nicht verfügbar');
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const attribute = gl.getAttribLocation(program, 'a_pos');
	gl.enableVertexAttribArray(attribute);
	gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

	const uniform = (name: string): WebGLUniformLocation | null => gl.getUniformLocation(program, name);
	const locations = {
		resolution: uniform('u_resolution'),
		time: uniform('u_time'),
		fill: uniform('u_fill'),
		animated: uniform('u_animated'),
		riseDuration: uniform('u_rise_duration'),
		waveLength: uniform('u_wave_length'),
		waveAmplitude: uniform('u_wave_amplitude'),
		waveDuration: uniform('u_wave_duration'),
		bandColors: uniform('u_band_colors[0]'),
		bandEdges: uniform('u_band_edges[0]'),
		bandCount: uniform('u_band_count'),
		vessel: uniform('u_vessel'),
		outline: uniform('u_outline'),
		seam: uniform('u_seam'),
	};

	gl.uniform1f(locations.riseDuration, RISE_DURATION);
	gl.uniform1f(locations.waveLength, WAVE_LENGTH);
	gl.uniform1f(locations.waveAmplitude, WAVE_AMPLITUDE);
	gl.uniform1f(locations.waveDuration, WAVE_DRIFT_DURATION);

	/*
	 * Größe nur bei echter Änderung schreiben: Jedes Schreiben von `canvas.width` leert den
	 * Zeichenbuffer — ungefiltert bei jedem Resize ein Flackern, etwa beim Scrollbalken.
	 */
	let backingWidth = 0;
	let backingHeight = 0;
	const resize = (): void => {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
		const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
		if (width === backingWidth && height === backingHeight) return;
		backingWidth = width;
		backingHeight = height;
		canvas.width = width;
		canvas.height = height;
		gl.viewport(0, 0, width, height);
		gl.uniform2f(locations.resolution, width, height);
	};

	/*
	 * Selbst-stoppende Render-Maschine: Sie läuft nur, solange die Welle sich bewegen darf und das
	 * Herz sichtbar ist — sonst genau ein Standbild je Zustandswechsel. Die Shader-Uhr zählt nur
	 * gelaufene Sekunden (kein Nachspringen nach der Pause), Zeitschritte sind auf 1/30 s geklemmt.
	 */
	let shaderTime = 0;
	let lastFrame = 0;
	let frameRequest = 0;
	let looping = false;
	let animated = false;
	let visible = true;
	let pageVisible = !document.hidden;

	const draw = (): void => {
		const w = window as unknown as { __heartDraws?: number; __heartTime?: number };
		w.__heartDraws = (w.__heartDraws ?? 0) + 1;
		w.__heartTime = shaderTime;
		resize();
		gl.uniform1f(locations.time, shaderTime);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	};

	const frame = (now: number): void => {
		if (lastFrame > 0) shaderTime += Math.min((now - lastFrame) / 1000, 1 / 30);
		lastFrame = now;
		draw();
		frameRequest = looping ? requestAnimationFrame(frame) : 0;
	};

	const ensureLoop = (): void => {
		const shouldLoop = animated && visible && pageVisible;
		if (shouldLoop === looping) return;
		looping = shouldLoop;
		if (shouldLoop) {
			lastFrame = 0; // Kein Aufholen nach der Pause — die Welle läuft dort weiter, wo sie stand.
			frameRequest = requestAnimationFrame(frame);
		} else {
			if (frameRequest) cancelAnimationFrame(frameRequest);
			frameRequest = 0;
			draw(); // Standbild des letzten Zustands.
		}
	};

	const update = (fill: number, bands: GlassBand[], colors: ThemeColors): void => {
		gl.uniform1f(locations.fill, fill);
		gl.uniform1i(locations.animated, animated ? 1 : 0);
		const slots = toSlotBands(bands, colors);
		gl.uniform1f(locations.bandCount, slots.length);
		const bandColors = new Float32Array(BAND_SLOTS * 3);
		const bandEdges = new Float32Array(BAND_SLOTS);
		slots.forEach((slot, index) => {
			bandColors.set(slot.color, index * 3);
			bandEdges[index] = slot.edge;
		});
		bandEdges.fill(1, slots.length); // Unbenutzte Plätze unschädlich hinter dem letzten Band.
		gl.uniform3fv(locations.bandColors, bandColors);
		gl.uniform1fv(locations.bandEdges, bandEdges);
		gl.uniform3fv(locations.vessel, colors.vessel);
		gl.uniform3fv(locations.outline, colors.outline);
		gl.uniform3fv(locations.seam, colors.seam);
		if (!looping) draw();
	};

	// Pause, wenn das Herz den Viewport verlässt oder der Tab versteckt wird.
	const intersectionObserver = new IntersectionObserver(
		(entries) => {
			visible = entries.some((entry) => entry.isIntersecting);
			ensureLoop();
		},
		{ rootMargin: '10% 0px' },
	);
	intersectionObserver.observe(canvas);

	const onVisibility = (): void => {
		pageVisible = !document.hidden;
		ensureLoop();
	};
	document.addEventListener('visibilitychange', onVisibility);

	const resizeObserver = new ResizeObserver(() => {
		if (!looping) draw();
	});
	resizeObserver.observe(canvas);

	const destroy = (): void => {
		if (frameRequest) cancelAnimationFrame(frameRequest);
		intersectionObserver.disconnect();
		resizeObserver.disconnect();
		document.removeEventListener('visibilitychange', onVisibility);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		// Bewusst KEIN `WEBGL_lose_context.loseContext()`: React (StrictMode, HMR) mounted die
		// Komponente erneut auf demselben Canvas — `getContext` liefert dann denselben, bereits
		// getöteten Kontext und jedes Kompilieren scheitert still. Der Kontext lebt mit dem
		// Canvas-Element; Programm und Buffer werden oben explizit freigegeben.
	};

	const debug = {
		gl,
		program,
		locations,
		get time() {
			return shaderTime;
		},
		get animated() {
			return animated;
		},
	};
	(window as unknown as { __heartDebug?: unknown }).__heartDebug = debug;
	return {
		update,
		setLooping: (next) => {
			animated = next;
			gl.uniform1i(locations.animated, next ? 1 : 0);
			ensureLoop();
		},
		destroy,
	};
};

export const HeartGlass = ({ fill, bands, animated, ariaLabel, onGiveUp }: HeartGlassProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<GlassEngine | null>(null);
	// Letzter Datenstand — nach einer Kontext-Wiederherstellung neu in den neuen Zustand spielen.
	const stateRef = useRef({ fill, bands, animated });

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		/*
		 * Kontextverlust explizit abfangen: Ohne `preventDefault` zerstört der Browser den Kontext
		 * endgültig; mit ihm folgt `webglcontextrestored` — dann wird hier neu aufgebaut und der
		 * letzte Datenstand eingespielt. Scheitert der Neuaufbau, gibt die Komponente auf.
		 */
		const onLost = (event: Event): void => {
			event.preventDefault();
			engineRef.current?.destroy();
			engineRef.current = null;
		};
		const onRestored = (): void => {
			try {
				const engine = createEngine(canvas);
				engineRef.current = engine;
				const { fill: lastFill, bands: lastBands, animated: lastAnimated } = stateRef.current;
				engine.update(lastFill, lastBands, readThemeColors());
				engine.setLooping(lastAnimated);
			} catch {
				onGiveUp();
			}
		};
		canvas.addEventListener('webglcontextlost', onLost);
		canvas.addEventListener('webglcontextrestored', onRestored);

		try {
			engineRef.current = createEngine(canvas);
		} catch {
			onGiveUp();
			return;
		}
		return () => {
			canvas.removeEventListener('webglcontextlost', onLost);
			canvas.removeEventListener('webglcontextrestored', onRestored);
			engineRef.current?.destroy();
			engineRef.current = null;
		};
		// onGiveUp ist bewusst stabil zu halten (useState-Setter der Bühne) — sonst Neuaufbau je Render.
	}, [onGiveUp]);

	// Daten und Theme in die Uniforms — bei laufender Loop greift der nächste Frame, sonst Standbild.
	useEffect(() => {
		stateRef.current = { fill, bands, animated };
		engineRef.current?.update(fill, bands, readThemeColors());
	}, [fill, bands, animated]);

	// Loop-Politik folgt dem Animationsschalter (eigener Effekt: Wechsel ohne Datenänderung).
	useEffect(() => {
		engineRef.current?.setLooping(animated);
	}, [animated]);

	return (
		<canvas
			ref={canvasRef}
			className="heart-glass-canvas"
			role="img"
			aria-label={ariaLabel}
			data-testid="heart-balance-canvas"
		/>
	);
};
