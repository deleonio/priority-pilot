import { TaskStatus } from 'client';
import { readAnimationsEnabled } from './animations';

/**
 * #1169: Konfetti-Regen als Erfolgs-Feedback beim Erledigt-Toggle („…"-Popover).
 * Modul-Vertrag: `docs/spec/issue-1169.md` — die Tests adressieren ausschließlich den
 * Overlay-Knoten `data-testid="confetti-overlay"`, die Render-Technik (Eigenbau-Canvas,
 * feste Partikelzahl + requestAnimationFrame) ist Umsetzungsentscheidung der Impl-Phase.
 */

/** Sichtbare Laufzeit (AK2: „ca. 5 Sekunden", Toleranzfenster 4–6 s). */
const CONFETTI_DURATION_MS = 5_000;

/** Feste, moderate Partikelzahl (KI-UX Mobile-First): genug Volumen, ohne auf Mobil zu ruckeln (AK4). */
const PARTICLE_COUNT = 120;

/** Abgerollte Zeitscheibe pro Frame — verhindert Partikel-„Teleportieren" nach Tab-Pause (rAF steht dann still). */
const MAX_FRAME_MS = 32;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Farbtokens (KI-UX Design-Sprache): Rollen statt Regenbogen-Hardcodes — funktioniert in hell UND dunkel. */
const COLOR_TOKENS = ['--pp-status-done', '--pp-success', '--pp-pillar-1', '--pp-pillar-3', '--pp-pillar-4'];

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	color: string;
	angle: number;
	spin: number;
}

/**
 * Richtungsentcheidung (#1169 AK3): gefeiert wird nur der Übergang AUF `Done` von einem
 * nicht-Done-Status — das Wieder-Öffnen (`Done→Open`) und Status-Wechsel ohne Done-Ziel
 * feiern nicht. Bewusst reine Funktion ohne `matchMedia` (TF3-Vorgabe der Spec).
 */
export function shouldCelebrateDone(from: TaskStatus, to: TaskStatus): boolean {
	return from !== TaskStatus.Done && to === TaskStatus.Done;
}

/** Liest die Partikelfarben aus den Rollen-Tokens des Dokuments (Fallback: status-done-Grün). */
const readPalette = (): string[] => {
	const styles = getComputedStyle(document.documentElement);
	const palette = COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim()).filter((color) => color !== '');
	return palette.length > 0 ? palette : ['#1a7f37'];
};

const createParticles = (width: number, height: number, palette: string[]): Particle[] =>
	Array.from({ length: PARTICLE_COUNT }, () => ({
		x: Math.random() * width,
		// Start über dem Viewport, damit der Regen von Beginn an „fällt" (auch bei Respawn).
		y: Math.random() * -height,
		vx: (Math.random() - 0.5) * 60,
		vy: 120 + Math.random() * 160,
		size: 5 + Math.random() * 6,
		color: palette[Math.floor(Math.random() * palette.length)] ?? '#1a7f37',
		angle: Math.random() * Math.PI,
		spin: (Math.random() - 0.5) * 6,
	}));

/**
 * Startet einen Konfetti-Regen über den gesamten Viewport (AK1) und räumt sich nach
 * `CONFETTI_DURATION_MS` selbst aus dem DOM ab (AK2). Das Overlay ist rein dekorativ
 * (`aria-hidden`, KI-UX A11y) und fängt keine Klicks (`pointer-events: none`, Muster
 * `update-prompt` in `app.css:1765` — AK5). Bei `prefers-reduced-motion: reduce` wird
 * nichts erzeugt und `false` zurückgegeben (AK6) — die globale CSS-Regel (`app.css:187`)
 * klemmt nur Motion-Token, sie stoppt KEINE rAF-Animation, deshalb die JS-Abfrage. Der
 * Check bleibt unabhängig vom Master-Schalter „Animationen" wirksam (#1183 AK4: reduce hat
 * Vorrang, auch bei eingeschaltetem Schalter).
 *
 * @returns `true`, wenn der Effekt gestartet wurde; `false` bei reduced-motion oder ausgeschaltetem Schalter.
 */
export function launchConfetti(): boolean {
	if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
		return false;
	}

	// #1183 AK2/AK3: Master-Schalter „Animationen" (localStorage, Default aus) — Konfetti und
	// künftige dekorative Animationen laufen nur bei eingeschaltetem Schalter. Der Aufrufer
	// (App.tsx) bleibt bewusst unverändert, das Gate sitzt hier zentral.
	if (!readAnimationsEnabled()) {
		return false;
	}

	const overlay = document.createElement('div');
	overlay.dataset.testid = 'confetti-overlay';
	overlay.setAttribute('aria-hidden', 'true');
	// Inline-Styles statt app.css: das Overlay ist flüchtig und tokenfrei positioniert (KI-UX).
	const overlayStyle = overlay.style;
	overlayStyle.position = 'fixed';
	overlayStyle.inset = '0';
	overlayStyle.zIndex = '500'; // unter dem UpdatePrompt (1000); pointer-events macht die Schicht unkritisch.
	overlayStyle.pointerEvents = 'none';
	overlayStyle.overflow = 'hidden';

	// Canvas auf Viewportgröße (nicht Dokumentgröße — lange Listen würden sonst Memory/Ruckeln verursachen).
	const canvas = document.createElement('canvas');
	const width = window.innerWidth;
	const height = window.innerHeight;
	const scale = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = Math.round(width * scale);
	canvas.height = Math.round(height * scale);
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	overlay.appendChild(canvas);
	document.body.appendChild(overlay);

	const context = canvas.getContext('2d');
	let frame = 0;
	if (context !== null) {
		context.scale(scale, scale);
		const particles = createParticles(width, height, readPalette());
		let last = performance.now();
		const tick = (now: number): void => {
			// dt klemmen: nach Hintergrund-Tab-Pause (rAF stand still) nicht das gesamte Fenster nachfeuern.
			const dt = Math.min(now - last, MAX_FRAME_MS) / 1_000;
			last = now;
			context.clearRect(0, 0, width, height);
			for (const particle of particles) {
				particle.x += particle.vx * dt;
				particle.y += particle.vy * dt;
				particle.angle += particle.spin * dt;
				if (particle.y - particle.size > height) {
					// Respawn oben — regnet bis zum Timeout durchgängig statt sich zu leeren.
					particle.y = -particle.size;
					particle.x = Math.random() * width;
				}
				context.save();
				context.translate(particle.x, particle.y);
				context.rotate(particle.angle);
				context.fillStyle = particle.color;
				context.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
				context.restore();
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
	}

	// Selbst-beendend (AK2): Overlay-Knoten aus dem DOM entfernen — nicht nur unsichtbar machen.
	window.setTimeout(() => {
		cancelAnimationFrame(frame);
		overlay.remove();
	}, CONFETTI_DURATION_MS);
	return true;
}
