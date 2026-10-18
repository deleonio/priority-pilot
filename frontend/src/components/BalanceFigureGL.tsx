import { useEffect, useRef } from 'react';
import fragmentSource from './balance-figure.frag?raw';
import { auftaktStand, auftaktWechselt } from '../lib/balanceFigure';
import type { BalanceMetrics } from '../lib/balanceMetric';
import type { FigureKind } from '../lib/balanceVariant';
import { PILLAR_RAMP_SIZE } from '../lib/pillarRamp';
import {
	bindFullscreenTriangle,
	buildProgram,
	createResize,
	createUniform,
	createWebGLContext,
	parseColor,
	SLOTS,
	toSlots,
} from '../lib/webglStage';

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
 * **Warum ein Programm für alle Figuren:** Sie zeigen dieselben Zahlen und teilen sich Zifferblatt,
 * Auftakt, Ruhepuls und Material-Grundlage. Ein Programm je Figur wäre dieselbe Umgebung mehrfach,
 * mit ebenso vielen Gelegenheiten, auseinanderzulaufen; die Figur ist deshalb ein Uniform
 * (`u_figure`).
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
	/** Welche Figur gezeichnet wird. */
	figure: FigureKind;
	/** Die Kennzahlen je Säule plus die Soll-Marke. */
	metrics: BalanceMetrics;
	/** Zahl der leuchtenden Striche (0–100) — dieselbe Zahl wie die große Prozentanzeige. */
	activeTicks: number;
	/** Sekunden je Ruhepuls-Schlag; ruhiger, je ausgewogener das Bild. */
	beatSeconds: number;
	/** Bewegung erlauben (beide Animationsschalter + OS-Einstellung). */
	animated: boolean;
	/**
	 * Freigabe des Auftakts: Fehlt der echte Balance-Stand noch (die Antwort von
	 * `GET /scores/balance`), hält die Engine den Auftakt auf 0 — das Zifferblatt bleibt leer,
	 * statt erst auf den lokalen Notwert zu wachsen und dort die Zielmarke zu wechseln.
	 * `undefined` = freigegeben (Aufrufe ohne Server-Kopplung).
	 */
	auftaktBereit?: boolean;
	/** Zugängliches Label der Grafik (dieselbe Formel wie das SVG-`aria-label`). */
	ariaLabel: string;
	/** Wird gerufen, wenn WebGL nicht aufgebaut werden kann — die Bühne fällt aufs SVG zurück. */
	onGiveUp: () => void;
}

/** Stärke des Kontaktschattens unter jeder Blase (0–0.3). */
const SHADOW_STRENGTH = 0.06;

/** Reihenfolge der Figuren im Shader (`u_figure`). */
const FIGURE_INDEX: Record<FigureKind, number> = {
	blasen: 0,
	ringe: 1,
	strahlen: 2,
	scheiben: 3,
	bluete: 4,
	kristall: 5,
	segmente: 6,
	zeiger: 7,
	bahnen: 8,
};

/** Stützstellen der Ring-Farbrampe in `app.css` (`--pp-balance-ring-0` … `-100`). */
const RING_STOPS = [0, 25, 50, 75, 100] as const;

type Rgb = [number, number, number];

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

