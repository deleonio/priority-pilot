/**
 * Die Säulen-Farbrampe, an einer Stelle.
 *
 * Es gibt zwei Rampen für dieselben Säulen, und sie haben verschiedene Aufgaben:
 *
 * - `--pp-pillar-1…7` ist die **Lese-Rampe**: kontrastgeprüft, paarweise unterscheidbar auch unter
 *   Farbsehschwäche (`pillarPalette.test.ts`). Sie färbt alles, was neben Text steht — vor allem
 *   den Tupfer in der Legende.
 * - `--pp-pillar-neon-1…7` ist die **Bild-Rampe**: dieselben Hues in voller Leuchtkraft, in hellem
 *   wie dunklem Theme gleich. Sie färbt ausschließlich Flächen in den Balance-Bildern (Wasser,
 *   Blasen). Dort trägt Farbe keine Bedeutung allein — der Säulenname steht als Text in der
 *   Legende daneben (Relief-Regel, ux-design.md §2, Regel 4).
 *
 * Beide Rampen haben **sieben** Ränge. Ab der 8. Säule wird nicht weiter eingefärbt (Regel 3):
 * Dann bleibt es bei der Basisklasse, die neutral färbt, und der Name in der Legende trägt die
 * Zuordnung allein. Weil alle vier Balance-Bilder und beide Legenden durch dieselbe Funktion
 * gehen, kann diese Grenze nicht an einer Stelle abdriften.
 */

/** Höchster Rang beider Rampen (`--pp-pillar-1…7`, `--pp-pillar-neon-1…7`). */
export const PILLAR_RAMP_SIZE = 7;

/**
 * Hängt an eine Basisklasse den Rampen-Modifier ihres Farbrangs — `heart-water` wird zu
 * `heart-water heart-water--3`. Jenseits der Rampe bleibt es bei der Basisklasse.
 */
export const rampClass = (base: string, colorIndex: number): string =>
	colorIndex < PILLAR_RAMP_SIZE ? `${base} ${base}--${colorIndex + 1}` : base;
