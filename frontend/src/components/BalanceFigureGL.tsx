import { useEffect, useRef } from 'react';
import fragmentSource from './balance-figure.frag?raw';
import { buildArcs, buildOrbs, buildRays, RISE_DURATION, targetRadius, type FigureMotion } from '../lib/balanceFigure';
import type { BalanceMetrics } from '../lib/balanceMetric';
import type { FigureKind } from '../lib/balanceVariant';
import { PILLAR_RAMP_SIZE } from '../lib/pillarRamp';

/**
 * Die Balance-Figuren als **WebGL-Bild** — die leuchtende Schwester des SVG in `BalanceFigure.tsx`.
 * Geometrie, Reihenfolge, Bewegung und Zifferblatt folgen exakt demselben Bildauftrag (siehe dort
 * und `lib/balanceFigure.ts`); das Shader-Programm `balance-figure.frag` fügt nur das Material
 * hinzu: Fresnel-Saum, irisierende Seifenhaut, Glanzlicht, Neon-Schein, Lichtpuls.
 *
 * **Warum WebGL und trotzdem kein Framework:** Der Effekt ist ein einziges gebundenes Dreieck —
 * three.js (~600 kB) wäre Wartungslast ohne Gegenwert. Der Shader ist bewusst GLSL ES 1.00
 * gehalten (kein `#version`, `gl_FragColor`), läuft also in WebGL1- wie WebGL2-Kontexten.
 *
 * **Warum ein Programm für drei Figuren:** Sie zeigen dieselben Zahlen und teilen sich Zifferblatt,
 * Auftakt, Ruhepuls und Material. Drei Programme wären dreimal dieselbe Umgebung mit drei
 * Gelegenheiten, auseinanderzulaufen; die Figur ist deshalb ein Uniform (`u_figure`).
 *
 * **Kosten-Rahmen (GPU-Floor):** DPR auf 2 geklemmt (gebundene Fläche), die Render-Loop stoppt
 * vollständig, wenn nichts zu tun ist — ohne Animation, außerhalb des Viewports oder bei
 * verstecktem Tab. `prefers-reduced-motion` und beide Animationsschalter wirken über `animated`
 * (still: Standbild in Grundform, wie die Still-Klasse des SVG).
 *
 * **Fallback ist das SVG:** WebGL fehlt oder fällt endgültig aus → die Bühne zeigt dasselbe Bild
 * ohne Material. Alles, was die Seite *sagt* (Zahl, Zustand, Legende), steht ohnehin als DOM neben
 * der Grafik.
 */