interface FigureEngine {
	/** Uniforms neu setzen (Figur/Werte/Theme) und ggf. ein Standbild zeichnen. */
	update: (state: FigureState, colors: ThemeColors) => void;
	/** Loop-Politik neu bewerten (Animation an/aus). */
	setLooping: (animated: boolean) => void;
	/** Auftakt freigeben oder erneut zurückhalten; die Freigabe startet ihn in dieser Sekunde. */
	setAuftaktBereit: (bereit: boolean) => void;
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
	const gl = createWebGLContext(canvas, { alpha: true, premultipliedAlpha: true, antialias: false });
	const program = buildProgram(gl, fragmentSource);
	gl.useProgram(program);
	const buffer = bindFullscreenTriangle(gl, program);
	const uniform = createUniform(gl, program);
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
		wedgeMid: uniform('u_wedge_mid[0]'),
		wedgeHalf: uniform('u_wedge_half[0]'),
		wedgeInner: uniform('u_wedge_inner[0]'),
		wedgeOuter: uniform('u_wedge_outer[0]'),
		target: uniform('u_target'),
		ringActive: uniform('u_ring_active'),
		ringStops: uniform('u_ring_stops[0]'),
		surface: uniform('u_surface'),
	};

	gl.uniform1f(locations.shadow, SHADOW_STRENGTH);
	// Premultiplizierte Ausgabe über transparenter Fläche.
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

	const resize = createResize(gl, canvas, locations.resolution);

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
	// Auftakt: gehalten, bis der erste echte Stand freigegeben wird — dann beginnt er in dieser
	// Shader-Sekunde und läuft einmalig auf den echten Wert statt auf einen lokalen Notwert.
	let riseStart = 0;
	let aufgeschoben = true;

	const draw = (): void => {
		resize();
		gl.uniform1f(locations.time, shaderTime);
		/*
		 * Auftakt nur, solange die Loop ihn auch abspielen kann. Ein Standbild zeigt immer den
		 * **fertigen** Stand: Wird das Dashboard in einem Hintergrund-Tab aufgebaut, läuft nie ein
		 * Frame — ein an die Shader-Uhr gebundener Auftakt bliebe dort auf 0 stehen und das Bild wäre
		 * leer statt fertig. Nur der gehaltene Auftakt (echter Stand fehlt) lässt auch das Standbild
		 * leer — es gibt noch nichts Fertiges zu zeigen.
		 */
		gl.uniform1f(locations.rise, auftaktStand(shaderTime, riseStart, !aufgeschoben, looping));
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
		writeFloats(locations.wedgeMid, slots.wedgeMid);
		writeFloats(locations.wedgeHalf, slots.wedgeHalf);
		writeFloats(locations.wedgeInner, slots.wedgeInner, 1);
		writeFloats(locations.wedgeOuter, slots.wedgeOuter);

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
		setAuftaktBereit: (bereit) => {
			if (!auftaktWechselt(aufgeschoben, bereit)) return;
			if (bereit) riseStart = shaderTime; // Der Auftakt beginnt in dieser Sekunde.
			aufgeschoben = !bereit;
			if (!looping) draw(); // Standbild nachziehen; die laufende Loop greift im nächsten Frame.
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
	auftaktBereit,
	ariaLabel,
	onGiveUp,
}: BalanceFigureGLProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<FigureEngine | null>(null);
	// Letzter Datenstand — nach einer Kontext-Wiederherstellung neu in den neuen Zustand spielen.
	const stateRef = useRef<FigureState & { animated: boolean; auftaktBereit: boolean }>({
		figure,
		metrics,
		activeTicks,
		beatSeconds,
		animated,
		auftaktBereit: auftaktBereit !== false,
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
				engine.setAuftaktBereit(stateRef.current.auftaktBereit);
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

	// Auftakt-Politik: Ohne Bewegung zeigt das Standbild sofort den fertigen Stand — zurückgehalten
	// wird nur bei laufender Animation, bis der erste echte Stand freigegeben wird.
	useEffect(() => {
		stateRef.current.auftaktBereit = auftaktBereit !== false;
		engineRef.current?.setAuftaktBereit(!(auftaktBereit === false && animated));
	}, [auftaktBereit, animated]);

	// Daten und Theme in die Uniforms — bei laufender Loop greift der nächste Frame, sonst Standbild.
	useEffect(() => {
		stateRef.current = { figure, metrics, activeTicks, beatSeconds, animated, auftaktBereit: auftaktBereit !== false };
		engineRef.current?.update({ figure, metrics, activeTicks, beatSeconds }, readThemeColors());
	}, [figure, metrics, activeTicks, beatSeconds, animated, auftaktBereit]);

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