interface BalanceFigureGLProps {
	/** Welche der drei Figuren gezeichnet wird. */
	figure: FigureKind;
	/** Die Kennzahlen je Säule plus die Soll-Marke. */
	metrics: BalanceMetrics;
	/** Zahl der leuchtenden Striche (0–100) — dieselbe Zahl wie die große Prozentanzeige. */
	activeTicks: number;
	/** Sekunden je Ruhepuls-Schlag; ruhiger, je ausgewogener das Bild. */
	beatSeconds: number;
	/** Bewegung erlauben (beide Animationsschalter + OS-Einstellung). */
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

/** Stärke des Kontaktschattens unter jeder Blase (0–0.3). */
const SHADOW_STRENGTH = 0.06;

/** Zahl der Uniform-Plätze je Säule — weitere Säulen laufen im letzten (neutralen) zusammen. */
const SLOTS = 8;

/** Reihenfolge der Figuren im Shader (`u_figure`). */
const FIGURE_INDEX: Record<FigureKind, number> = { blasen: 0, ringe: 1, strahlen: 2, scheiben: 3 };

/** Stützstellen der Ring-Farbrampe in `app.css` (`--pp-balance-ring-0` … `-100`). */
const RING_STOPS = [0, 25, 50, 75, 100] as const;

type Rgb = [number, number, number];

/** Liest eine CSS-Farbe (`#rgb`, `#rrggbb`, `rgb()`) als 0–1-Vektor; unlesbar bleibt schwarz. */
const parseColor = (value: string): Rgb => {
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

/**
 * Theme-Farben aus den CSS-Rollen lesen — dieselben Variablen, die das SVG einfärbt. Die Figuren
 * nehmen die **Neon**-Rampe (`--pp-pillar-neon-*`); die kontrastgeprüfte Lese-Rampe bleibt dem
 * Farbtupfer der Legende vorbehalten (Relief-Regel, ux-design.md §2, Regel 4).
 */
const readThemeColors = () => {
	const style = getComputedStyle(document.documentElement);
	const read = (name: string): Rgb => parseColor(style.getPropertyValue(name));
	return {
		pillars: Array.from({ length: PILLAR_RAMP_SIZE }, (_, index) => read(`--pp-pillar-neon-${index + 1}`)),
		ring: RING_STOPS.map((stop) => read(`--pp-balance-ring-${stop}`)),
		surface: read('--pp-surface-1'),
		// Ab der 8. Säule wird nicht weiter eingefärbt (ux-design.md §2, Regel 3).
		neutral: read('--pp-border-strong'),
	};
};

type ThemeColors = ReturnType<typeof readThemeColors>;

/** Alles, was der Shader je Datenstand braucht. */
interface FigureState {
	figure: FigureKind;
	metrics: BalanceMetrics;
	activeTicks: number;
	beatSeconds: number;
}

/**
 * Packt die Formen einer Figur auf die acht Uniform-Plätze. Gibt es mehr Säulen als Plätze, werden
 * die **hinteren** abgeschnitten: Bei den Blasen ist die Liste groß → klein sortiert, ein Stapel
 * ohne seine größten Blasen wäre keine Aussage mehr; bei Ringen und Strahlen entscheidet die
 * Anzeigereihenfolge, und dort sind die ersten Säulen die, die der Nutzer zuerst sehen will.
 */
export const toSlots = (
	state: FigureState,
	colors: ThemeColors,
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
			target: rays[0]?.targetLength ?? 0,
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
		target: targetRadius(state.metrics),
	};
};

interface FigureEngine {
	/** Uniforms neu setzen (Figur/Werte/Theme) und ggf. ein Standbild zeichnen. */
	update: (state: FigureState, colors: ThemeColors) => void;
	/** Render-Loop-Politik neu bewerten (Animation an/aus). */
	setLooping: (animated: boolean) => void;
	/** GPU-Ressourcen freigeben — gehört zum Effect-Cleanup dazu. */
	destroy: () => void;
}

/**
 * Baut den WebGL-Zustand auf. Wirft bei jedem Problem (kein Kontext, Compile-Fehler) — der Aufrufer
 * fängt und fällt auf das SVG zurück. So bleibt der Erfolgspfad frei von Sonderfällen.
 */
const createEngine = (canvas: HTMLCanvasElement): FigureEngine => {
	// `premultipliedAlpha`: Die Formen liegen halbtransparent übereinander; der Shader akkumuliert
	// premultipliziert, nur so bleibt die Überlagerung ohne dunklen Saum über der Karte.
	const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
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
	gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
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
		animated: uniform('u_animated'),
		rise: uniform('u_rise'),
		beat: uniform('u_beat'),
		figure: uniform('u_figure'),
		shadow: uniform('u_shadow'),
		colors: uniform('u_colors[0]'),
		phase: uniform('u_phase[0]'),
		swing: uniform('u_swing[0]'),
		rot: uniform('u_rot[0]'),
		dir: uniform('u_dir[0]'),
		count: uniform('u_count'),
		orbRadius: uniform('u_orb_radius[0]'),
		arcRadius: uniform('u_arc_radius[0]'),
		arcWidth: uniform('u_arc_width[0]'),
		arcSweep: uniform('u_arc_sweep[0]'),
		rayAngle: uniform('u_ray_angle[0]'),
		raySpread: uniform('u_ray_spread[0]'),
		rayLength: uniform('u_ray_length[0]'),
		target: uniform('u_target'),
		ringActive: uniform('u_ring_active'),
		ringStops: uniform('u_ring_stops[0]'),
		surface: uniform('u_surface'),
	};

	gl.uniform1f(locations.shadow, SHADOW_STRENGTH);
	// Premultiplizierte Ausgabe über transparenter Fläche.
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

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
	 * Selbst-stoppende Render-Maschine: Sie läuft nur, solange sich etwas bewegen darf und das Bild
	 * sichtbar ist — sonst genau ein Standbild je Zustandswechsel. Die Shader-Uhr zählt nur
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
		resize();
		gl.uniform1f(locations.time, shaderTime);
		/*
		 * Auftakt nur, solange die Loop ihn auch abspielen kann. Ein Standbild zeigt immer den
		 * **fertigen** Stand: Wird das Dashboard in einem Hintergrund-Tab aufgebaut, läuft nie ein
		 * Frame — ein an die Shader-Uhr gebundener Auftakt bliebe dort auf 0 stehen und das Bild wäre
		 * leer statt fertig.
		 */
		gl.uniform1f(locations.rise, looping ? Math.min(1, shaderTime / RISE_DURATION) : 1);
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
			lastFrame = 0; // Kein Aufholen nach der Pause — die Formen schwingen dort weiter, wo sie standen.
			frameRequest = requestAnimationFrame(frame);
		} else {
			if (frameRequest) cancelAnimationFrame(frameRequest);
			frameRequest = 0;
			draw(); // Standbild des letzten Zustands.
		}
	};

	/** Schreibt eine Zahlenliste in einen Uniform-Platz; ungenutzte Plätze bekommen `pad`. */
	const writeFloats = (location: WebGLUniformLocation | null, values: number[], pad = 0): void => {
		const array = new Float32Array(SLOTS).fill(pad);
		values.forEach((value, index) => (array[index] = value));
		gl.uniform1fv(location, array);
	};

	const update = (state: FigureState, colors: ThemeColors): void => {
		gl.uniform1i(locations.animated, animated ? 1 : 0);
		gl.uniform1f(locations.figure, FIGURE_INDEX[state.figure]);
		gl.uniform1f(locations.beat, state.beatSeconds);
		gl.uniform1f(locations.ringActive, state.activeTicks);
		gl.uniform3fv(locations.ringStops, new Float32Array(colors.ring.flat()));
		gl.uniform3fv(locations.surface, colors.surface);

		const slots = toSlots(state, colors);
		gl.uniform1f(locations.count, slots.colors.length);
		gl.uniform1f(locations.target, slots.target);

		const packed = new Float32Array(SLOTS * 3);
		slots.colors.forEach((color, index) => packed.set(color, index * 3));
		gl.uniform3fv(locations.colors, packed);

		writeFloats(
			locations.phase,
			slots.motions.map((motion) => motion.phase),
		);
		// Perioden der ungenutzten Plätze bleiben > 0: Der Shader teilt durch sie, auch wenn
		// `u_count` ihren Beitrag anschließend auf null maskiert.
		writeFloats(
			locations.swing,
			slots.motions.map((motion) => motion.swingPeriod),
			1,
		);
		writeFloats(
			locations.rot,
			slots.motions.map((motion) => motion.rotPeriod),
			1,
		);
		writeFloats(
			locations.dir,
			slots.motions.map((motion) => motion.rotDirection),
		);
		writeFloats(locations.orbRadius, slots.orbRadius);
		writeFloats(locations.arcRadius, slots.arcRadius, 1);
		writeFloats(locations.arcWidth, slots.arcWidth, 1);
		writeFloats(locations.arcSweep, slots.arcSweep);
		writeFloats(locations.rayAngle, slots.rayAngle);
		writeFloats(locations.raySpread, slots.raySpread, 1);
		writeFloats(locations.rayLength, slots.rayLength);

		if (!looping) draw();
	};

	// Pause, wenn das Bild den Viewport verlässt oder der Tab versteckt wird.
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

export const BalanceFigureGL = ({
	figure,
	metrics,
	activeTicks,
	beatSeconds,
	animated,
	ariaLabel,
	onGiveUp,
}: BalanceFigureGLProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<FigureEngine | null>(null);
	// Letzter Datenstand — nach einer Kontext-Wiederherstellung neu in den neuen Zustand spielen.
	const stateRef = useRef<FigureState & { animated: boolean }>({
		figure,
		metrics,
		activeTicks,
		beatSeconds,
		animated,
	});

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
				engine.setLooping(stateRef.current.animated);
				engine.update(stateRef.current, readThemeColors());
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

	// Loop-Politik folgt dem Animationsschalter (eigener Effekt: Wechsel ohne Datenänderung).
	useEffect(() => {
		engineRef.current?.setLooping(animated);
	}, [animated]);

	// Daten und Theme in die Uniforms — bei laufender Loop greift der nächste Frame, sonst Standbild.
	useEffect(() => {
		stateRef.current = { figure, metrics, activeTicks, beatSeconds, animated };
		engineRef.current?.update({ figure, metrics, activeTicks, beatSeconds }, readThemeColors());
	}, [figure, metrics, activeTicks, beatSeconds, animated]);

	/*
	 * Theme-Wechsel nachziehen: Die Farben stehen als Uniforms in der GPU, nicht als CSS — ein
	 * Wechsel von hell auf dunkel ändert für React nichts und ließe das Bild sonst in den alten
	 * Farben stehen, bis zufällig neue Daten kommen. `applyTheme` (`lib/theme.ts`) setzt
	 * `data-theme` auf `<html>`; daran hängt der Beobachter. Das SVG braucht das nicht — es färbt
	 * über die Custom Properties selbst.
	 */
	useEffect(() => {
		const observer = new MutationObserver(() => {
			engineRef.current?.update(stateRef.current, readThemeColors());
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => observer.disconnect();
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="balance-figure-canvas"
			role="img"
			aria-label={ariaLabel}
			data-testid="heart-balance-canvas"
		/>
	);
};
